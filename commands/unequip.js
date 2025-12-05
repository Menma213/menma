const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unequip')
        .setDescription('Unequip an accessory.')
        .addStringOption(option =>
            option.setName('accessory')
                .setDescription('The name of the accessory to unequip.')
                .setRequired(true)),
    async execute(interaction) {
        const accessoryName = interaction.options.getString('accessory');
        const userId = interaction.user.id;

        const usersPath = path.resolve(__dirname, '../data/users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        const user = users[userId];
        if (!user) {
            return interaction.reply({ content: 'You are not registered in the game.', ephemeral: true });
        }

        if (!user.equipped_accessories || !user.equipped_accessories.includes(accessoryName)) {
            return interaction.reply({ content: `You do not have "${accessoryName}" equipped.`, ephemeral: true });
        }

        user.equipped_accessories = user.equipped_accessories.filter(acc => acc !== accessoryName);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        return interaction.reply({ content: `You have unequipped "${accessoryName}".` });
    },
};
