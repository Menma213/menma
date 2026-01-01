const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { runBattle, comboList } = require('./combinedcommands.js');
const { handleClanMaterialDrop } = require('../utils/materialUtils.js');
const { userMutex, giftMutex, bountyMutex, mentorMutex } = require('../utils/locks');

// --- Paths (Relative to /commands) ---
const usersPath = path.resolve(__dirname, '../data/users.json');
const playersPath = path.resolve(__dirname, '../data/players.json');
const giftPath = path.resolve(__dirname, '../data/gift.json');
const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
const bountyPath = path.resolve(__dirname, '../data/bounty.json');
const mentorExpPath = path.resolve(__dirname, '../data/mentorexp.json');

// --- Constants ---
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";

const ARANK_NPCS = [
    {
        name: "Jugo",
        image: "https://i.postimg.cc/vmfSx5V1/17-D3-B777-0-FC6-4-EE4-957-D-513-CC60-D8924.png",
        baseHealth: 1.2,
        basePower: 1.5,
        baseDefense: 1.0,
        accuracy: 85,
        dodge: 5,
        jutsu: ["Attack", "Monster Claw"]
    },
    {
        name: "Temari",
        image: "https://i.postimg.cc/1tS7G4Gv/6-CCACDF3-9612-4831-8-D31-046-BEA1586-D9.png",
        baseHealth: 1.0,
        basePower: 1.4,
        baseDefense: 0.8,
        accuracy: 90,
        dodge: 10,
        jutsu: ["Attack", "Wind Scythe"]
    },
    {
        name: "Kankuro",
        image: "https://i.postimg.cc/y8wbNLk4/5-F95788-A-754-C-4-BA6-B0-E0-39-BCE2-FDCF04.png",
        baseHealth: 1.0,
        basePower: 1.3,
        baseDefense: 1.2,
        accuracy: 80,
        dodge: 5,
        jutsu: ["Attack", "Puppet Master"]
    },
    {
        name: "Suigetsu",
        image: "https://i.postimg.cc/GmBfrW3x/54-AE56-B1-E2-EE-4179-BD24-EEC282-A8-B3-BF.png",
        baseHealth: 1.4,
        basePower: 1.2,
        baseDefense: 1.1,
        accuracy: 75,
        dodge: 15,
        jutsu: ["Attack", "Water Dragon Jutsu"]
    },
    {
        name: "Fuguki",
        image: "https://i.postimg.cc/QMJJrm7q/064262-C0-1-BC4-47-B2-A06-A-59-DC193-C0285.png",
        baseHealth: 1.5,
        basePower: 1.6,
        baseDefense: 1.4,
        accuracy: 70,
        dodge: 0,
        jutsu: ["Attack", "Samehada Slash"]
    },
    {
        name: "Jinpachi",
        image: "https://i.postimg.cc/SsZLnKD2/809-EBF4-E-70-EF-4-C83-BCE4-3-D6-C228-B1239.png",
        baseHealth: 1.3,
        basePower: 1.5,
        baseDefense: 1.1,
        accuracy: 85,
        dodge: 10,
        jutsu: ["Attack", "Greast Forest Crumbling"]
    },
    {
        name: "Kushimaru",
        image: "https://i.postimg.cc/3wTF6VkR/53-BE91-D0-8-A53-47-C9-BD48-A06728-AFE79-C.png",
        baseHealth: 1.2,
        basePower: 1.4,
        baseDefense: 0.9,
        accuracy: 95,
        dodge: 20,
        jutsu: ["Attack", "One Thousand Slashes"]
    },
    {
        name: "Baki",
        image: "https://i.postimg.cc/Jn7c7XcC/5997-D785-7-C7-D-4-BC0-93-DB-CCF7-CA3-CDB56.png",
        baseHealth: 1.1,
        basePower: 1.4,
        baseDefense: 1.2,
        accuracy: 85,
        dodge: 10,
        jutsu: ["Attack", "Wind Scythe"]
    }
];

// --- Helper Functions ---
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 50000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

