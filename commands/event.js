const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Event'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Upcoming Event')
            .setDescription('**Something awaits..**](https://shinobirpg.online/event)')
            .setColor('#006400')

        await interaction.reply({ embeds: [embed] });
    },
};
