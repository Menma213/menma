const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const jutsusPath = path.join(dataPath, 'jutsu.json');  // Fixed path
const requirementsPath = path.join(dataPath, 'requirements.json');

const loadData = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const saveData = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2));

const SCROLL_JUTSU = {
    "Needle Assault Scroll": "Needle Assault",
    "Silent Assassination Scroll": "Silent Assassination",
    "Serpents Wrath Scroll": "Serpents Wrath"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('learnjutsu')
        .setDescription('Attempt to learn jutsu from your current scroll'),

    async execute(interaction) {
        const users = loadData(usersPath);
        const jutsuData = loadData(jutsusPath);  // Now loads from correct file
        const requirements = loadData(requirementsPath);

        const userId = interaction.user.id;
        const currentScroll = users[userId]?.current_scroll;

        if (!currentScroll) {
            return interaction.reply({ content: "You don't have an active scroll set!", ephemeral: true });
        }

        const userReqs = requirements[userId];
        if (!userReqs) {
            return interaction.reply({ content: "No requirements found for your scroll!", ephemeral: true });
        }

        const completedReqs = userReqs.requirements.filter(r => r.completed >= r.needed).length;
        const successChance = completedReqs * 20;
        const attempts = users[userId].scroll_attempts || 0;
        const cost = attempts === 0 ? "Free!" : "10,000 Ryo";

        if (attempts > 0 && users[userId].money < 10000) {
            return interaction.reply({ content: "You need 10,000 Ryo for another attempt!", ephemeral: true });
        }

        const jutsuName = SCROLL_JUTSU[currentScroll];
        if (!jutsuName) {
            return interaction.reply({ 
                content: "Error: Invalid scroll type!", 
                ephemeral: true 
            });
        }

        const roll = Math.random() * 100;
        if (roll <= successChance) {
            // Success
            if (!jutsuData[userId].usersjutsu) jutsuData[userId].usersjutsu = [];
            jutsuData[userId].usersjutsu.push(jutsuName);
            
            // Remove scroll and reset
            jutsuData[userId].scrolls = jutsuData[userId].scrolls.filter(s => s !== currentScroll);
            users[userId].current_scroll = null;
            delete requirements[userId];

            if (attempts > 0) users[userId].money -= 10000;
            
            saveData(jutsusPath, jutsuData);  // Saves to correct file
            saveData(usersPath, users);
            saveData(requirementsPath, requirements);

            return interaction.reply({ 
                content: `<":nsmile:1380884032312709191> Success! You learned **${jutsuName}**!` 
            });
        }

        // Failure
        if (attempts > 0) users[userId].money -= 10000;
        users[userId].scroll_attempts = attempts + 1;
        saveData(usersPath, users);

        return interaction.reply({
            content: `❌ Failed to learn the jutsu. (${successChance}% chance)\nNext attempt will cost 10,000 Ryo.`
        });
    }
};
