const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.cache = new Map();
        this.paths = {
            users: path.resolve(__dirname, '../data/users.json'),
            players: path.resolve(__dirname, '../data/players.json'),
            jutsus: path.resolve(__dirname, '../data/jutsus.json'),
            combos: path.resolve(__dirname, '../data/combos.json')
        };
        this.isDirty = new Set();
        this.loadAll();

        // Auto-save every 5 minutes just in case, though we will write-through
        setInterval(() => this.saveDirty(), 5 * 60 * 1000);
    }

    loadAll() {
        for (const [key, filePath] of Object.entries(this.paths)) {
            try {
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath, 'utf8');
                    this.cache.set(key, JSON.parse(data));
                    console.log(`[DataManager] Loaded ${key} from ${filePath}`);
                } else {
                    this.cache.set(key, {});
                    console.log(`[DataManager] ${key} file not found, initialized empty.`);
                }
            } catch (err) {
                console.error(`[DataManager] Error loading ${key}:`, err);
                this.cache.set(key, {});
            }
        }
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, data) {
        this.cache.set(key, data);
        this.isDirty.add(key);
        this.saveToFile(key); // Immediate write-through for safety
    }

    saveToFile(key) {
        const filePath = this.paths[key];
        const data = this.cache.get(key);
        if (filePath && data) {
            try {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                this.isDirty.delete(key);
            } catch (err) {
                console.error(`[DataManager] Error saving ${key}:`, err);
            }
        }
    }

    saveDirty() {
        if (this.isDirty.size === 0) return;
        console.log(`[DataManager] Periodic save for: ${Array.from(this.isDirty).join(', ')}`);
        for (const key of this.isDirty) {
            this.saveToFile(key);
        }
    }

    // Helper to get specialized data like a specific player
    getPlayer(userId) {
        const players = this.get('players');
        return players[userId];
    }

    updatePlayer(userId, updateFn) {
        const players = this.get('players');
        if (players[userId]) {
            updateFn(players[userId]);
            this.set('players', players);
        }
    }

    getUser(userId) {
        const users = this.get('users');
        return users[userId];
    }

    updateUser(userId, updateFn) {
        const users = this.get('users');
        if (users[userId]) {
            updateFn(users[userId]);
            this.set('users', users);
        }
    }
}

// Singleton instance
const dataManager = new DataManager();
module.exports = dataManager;
