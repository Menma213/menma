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
        const charHp = character.hp;
        const charPower = character.power;
        const charDefense = character.defense;

        // Helper to get rarity weight
        const getRarityWeight = (rarity) => {
            switch (rarity) {
                case 'Mythic': return 6;
                case 'Legendary': return 5;
                case 'Epic': return 4;
                case 'Rare': return 3;
                case 'Uncommon': return 2;
                case 'Common': return 1;
                default: return 0;
            }
        };

        // Save character to collection with metadata for the collection command
        if (playerData.collection[charName]) {
            playerData.collection[charName].count++;

            const currentRarityWeight = getRarityWeight(playerData.collection[charName].rarity);
            const newRarityWeight = getRarityWeight(charRarity);

            // If new card is better rarity, upgrade the stats
            if (newRarityWeight > currentRarityWeight) {
                playerData.collection[charName].rarity = charRarity;
                playerData.collection[charName].color = charColor;
                playerData.collection[charName].source = sourceMedia;
                playerData.collection[charName].hp = charHp;
                playerData.collection[charName].power = charPower;
                playerData.collection[charName].defense = charDefense;
            }
        } else {
            playerData.collection[charName] = {
                count: 1,
                rarity: charRarity,
                color: charColor,
                source: sourceMedia,
                image: charImage,
                id: character.id,
                hp: charHp,
                power: charPower,
                defense: charDefense
            };
        }

        // Update last summon time
        playerData.lastSummon = Date.now();

        // Save data back to the individual player file
        savePlayerData(userId, playerData);

        // Build the result embed
        const embed = new EmbedBuilder()
            .setTitle(`SUMMON SUCCESSFUL`)
            .setDescription(`You have summoned **${charName}**!\n\n**Source:** ${sourceMedia}\n**Rarity:** ${charRarity}`)
            .setImage(charImage)
            .setColor(charColor)
            .addFields(
                { name: 'Stats', value: `💪 Power: ${charPower}\n🛡️ Defense: ${charDefense}\n❤️ HP: ${charHp}`, inline: false },
                { name: 'Unique Cards', value: `${Object.keys(playerData.collection).length}`, inline: true }
            )
            .setFooter({ text: `Character ID: ${character.id} • Collection: ${Object.values(playerData.collection).reduce((acc, curr) => acc + (typeof curr === 'object' ? curr.count : curr), 0)} total` });

        await interaction.editReply({ embeds: [embed] });
    }
};
