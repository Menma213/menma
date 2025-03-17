require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '%'; // Prefix for commands

if (!TOKEN) {
    console.error("❌ Missing bot token in the .env file!");
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

client.commands = new Collection();

// Load all command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (!command.name || !command.execute) {
            console.error(`⚠️ Command "${file}" is missing required properties.`);
            continue;
        }
        client.commands.set(command.name, command);
    } catch (error) {
        console.error(`❌ Error loading command "${file}":`, error);
    }
}

// Handle prefix commands
client.on('messageCreate', async message => {
    // Ignore messages from bots or without the prefix
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    // Extract command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Get the command
    const command = client.commands.get(commandName);
    if (!command) return;

    // Execute the command
    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`❌ Error executing "${commandName}":`, error);
        await message.reply({ content: "⚠️ An error occurred while executing this command." });
    }
});

// Bot ready event
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
});

// Log in
client.login(TOKEN);