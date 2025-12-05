const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
// --- Mock ARANK_NPCS ---
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
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 50000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

async function calculateRewards(userId, totalEnemiesDefeated, player, interaction) {
    const baseExp = 15 + (player.level * 0.1);
    const baseMoney = 200 + Math.floor((player.level || 1) * 5);
    let exp = baseExp, money = baseMoney, isJackpot = false, isBonus = false, isNormal = false, bounty = 0;

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

    const giftDataPath = giftPath;
    let giftData = fs.existsSync(giftDataPath) ? JSON.parse(fs.readFileSync(giftDataPath, 'utf8')) : {};
    if (!giftData[userId]) giftData[userId] = [];

    giftData[userId].push({
        id: generateGiftId(giftData[userId]),
        type: 'exp',
        amount: exp,
        from: 'arank',
        date: Date.now()
    });

    giftData[userId].push({
        id: generateGiftId(giftData[userId]),
        type: 'money',
        amount: money,
        from: 'arank',
        date: Date.now()
    });

    const akatsukiData = fs.existsSync(akatsukiPath) ? JSON.parse(fs.readFileSync(akatsukiPath, 'utf8')) : {};
    if (akatsukiData.members && akatsukiData.members[userId]) {
        bounty = 10;
        const bountyData = fs.existsSync(bountyPath) ? JSON.parse(fs.readFileSync(bountyPath, 'utf8')) : {};
        if (!bountyData[userId]) {
            bountyData[userId] = { bounty: 0 };
        }
        bountyData[userId].bounty += bounty;
        fs.writeFileSync(bountyPath, JSON.stringify(bountyData, null, 2));

        giftData[userId].push({
            id: generateGiftId(giftData[userId]),
            type: 'bounty',
            amount: bounty,
            from: 'arank',
            date: Date.now()
        });
    }

    fs.writeFileSync(giftDataPath, JSON.stringify(giftData, null, 2));

    return {
        exp,
        money,
        bounty,
        isJackpot,
        isBonus,
        isNormal
    };
}

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

        const now = Date.now();
        let cooldownMs = 20 * 60 * 1000;
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 12 * 60 * 1000;
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(12 * 60 * 1000 * 1.1);
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(12 * 60 * 1000 * 1.1 * 1.1);
        }
        if (users[userId].lastArank && now - users[userId].lastArank < cooldownMs) {
            const left = cooldownMs - (now - users[userId].lastArank);
            const min = Math.floor(left / 60000);
            const sec = Math.floor((left % 60000) / 1000);
            return interaction.editReply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: false });
        }
        users[userId].lastArank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        let totalEnemiesDefeated = 0;
        let playerLost = false;
        let player = { ...users[userId], ...players[userId] };
        player.currentHealth = player.health;
        player.chakra = player.chakra || 10;
        player.activeEffects = [];
        player.accuracy = 100;
        player.dodge = 0;
        player.jutsu = users[userId].jutsu || {};

        let comboState = null;
        if (player.Combo && comboList[player.Combo]) {
            comboState = {
                combo: comboList[player.Combo],
                usedJutsus: new Set()
            };
            player.comboState = comboState;
        }

        while (totalEnemiesDefeated < 50 && !playerLost) {
            const randomNpc = ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
            const npcId = `NPC_${randomNpc.name}`;

            let npc = {
                ...randomNpc,
                userId: npcId,
                name: randomNpc.name,
                currentHealth: randomNpc.health,
                chakra: 10,
                activeEffects: [],
                jutsu: Object.fromEntries(randomNpc.jutsu.map((j, i) => [i, j]))
            };

            player.activeEffects = [];
            player.comboState = comboState;

            const { winner, loser } = await runBattle(interaction, userId, npcId, 'arank', npc);

            if (winner && winner.userId === userId) {
                player.currentHealth = winner.currentHealth;
                player.chakra = winner.chakra;
            } else {
                playerLost = true;
                await interaction.followUp(`**Defeat!** You were defeated by ${npc.name} after defeating ${totalEnemiesDefeated} enemies.`);
                break;
            }

            totalEnemiesDefeated++;

            if (users[userId]) {
                users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                users[userId].wins = (users[userId].wins || 0) + 1;
            }

            // --- REWARDS & DROPS ---
            const rewards = await calculateRewards(userId, totalEnemiesDefeated, player, interaction);
            const drops = handleClanMaterialDrop(userId);
            let dropMsg = "";
            if (drops) {
                dropMsg += "\nClan Materials Found:\n";
                for (const [mat, qty] of Object.entries(drops)) {
                    dropMsg += `${mat}: ${qty}\n`;
                }
            }

            let rewardEmbed;
            let description = `<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!`;
            if (rewards.bounty > 0) {
                description += `\n<@${userId}> has earned ${rewards.bounty} bounty!`;
            }

            if (rewards.isJackpot) {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!`)
                    .setDescription(`**JACKPOT REWARD!**\n${description}\nYou've completed 50 enemies in this mission!`)
                    .setColor('#FFD700');
            } else if (rewards.isBonus) {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!!`)
                    .setDescription(`**BONUS REWARD!**\n${description}\nEnemies Defeated: ${totalEnemiesDefeated}`)
                    .setColor('#00BFFF');
            } else {
                rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End!`)
                    .setDescription(`${description}\nEnemies Defeated: ${totalEnemiesDefeated}\nAll rewards have been sent to your gift inventory. Use **/gift inventory** to claim them!`)
                    .setColor('#006400');
            }

            await interaction.followUp({
                embeds: [rewardEmbed],
                content: dropMsg ? "```" + dropMsg + "```" : null
            });

            if (totalEnemiesDefeated < 50) {
                const continueRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('continue_arank').setLabel('Continue Mission').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('stop_arank').setLabel('End Mission').setStyle(ButtonStyle.Danger)
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
                        if (collected.size === 0) resolve('stop_arank');
                    });
                });

                if (choice === 'stop_arank') {
                    await interaction.followUp("Mission ended by player.");
                    break;
                }
            }
        }

        users[userId].health = player.currentHealth;
        users[userId].chakra = player.chakra;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        if (!playerLost && totalEnemiesDefeated >= 50) {
            await interaction.followUp(`**Congratulations!** You have successfully completed all 50 A-Rank battles!`);
        }
    }
};