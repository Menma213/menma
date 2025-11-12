
const { SlashCommandBuilder, EmbedBuilder, Collection, Routes, REST } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OWNER_ID = '835408109899219004';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const HELPER_SERVER_EVENT = path.resolve(__dirname, '../../menma/data/server_events.txt');
const BRANK_FILE = path.resolve(__dirname, '../../menma/commands/brank.js');
const COMMANDS_DIR = path.resolve(__dirname);

let restClient;

async function refreshDiscordCommands(client) {
    if (!restClient) {
        restClient = new REST().setToken(client.token);
    }
    
    const commandsData = client.commands.map(command => command.data);
    
    try {
        await restClient.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData },
        );
        
        console.log(`[Discord API] Successfully registered ${commandsData.length} application commands.`);
        return true;
    } catch (error) {
        console.error('[Discord API] Failed to register application commands:', error);
        return false;
    }
}

async function registerNewCommand(client, filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        const newCommand = require(filePath);
        
        if (newCommand.data && newCommand.execute) {
            const commandName = newCommand.data.name;

            if (newCommand.data.description && newCommand.data.description.length > 100) {
                console.error(`[Jarvis] Command description too long: ${newCommand.data.description.length} chars`);
                return false;
            }
            
            if (!(client.commands instanceof Collection)) {
                console.error("[Jarvis] Client does not have a 'commands' Collection");
                return false;
            }

            client.commands.set(commandName, newCommand);
            console.log(`[Jarvis] Successfully updated local cache for: /${commandName}`);
            
            const apiSuccess = await refreshDiscordCommands(client);

            if (apiSuccess) {
                return true;
            } else {
                client.commands.delete(commandName);
                return false;
            }
            
        } else {
            console.error(`[Jarvis] File ${filePath} missing 'data' or 'execute'`);
            return false;
        }
    } catch (error) {
        console.error(`[Jarvis] Error registering command from ${filePath}:`, error.message);
        return false;
    }
}

async function createCommand(commandName, commandDescription, commandCode, client) {
    const sanitizedName = commandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!sanitizedName) { 
        return "That command name is too confusing. I need a simpler name to make a command."; 
    }
    
    const filePath = path.join(COMMANDS_DIR, `${sanitizedName}.js`);
    
    if (client.commands && client.commands.has(sanitizedName)) {
        return `A command named /${sanitizedName} already exists! Try a different name.`;
    }

    try {
        fs.writeFileSync(filePath, commandCode);
        
        const success = await registerNewCommand(client, filePath); 
        
        if (success) {
            return `Finished! New command deployed: **/${sanitizedName}**! It's live now. (May take a minute for Discord to update)`;
        } else {
            return `I made the code, but command registration failed. Check console for details.`;
        }
    } catch (error) {
        console.error('File saving or command registration failed:', error);
        return `I failed to deploy the command: ${error.message}`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Owner-only command to interact with Jarvis.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt for Jarvis.')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const userPrompt = interaction.options.getString('prompt');

        const jarvisSystemPrompt = `
You are Jarvis, a world-class professional developer AI. You can create and deploy discord.js v14 slash commands on the fly.

CRITICAL REQUIREMENTS:
1.  You will be given a prompt by the owner.
2.  You will write the code for a new slash command.
3.  You will then use the 'createCommand' tool to deploy the new command.
4.  You are not limited to minigames. You can create any type of command.
5.  You can use any node.js module you need.
6.  The code should be self-contained in the 'execute' function.
7.  The command name and description should be based on the user's prompt.

Respond with ONLY a JSON object with the following structure:
{
  "action": "createCommand",
  "payload": {
    "commandName": "the-name-of-the-command",
    "commandDescription": "A short description of the command",
    "commandCode": "THE FULL JAVASCRIPT CODE FOR THE COMMAND"
  }
}

Special Condition: If the owner asks you to make a server event, follow these instructions:
You then code server events that are a bit different from minigames. The server events are always gonna be related to the bot. How is a game related file coded properly without bugs and errors? Im going to give you references, alot of them:
First of all, we will use "runbattle" function from combinedcommands.js. For additional info here are the files you'll ever need:
Helper file that contains mixed information about all the things: '${HELPER_SERVER_EVENT}'
Brank command which is a fight between user and a single npc, this is for reference: "${BRANK_FILE}"
`;

        try {
            await interaction.deferReply();

            const result = await model.generateContent({
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: jarvisSystemPrompt }] },
            });

            const responseText = result.response.text();
            const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '');
            const parsedResponse = JSON.parse(cleanedResponse);

            if (parsedResponse.action === 'createCommand') {
                const { commandName, commandDescription, commandCode } = parsedResponse.payload;
                const creationResult = await createCommand(commandName, commandDescription, commandCode, interaction.client);
                await interaction.editReply(creationResult);
            } else {
                await interaction.editReply("I was unable to process that request. Please try again.");
            }

        } catch (error) {
            console.error('Jarvis command failed:', error);
            await interaction.editReply('Jarvis encountered an error.');
        }
    },
};
