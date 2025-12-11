const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');

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
    if (!CLIENT_ID || !REDIRECT_URI) return res.send("Missing Config");
    console.log(`initiating login with redirect_uri: ${REDIRECT_URI}`);
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// OAuth Callback
webApp.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code provided.');

    console.log(`Exchanging code for token with redirect_uri: ${REDIRECT_URI}`);

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: WEB_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) return res.status(500).send(`Error: ${JSON.stringify(tokenData)}`);

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // 1. Redirect to Hub with query params
        // This allows hub.html to set localStorage and show a welcome screen
        const redirectUrl = `/hub.html?username=${encodeURIComponent(userData.username)}&discord_id=${userData.id}&avatar=${userData.avatar}`;
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


webApp.listen(WEB_PORT, () => {
    console.log(`🌍 Production Web Server running on port ${WEB_PORT}`);
});

client.login(TOKEN);



