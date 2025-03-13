require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const GUILD_ID = process.env.GUILD_ID && /^\d+$/.test(process.env.GUILD_ID) ? process.env.GUILD_ID : null;

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

client.commands = new Collection();
const commands = [];

// Load all command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (!command.data || !command.data.name) {
            console.error(`⚠️ Command "${file}" is missing required properties.`);
            continue;
        }
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } catch (error) {
        console.error(`❌ Error loading command "${file}":`, error);
    }
}

// Register Slash Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("🔄 Deleting existing slash commands...");

        const route = GUILD_ID 
            ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) // Register commands only in a specific server (for testing)
            : Routes.applicationCommands(CLIENT_ID); // Register globally

        // Fetch all existing commands
        const existingCommands = await rest.get(route);
        if (existingCommands.length > 0) {
            // Delete existing commands
            await Promise.all(existingCommands.map(async (command) => {
                console.log(`🔴 Deleting command: ${command.name}`);
                await rest.delete(`${route}/${command.id}`);
            }));
            console.log("✅ Successfully deleted all existing commands!");
        } else {
            console.log("🔄 No existing commands to delete.");
        }

        // Check for duplicate command names
        const commandNames = commands.map(cmd => cmd.name);
        const uniqueCommandNames = new Set(commandNames);
        if (commandNames.length !== uniqueCommandNames.size) {
            console.warn("⚠️ Duplicate command names detected! Ensure all commands have unique names.");
        }

        console.log("🔄 Registering new slash commands...");
        await rest.put(route, { body: commands });
        console.log("✅ Successfully registered new slash commands!");
    } catch (error) {
        console.error("❌ Error while deleting or registering slash commands:", error);
    }
})();

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: "⚠️ Unknown command.", ephemeral: true });

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing "${interaction.commandName}":`, error);
        await interaction.reply({ content: "⚠️ An error occurred while executing this command.", ephemeral: true });
    }
});

// Bot ready event
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
});

// Log in
client.login(TOKEN);
