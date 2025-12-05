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

        const equippedAccessories = user.equipped_accessories || [];
        const inventoryAccessories = user.inventory && user.inventory.accessories ? user.inventory.accessories : [];

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Inventory`)
            .setColor('#0099ff');

        if (equippedAccessories.length > 0) {
            embed.addFields({ name: 'Equipped', value: equippedAccessories.join('\n'), inline: true });
        } else {
            embed.addFields({ name: 'Equipped', value: 'None', inline: true });
        }

        if (inventoryAccessories.length > 0) {
            embed.addFields({ name: 'Inventory', value: inventoryAccessories.join('\n'), inline: true });
        } else {
            embed.addFields({ name: 'Inventory', value: 'Empty', inline: true });
        }

        return interaction.reply({ embeds: [embed] });
    },
};
