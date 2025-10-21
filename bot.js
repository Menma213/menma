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
});

// Listen for messages to trigger Thunderbird NPC
const tradeCmd = require('./commands/trade');
client.on('messageCreate', async (message) => {
    if (typeof tradeCmd.thunderbirdListener === 'function') {
        await tradeCmd.thunderbirdListener(message);
    }
});

// Log in
client.login(TOKEN);