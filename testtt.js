const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const topggToken = process.env.TOPGG_TOKEN;
const commandsPath = path.join(__dirname,'commands');
const topggApiUrl = 'https://top.gg/v1/projects/@me/commands';

if (!topggToken) {
    console.error('Error: TOPGG_TOKEN not found in your .env file.');
    process.exit(1);
}

const commands = [];
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Collect command payloads from each file
for (const file of commandFiles) {
    // Check if the filename contains 'admin' and skip it
    if (file.toLowerCase().includes('admin')) {
        console.log(`⏩ Skipping ${file}. This is an admin command.`);
        continue;
    }

    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (command.data && typeof command.data.toJSON === 'function') {
            commands.push(command.data.toJSON());
            console.log(`✅ Successfully converted ${file} to JSON.`);
        } else {
            console.warn(`⚠️ Warning: Skipping ${file}. It does not have a valid 'data' property with a toJSON method.`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
    }
}

// Make the POST request to top.gg
async function updateTopggCommands() {
    try {
        const response = await fetch(topggApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': topggToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commands)
        });

        if (response.ok) {
            console.log('\n🎉 Command payloads successfully updated on Top.gg!');
            console.log('You should now see them on your bot\'s page.');
        } else {
            const errorText = await response.text();
            console.error('\n❌ Error updating commands on Top.gg:', response.status, response.statusText);
            console.error('Response body:', errorText);
        }
    } catch (error) {
        console.error('\n❌ An error occurred while making the API request:', error);
    }
}

updateTopggCommands();