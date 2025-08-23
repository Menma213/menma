const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.resolve(__dirname, '../data/users.json');

const getUsers = () => {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        return {};
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gain-bxp')
        .setDescription('Simulate completing a quest and gaining BXP.'),
    async execute(interaction) {
        const users = getUsers();
        const userId = interaction.user.id;

        if (!users[userId]) {
            users[userId] = { bxp: 0, claimedTiers: [] };
        }

        const bxpGained = Math.floor(Math.random() * 500) + 100; // Random amount from 100 to 599
        users[userId].bxp += bxpGained;
        saveUsers(users);

        await interaction.reply({
            content: `You completed a quest and gained **${bxpGained} BXP**! Your new total is **${users[userId].bxp} BXP**.`,
            ephemeral: true
        });
    }
};