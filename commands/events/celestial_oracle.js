const { SlashCommandBuilder } = require('discord.js');
const { runBattle } = require('../combinedcommands.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('celestial_oracle')
        .setDescription('Consult the Celestial Oracle for wisdom and rewards!'),
    async execute(interaction) {
        const player = interaction.user;

        // Define the unique NPC
        const npcName = 'The Celestial Oracle';
        const npcDescription = 'A being of pure starlight and cosmic energy, known for its cryptic prophecies and immense power.';
        const npcImage = 'https://i.imgur.com/YourUniqueOracleImage.png'; // Replace with a unique image URL

        // Event logic
        await interaction.reply({
            content: `You approach the shimmering veil where ${npcName} resides. A voice, like a thousand whispered stars, echoes in your mind: "Seeker, your path is intertwined with destiny. Prove your worth, and the cosmos shall bestow its boons."`,
            embeds: [
                {
                    title: `${npcName}`,
                    description: npcDescription,
                    color: 0x8A2BE2, // Purple
                    image: {
                        url: npcImage
                    },
                    fields: [
                        {
                            name: "What do you do?",
                            value: "The Oracle awaits your response. Will you:\n1. **Seek a Prophecy** (Initiate a battle)\n2. **Offer a Tribute** (Leave peacefully)"
                        }
                    ],
                    footer: {
                        text: `Challenged by: ${player.username}`
                    }
                }
            ],
            components: [
                {
                    type: 1, // ActionRow
                    components: [
                        {
                            type: 2, // Button
                            style: 1, // Primary
                            label: "Seek Prophecy",
                            custom_id: "seek_prophecy"
                        },
                        {
                            type: 2, // Button
                            style: 4, // Danger
                            label: "Offer Tribute",
                            custom_id: "offer_tribute"
                        }
                    ]
                }
            ]
        });

        const filter = i => i.user.id === player.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, max: 1, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'seek_prophecy') {
                await i.deferUpdate();
                const battleResult = await runBattle(player, interaction, {
                    npcName: npcName,
                    npcDescription: npcDescription,
                    npcImage: npcImage,
                    player: player,
                    moneyReward: Math.floor(Math.random() * 100) + 50, // 50-150
                    expReward: Math.floor(Math.random() * 50) + 25,    // 25-75
                    ramenReward: Math.floor(Math.random() * 3) + 1,    // 1-4
                    ssChance: 0.1, // 10% chance for SS
                    fallbackNpcImage: 'https://i.imgur.com/fallback.png' // Replace with your fallback image
                });

                if (battleResult) {
                    await interaction.editReply({ content: battleResult.message, embeds: [], components: [] });
                } else {
                    await interaction.editReply({ content: "An unexpected error occurred during the battle.", embeds: [], components: [] });
                }

            } else if (i.customId === 'offer_tribute') {
                await i.update({
                    content: `You offer a respectful bow and depart from ${npcName}'s presence, the echoes of starlight fading behind you.`,
                    embeds: [],
                    components: []
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: "The Oracle's veil shimmers, but you have hesitated for too long. The moment has passed.", embeds: [], components: [] });
            }
        });
    },
};