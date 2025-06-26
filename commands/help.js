const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📜 View all available commands!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        const commands = [];

        // Dynamically load commands
        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));
                if (command.data && command.data.name) {
                    commands.push(command);
                }
            } catch (error) {
                console.error(`❌ Error loading command from "${file}":`, error);
            }
        }

        // Pagination Variables
        const itemsPerPage = 5;
        let currentPage = 0;
        const totalPages = Math.max(1, Math.ceil(commands.length / itemsPerPage));

        // Function to generate the command list
        function generatePage() {
            let commandList = '';
            const pageCommands = commands.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
            pageCommands.forEach(command => {
                commandList += `**🌀 /${command.data.name}** → *${command.data.description || 'No description available'}*\n\n`;
            });
            return commandList || '*No commands available.*';
        }

        // Function to create an embed for the current page
        function generateEmbed() {
            return new EmbedBuilder()
                .setTitle("📜 **KonohaRPG Command Guide**")
                .setDescription(generatePage())
                .setColor("#FFD700") // Golden theme
                .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256, dynamic: true }))
                .setFooter({
                    text: `Page ${currentPage + 1} of ${totalPages} • Use the buttons below to navigate`,
                    iconURL: "https://img1.hulu.com/user/v3/artwork/a99159e3-5f5b-4bf6-b166-c3d26c02ab56?base_image_bucket_name=image_manager&base_image=3ed708b1-223c-4af7-ac5c-2aeb085aa221&size=600x338&format=webp",
                })
                .setTimestamp();
        }

        // Navigation Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),

            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1),

            new ButtonBuilder()
                .setCustomId('close')
                .setLabel('❌ Close')
                .setStyle(ButtonStyle.Danger)
        );

        // Send Initial Response
        const message = await interaction.reply({ embeds: [generateEmbed()], components: [row], ephemeral: true });

        // Button Collector
        const filter = i => i.user.id === userId;
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'next' && currentPage < totalPages - 1) {
                currentPage++;
            } else if (i.customId === 'prev' && currentPage > 0) {
                currentPage--;
            } else if (i.customId === 'close') {
                return await interaction.editReply({
                    content: "✅ **Help closed.**",
                    embeds: [],
                    components: [],
                });
            }

            // Update Embed and Buttons
            await i.update({
                embeds: [generateEmbed()],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('⬅️ Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === 0),

                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === totalPages - 1),

                        new ButtonBuilder()
                            .setCustomId('close')
                            .setLabel('❌ Close')
                            .setStyle(ButtonStyle.Danger)
                    ),
                ],
            });
        });

        collector.on('end', async () => {
            await interaction.editReply({
                components: [],
                embeds: [
                    generateEmbed().setFooter({
                        text: "⏳ Help Session Expired • Use /help again",
                        iconURL: "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg",
                    }),
                ],
            });
        });
    },
};