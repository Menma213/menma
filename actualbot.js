const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');

// Check for node-llama-cpp dependency
try {
    require.resolve('node-llama-cpp');
    console.log("✅ dependency 'node-llama-cpp' found.");
} catch (e) {
    console.error("❌ dependency 'node-llama-cpp' not found!");
}

// Add this block at the very top, before any require('dotenv').config()
// Support for .env.path file
const envPathFile = path.join(__dirname, '.env.path');
let envFile = '.env';
if (fs.existsSync(envPathFile)) {
    const customEnvPath = fs.readFileSync(envPathFile, 'utf8').trim();
    if (customEnvPath) envFile = customEnvPath;
}
require('dotenv').config({ path: path.resolve(__dirname, envFile) });

// Load environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error("❌ Missing bot token or client ID in the .env file!");
    process.exit(1);
}

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // REMOVED: GatewayIntentBits.MessageContent is removed to comply with the request.
        // The bot will still receive MessageCreate events for its own messages or those without
        // the content intent, but content from other users' messages will be missing.
    ]
});

client.commands = new Collection();

// Add global prompt counter
const userPromptCounts = {};

// Money Logging System
const lastUserInteraction = {};
const MONEY_LOG_LIMIT = 2000000;
const MONEY_LOG_CHANNEL = '1381278641144467637';
const MONEY_LOG_FILE = path.join(__dirname, 'menma', 'data', 'money_gain_logs.txt');
const PLAYERS_FILE = path.join(__dirname, 'menma', 'data', 'players.json');
let lastPlayersState = {};

// Initial load of players state
try {
    if (fs.existsSync(PLAYERS_FILE)) {
        lastPlayersState = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    }
} catch (e) {
    console.error('[MoneyMonitor] Failed initial load:', e);
}

function monitorMoneyGains() {
    try {
        if (!fs.existsSync(PLAYERS_FILE)) return;
        const currentData = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));

        for (const userId in currentData) {
            const oldMoney = lastPlayersState[userId]?.money || 0;
            const newMoney = currentData[userId]?.money || 0;
            const gain = newMoney - oldMoney;

            if (gain >= MONEY_LOG_LIMIT) {
                const interaction = lastUserInteraction[userId];
                const now = Date.now();
                let source = "Unknown / System";

                if (interaction && (now - interaction.timestamp < 120000)) { // 2 minute window
                    source = `Command: /${interaction.command}`;
                }

                const logEntry = ` **MONEY (Prod)**\n` +
                    `**User:** <@${userId}> (${userId})\n` +
                    `**Gain:** $${gain.toLocaleString()}\n` +
                    `**New Balance:** $${newMoney.toLocaleString()}\n` +
                    `**Source:** ${source}\n` +
                    `**Time:** ${new Date().toLocaleString()}`;

                // Log to Discord
                client.channels.fetch(MONEY_LOG_CHANNEL).then(channel => {
                    if (channel) channel.send(logEntry);
                }).catch(err => console.error('[MoneyMonitor] Discord Log Error:', err));

                // Log to Text File
                const fileEntry = `[${new Date().toISOString()}] User: ${userId}, Gain: ${gain}, NewBalance: ${newMoney}, Source: ${source}\n`;
                fs.appendFileSync(MONEY_LOG_FILE, fileEntry);
            }
        }
        lastPlayersState = JSON.parse(JSON.stringify(currentData));
    } catch (err) {
        // Silently fail to avoid disrupting the bot
    }
}

// Poll every 5 seconds for changes
setInterval(monitorMoneyGains, 5000);

