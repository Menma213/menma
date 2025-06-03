const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give money to another player')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('User to give money to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of money to give')
                .setRequired(true)),
    async execute(interaction) {
        const giverId = interaction.user.id;
        const targetUser = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });

        if (!fs.existsSync(usersPath)) return interaction.reply({ content: "Database not found.", ephemeral: true });
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[giverId] || !users[targetUser.id]) {
            return interaction.reply({ content: "Both users must be enrolled.", ephemeral: true });
        }
        if (users[giverId].money < amount) {
            return interaction.reply({ content: "You don't have enough money.", ephemeral: true });
        }
        users[giverId].money -= amount;
        users[targetUser.id].money += amount;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        await interaction.reply(`${interaction.user.username} gave $${amount} to ${targetUser.username}!`);
    }
};
