const fs = require('fs');
const path = require('path');

const PLAYER_DATA_DIR = path.join(__dirname, '..', 'data', 'player_data');

// Ensure directory exists
if (!fs.existsSync(PLAYER_DATA_DIR)) {
    fs.mkdirSync(PLAYER_DATA_DIR, { recursive: true });
}

function getPlayerPath(userId) {
    return path.join(PLAYER_DATA_DIR, `${userId}.txt`);
}

function getPlayerData(userId) {
    const filePath = getPlayerPath(userId);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`Error reading player data for ${userId}:`, e);
    }

    // Return default structure if not found
    return {
        money: 1000,
        packs: 0,
        collection: {},
        decks: [[], [], [], [], []],
        decknames: ["", "", "", "", ""],
        selectedDeck: 0,
        lastSummon: 0,
        essence: 0
    };
}

function savePlayerData(userId, data) {
    const filePath = getPlayerPath(userId);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error saving player data for ${userId}:`, e);
        return false;
    }
}

const RARITY_LEVELS = [
    { name: 'Common', chance: 0.5, color: '#95a5a6', stats: { hp: [1000, 5000], power: [100, 500], defense: [100, 500] } },
    { name: 'Uncommon', chance: 0.3, color: '#2ecc71', stats: { hp: [5000, 20000], power: [500, 2000], defense: [500, 2000] } },
    { name: 'Rare', chance: 0.15, color: '#3498db', stats: { hp: [20000, 50000], power: [2000, 5000], defense: [2000, 5000] } },
    { name: 'Epic', chance: 0.04, color: '#9b59b6', stats: { hp: [50000, 100000], power: [5000, 10000], defense: [5000, 10000] } },
    { name: 'Legendary', chance: 0.009, color: '#f1c40f', stats: { hp: [100000, 250000], power: [10000, 25000], defense: [10000, 25000] } },
    { name: 'Mythic', chance: 0.001, color: '#e74c3c', stats: { hp: [250000, 500000], power: [25000, 50000], defense: [25000, 50000] } }
];

function calculateStats(character) {
    const favourites = character.favourites || 0;
    const mediaPopularity = character.media.nodes[0]?.popularity || 0;

    // Determine rarity based on popularity/favourites score or random?
    // User said "Summon is luck based".
    // Let's use a weighted random selection for rarity in summon, 
    // BUT user also said "higher rarity = better stats".
    // For now, let's map popularity to rarity somewhat, but keep it mostly random for "summon" if we follow "luck based".
    // Actually, "luck based" usually implies RNG. 
    // Let's implement a random rarity selector.

    const rand = Math.random();
    let cumulativeChance = 0;
    let selectedRarity = RARITY_LEVELS[0];

    // Weighted random rarity
    for (const rarity of RARITY_LEVELS) {
        cumulativeChance += rarity.chance;
        if (rand < cumulativeChance) {
            selectedRarity = rarity;
            break; // Found it
        }
    }
    // If we somehow didn't pick (due to precision), pick the last one or stay Common.
    // Actually, the loop above works if mapped correctly. 
    // Wait, 0.5 + 0.3 + 0.15 + 0.04 + 0.009 + 0.001 = 1.0. Correct.

    // Calculate stats based on range
    const getStat = (range) => Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];

    return {
        rarity: selectedRarity.name,
        color: selectedRarity.color,
        hp: getStat(selectedRarity.stats.hp),
        power: getStat(selectedRarity.stats.power),
        defense: getStat(selectedRarity.stats.defense),
        score: (favourites * 8) + mediaPopularity // Keep score for internal reference if needed
    };
}

async function fetchRandomCharacter() {
    // Generate a random page to pick from a wide pool of characters
    // Page 1-5000 covers 5000 characters.
    const randomPage = Math.floor(Math.random() * 5000) + 1;

    const query = `
    query ($page: Int) {
      Page (page: $page, perPage: 1) {
        characters {
          id
          favourites
          name {
            full
          }
          image {
            large
          }
          media (perPage: 1, sort: POPULARITY_DESC) {
            nodes {
              popularity
              title {
                romaji
              }
            }
          }
        }
      }
    }
    `;

    const variables = {
        page: randomPage
    };

    const url = 'https://graphql.anilist.co';
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    };

    try {
        const response = await fetch(url, options);
        const json = await response.json();
        if (json.data && json.data.Page.characters.length > 0) {
            const character = json.data.Page.characters[0];
            const stats = calculateStats(character);
            return {
                ...character,
                ...stats,
                rarity: stats.rarity, // Ensure rarity is passed
                hp: stats.hp,
                power: stats.power,
                defense: stats.defense
            };
        }
    } catch (e) {
        console.error('Error fetching character from AniList:', e);
    }
    return null;
}

// Cache for Top 100
let TOP_100_CACHE = null;
let CACHE_TIME = 0;

async function fetchTop100Characters() {
    // Return cached if fresh (1 hour)
    if (TOP_100_CACHE && (Date.now() - CACHE_TIME < 3600000)) {
        return TOP_100_CACHE;
    }

    const query = `
    query {
      Page(perPage: 100) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full }
          favourites
          image { large }
          media(perPage: 1, sort: POPULARITY_DESC) {
            nodes {
              popularity
              title { romaji }
            }
          }
        }
      }
    }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query })
        });

        const json = await response.json();
        if (json.data && json.data.Page.characters) {
            TOP_100_CACHE = json.data.Page.characters.map(char => {
                const stats = calculateStats(char); // Generate stats for shop view
                return { ...char, ...stats };
            });
            CACHE_TIME = Date.now();
            return TOP_100_CACHE;
        }
    } catch (e) {
        console.error('Error fetching Top 100:', e);
    }
    return [];
}

const CHARACTER_DB_PATH = path.join(__dirname, '..', 'data', 'top100anime_characters.json');

let CHARACTER_DB = [];

function loadCharacterDatabase() {
    try {
        if (fs.existsSync(CHARACTER_DB_PATH)) {
            const data = fs.readFileSync(CHARACTER_DB_PATH, 'utf8');
            CHARACTER_DB = JSON.parse(data);
            console.log(`Loaded ${CHARACTER_DB.length} characters from database.`);
        } else {
            console.warn('Character database file not found.');
            CHARACTER_DB = [];
        }
    } catch (e) {
        console.error('Error loading character database:', e);
        CHARACTER_DB = [];
    }
    return CHARACTER_DB;
}

function getRandomCharacterFromDB() {
    if (CHARACTER_DB.length === 0) {
        loadCharacterDatabase();
    }
    if (CHARACTER_DB.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * CHARACTER_DB.length);
    return CHARACTER_DB[randomIndex];
}

module.exports = {
    getPlayerData,
    savePlayerData,
    fetchRandomCharacter,
    fetchTop100Characters,
    loadCharacterDatabase,
    getRandomCharacterFromDB,
    RARITY_LEVELS
};