// Load all command files
const commandsPath = path.join(__dirname, 'menma/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (!command.data?.name || !command.execute) {
            console.error(`⚠️ Command "${file}" is missing required properties.`);
            continue;
        }
        client.commands.set(command.data.name, command);

        // Register event-based commands (like admincommand102.js)
        if (typeof command.setup === 'function') {
            // Pass client and userPromptCounts to setup
            command.setup(client, userPromptCounts);
        }
    } catch (error) {
        console.error(`❌ Error loading command "${file}":`, error);
    }
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');

        // Only include commands with a valid .data.toJSON method
        const commands = Array.from(client.commands.values())
            .filter(cmd => cmd.data && typeof cmd.data.toJSON === 'function')
            .map(cmd => cmd.data.toJSON());
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
})();

// ensure data dir exists and prepare errors file path
const dataDir = path.join(__dirname, 'menma', 'data');
const errorsFile = path.join(dataDir, 'errors.json');

function ensureDataDir() {
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        console.error('Failed to ensure data dir for errors:', e);
    }
}

/**
 * Record an error object with context into menma/data/errors.json
 * Keeps a JSON array of error entries.
 */
function recordErrorToJson(err, context = {}) {
    try {
        ensureDataDir();
        let existing = [];
        if (fs.existsSync(errorsFile)) {
            try {
                existing = JSON.parse(fs.readFileSync(errorsFile, 'utf8')) || [];
            } catch (e) {
                // if parsing fails, back up the corrupted file and start fresh
                try {
                    fs.copyFileSync(errorsFile, errorsFile + '.corrupt.' + Date.now());
                } catch { }
                existing = [];
            }
        }
        const entry = {
            id: Date.now() + '-' + Math.floor(Math.random() * 10000),
            timestamp: new Date().toISOString(),
            message: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : null,
            context,
            process: {
                pid: process.pid,
                argv: process.argv,
                node: process.version,
            },
            env: {
                NODE_ENV: process.env.NODE_ENV || null
            }
        };
        existing.push(entry);
        fs.writeFileSync(errorsFile, JSON.stringify(existing, null, 2));
        return entry;
    } catch (writeErr) {
        // if even logging to file fails, at least log to console
        console.error('Failed to record error to JSON:', writeErr);
    }
}

// Global handlers to capture crashes and unhandled rejections
process.on('uncaughtException', (err) => {
    try {
        console.error('Uncaught Exception, recording and exiting:', err);
        recordErrorToJson(err, { type: 'uncaughtException' });
    } catch (e) {
        console.error('Error while recording uncaughtException:', e);
    } finally {
        // give the logger a moment, then exit
        setTimeout(() => process.exit(1), 500);
    }
});

process.on('unhandledRejection', (reason) => {
    try {
        console.error('Unhandled Rejection, recording:', reason);
        recordErrorToJson(reason, { type: 'unhandledRejection' });
    } catch (e) {
        console.error('Error while recording unhandledRejection:', e);
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Track interaction for money logging
    lastUserInteraction[interaction.user.id] = {
        command: interaction.commandName,
        timestamp: Date.now()
    };

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing "${interaction.commandName}":`, error);
        try {
            // record command execution errors to json for post-mortem
            recordErrorToJson(error, {
                type: 'interactionExecuteError',
                command: interaction.commandName,
                userId: interaction.user?.id
            });
        } catch (e) {
            console.error('Failed to record interaction error:', e);
        }
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        } else if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
});

// Also record client-level errors
client.on('error', (err) => {
    console.error('Discord client error:', err);
    try {
        recordErrorToJson(err, { type: 'discordClientError' });
    } catch (e) {
        console.error('Failed to record client error:', e);
    }
});

// Bot ready event
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} server(s).`);

    // Start Forest of Death auto-start every 3 hours
    try {
        const fodCmd = require('./menma/commands/fod');
        if (typeof fodCmd.startAutoFOD === 'function') {
            fodCmd.startAutoFOD(client);
            console.log('⏰ Forest of Death auto-start enabled.');
        }
    } catch (err) {
        console.error('❌ Failed to enable Forest of Death auto-start:', err);
    }

    // Start the Top.gg auto-poster
    try {
        const topggCmd = require('./menma/commands/topgg');
        if (typeof topggCmd.setup === 'function') {
            topggCmd.setup(client);
            console.log('✅ Top.gg auto-poster started.');
        }
    } catch (err) {
        console.error('❌ Failed to start Top.gg auto-poster:', err);
    }

    // --- Register tournament module interaction handler if present ---
    try {
        const tournamentCmd = client.commands.get('tournament');
        if (tournamentCmd && typeof tournamentCmd.registerClient === 'function') {
            tournamentCmd.registerClient(client);
            console.log('✅ Tournament module interaction listener registered.');
        } else {
            console.log('ℹ️ Tournament module or registerClient not found; skipping registration.');
        }
    } catch (err) {
        console.error('❌ Error registering tournament client handler:', err);
    }
});

