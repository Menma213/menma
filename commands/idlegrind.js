const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('idlegrind')
        .setDescription('Open the meditation page to earn AFK rewards!'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Meditation')
            .setDescription('Meditating allows you to earn levels and Money while you are away')
            .addFields(
                { name: 'Training Grounds', value: '[Click here to start Meditating](https://shinobirpg.online/idlegrind)' },
                { name: 'Daily Limit', value: '50 Levels (Reduced by mission activity)' },
                { name: 'Boost', value: 'Use Ad Tokens from the /bank to boost your Money gains!' }
            )
            .setColor('#9333ea')
            .setThumbnail('https://i.postimg.cc/nrCfwFxz/image.png')
            .setFooter({ text: 'For the Grass Touchers.' });

        await interaction.reply({ embeds: [embed] });
    },
};
