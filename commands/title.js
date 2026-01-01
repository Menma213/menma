const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '..', 'data', 'users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('title')
        .setDescription('Manage your earned titles.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all your unlocked titles.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('equip')
                .setDescription('Equip a title from your collection.')
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subheading = interaction.options.getSubcommand();
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];

        if (!user) return interaction.reply({ content: "You are not registered.", ephemeral: true });

        // Ensure title storage exists
        if (!user.unlocked_titles) user.unlocked_titles = [];

        // Add default title if empty
        if (user.unlocked_titles.length === 0) {
            user.unlocked_titles.push('Genin');
        }

        if (subheading === 'list') {
            const currentTitle = user.title || "None";
            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Titles`)
                .setColor('#FFD700')
                .setDescription(`**Current Title:** ${currentTitle}\n\n**Unlocked Titles:**\n${user.unlocked_titles.map(t => `• ${t}`).join('\n')}`)
                .setFooter({ text: "Use /title equip to change your title." });

            return interaction.reply({ embeds: [embed] });
        }

        if (subheading === 'equip') {
            if (user.unlocked_titles.length === 0) {
                return interaction.reply({ content: "You have no titles to equip!", ephemeral: true });
            }

            const options = user.unlocked_titles.map(title => ({
                label: title,
                value: title
            })).slice(0, 25); // Discord limit

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('equip_title_select')
                .setPlaceholder('Select a title to equip')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const response = await interaction.reply({
                content: `**Current Title:** ${user.title || "None"}\nSelect a title to equip:`,
                components: [row],
                fetchReply: true
            });

            const filter = i => i.customId === 'equip_title_select' && i.user.id === userId;
            const collector = response.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const selectedTitle = i.values[0];

                // Reload user data to avoid race conditions
                const currentUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                currentUsers[userId].title = selectedTitle;
                fs.writeFileSync(usersPath, JSON.stringify(currentUsers, null, 2));

                await i.update({ content: `**Transformed!**\nYou are now known as **${selectedTitle}**!`, components: [] });
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    // Cleanup if needed
                }
            });
        }
    }
};
