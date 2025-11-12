// --- arank.js ---
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { runBattle, comboList } = require('./combinedcommands.js'); // runBattle + comboList from combinedcommands

// --- Constants ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";
const HOKAGE_ROLE = '1349278752944947240'; // Assuming this is the Hokage role ID

// --- Mock ARANK_NPCS for demonstration ---
// In a real scenario, this would be loaded from a separate file or database.
const ARANK_NPCS = [
    {
        name: "Jugo",
        image: "https://i.postimg.cc/vmfSx5V1/17-D3-B777-0-FC6-4-EE4-957-D-513-CC60-D8924.png",
        baseHealth: 0.8,
        basePower: 1.2,
        baseDefense: 0.5,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Monster Claw"]
    },

    {
        name: "Temari",
        image: "https://i.postimg.cc/1tS7G4Gv/6-CCACDF3-9612-4831-8-D31-046-BEA1586-D9.png",
        baseHealth: 0.2,
        basePower: 1.0,
        baseDefense: 0.5,
        accuracy: 90,
        dodge: 0,
        jutsu: ["Attack", "Wind Scythe"]
    },

    {
        name: "Kankuro",
        image: "https://i.postimg.cc/y8wbNLk4/5-F95788-A-754-C-4-BA6-B0-E0-39-BCE2-FDCF04.png",
        baseHealth: 0.2,
        basePower: 1.1,
        baseDefense: 0.7,
        accuracy: 80,
        dodge: 0,
        jutsu: ["Attack", "Puppet Master"]
    },

    {
        name: "Suigetsu",
        image: "https://i.postimg.cc/GmBfrW3x/54-AE56-B1-E2-EE-4179-BD24-EEC282-A8-B3-BF.png",
        baseHealth: 0.6,
        basePower: 1.0,
        baseDefense: 0.6,
        accuracy: 75,
        dodge: 0,
        jutsu: ["Attack", "Water Dragon Jutsu"]
    },

    {
        name: "Fuguki",
        image: "https://i.postimg.cc/QMJJrm7q/064262-C0-1-BC4-47-B2-A06-A-59-DC193-C0285.png",
        baseHealth: 0.6,
        basePower: 1.2,
        baseDefense: 0.8,
        accuracy: 70,
        dodge: 0,
        jutsu: ["Attack", "Samehada Slash"]
    },

    {
        name: "Jinpachi",
        image: "https://i.postimg.cc/SsZLnKD2/809-EBF4-E-70-EF-4-C83-BCE4-3-D6-C228-B1239.png",
        baseHealth: 0.7,
        basePower: 1.1,
        baseDefense: 0.7,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Greast Forest Crumbling"]
    },

    {
        name: "Kushimaru",
        image: "https://i.postimg.cc/3wTF6VkR/53-BE91-D0-8-A53-47-C9-BD48-A06728-AFE79-C.png",
        baseHealth: 0.6,
        basePower: 1.1,
        baseDefense: 0.6,
        accuracy: 95,
        dodge: 0,
        jutsu: ["Attack", "One Thousand Slashes"]
    },

    {
        name: "Baki",
        image: "https://i.postimg.cc/Jn7c7XcC/5997-D785-7-C7-D-4-BC0-93-DB-CCF7-CA3-CDB56.png",
        baseHealth: 0.5,
        basePower: 1.0,
        baseDefense: 0.7,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Wind Scythe"]

    }
];
// --- Helper Functions ---

