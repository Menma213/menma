const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { generateTerritoryMap } = require('../utils/mapGenerator');
const fs = require('fs');
const path = require('path');

const territoriesPath = path.resolve(__dirname, '../data/territories.json');
const clansPath = path.resolve(__dirname, '../data/clans.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('map')
        .setDescription('View the ninja world map and your current location'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Load clan colors for dynamic coloring
            const clans = fs.existsSync(clansPath) ? JSON.parse(fs.readFileSync(clansPath, 'utf8')) : {};
            const clanColors = {};

            for (const [clanId, clan] of Object.entries(clans)) {
                if (clan.color) {
                    clanColors[clanId] = clan.color;
                }
            }

            // Get user location
            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
            const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
            const user = users[interaction.user.id];
            const userLocationName = user ? user.location : null;
            const userLocation = userLocationName ? territories.territories[userLocationName]?.position : null;

            // Generate map
            const mapBuffer = await generateTerritoryMap({
                showLabels: true,
                showControlPercentage: false,
                clanColors,
                userLocation
            });

            const attachment = new AttachmentBuilder(mapBuffer, { name: 'territory-map.png' });

            // Create embed with territory summary
            const embed = new EmbedBuilder()
                .setTitle('🗺️ Ninja World Territory Map')
                .setDescription('Current territory control across the ninja world')
                .setColor('#FFD700')
                .setImage('attachment://territory-map.png')
                .setTimestamp();

            // Add territory summary
            const summary = {};
            for (const territory of Object.values(territories.territories)) {
                if (territory.controlledBy) {
                    if (!summary[territory.controlledBy]) {
                        summary[territory.controlledBy] = [];
                    }
                    summary[territory.controlledBy].push(territory.displayName);
                }
            }

            if (Object.keys(summary).length > 0) {
                for (const [clanId, territoryList] of Object.entries(summary)) {
                    const clan = clans[clanId];
                    const clanName = clan?.name || clanId;
                    embed.addFields({
                        name: `${clanName} (${territoryList.length} territories)`,
                        value: territoryList.join(', '),
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: 'No Territories Claimed',
                    value: 'The ninja world awaits conquest! Form a clan and claim your territory.',
                    inline: false
                });
            }

            if (userLocationName) {
                const currentTerritory = territories.territories[userLocationName];
                embed.addFields({
                    name: '📍 Your Location',
                    value: `You are currently in **${currentTerritory?.displayName || userLocationName}**`,
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('[map.js] Error:', error);
            await interaction.editReply({
                content: 'An error occurred while generating the map.',
                ephemeral: true
            });
        }
    }
};
