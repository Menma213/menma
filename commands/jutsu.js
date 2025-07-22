const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jutsu')
        .setDescription('Display all obtainable jutsu.'),
    async execute(interaction) {
        try {
            const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));

            // Define categories in desired order
            const categories = {
                "Genin": [],
                "Chuunin": [],
                "Jounin": [],
                "Hokage": [],
                "S-Rank": [],
                "No Category": [] // Catch-all for jutsus without a specified category
            };

            // Populate categories with jutsu names
            for (const jutsuName in jutsus) {
                const jutsu = jutsus[jutsuName];
                const category = jutsu.category || "No Category";

                if (categories.hasOwnProperty(category)) {
                    categories[category].push(jutsu.name);
                } else {
                    categories["No Category"].push(jutsu.name);
                }
            }

            const embeds = [];
            const categoryOrder = ["Genin", "Chuunin", "Jounin", "Hokage", "S-Rank", "No Category"]; // Explicit order

            // Create an embed for each category that has jutsus
            for (const categoryName of categoryOrder) {
                if (categories[categoryName].length > 0) {
                    const embed = new EmbedBuilder()
                        .setTitle(` ${categoryName} Jutsu`)
                        .setColor(0x00FFFF)
                        .setDescription(`${categoryName} jutsu:`)
                        .setFooter({ text: 'Train hard to master them all!' });

                    embed.addFields({
                        name: `Jutsu List`,
                        value: categories[categoryName].map(name => `\`${name}\``).join('\n') || 'No jutsu found for this category.',
                        inline: false
                    });
                    embeds.push(embed);
                }
            }

            // Fallback if no jutsus are found at all
            if (embeds.length === 0) {
                const noJutsuEmbed = new EmbedBuilder()
                    .setTitle(' No Jutsu Found')
                    .setColor(0xFF0000)
                    .setDescription('It seems no jutsu are currently registered in the database.')
                    .setTimestamp();
                return interaction.reply({ embeds: [noJutsuEmbed], ephemeral: false });
            }

            let currentPage = 0;

            // Create buttons for pagination
            const getButtons = (page) => {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('first_page')
                            .setLabel('⏮️ First')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('◀️ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next ▶️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === embeds.length - 1),
                        new ButtonBuilder()
                            .setCustomId('last_page')
                            .setLabel('Last ⏭️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === embeds.length - 1),
                    );
            };

            const replyMessage = await interaction.reply({
                embeds: [embeds[currentPage].setFooter({ text: `Page ${currentPage + 1}/${embeds.length} | Train hard to master them all!` })],
                components: [getButtons(currentPage)],
                fetchReply: true, // Needed to create a collector on this message
                ephemeral: false
            });

            // Create a collector for button interactions
            const collector = replyMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 // 2 minutes until collector expires
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
                }

                await i.deferUpdate(); // Acknowledge the button click

                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(embeds.length - 1, currentPage + 1);
                } else if (i.customId === 'first_page') {
                    currentPage = 0;
                } else if (i.customId === 'last_page') {
                    currentPage = embeds.length - 1;
                }

                await i.editReply({
                    embeds: [embeds[currentPage].setFooter({ text: `Page ${currentPage + 1}/${embeds.length} | Train hard to master them all!` })],
                    components: [getButtons(currentPage)]
                });
            });

            collector.on('end', async () => {
                // Disable buttons when the collector expires
                await replyMessage.edit({
                    components: [getButtons(currentPage).components.map(button => button.setDisabled(true))]
                }).catch(console.error); // Catch potential errors if message was deleted
            });

        } catch (error) {
            console.error("Error displaying jutsu:", error);
            await interaction.reply({ content: 'An error occurred while trying to display the jutsu. Please try again later.', ephemeral: true });
        }
    }
};