const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for an obtainable jutsu and see its effects.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The name of the jutsu to search for')
                .setRequired(true)),

    async execute(interaction) {
        const query = interaction.options.getString('query').toLowerCase();
        const dbPath = path.join(__dirname, '..', 'data', 'jutsu_database.json');

        if (!fs.existsSync(dbPath)) {
            return interaction.reply({ content: 'Jutsu database is not initialized. Please try again later.', ephemeral: true });
        }

        try {
            const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const results = [];

            for (const hash in db) {
                const jutsu = db[hash];
                if (jutsu.name.toLowerCase().includes(query)) {
                    results.push(jutsu);
                }
            }

            if (results.length === 0) {
                return interaction.reply({ content: `No jutsus found matching "${query}".`, ephemeral: true });
            }

            if (results.length === 1) {
                const jutsu = results[0];
                const embed = new EmbedBuilder()
                    .setTitle(jutsu.name)
                    .setColor('#ff4757')
                    .setDescription(jutsu.description)
                    .addFields(
                        { name: 'Chakra Cost', value: jutsu.chakra, inline: true },
                        { name: 'Obtainment', value: jutsu.obtainment, inline: true }
                    )
                    .setURL(`https://shinobirpg.online/jutsus/${jutsu.hash}`)
                    .setFooter({ text: 'Powered by ShinobiRPG Database' });

                return interaction.reply({ embeds: [embed] });
            }

            // Multiple results
            const resultList = results.slice(0, 10).map(j => `• **${j.name}** ( [View Page](https://shinobirpg.online/jutsus/${j.hash}) )`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('Jutsu Search Results')
                .setColor('#ff4757')
                .setDescription(`Found ${results.length} matches for "${query}":\n\n${resultList}${results.length > 10 ? '\n\n*...and more. Try a more specific search!*' : ''}`);

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Search command error:', error);
            return interaction.reply({ content: 'An error occurred while searching the database.', ephemeral: true });
        }
    },
};