async function handleRewards(userId, totalEnemiesDefeated, playerLevel, interaction) {
    const baseExp = 15 + (playerLevel * 0.1);
    const baseMoney = 200 + Math.floor(playerLevel * 5);
    let exp = baseExp, money = baseMoney, isJackpot = false, isBonus = false, isNormal = false, bounty = 0;

    const missionNum = totalEnemiesDefeated + 1;

    if (missionNum % 5 === 0) {
        let bonusExp = Math.max(1 * playerLevel, baseExp);
        let bonusMoney = baseMoney;
        if (missionNum === 50) {
            exp = Math.floor(bonusExp * 3.0);
            money = Math.floor(bonusMoney * 20);
            isJackpot = true;
        } else {
            exp = Math.floor(bonusExp);
            money = Math.floor(bonusMoney);
            isBonus = true;
        }
    } else {
        isNormal = true;
    }

    // --- Akatsuki Bounty ---
    let isAkatsuki = false;
    try {
        const akatsukiContent = await fs.readFile(akatsukiPath, 'utf8');
        const akatsukiData = JSON.parse(akatsukiContent);
        if (akatsukiData.members && akatsukiData.members[userId]) isAkatsuki = true;
    } catch (e) { }

    if (isAkatsuki) {
        bounty = 10;
    }

    return { exp, money, bounty, isJackpot, isBonus, isNormal };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arank')
        .setDescription('Engage in up to 50 A-Rank NPC battles for rewards and materials.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // 1. Initial Load & Cooldown Check
        let playerStats = null;
        let cooldownInfo = { onCooldown: false, timeLeft: 0 };

        await userMutex.runExclusive(async () => {
            const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
            const players = JSON.parse(await fs.readFile(playersPath, 'utf8'));

            if (!users[userId] || !players[userId]) {
                return;
            }

            const now = Date.now();
            let cooldownMs = 20 * 60 * 1000;
            const memberRoles = interaction.member.roles.cache;

            if (memberRoles.has(JINCHURIKI_ROLE)) cooldownMs = 12 * 60 * 1000;
            else if (memberRoles.has(LEGENDARY_ROLE)) cooldownMs = Math.round(13.2 * 60 * 1000);
            else if (memberRoles.has(DONATOR_ROLE)) cooldownMs = Math.round(14.5 * 60 * 1000);

            if (users[userId].lastArank && now - users[userId].lastArank < cooldownMs) {
                cooldownInfo.onCooldown = true;
                cooldownInfo.timeLeft = cooldownMs - (now - users[userId].lastArank);
            } else {
                users[userId].lastArank = now;
                await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
                playerStats = { ...users[userId], ...players[userId], userId };
            }
        });

        if (!playerStats) {
            if (cooldownInfo.onCooldown) {
                const min = Math.floor(cooldownInfo.timeLeft / 60000);
                const sec = Math.floor((cooldownInfo.timeLeft % 60000) / 1000);
                return interaction.reply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: true });
            }
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        let totalEnemiesDefeated = 0;
        let playerLost = false;

        // Prepare player for battle loop
        let combatant = {
            ...playerStats,
            currentHealth: playerStats.health,
            chakra: playerStats.chakra || 20,
            activeEffects: [],
            accuracy: 100,
            dodge: 0,
            jutsu: playerStats.jutsu || {}
        };

        while (totalEnemiesDefeated < 50 && !playerLost) {
            const randomNpc = ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
            const npcId = `NPC_${randomNpc.name}`;

            // Clean up combatant state for new round (keep HP/Chakra from previous)
            combatant.activeEffects = [];
            if (combatant.Combo && comboList[combatant.Combo]) {
                combatant.comboState = { combo: comboList[combatant.Combo], usedJutsus: new Set() };
            }

            // Run Battle
            const result = await runBattle(interaction, userId, npcId, 'arank', randomNpc);

            if (result.winner && result.winner.userId === userId) {
                // Update persistent battle stats
                combatant.currentHealth = result.winner.currentHealth;
                combatant.chakra = result.winner.chakra;
                totalEnemiesDefeated++;

                // --- Rewards Calculation ---
                const rewards = await handleRewards(userId, totalEnemiesDefeated - 1, playerStats.level || 1, interaction);

                // --- Mentor & Wins Progress & Rewards ---
                await userMutex.runExclusive(async () => {
                    const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                    const players = JSON.parse(await fs.readFile(playersPath, 'utf8'));

                    if (users[userId]) {
                        users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                        users[userId].wins = (users[userId].wins || 0) + 1;
                    }

                    if (players[userId]) {
                        players[userId].exp += rewards.exp;
                        players[userId].money += rewards.money;
                        // Use the rounding helper if needed or simple Math.round
                        players[userId].exp = Math.round(players[userId].exp * 10) / 10;
                    }

                    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
                    await fs.writeFile(playersPath, JSON.stringify(players, null, 2));
                });

                // Update Mentor EXP in mentorexp.json
                await mentorMutex.runExclusive(async () => {
                    const me = JSON.parse(await fs.readFile(mentorExpPath, 'utf8').catch(() => "{}"));
                    if (!me[userId]) me[userId] = { exp: 0, last_train: 0 };
                    me[userId].exp += 1;
                    await fs.writeFile(mentorExpPath, JSON.stringify(me, null, 2));
                });

                if (rewards.bounty > 0) {
                    await bountyMutex.runExclusive(async () => {
                        let bountyData = {};
                        try {
                            const bContent = await fs.readFile(bountyPath, 'utf8');
                            bountyData = JSON.parse(bContent);
                        } catch (e) { }

                        if (!bountyData[userId]) bountyData[userId] = { bounty: 0 };
                        bountyData[userId].bounty += rewards.bounty;
                        await fs.writeFile(bountyPath, JSON.stringify(bountyData, null, 2));
                    });
                }

                // --- Material Drops (Handles its own saving) ---
                const drops = handleClanMaterialDrop(userId, 4); // A-rank is roughly tier 4 difficulty

                let dropMsg = "";
                if (drops) {
                    dropMsg = "\n**Clan Materials Found:**\n" + Object.entries(drops).map(([m, q]) => `• ${m}: ${q}`).join('\n');
                }

                const description = `<@${userId}> earned **${rewards.exp} EXP** and **$${rewards.money.toLocaleString()} Ryo**!${rewards.bounty > 0 ? `\nEarned **${rewards.bounty} Bounty**!` : ''}`;

                const rewardEmbed = new EmbedBuilder()
                    .setTitle(rewards.isJackpot ? "JACKPOT REWARD!" : rewards.isBonus ? "BONUS REWARD!" : "Mission Progress")
                    .setDescription(`${description}\n\nEnemies Defeated: **${totalEnemiesDefeated}/50**\nRewards added directly to your account.`)
                    .setColor(rewards.isJackpot ? '#FFD700' : rewards.isBonus ? '#00BFFF' : '#006400');

                const msgOptions = { embeds: [rewardEmbed] };
                if (dropMsg) msgOptions.content = "```\n" + dropMsg + "\n```";

                // Use channel.send if interaction is old, otherwise followUp
                try {
                    await interaction.followUp(msgOptions);
                } catch (e) {
                    await interaction.channel.send({ content: `<@${userId}>`, ...msgOptions });
                }

                // --- Continue? ---
                if (totalEnemiesDefeated < 50) {
                    const continueRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('continue_arank').setLabel('Next Battle').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('stop_arank').setLabel('End Mission').setStyle(ButtonStyle.Danger)
                    );

                    let continueMsg;
                    try {
                        continueMsg = await interaction.followUp({
                            content: "Do you want to continue the mission?",
                            components: [continueRow]
                        });
                    } catch (e) {
                        continueMsg = await interaction.channel.send({
                            content: `<@${userId}>, do you want to continue the mission?`,
                            components: [continueRow]
                        });
                    }

                    const choice = await new Promise(resolve => {
                        const collector = continueMsg.createMessageComponentCollector({
                            filter: i => i.user.id === userId,
                            time: 30000,
                            max: 1
                        });
                        collector.on('collect', async i => {
                            try { await i.deferUpdate(); } catch (e) { }
                            resolve(i.customId);
                        });
                        collector.on('end', collected => {
                            if (collected.size === 0) resolve('stop_arank');
                        });
                    });

                    // Cleanup buttons
                    try { await continueMsg.edit({ components: [] }); } catch (e) { }

                    if (choice === 'stop_arank') {
                        await interaction.channel.send(`Mission ended by player. Total enemies defeated: ${totalEnemiesDefeated}`);
                        break;
                    }
                }
            } else {
                playerLost = true;
                await interaction.channel.send(`**Defeat!** <@${userId}> was defeated by ${randomNpc.name} after defeating ${totalEnemiesDefeated} enemies.`);
            }
        }

        if (!playerLost && totalEnemiesDefeated >= 50) {
            const finalEmbed = new EmbedBuilder()
                .setTitle("🏆 MISSION COMPLETE 🏆")
                .setDescription(`<@${userId}> has successfully cleared all 50 A-Rank battles! Truly a master shinobi.`)
                .setColor('#FFD700')
                .setThumbnail(interaction.user.displayAvatarURL());

            await interaction.channel.send({ embeds: [finalEmbed] });
        }
    }
};