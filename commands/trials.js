const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle, getCooldownString } = require('./combinedcommands.js');
const { userMutex, bountyMutex, jutsuMutex, mentorMutex } = require('../utils/locks');

const usersPath = path.resolve(__dirname, '../data/users.json');
const playersPath = path.resolve(__dirname, '../data/players.json');
const giftPath = path.resolve(__dirname, '../data/gift.json'); // Kept for reference if needed, but unused now
const bountyPath = path.resolve(__dirname, '../data/bounty.json');
const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
const jutsuJsonPath = path.resolve(__dirname, '../data/jutsu.json');
const mentorExpPath = path.resolve(__dirname, '../data/mentorexp.json');
const DONATOR_ROLE = "1385640728130097182";
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";

// --- Hokage Trials Data ---
const HOKAGE_TRIALS = [
    {
        name: "Kakashi Hatake",
        image: "https://www.pngplay.com/wp-content/uploads/12/Kakashi-Hatake-Transparent-Background.png",
        health: 25000,
        power: 2100,
        defense: 1500,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Lightning Blade", "Summon Ninken"],
        combos: ["Lightning Hound Combo"],
        dropJutsu: "One Thousand Years of Death",
        statsType: "fixed"
    },
    {
        name: "Tsunade",
        image: "https://i.pinimg.com/236x/e5/2b/dc/e52bdc19eWJh8J6Mx9DrGXKEv3ojKmqw8Cv9pscK.jpg",
        health: 30000,
        power: 3000,
        defense: 2110,
        accuracy: 90,
        dodge: 15,
        jutsu: ["Attack", "Cherry Blossom Impact", "Creation Rebirth"],
        combos: ["Genesis Combo"],
        dropJutsu: "Creation Rebirth",
        statsType: "fixed"
    },
    {
        name: "Hiruzen Sarutobi",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hiruzen-Sarutobi-PNG-Photos.png",
        health: 40010,
        power: 4200,
        defense: 5500,
        accuracy: 92,
        dodge: 20,
        jutsu: ["Attack", "Fireball Jutsu", "Burning Ash"],
        combos: ["Flame Reaper Combo"],
        dropJutsu: "Burning Ash",
        statsType: "fixed"
    },
    {
        name: "Tobirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Tobirama-Senju-PNG-Pic-Background.png",
        health: 51000,
        power: 7000,
        defense: 6000,
        accuracy: 97,
        dodge: 30,
        jutsu: ["Attack", "Water Dragon Jutsu", "Shadow Clone Jutsu"],
        combos: ["Water Clone Combo"],
        dropJutsu: "Water Dragon Jutsu",
        statsType: "fixed"
    },
    {
        name: "Minato Namikaze",
        image: "https://www.pngplay.com/wp-content/uploads/12/Minato-Namikaze-Transparent-Free-PNG.png",
        health: 57000,
        power: 8000,
        defense: 7000,
        accuracy: 100,
        dodge: 40,
        jutsu: ["Attack", "Rasengan", "Flying Raijin Jutsu"],
        combos: ["Flash Combo"],
        dropJutsu: "Flying Raijin Jutsu",
        statsType: "fixed"
    },
    {
        name: "Hashirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hashirama-Senju-No-Background.png",
        health: 59000,
        power: 10000,
        defense: 8000,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Creation Rebirth", "Great Forest Crumbling"],
        combos: ["Forest Genesis Combo"],
        dropJutsu: "Great Forest Crumbling",
        statsType: "fixed"
    },
    {
        name: "Naruto Uzumaki",
        image: "https://pngimg.com/d/naruto_PNG18.png",
        health: 60000,
        power: 13000,
        defense: 8000,
        accuracy: 98,
        dodge: 35,
        jutsu: ["Attack", "Shadow Clone Jutsu", "Rasenshuriken"],
        combos: ["Ultimate Combo"],
        dropJutsu: "Rasenshuriken",
        statsType: "fixed"
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

        let onCooldown = false;
        let cooldownLeft = 0;
        let userExists = false;

        await userMutex.runExclusive(async () => {
            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
            if (!users[userId]) {
                userExists = false;
                return;
            }
            userExists = true;

            const now = Date.now();
            let cooldownMs = 25 * 60 * 1000;
            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 13 * 60 * 1000;
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = Math.round(14 * 60 * 1000);
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = Math.round(15 * 60 * 1000);
            }

            if (users[userId].LastTrials && now - users[userId].LastTrials < cooldownMs) {
                onCooldown = true;
                cooldownLeft = cooldownMs - (now - users[userId].LastTrials);
            } else {
                users[userId].LastTrials = now;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            }
        });

        if (!userExists) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        if (onCooldown) {
            return interaction.reply({ content: `You can do this again in ${getCooldownString(cooldownLeft)}.`, ephemeral: false });
        }

        await interaction.deferReply({ ephemeral: false });

        let currentTrialIndex = 0;
        let userLostTrial = false;

        // --- Loop through Hokage trials ---
        while (currentTrialIndex < HOKAGE_TRIALS.length && !userLostTrial) {
            const npcTemplate = HOKAGE_TRIALS[currentTrialIndex];
            const npcId = `NPC_${npcTemplate.name.replace(/\s+/g, '_')}`;

            await interaction.followUp({ content: `**Trial Battle ${currentTrialIndex + 1}/${HOKAGE_TRIALS.length} Started!**\nYou are facing **${npcTemplate.name}**!` });

            const battleResult = await runBattle(interaction, userId, npcId, 'trials', npcTemplate);

            if (battleResult && battleResult.winner && battleResult.winner.userId === userId) {
                // Player won
                let playerLevel = 1;
                let userLocation = 'land_of_fire';

                await userMutex.runExclusive(async () => {
                    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                    const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
                    playerLevel = players[userId]?.level || 1;
                    userLocation = users[userId]?.location || 'land_of_fire';
                });

                const territoriesPath = path.resolve(__dirname, '../data/territories.json');
                let currentTier = 1;
                try {
                    const territoriesData = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
                    currentTier = territoriesData.territories[userLocation]?.tier || 1;
                } catch (e) {
                    console.error('[trials.js] Failed to read current tier:', e);
                }

                const expReward = Math.round((25 + (playerLevel * 0.5)) * currentTier);
                const moneyReward = 10000 * currentTier;

                // Apply Rewards
                await userMutex.runExclusive(async () => {
                    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                    const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};

                    if (players[userId]) {
                        players[userId].exp += expReward;
                        players[userId].money += moneyReward;
                    }

                    if (users[userId]) {
                        users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                        users[userId].wins = (users[userId].wins || 0) + 1;
                    }

                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
                });

                // Update Mentor EXP in mentorexp.json
                await mentorMutex.runExclusive(async () => {
                    let me = {};
                    try {
                        me = JSON.parse(fs.readFileSync(mentorExpPath, 'utf8'));
                    } catch (e) { }
                    if (!me[userId]) me[userId] = { exp: 0, last_train: 0 };
                    me[userId].exp += 1;
                    fs.writeFileSync(mentorExpPath, JSON.stringify(me, null, 2));
                });

                // Bounty
                const akatsukiData = fs.existsSync(akatsukiPath) ? JSON.parse(fs.readFileSync(akatsukiPath, 'utf8')) : {};
                let bountyDescription = '';
                if (akatsukiData.members && akatsukiData.members[userId]) {
                    await bountyMutex.runExclusive(async () => {
                        const bountyData = fs.existsSync(bountyPath) ? JSON.parse(fs.readFileSync(bountyPath, 'utf8')) : {};
                        if (!bountyData[userId]) {
                            bountyData[userId] = { bounty: 0 };
                        }
                        bountyData[userId].bounty += 10;
                        fs.writeFileSync(bountyPath, JSON.stringify(bountyData, null, 2));
                    });
                    bountyDescription = `\n<@${userId}> has earned 10 bounty!`;
                }

                const rewardEmbed = new EmbedBuilder()
                    .setTitle(`Trial ${currentTrialIndex + 1} Cleared!`)
                    .setDescription(
                        `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!${bountyDescription}\n\nRewards have been added to your account.`
                    )
                    .setColor('#006400');
                await interaction.channel.send({ embeds: [rewardEmbed] });

                // Jutsu Drop
                const dropJutsu = npcTemplate.dropJutsu;
                if (dropJutsu) {
                    await jutsuMutex.runExclusive(async () => {
                        let jutsuJson = fs.existsSync(jutsuJsonPath) ? JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8')) : {};
                        if (!jutsuJson[userId]) jutsuJson[userId] = { usersjutsu: [] };
                        if (!Array.isArray(jutsuJson[userId].usersjutsu)) jutsuJson[userId].usersjutsu = [];

                        if (!jutsuJson[userId].usersjutsu.includes(dropJutsu)) {
                            jutsuJson[userId].usersjutsu.push(dropJutsu);
                            fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuJson, null, 2));
                            await interaction.channel.send({ content: `You obtained a new jutsu: **${dropJutsu}**! (Added to your jutsu list)` });
                        } else {
                            await interaction.channel.send({ content: `You already have the jutsu: **${dropJutsu}**.` });
                        }
                    });
                }

                currentTrialIndex++;

            } else {
                // Loss
                userLostTrial = true;
                await userMutex.runExclusive(async () => {
                    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                    if (users[userId]) {
                        users[userId].losses = (users[userId].losses || 0) + 1;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }
                });
                await interaction.followUp(`**Trial Failed!** You were defeated by ${npcTemplate.name}.`);
                break;
            }
        }

        // Final Summary
        await userMutex.runExclusive(async () => {
            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
            if (users[userId]) {
                if (!userLostTrial && currentTrialIndex >= HOKAGE_TRIALS.length) {
                    await interaction.followUp(`**Congratulations!** You have successfully completed all Hokage Trials!`);
                    users[userId].trialsResult = "win";
                } else if (userLostTrial) {
                    users[userId].trialsResult = "lose";
                }
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            }
        });
    }
};