// =========================================
// WEB SERVER & OAUTH (Production)
// =========================================
const webApp = express();
const WEB_PORT = process.env.PORT || 21788;
const REDIRECT_URI = process.env.REDIRECT_URI;
// Use CLIENT_SECRET directly as requested
const WEB_CLIENT_SECRET = process.env.CLIENT_SECRET;

console.log('--- Credential Debug (Production) ---');
console.log(`CLIENT_ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 4) + '...' : 'Missing'} (Length: ${CLIENT_ID ? CLIENT_ID.length : 0})`);
console.log(`WEB_SECRET: ${WEB_CLIENT_SECRET ? WEB_CLIENT_SECRET.substring(0, 4) + '...' : 'Missing'} (Length: ${WEB_CLIENT_SECRET ? WEB_CLIENT_SECRET.length : 0})`);
console.log(`REDIRECT_URI: ${REDIRECT_URI}`);
console.log('------------------------');

webApp.use(cors());
webApp.use(express.json());
webApp.use(express.static(path.join(__dirname, 'website')));

webApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// OAuth Login
webApp.get('/login/discord', (req, res) => {
    // Prefer environment variable, fallback to request host for local dev if needed (though usually needs to match EXACTLY)
    const effectiveRedirectUri = process.env.REDIRECT_URI || REDIRECT_URI;

    if (!CLIENT_ID || !effectiveRedirectUri) {
        console.error("Missing CLIENT_ID or REDIRECT_URI");
        return res.send("Server Configuration Error: Missing OAuth Config");
    }

    console.log(`[OAuth] Initiating login. ClientID: ${CLIENT_ID.substring(0, 4)}...`);
    console.log(`[OAuth] Using Redirect URI: ${effectiveRedirectUri}`);

    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(effectiveRedirectUri)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// OAuth Callback
webApp.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code provided.');

    const effectiveRedirectUri = process.env.REDIRECT_URI || REDIRECT_URI;
    console.log(`[OAuth] Exchanging code. Using Redirect URI: ${effectiveRedirectUri}`);

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: WEB_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: effectiveRedirectUri,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) return res.status(500).send(`Error: ${JSON.stringify(tokenData)}`);

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // 1. Redirect to Index with query params
        // This allows index.html to set localStorage and update UI
        const redirectUrl = `/index.html?username=${encodeURIComponent(userData.username)}&discord_id=${userData.id}&avatar=${userData.avatar}`;
        res.redirect(redirectUrl);

    } catch (err) {
        console.error("OAuth Error:", err);
        res.status(500).send("Authentication failed.");
    }
});

