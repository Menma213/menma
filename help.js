const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { MessageActionRow, MessageButton, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands with a slick interactive interface!'),
    async execute(interaction) {
        // Path to the commands folder
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // Prepare a list to store commands
        const commands = [];

        // Dynamically load commands from the folder
        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));
                if (command.data && command.data.name) {
                    commands.push(command);
                }
            } catch (error) {
                console.error(`❌ Error loading command from file "${file}":`, error);
            }
        }

        // Set up pagination variables
        const itemsPerPage = 5;
        let currentPage = 0;

        // Create the initial embed
        const embed = new EmbedBuilder()
            .setTitle('✨ Bot Command List')
            .setDescription('Browse through the commands using the emojis below.')
            .setColor('#ff4757')
            .setFooter({ text: `Page 1 of ${Math.ceil(commands.length / itemsPerPage)}` })
            .setTimestamp();

        // Generate the command list for the current page
        function generatePage() {
            let commandList = '';
            const pageCommands = commands.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
            pageCommands.forEach(command => {
                commandList += `**/${command.data.name}**: ${command.data.description || 'No description available'}\n`;
            });
            return commandList || 'No commands available on this page.';
        }

        // Set the content of the embed for the current page
        embed.setDescription(generatePage());

        // Send the initial embed and react with page navigation emojis
        const message = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Add emoji reactions for navigation
        await message.react('⬅️'); // Previous
        await message.react('➡️'); // Next

        // Create a filter to only accept reactions from the user who invoked the command
        const filter = (reaction, user) => {
            return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        // Create a reaction collector to handle emoji reactions
        const collector = message.createReactionCollector({ filter, time: 60000 });

        collector.on('collect', async reaction => {
            if (reaction.emoji.name === '➡️') {
                // If the user clicks 'Next', move to the next page
                if (currentPage < Math.ceil(commands.length / itemsPerPage) - 1) {
                    currentPage++;
                }
            } else if (reaction.emoji.name === '⬅️') {
                // If the user clicks 'Previous', move to the previous page
                if (currentPage > 0) {
                    currentPage--;
                }
            }

            // Update the embed with the new page content
            embed.setDescription(generatePage())
                 .setFooter({ text: `Page ${currentPage + 1} of ${Math.ceil(commands.length / itemsPerPage)}` })
                 .setTimestamp();

            // Reactions must be removed before updating to prevent errors
            await reaction.users.remove(interaction.user.id);

            // Edit the message with the updated page
            await message.edit({ embeds: [embed] });

            // Re-add the reactions for pagination
            await message.react('⬅️');
            await message.react('➡️');
        });

        collector.on('end', async () => {
            // Disable the reactions after the collector ends (no more interaction)
            await message.reactions.removeAll();
            embed.setFooter({ text: `Help Session Expired | Last accessed at: ${new Date().toLocaleString()}` });
            await message.edit({ embeds: [embed] });
        });
    },
};
