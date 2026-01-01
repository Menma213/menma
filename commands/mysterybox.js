const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { userMutex } = require('../utils/locks');

const usersPath = path.resolve(__dirname, '../data/users.json');
const jutsuPath = path.resolve(__dirname, '../data/jutsu.json');
const jutsusDefPath = path.resolve(__dirname, '../data/jutsus.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mysterybox')
        .setDescription('Open a one-time mystery box to receive a random jutsu!'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            await interaction.deferReply();

            let resultJutsu = null;
            let alreadyUsed = false;

            await userMutex.runExclusive(async () => {
                const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                if (!users[userId]) {
                    throw new Error("You need to enroll first!");
                }

                if (users[userId].usedMysteryBox) {
                    alreadyUsed = true;
                    return;
                }

                const jutsusDef = JSON.parse(await fs.readFile(jutsusDefPath, 'utf8'));

                // User's Must-Include list
                const whitelist = ["Carnage", "Lord of Bloodsea", "Last Resort", "Heaven's Supremacy"];

                // User's Blacklist (Absurdly broken or dev jutsus not explicitly requested)
                const blacklist = ["Attack", "Transformation Jutsu"];

                const pool = Object.keys(jutsusDef).filter(name => {
                    const j = jutsusDef[name];

                    // Always include whitelist
                    if (whitelist.includes(name)) return true;

                    // Always include round-based
                    if (j.roundBased === true) return true;

                    // Filter out core/starting/blacklisted
                    if (blacklist.includes(name)) return false;
                    if (j.obtainment === "Starting Jutsu") return false;

                    // Block other "absurd" customs or unobtainables unless they were in whitelist/roundbased
                    if (j.category === "Custom" || j.obtainment === "unobtainable") return false;
                    if (j.category === "Hokage" || j.category === "S-Rank" || j.category === "Jounin") return true;

                    // Default to including normal progression jutsus
                    return true;
                });

                if (pool.length === 0) {
                    throw new Error("No jutsus available in the mystery box right now.");
                }

                resultJutsu = pool[Math.floor(Math.random() * pool.length)];

                // Add to user's collection
                const userJutsuInventory = JSON.parse(await fs.readFile(jutsuPath, 'utf8'));
                if (!userJutsuInventory[userId]) {
                    userJutsuInventory[userId] = { usersjutsu: ["Attack", "Transformation Jutsu"], combos: [], scrolls: [] };
                }

                if (!userJutsuInventory[userId].usersjutsu.includes(resultJutsu)) {
                    userJutsuInventory[userId].usersjutsu.push(resultJutsu);
                }

                // Mark as used
                users[userId].usedMysteryBox = true;

                // Save both
                await fs.writeFile(jutsuPath, JSON.stringify(userJutsuInventory, null, 2));
                await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
            });

            if (alreadyUsed) {
                return interaction.editReply({ content: "You have already claimed your one-time Mystery Box!", flags: [MessageFlags.Ephemeral] });
            }

            const embed = new EmbedBuilder()
                .setTitle("Mystery Box Opened!")
                .setDescription(`You reached into the box and pulled out a rare scroll...\n\nYou have learned **${resultJutsu}**!`)
                .setColor("#FFD700")
                .setImage("https://media.tenor.com/y_v98-K_r8AAAAAM/naruto-scroll.gif");

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: error.message });
            } else {
                await interaction.reply({ content: error.message, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};