// Helper to generate unique gift ID (matches runBattle logic)
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 50000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// --- Reward Calculation ---
async function calculateRewards(userId, totalEnemiesDefeated, player, interaction) {
    const baseExp = 15 + (player.level * 0.1);
    const baseMoney = 200 + Math.floor((player.level || 1) * 5);
    let exp = baseExp, money = baseMoney, isJackpot = false, isBonus = false, isNormal = false;

    if ((totalEnemiesDefeated + 1) % 5 === 0) {
        let bonusExp = Math.max(1 * (player.level || 1), baseExp);
        let bonusMoney = baseMoney;
        if (totalEnemiesDefeated + 1 === 50) {
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

    // --- Send rewards to gift inventory (gift.json) ---
    const giftDataPath = giftPath;
    let giftData = fs.existsSync(giftDataPath) ? JSON.parse(fs.readFileSync(giftDataPath, 'utf8')) : {};
    if (!giftData[userId]) giftData[userId] = [];

    // Add EXP reward as a gift
    giftData[userId].push({
        id: generateGiftId(giftData[userId]),
        type: 'exp',
        amount: exp,
        from: 'arank',
        date: Date.now()
    });

    // Add Money reward as a gift
    giftData[userId].push({
        id: generateGiftId(giftData[userId]),
        type: 'money',
        amount: money,
        from: 'arank',
        date: Date.now()
    });

    // Save updated gift inventory
    fs.writeFileSync(giftDataPath, JSON.stringify(giftData, null, 2));

    return {
        exp,
        money,
        isJackpot,
        isBonus,
        isNormal
    };
}

// --- Material Drop Logic ---
function getMaterialDrop(role) {
    if (role === "Hokage") return Math.floor(Math.random() * 3) + 12;
    if (role === "Right Hand Man") return Math.floor(Math.random() * 3) + 10;
    if (role === "Guard") return Math.floor(Math.random() * 3) + 8;
    if (role === "Spy") return Math.floor(Math.random() * 3) + 2;
    return 0;
}
function getRandomMaterial() {
    const mats = [
        { name: "Iron", emoji: "🪓", key: "iron" },
        { name: "Wood", emoji: "🌲", key: "wood" },
        { name: "Rope", emoji: "🪢", key: "rope" }
    ];
    return mats[Math.floor(Math.random() * mats.length)];
}
function getAkatsukiMaterialDrop(role) {
    if (role === "Akatsuki Leader") return Math.floor(Math.random() * 3) + 12;
    if (role === "Co-Leader") return Math.floor(Math.random() * 3) + 10;
    if (role === "Bruiser") return Math.floor(Math.random() * 3) + 8;
    if (role === "Scientist") return Math.floor(Math.random() * 3) + 2;
    return 0;
}
function getRandomAkatsukiMaterial() {
    const mats = [
        { name: "Metal", emoji: "🪙", key: "metal" },
        { name: "Gunpowder", emoji: "💥", key: "gunpowder" },
        { name: "Copper", emoji: "🔌", key: "copper" }
    ];
    return mats[Math.floor(Math.random() * mats.length)];
}

// --- Slash Command Definition ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('arank')
        .setDescription('Engage in 50 A-Rank NPC battles for rewards and materials.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        // --- COOLDOWN LOGIC ---
        const now = Date.now();
        let cooldownMs = 20 * 60 * 1000; // default 20 min
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 12 * 60 * 1000;
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(12 * 60 * 1000 * 1.1); // 13.2 min
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(12 * 60 * 1000 * 1.1 * 1.1); // 14.52 min
        }
        if (users[userId].lastArank && now - users[userId].lastArank < cooldownMs) {
            const left = cooldownMs - (now - users[userId].lastArank);
            const min = Math.floor(left / 60000);
            const sec = Math.floor((left % 60000) / 1000);
            return interaction.editReply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: false });
        }
        users[userId].lastArank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // --- Initialize Player State ---
        let totalEnemiesDefeated = 0;
        let playerLost = false;
        let player = { ...users[userId], ...players[userId] }; // Merge user and player data
        player.currentHealth = player.health;
        player.chakra = player.chakra || 10;
        player.activeEffects = [];
        player.accuracy = 100;
        player.dodge = 0;
        player.jutsu = users[userId].jutsu || {};

        // Combo tracking state
        let comboState = null;
        if (player.Combo && comboList[player.Combo]) { // Assuming comboList is globally available or imported
            comboState = {
                combo: comboList[player.Combo],
                usedJutsus: new Set()
            };
            player.comboState = comboState;
        }

        // --- 50 ENEMY LOOP ---
        while (totalEnemiesDefeated < 50 && !playerLost) {
            // Pick a random A-Rank NPC from ARANK_NPCS
            const randomNpc = ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
            const npcId = `NPC_${randomNpc.name}`;

            // Reset NPC stats for each fight
            let npc = {
                ...randomNpc,
                userId: npcId,
                name: randomNpc.name,
                currentHealth: randomNpc.health,
                chakra: 10, // Reset NPC chakra for each fight
                activeEffects: [],
                jutsu: Object.fromEntries(randomNpc.jutsu.map((j, i) => [i, j]))
            };

            // Reset player effects for each fight (but keep health/chakra as is)
            player.activeEffects = [];
            player.comboState = comboState; // Re-apply combo state if it exists

            // Run the battle (single fight)
            // runBattle expects the npc template as the 5th argument.
            // Do NOT pass the local player object as that caused npcData.jutsu to be the wrong object.
            const { winner, loser } = await runBattle(interaction, userId, npcId, 'arank', npc);

            // Check if the player won the battle
            if (winner && winner.userId === userId) {
                // Player won, update their stats for the next round
                player.currentHealth = winner.currentHealth;
                player.chakra = winner.chakra;
            } else {
                // Player lost or it was a draw
                playerLost = true;
                await interaction.followUp(`**Defeat!** You were defeated by ${npc.name} after defeating ${totalEnemiesDefeated} enemies.`);
                break;
            }

            // Player won this round
            totalEnemiesDefeated++;

                users[userId].wins = (users[userId].wins || 0) + 1;
                // Add +1 mentor EXP on A-Rank win
                if (users[userId]) {
                    users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                }

            // --- REWARDS ---
            const rewards = await calculateRewards(userId, totalEnemiesDefeated - 1, player, interaction);
            users[userId].health = player.currentHealth; // Save current health
            users[userId].chakra = player.chakra; // Save current chakra
            // Save other relevant player stats if they were modified by runBattle

            // --- MATERIAL DROP SYSTEM ---
            let role = player.role || "";
            if (interaction.member.roles.cache.has(HOKAGE_ROLE)) role = "Hokage"; // Use the defined constant

            let villageDropMsg = "";
            const amount = getMaterialDrop(role);
            if (amount > 0) {
                const mat = getRandomMaterial();
                const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
                let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
                if (fs.existsSync(villagePath)) {
                    village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
                }
                village[mat.key] = (village[mat.key] || 0) + amount;
                fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
                villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
            }

            let akatsukiDropMsg = "";
            if (player.occupation === "Akatsuki") {
                let akatsukiRole = player.role || "";
                let akatsukiAmount = getAkatsukiMaterialDrop(akatsukiRole);
                if (akatsukiAmount > 0) {
                    const akatsukiMat = getRandomAkatsukiMaterial();
                    const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
                    let akatsuki = { metal: 0, gunpowder: 0, copper: 0, bombs: {} };
                    if (fs.existsSync(akatsukiPath)) {
                        akatsuki = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
                    }
                    akatsuki[akatsukiMat.key] = (akatsuki[akatsukiMat.key] || 0) + akatsukiAmount;
                    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
                    akatsukiDropMsg = `You found ${akatsukiAmount} ${akatsukiMat.name} ${akatsukiMat.emoji} during the mission\n`;
                }
            }

            // Prepare drop message
            let dropMsg = "```";
            if (player.occupation === "Akatsuki" && akatsukiDropMsg) {
                dropMsg += `\n${akatsukiDropMsg}`;
            } else if (amount > 0) {
                dropMsg += `\n${villageDropMsg}`;
            }
            dropMsg += "```";

            // Prepare reward embed
            let rewardEmbed;
            if (rewards.isJackpot) {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!`)
                    .setDescription(
                        `**JACKPOT REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nYou've completed 50 enemies in this mission!`
                    )
                    .setColor('#FFD700');
            } else if (rewards.isBonus) {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!!`)
                    .setDescription(
                        `**BONUS REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}`
                    )
                    .setColor('#00BFFF');
            } else {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!`)
                    .setDescription(
                        `<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}\nAll rewards have been sent to your gift inventory. Use **/gift inventory** to claim them!`
                    )
                    .setColor('#006400');
            }

            await interaction.followUp({
                embeds: [rewardEmbed],
                content: dropMsg.trim() === '``' ? '' : dropMsg // Only send content if there are drops
            });

            // Ask if player wants to continue (unless it's the last enemy)
            if (totalEnemiesDefeated < 50) {
                const continueRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('continue_arank') // Unique custom ID for arank continuation
                        .setLabel('Continue Mission')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('stop_arank') // Unique custom ID for arank stopping
                        .setLabel('End Mission')
                        .setStyle(ButtonStyle.Danger)
                );
                const continueMessage = await interaction.followUp({
                    content: "Do you want to continue the mission?",
                    components: [continueRow]
                });

                const choice = await new Promise(resolve => {
                    const collector = continueMessage.createMessageComponentCollector({
                        filter: i => i.user.id === userId,
                        time: 30000,
                        max: 1
                    });
                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        resolve(i.customId);
                    });
                    collector.on('end', collected => {
                        if (collected.size === 0) resolve('stop_arank'); // Default to stop if no interaction
                    });
                });

                if (choice === 'stop_arank') {
                    await interaction.followUp("Mission ended by player.");
                    break;
                }
            }
        }

        // --- Save final user state ---
        // Ensure all modifications made during the loop are saved.
        // This includes health, chakra, wins, and any other stats potentially modified by runBattle.
        users[userId].health = player.currentHealth;
        users[userId].chakra = player.chakra;
        // Add any other player stats that might have been modified
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Final summary if player survived all 50
        if (!playerLost && totalEnemiesDefeated >= 50) {
            await interaction.followUp(`**Congratulations!** You have successfully completed all 50 A-Rank battles!`);
        }
    }
};