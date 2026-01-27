// Add this block at the very top, before any require('dotenv').config()
const fs = require('fs');
const path = require('path');

// Support for .env.path file
const envPathFile = path.join(__dirname, '.env.path');
let envFile = '.env';
if (fs.existsSync(envPathFile)) {
    const customEnvPath = fs.readFileSync(envPathFile, 'utf8').trim();
    if (customEnvPath) envFile = customEnvPath;
}
require('dotenv').config({ path: path.resolve(__dirname, envFile) });

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const dataManager = require('./commands/dataUtils');
global.dataManager = dataManager; // Make it global for all commands to access

// Load environment variables
const TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : undefined;
const CLIENT_ID = process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : undefined;
const CLIENT_SECRET = process.env.CLIENT_SECRET ? process.env.CLIENT_SECRET.trim() : undefined;

if (!TOKEN || !CLIENT_ID) {
    console.error("❌ Missing bot token or client ID in the .env file!");
    process.exit(1);
}

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection(); // Ensure commands is a Collection

// Add global prompt counter
const userPromptCounts = {};

// --- Load story.js and run setup for minigame engine ---
const storyModule = require('./commands/story');
if (typeof storyModule.setup === 'function') {
    storyModule.setup(client, userPromptCounts);
}
// --- End minigame engine setup ---

// Money Logging System
const lastUserInteraction = {};
const MONEY_LOG_LIMIT = 2000000;
const MONEY_LOG_CHANNEL = '1381278641144467637';
const MONEY_LOG_FILE = path.join(__dirname, 'data', 'money_gain_logs.txt');
const PLAYERS_FILE = path.join(__dirname, 'data', 'players.json');
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

                const logEntry = `💰 **BIG MONEY ALERT**\n` +
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
const commandsPath = path.join(__dirname, '/commands');
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
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        } else if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
});

// Bot ready event
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} server(s).`);

    // Start Forest of Death auto-start every 3 hours
    try {
        const fodCmd = require('./commands/fod');
        if (typeof fodCmd.startAutoFOD === 'function') {
            fodCmd.startAutoFOD(client);
            console.log('⏰ Forest of Death auto-start enabled.');
        }
    } catch (err) {
        console.error('❌ Failed to enable Forest of Death auto-start:', err);
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

// Listen for messages to trigger Thunderbird NPC
const tradeCmd = require('./commands/trade');
client.on('messageCreate', async (message) => {
    if (typeof tradeCmd.thunderbirdListener === 'function') {
        await tradeCmd.thunderbirdListener(message);
    }
});

client.on('guildMemberAdd', async member => {
    try {
        const welcomeModule = require('./commands/welcome.js');
        const welcomeChannelId = welcomeModule.WELCOME_CHANNEL;
        const welcomeChannel = await client.channels.fetch(welcomeChannelId);

        if (welcomeChannel) {
            const welcomeCard = await welcomeModule.generateWelcomeCard(member);
            const attachment = new AttachmentBuilder(welcomeCard, { name: 'welcome-card.png' });
            await welcomeChannel.send({ content: `Welcome to the server, <@${member.id}>!`, files: [attachment] });
        }
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// Log in
// Log in
client.login(TOKEN);

// ==========================================
// WEB SERVER INTEGRATION (Menma Story)
// ==========================================

const express = require('express');
const webApp = express();
const cors = require('cors');
webApp.use(cors());
webApp.use(express.json());

// Load web server environment variables
// Load environment variables
// Load environment variables

const WEB_PORT = process.env.WEB_PORT || 3001;
// Fallback to CLIENT_SECRET if WEB_CLIENT_SECRET is not set
let WEB_CLIENT_SECRET = process.env.WEB_CLIENT_SECRET || CLIENT_SECRET;
if (WEB_CLIENT_SECRET) WEB_CLIENT_SECRET = WEB_CLIENT_SECRET.trim();

let REDIRECT_URI = process.env.REDIRECT_URI;
if (REDIRECT_URI) REDIRECT_URI = REDIRECT_URI.trim();

console.log('--- Credential Debug ---');
console.log(`CLIENT_ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 4) + '...' : 'Missing'} (Length: ${CLIENT_ID ? CLIENT_ID.length : 0})`);
console.log(`WEB_SECRET: ${WEB_CLIENT_SECRET ? WEB_CLIENT_SECRET.substring(0, 4) + '...' : 'Missing'} (Length: ${WEB_CLIENT_SECRET ? WEB_CLIENT_SECRET.length : 0})`);
console.log(`REDIRECT_URI: ${REDIRECT_URI}`);
console.log('------------------------');

if (!REDIRECT_URI || !WEB_CLIENT_SECRET) {
    console.warn("⚠️ Missing REDIRECT_URI or WEB_CLIENT_SECRET (or CLIENT_SECRET) in .env file. OAuth features will be disabled.");
}

// Serve static files from 'website' directory
webApp.use(express.static(path.join(__dirname, 'website')));

webApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// OAuth Login
webApp.get('/login/discord', (req, res) => {
    console.log(`initiating login with redirect_uri: ${REDIRECT_URI}`);
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
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
        if (tokenData.error || !tokenResponse.ok) {
            console.error("Discord Token Error:", tokenData);
            return res.status(500).send(`Discord API Error: ${JSON.stringify(tokenData)}`);
        }

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userResponse.json();

        // Redirect to Hub with query params for local testing
        const redirectUrl = `/hub.html?username=${encodeURIComponent(userData.username)}&discord_id=${userData.id}&avatar=${userData.avatar}`;
        res.redirect(redirectUrl);


    } catch (error) {
        console.error('OAuth flow failed:', error);
        res.status(500).send('Authentication Error');
    }
});

// API: Complete Story
webApp.post('/api/complete-story', async (req, res) => {
    console.log("Received complete-story request:", req.body);
    const { userId, storyId, jutsuChosen } = req.body;

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const userStatsPath = path.join(__dirname, 'data', 'users.json');

    try {
        const data = await fs.readFileSync(userStatsPath, 'utf8');
        let usersDB = JSON.parse(data);

        if (!usersDB[userId]) usersDB[userId] = { id: userId, money: 0 };

        // Update User Data
        usersDB[userId].completedRaidStory = true;
        if (jutsuChosen) usersDB[userId].storyJutsu = jutsuChosen;

        await fs.writeFileSync(userStatsPath, JSON.stringify(usersDB, null, 4));
        console.log(`Updated story completion for user ${userId}`);

        res.json({ success: true, message: "Story progress saved." });

    } catch (error) {
        console.error('Error updating users.json:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API: Track Story View (Korilore)
webApp.post('/api/track-view', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const koriPath = path.join(__dirname, 'data', 'korilore.json');
    let koriDB = { users: [] };

    try {
        if (fs.existsSync(koriPath)) {
            const data = fs.readFileSync(koriPath, 'utf8');
            try { koriDB = JSON.parse(data); } catch (e) { console.error("Error parsing korilore.json, resetting db"); }
        }

        if (!koriDB.users) koriDB.users = [];

        // Add if not exists
        if (!koriDB.users.includes(userId)) {
            koriDB.users.push(userId);
            fs.writeFileSync(koriPath, JSON.stringify(koriDB, null, 4));
            console.log(`Logged new viewer: ${userId}`);
        } else {
            console.log(`Viewer ${userId} already logged.`);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Error in track-view:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

webApp.listen(WEB_PORT, () => {
    console.log(`🌍 Web Server running on port ${WEB_PORT} (Integrated with Bot)`);
});