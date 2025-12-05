const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// We need to reach into crank.js to grab the image generation function.
// This is not ideal, but for a test command, it's acceptable.
// In a real application, you'd export generateRewardsImage from its own module.
const { generateRewardsImage } = require('./crank.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testcrank')
        .setDescription('Generates a test of the crank reward image.'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // --- Mock Data ---
            const username = interaction.user.username;
            const streakDay = Math.floor(Math.random() * 30) + 1; // Random day between 1 and 30
            const streakBroken = Math.random() > 0.8; // 20% chance to show a "broken" streak image

            const rewards = {
                money: Math.floor(Math.random() * 1000000),
                ramen: Math.floor(Math.random() * 100),
                exp: Math.floor(Math.random() * 500),
                ss: Math.random() > 0.5 ? Math.floor(Math.random() * 150) : 0, // 50% chance of SS
            };

            const ssInfo = {
                ss: rewards.ss,
                isBonus: rewards.ss > 0,
                ssChance: 20, // Just a static value for the display
                isWeekend: false,
            };

            // --- Generate Image ---
            const imagePath = await generateRewardsImage(
                username,
                streakDay,
                rewards,
                ssInfo,
                streakBroken
            );

            const attachment = new AttachmentBuilder(imagePath);

            await interaction.editReply({
                content: `Here is a test reward image for **Day ${streakDay}**.`,
                files: [attachment]
            });

            // --- Cleanup ---
            fs.unlinkSync(imagePath);

        } catch (error) {
            console.error('Error generating test crank image:', error);
            await interaction.editReply('There was an error while generating the test image.');
        }
    },
};
