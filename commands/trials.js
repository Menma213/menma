// trials.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle, getCooldownString } = require('./combinedcommands.js'); // Assuming runBattle and getCooldownString are in combinedcommands.js

// --- Configuration ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const jutsuJsonPath = path.resolve(__dirname, '../../menma/data/jutsu.json'); // Path to jutsu.json

// Role IDs (these would typically be fetched from your Discord server config)
const JINCHURIKI_ROLE = "1385641469507010640"; // Example ID
const LEGENDARY_ROLE = "1385640798581952714"; // Example ID
const DONATOR_ROLE = "1385640728130097182";  // Example ID
// --- Hokage Trials Data ---
const HOKAGE_TRIALS = [
    {
        name: "Kakashi Hatake",
        image: "https://www.pngplay.com/wp-content/uploads/12/Kakashi-Hatake-Transparent-Background.png",
        health: 25000, // Changed from baseHealth
        power: 2100, // Changed from basePower
        defense: 1500, // Changed from baseDefense
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Lightning Blade", "Summon Ninken"],
        combos: ["Lightning Hound Combo"],
        dropJutsu: "One Thousand Years of Death",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Tsunade",
        image: "https://www.pngitem.com/pimgs/m/392-3928595_naruto-tsunadesenju-tsunadesama-tsunade-naruto-tsunade-png-transparent.png",
        health: 30000, // Changed from baseHealth
        power: 3000, // Changed from basePower
        defense: 2110, // Changed from baseDefense
        accuracy: 90,
        dodge: 15,
        jutsu: ["Attack", "Cherry Blossom Impact", "Creation Rebirth"],
        combos: ["Genesis Combo"],
        dropJutsu: "Creation Rebirth",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Hiruzen Sarutobi",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hiruzen-Sarutobi-PNG-Photos.png",
        health: 40010, // Changed from baseHealth
        power: 4200, // Changed from basePower
        defense: 5500, // Changed from baseDefense
        accuracy: 92,
        dodge: 20,
        jutsu: ["Attack", "Fireball Jutsu", "Burning Ash"],
        combos: ["Flame Reaper Combo"],
        dropJutsu: "Burning Ash",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Tobirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Tobirama-Senju-PNG-Pic-Background.png",
        health: 51000, // Changed from baseHealth
        power: 7000, // Changed from basePower
        defense: 6000, // Changed from baseDefense
        accuracy: 97,
        dodge: 30,
        jutsu: ["Attack", "Water Dragon Jutsu", "Shadow Clone Jutsu"],
        combos: ["Water Clone Combo"],
        dropJutsu: "Water Dragon Jutsu",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Minato Namikaze",
        image: "https://www.pngplay.com/wp-content/uploads/12/Minato-Namikaze-Transparent-Free-PNG.png",
        health: 57000, // Changed from baseHealth
        power: 8000, // Changed from basePower
        defense: 7000, // Changed from baseDefense
        accuracy: 100,
        dodge: 40,
        jutsu: ["Attack", "Rasengan", "Flying Raijin Jutsu"],
        combos: ["Flash Combo"],
        dropJutsu: "Flying Raijin Jutsu",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Hashirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hashirama-Senju-No-Background.png",
        health: 59000, // Changed from baseHealth
        power: 10000, // Changed from basePower
        defense: 8000, // Changed from baseDefense
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Creation Rebirth", "Great Forest Crumbling"],
        combos: ["Forest Genesis Combo"],
        dropJutsu: "Great Forest Crumbling",
        statsType: "fixed" // Added statsType
    },
    {
        name: "Naruto Uzumaki",
        image: "https://pngimg.com/d/naruto_PNG18.png",
        health: 60000, // Changed from baseHealth
        power: 13000, // Changed from basePower
        defense: 8000, // Changed from baseDefense
        accuracy: 98,
        dodge: 35,
        jutsu: ["Attack", "Shadow Clone Jutsu", "Rasenshuriken"],
        combos: ["Ultimate Combo"],
        dropJutsu: "Rasenshuriken",
        statsType: "fixed" // Added statsType
    }
];
// --- Helper Function to Generate Unique Gift ID ---
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 50000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// --- Slash Command Definition ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('trials')
        .setDescription('Embark on the Hokage Trials!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        // Load user data
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        const playerLevel = players[userId]?.level || 1;
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // --- Cooldown System ---
        const now = Date.now();
        let cooldownMs = 25 * 60 * 1000; // Default 25 min

        // Check premium roles (jinchuriki > legendary > donator)
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 13 * 60 * 1000; // 13 min
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(14 * 60 * 1000 ); // 14.3 min
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(15 * 60 * 1000 ); // 15.73 min
        }

        // Check if user is on cooldown
        if (users[userId].LastTrials && now - users[userId].LastTrials < cooldownMs) {
            const left = cooldownMs - (now - users[userId].LastTrials);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: false });
        }

        // --- Register cooldown instantly when command is sent ---
        users[userId].LastTrials = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        await interaction.deferReply({ ephemeral: false });

        let currentTrialIndex = 0;
        let userLostTrial = false;

        // --- Loop through Hokage trials ---
        while (currentTrialIndex < HOKAGE_TRIALS.length && !userLostTrial) {
            const npcTemplate = HOKAGE_TRIALS[currentTrialIndex];
            const npcId = `NPC_${npcTemplate.name.replace(/\s+/g, '_')}`; // Unique ID for trial NPCs, sanitize name

            await interaction.followUp({ content: `**Trial Battle ${currentTrialIndex + 1}/${HOKAGE_TRIALS.length} Started!**\nYou are facing **${npcTemplate.name}**!` });
            // Pass npcTemplate to runBattle so the correct Hokage NPC is used
            const battleResult = await runBattle(interaction, userId, npcId, 'trials', npcTemplate);

            if (battleResult && battleResult.winner && battleResult.winner.userId === userId) {
                // Player won this trial
                const expReward = 1 + (playerLevel * 1);
                const moneyReward = 10000;

                // --- Send rewards to gift inventory (gift.json) ---
                let giftData = fs.existsSync(giftPath) ? JSON.parse(fs.readFileSync(giftPath, 'utf8')) : {};
                if (!giftData[userId]) giftData[userId] = [];

                // Add EXP reward as a gift
                giftData[userId].push({
                    id: generateGiftId(giftData[userId]),
                    type: 'exp',
                    amount: expReward,
                    from: 'trials',
                    date: Date.now()
                });

                // Add Money reward as a gift
                giftData[userId].push({
                    id: generateGiftId(giftData[userId]),
                    type: 'money',
                    amount: moneyReward,
                    from: 'trials',
                    date: Date.now()
                });

                // Save updated gift inventory
                fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));

                users[userId].wins = (users[userId].wins || 0) + 1;
                // Add +1 mentor EXP on trial win
                if (users[userId]) {
                    users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                }
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                const rewardEmbed = new EmbedBuilder()
                    .setTitle(`Trial ${currentTrialIndex + 1} Cleared!`)
                    .setDescription(
                        `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!\n\nAll rewards have been sent to your gift inventory. Use **/gift inventory** to claim them!`
                    )
                    .setColor('#006400'); // Green color for success
                await interaction.followUp({ embeds: [rewardEmbed] });

                // Handle Jutsu Drop (add directly to jutsu.json if user doesn't have it)
                const dropJutsu = npcTemplate.dropJutsu;
                if (dropJutsu) {
                    let jutsuJson = fs.existsSync(jutsuJsonPath) ? JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8')) : {};
                    if (!jutsuJson[userId]) jutsuJson[userId] = { usersjutsu: [] };
                    if (!Array.isArray(jutsuJson[userId].usersjutsu)) jutsuJson[userId].usersjutsu = [];

                    if (!jutsuJson[userId].usersjutsu.includes(dropJutsu)) {
                        jutsuJson[userId].usersjutsu.push(dropJutsu);
                        fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuJson, null, 2));
                        await interaction.followUp({ content: `You obtained a new jutsu: **${dropJutsu}**! (Added to your jutsu list)` });
                    } else {
                        await interaction.followUp({ content: `You already have the jutsu: **${dropJutsu}**.` });
                    }
                }

                // Move to the next trial
                currentTrialIndex++;

            } else { // Battle result is 'lose' or player fled
                userLostTrial = true;
                users[userId].losses = (users[userId].losses || 0) + 1;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                await interaction.followUp(`**Trial Failed!** You were defeated by ${npcTemplate.name}.`);
                break; // Exit the trial loop
            }
        }

        // --- Final summary after all trials or early exit ---
        if (!userLostTrial && currentTrialIndex >= HOKAGE_TRIALS.length) {
            await interaction.followUp(`**Congratulations!** You have successfully completed all Hokage Trials!`);
            users[userId].trialsResult = "win"; // For tutorial tracking
        } else if (userLostTrial) {
            users[userId].trialsResult = "lose"; // For tutorial tracking
        }
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    }
};