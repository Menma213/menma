const { SlashCommandBuilder } = require('discord.js');
const { runBattle } = require('./combinedcommands.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('training')
        .setDescription('Practice battle against a Training Dummy'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Define Training Dummy Template
        const dummyTemplate = {
            name: "Training Dummy",
            image: "https://ark.wiki.gg/images/thumb/Training_Dummy.png/228px-Training_Dummy.png?72e397",
            health: 20000000000,
            maxHealth: 20000000000,
            power: 50000,
            defense: 50000,
            accuracy: 80,
            dodge: 0,
            jutsu: ["Transformation"],
            statsType: 'fixed',
            level: 1,
            immunities: [],
            activeEffects: []
        };

        try {
            // Interact immediately
            await interaction.reply({ content: "Starting training session...", fetchReply: true });

            // Start Battle
            // runBattle(interaction, player1Id, player2Id, battleType, npcTemplate, mode)
            await runBattle(interaction, userId, 'NPC_Training Dummy', 'practice', dummyTemplate, 'practice');

        } catch (err) {
            console.error('Error in training command:', err);
            if (!interaction.replied) {
                await interaction.reply({ content: "An error occurred starting training.", ephemeral: true });
            } else {
                await interaction.followUp({ content: "An error occurred starting training.", ephemeral: true });
            }
        }
    }
};
