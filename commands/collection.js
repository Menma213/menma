const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayerData } = require('../utils/tcgUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collection')
        .setDescription('View your anime character card collection'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const playerData = getPlayerData(userId);
        const collection = playerData.collection;

        const cards = Object.entries(collection).map(([name, data]) => {
            if (typeof data === 'number') {
                return { name, count: data, rarity: 'Legacy', ovr: '??', color: '#95a5a6' };
            }
            return { name, ...data };
        });

        if (cards.length === 0) {
            return await interaction.reply({ content: "Your collection is empty! Use `/summon` to get your first card.", ephemeral: true });
        }

        // Sort by OVR descending
        cards.sort((a, b) => (b.ovr || 0) - (a.ovr || 0));

        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(cards.length / ITEMS_PER_PAGE);
        let currentPage = 1;

        const generateEmbed = (page) => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const pageCards = cards.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Collection`)
                .setDescription(`Total Unique Cards: **${cards.length}**\nTotal Cards: **${cards.reduce((acc, curr) => acc + curr.count, 0)}**`)
                .setColor('#2b2d31')
                .setFooter({ text: `Page ${page} of ${totalPages}` });

            const list = pageCards.map((card, index) => {
                const rarityIcon = getRarityIcon(card.rarity);
                return `**${start + index + 1}.** ${rarityIcon} \`[${card.ovr}]\` **${card.name}** x${card.count}`;
            }).join('\n');

            embed.addFields({ name: 'Card List (Sorted by OVR)', value: list || 'No cards on this page.' });

            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder();
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages)
            );
            return row;
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: totalPages > 1 ? [generateButtons(currentPage)] : [],
            fetchReply: true
        });

        if (totalPages > 1) {
            const collector = response.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "This is not your menu!", ephemeral: true });

                if (i.customId === 'prev_page') currentPage--;
                else if (i.customId === 'next_page') currentPage++;

                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => { });
            });
        }
    }
};

function getRarityIcon(rarity) {
    switch (rarity) {
        case 'Mythic': return '🔴';
        case 'Legendary': return '🟠';
        case 'Epic': return '🟣';
        case 'Rare': return '🔵';
        case 'Uncommon': return '🟢';
        case 'Common': return '⚪';
        default: return '❓';
    }
}
