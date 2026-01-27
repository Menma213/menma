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
        lastSummon: 0
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
    { name: 'Common', ovrThreshold: 0, color: '#95a5a6' },
    { name: 'Uncommon', ovrThreshold: 30, color: '#2ecc71' },
    { name: 'Rare', ovrThreshold: 45, color: '#3498db' },
    { name: 'Epic', ovrThreshold: 75, color: '#9b59b6' },
    { name: 'Legendary', ovrThreshold: 95, color: '#f1c40f' },
    { name: 'Mythic', ovrThreshold: 115, color: '#e74c3c' }
];

function calculateStats(character) {
    const favourites = character.favourites || 0;
    const mediaPopularity = character.media.nodes[0]?.popularity || 0;

    // Purely popularity-based score (No randomness)
    // Scale: Favorites are weighted heavily (x8), Series popularity provides the base.
    const score = (favourites * 8) + mediaPopularity;
    let ovr = Math.floor(Math.pow(score, 0.38) * 0.82);

    // Cap at 120 (absolute peak)
    if (ovr > 120) ovr = 120;
    if (ovr < 1) ovr = 1;

    // Determine rarity based on OVR brackets
    let rarity = RARITY_LEVELS[0];
    for (let i = RARITY_LEVELS.length - 1; i >= 0; i--) {
        if (ovr >= RARITY_LEVELS[i].ovrThreshold) {
            rarity = RARITY_LEVELS[i];
            break;
        }
    }

    return {
        rarity: rarity.name,
        color: rarity.color,
        ovr: ovr,
        score: score
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
                ...stats
            };
        }
    } catch (e) {
        console.error('Error fetching character from AniList:', e);
    }
    return null;
}

module.exports = {
    getPlayerData,
    savePlayerData,
    fetchRandomCharacter,
    RARITY_LEVELS
};