// API: Track View (Korilore)
webApp.post('/api/track-view', (req, res) => {
    console.log(`[API] Received track-view request from: ${req.ip}, body:`, req.body);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const koriPath = path.join(__dirname, 'menma', 'data', 'korilore.json'); // Adjust path for actualbot structure
    // Wait, locally korilore is in data/korilore.json relative to root, but actualbot uses menma/data elsewhere?
    // Line 86: const dataDir = path.join(__dirname, 'menma', 'data');
    // So yes, menma/data.

    try {
        // Ensure dir exists
        fs.mkdirSync(path.dirname(koriPath), { recursive: true });

        let data = { users: [] };
        if (fs.existsSync(koriPath)) {
            data = JSON.parse(fs.readFileSync(koriPath, 'utf8'));
        }
        if (!data.users) data.users = [];

        if (!data.users.includes(userId)) {
            data.users.push(userId);
            fs.writeFileSync(koriPath, JSON.stringify(data, null, 2));
            console.log(`[Korilore] Tracked new user: ${userId}`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Track View Error:", err);
        res.status(500).json({ error: 'Internal Error' });
    }
});
// API: Complete Story
webApp.post('/api/complete-story', (req, res) => {
    // Just log for now or implement if needed. User only asked for ID tracking in korilore.
    // Index.html calls this.
    res.json({ success: true });
});


// API: Bank Data
webApp.get('/api/bank-data', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Path to players.json - ensuring we look in the right place relative to actualbot.js
    const playersPath = path.join(__dirname, 'menma', 'data', 'players.json');

    try {
        if (!fs.existsSync(playersPath)) {
            // Fallback for dev/test environments if file is missing
            return res.status(404).json({ error: 'Data not available' });
        }
        const data = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        const user = data[userId];
        if (user) {
            res.json({
                money: user.money || 0,
                ss: user.ss || 0,
                success: true
            });
        } else {
            res.json({ money: 0, ss: 0, error: 'User not found', success: false });
        }
    } catch (e) {
        console.error("Bank API Error", e);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========================================
// ADMIN API (Owner Only)
// =========================================
const OWNER_ID = '835408109899219004';

// Middleware-like check for admin
const isAdmin = (req) => {
    const adminId = req.headers['x-admin-id'] || req.query.adminId;
    return adminId === OWNER_ID;
};

// GET User/Player Data
webApp.get('/api/admin/get-data', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized. Admin only.' });

    const targetId = req.query.targetId;
    if (!targetId) return res.status(400).json({ error: 'Missing targetId' });

    const playersPath = path.join(__dirname, 'menma', 'data', 'players.json');
    const usersPath = path.join(__dirname, 'menma', 'data', 'users.json');

    try {
        let response = { success: true, userData: null, playerData: null };

        if (fs.existsSync(usersPath)) {
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            response.userData = users[targetId] || null;
        }

        if (fs.existsSync(playersPath)) {
            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            response.playerData = players[targetId] || null;
        }

        if (!response.userData && !response.playerData) {
            return res.status(404).json({ error: 'User/Player not found in data files.' });
        }

        res.json(response);
    } catch (e) {
        console.error("Admin API Get Error", e);
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE User/Player Data
webApp.post('/api/admin/update-data', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized. Admin only.' });

    const { targetId, type, data } = req.body; // type: 'user' or 'player'
    if (!targetId || !type || !data) return res.status(400).json({ error: 'Missing parameters' });

    const fileName = type === 'user' ? 'users.json' : 'players.json';
    const filePath = path.join(__dirname, 'menma', 'data', fileName);

    try {
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: `File ${fileName} not found` });

        // READ ENTIRE FILE: We read the full JSON to memory
        const allData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // UPDATE ONLY THE SPECIFIC USER: This ensures we don't wipe other hundreds of users.
        // We only modify the entry for the targetId.
        allData[targetId] = data;

        // WRITE BACK: Save the updated full JSON object.
        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
        res.json({ success: true, message: `${type} data updated successfully for ${targetId}.` });
    } catch (e) {
        console.error("Admin API Update Error", e);
        res.status(500).json({ error: 'Server error' });
    }
});

webApp.listen(WEB_PORT, () => {
    console.log(`🌍 Production Web Server running on port ${WEB_PORT}`);
});

client.login(TOKEN);


//this is the main file of a discord bot hosted on Pterodactyl. This is the main production variant and should not lose any of its major functionality while editing. 
