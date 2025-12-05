const fs = require('fs');
const path = require('path');

const CLANS_FILE = path.resolve(__dirname, '../data/clans.json');
const USERS_FILE = path.resolve(__dirname, '../data/users.json');
const CLAN_CONTRIBUTIONS_FILE = path.resolve(__dirname, '../data/clancontributions.json');

const COMMON_MATERIALS = ['wood', 'iron', 'copper', 'gun_powder', 'rope', 'metal'];

// Rare materials with their tier requirements
const RARE_MATERIALS = {
    rare_resin: { tier: 4, chance: 0.5 },
    lightning_resin: { tier: 5, chance: 0.5 },
    mythical_sand: { tier: 6, chance: 0.5 },
    holy_waters: { tier: 7, chance: 0.5 },
    a_piece_of_earth: { tier: 8, chance: 0.5 },
    phazal: { tier: 9, chance: 0.5 }
};

function handleClanMaterialDrop(userId, currentTier = 1) {
    if (!fs.existsSync(USERS_FILE) || !fs.existsSync(CLANS_FILE)) return null;

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const clans = JSON.parse(fs.readFileSync(CLANS_FILE, 'utf8'));

    const user = users[userId];
    if (!user || !user.clan || user.clan === 'None' || !clans[user.clan]) return null;

    const clanName = user.clan;
    const clan = clans[clanName];

    const drops = {};

    // --- COMMON MATERIALS ---
    // Scale quantity based on tier: Math.floor(1 + (currentTier * 0.5))
    const tierMultiplier = Math.floor(1 + (currentTier * 0.5));
    const numDrops = 3;

    // Shuffle array to pick random distinct items
    const shuffled = [...COMMON_MATERIALS].sort(() => 0.5 - Math.random());
    const selectedMaterials = shuffled.slice(0, numDrops);

    for (const mat of selectedMaterials) {
        drops[mat] = tierMultiplier;
    }

    // --- RARE MATERIALS ---
    // Each rare material has a 0.5% drop chance if tier threshold is met
    for (const [material, config] of Object.entries(RARE_MATERIALS)) {
        if (currentTier >= config.tier) {
            // Roll for drop (0-100 range, need <= 0.5 to succeed)
            const roll = Math.random() * 100;
            if (roll <= config.chance) {
                drops[material] = 1;
            }
        }
    }

    // Update Clan Data
    if (!clan.materials) clan.materials = {};

    for (const [mat, qty] of Object.entries(drops)) {
        clan.materials[mat] = (clan.materials[mat] || 0) + qty;
    }

    // Save Clans
    fs.writeFileSync(CLANS_FILE, JSON.stringify(clans, null, 4));

    // --- Update Clan Contributions ---
    let contributions = {};
    if (fs.existsSync(CLAN_CONTRIBUTIONS_FILE)) {
        try {
            contributions = JSON.parse(fs.readFileSync(CLAN_CONTRIBUTIONS_FILE, 'utf8'));
        } catch (e) { console.error("Error reading clan contributions:", e); }
    }

    if (!contributions[clanName]) contributions[clanName] = {};
    if (!contributions[clanName][userId]) contributions[clanName][userId] = {};

    for (const [mat, qty] of Object.entries(drops)) {
        contributions[clanName][userId][mat] = (contributions[clanName][userId][mat] || 0) + qty;
    }

    fs.writeFileSync(CLAN_CONTRIBUTIONS_FILE, JSON.stringify(contributions, null, 4));

    return drops;
}

module.exports = { handleClanMaterialDrop };
