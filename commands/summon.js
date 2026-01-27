const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerData, savePlayerData, fetchRandomCharacter } = require('../utils/tcgUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summon')
        .setDescription('Summon a random anime character to your TCG collection'),

    async execute(interaction) {
        // Defer reply because AniList API might take a moment
        await interaction.deferReply();

        const userId = interaction.user.id;
        const playerData = getPlayerData(userId);

        // Fetch a random character from AniList with auto-calculated stats
        const character = await fetchRandomCharacter();

        if (!character) {
            return await interaction.editReply('Failed to fetch a character from AniList. Please try again later.');
        }

        const charName = character.name.full;
        const charImage = character.image.large;
        const sourceMedia = character.media.nodes[0]?.title.romaji || 'Unknown Anime';
        const charRarity = character.rarity;
        const charColor = character.color;
        const charOvr = character.ovr;

        // Save character to collection with metadata for the collection command
        if (playerData.collection[charName]) {
            playerData.collection[charName].count++;
            // Optionally update OVR if the newly summoned one is somehow better (not possible with current logic but for future)
            if (charOvr > (playerData.collection[charName].ovr || 0)) {
                playerData.collection[charName].ovr = charOvr;
                playerData.collection[charName].rarity = charRarity;
                playerData.collection[charName].color = charColor;
                playerData.collection[charName].source = sourceMedia;
            }
        } else {
            playerData.collection[charName] = {
                count: 1,
                rarity: charRarity,
                ovr: charOvr,
                color: charColor,
                source: sourceMedia,
                image: charImage,
                id: character.id
            };
        }

        // Update last summon time
        playerData.lastSummon = Date.now();

        // Save data back to the individual player file
        savePlayerData(userId, playerData);

        // Build the result embed
        const embed = new EmbedBuilder()
            .setTitle(`SUMMON SUCCESSFUL`)
            .setDescription(`You have summoned **${charName}**!\n\n**Source:** ${sourceMedia}\n**Overall (OVR):** \`${charOvr}\``)
            .setImage(charImage)
            .setColor(charColor)
            .addFields(
                { name: 'Rarity', value: `**${charRarity}**`, inline: true },
                { name: 'Unique Cards', value: `${Object.keys(playerData.collection).length}`, inline: true }
            )
            .setFooter({ text: `Character ID: ${character.id} • Collection: ${Object.values(playerData.collection).reduce((acc, curr) => acc + (typeof curr === 'object' ? curr.count : curr), 0)} total` });

        await interaction.editReply({ embeds: [embed] });
    }
};
