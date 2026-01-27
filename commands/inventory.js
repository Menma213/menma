const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Displays your accessory inventory and equipped items.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const usersPath = path.resolve(__dirname, '../data/users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        const user = users[userId];
        if (!user) {
            return interaction.reply({ content: 'You are not registered in the game.', ephemeral: true });
        }

        const userAccessoryPath = path.resolve(__dirname, '../data/userAccessory.json');
        const userAccessoryData = fs.existsSync(userAccessoryPath) ? JSON.parse(fs.readFileSync(userAccessoryPath, 'utf8')) : {};
        const userAcc = userAccessoryData[userId] || { inventory: [], equipped: null };

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Inventory`)
            .setColor('#0099ff');

        if (userAcc.equipped) {
            embed.addFields({ name: 'Equipped', value: userAcc.equipped, inline: true });
        } else {
            embed.addFields({ name: 'Equipped', value: 'None', inline: true });
        }

        if (userAcc.inventory && userAcc.inventory.length > 0) {
            embed.addFields({ name: 'Inventory', value: userAcc.inventory.join('\n'), inline: true });
        } else {
            embed.addFields({ name: 'Inventory', value: 'Empty', inline: true });
        }

        return interaction.reply({ embeds: [embed] });
    },
};
