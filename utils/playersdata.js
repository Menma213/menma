const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '../data/players.json');

// Load player data from the file
function loadPlayerData() {
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataFilePath));
}

// Save player data to the file
function savePlayerData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

// Get a player's data, create if not exists
function getPlayer(userId) {
    let players = loadPlayerData();
    if (!players[userId]) {
        players[userId] = {
            level: 1,
            exp: 0,
            wins: 0,
            losses: 0,
            rankedPoints: 0,
            clan: 'None',
            bloodline: 'None',
            mentor: 'None',
            rank: 'Genin',
            money: 1000, // Starting money
            battleStats: {
                health: 100,
                power: 10,
                defense: 5,
                chakra: 10
            },
            jutsu: [],
            inventory: []
        };
        savePlayerData(players);
    }
    return players[userId];
}

// Update a player's data and save it
function updatePlayer(userId, newData) {
    let players = loadPlayerData();
    players[userId] = { ...players[userId], ...newData };
    savePlayerData(players);
}

// Add EXP to a player
function addExp(userId, amount) {
    let player = getPlayer(userId);
    player.exp += amount;
    updatePlayer(userId, player);
}

// Deduct money from a player
function deductMoney(userId, amount) {
    let player = getPlayer(userId);
    if (player.money >= amount) {
        player.money -= amount;
        updatePlayer(userId, player);
        return true;
    }
    return false; // Not enough money
}

module.exports = {
    getPlayer,
    updatePlayer,
    addExp,
    deductMoney
};
