const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const bridge = require('../utils/gwent_bridge');

// Session store
const sessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gwent')
        .setDescription('Play the full Gwent game (Twitcher 3 Classic)')
        .addStringOption(option =>
            option.setName('faction')
                .setDescription('Choose your starting faction')
                .setRequired(true)
                .addChoices(
                    { name: 'Northern Realms', value: 'realms' },
                    { name: 'Nilfgaard', value: 'nilfgaard' },
                    { name: 'Monsters', value: 'monsters' },
                    { name: 'Scoia\'tael', value: 'scoiatael' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const faction = interaction.options.getString('faction');

        // Initialize Bridge and Start Match
        await bridge.init();
        await bridge.startMatch(faction);

        // Start a new game in the bridge
        // This might require a specific function in Gwent logic to reset/start
        // Assuming we can just re-init or trigger a start
        // For now, let's assume the first init sets up the board.
        // We might need bridge.startMatch(faction)

        const renderAndUpdate = async (int) => {
            const buffer = await bridge.render();
            const attachment = new AttachmentBuilder(buffer, { name: 'gwent.png' });

            const hand = bridge.getHand();

            const embed = new EmbedBuilder()
                .setTitle(`⚔️ GWENT: ${interaction.user.username}'s Match`)
                .setImage('attachment://gwent.png')
                .setColor('#ffcc00')
                .setFooter({ text: 'Use the menu to play cards or click Pass' });

            // Action Row 1: Play Cards (Menu)
            const menu = new StringSelectMenuBuilder()
                .setCustomId('gwent_play')
                .setPlaceholder('Select a card to play...')
                .addOptions(hand.slice(0, 25).map(c => ({
                    label: `${c.name} (${c.power})`,
                    description: `Row: ${c.row}`,
                    value: c.index.toString()
                })));

            const row1 = new ActionRowBuilder().addComponents(menu);

            // Action Row 2: Controls
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('gwent_pass')
                    .setLabel('Pass Round')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('gwent_refresh')
                    .setLabel('Refresh Board')
                    .setStyle(ButtonStyle.Secondary)
            );

            const msgOptions = {
                embeds: [embed],
                files: [attachment],
                components: hand.length > 0 ? [row1, row2] : [row2]
            };

            if (int.isButton() || int.isStringSelectMenu()) {
                await int.update(msgOptions);
            } else {
                await interaction.editReply(msgOptions);
            }
        };

        await renderAndUpdate(interaction);

        // Interaction Collector
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });

        collector.on('collect', async i => {
            if (i.customId === 'gwent_play') {
                const index = parseInt(i.values[0]);
                await bridge.playCard(index);
                // AI might take a turn automatically in Gwent engine
                await renderAndUpdate(i);
            } else if (i.customId === 'gwent_pass') {
                await bridge.pass();
                await renderAndUpdate(i);
            } else if (i.customId === 'gwent_refresh') {
                await renderAndUpdate(i);
            }
        });
    }
};
