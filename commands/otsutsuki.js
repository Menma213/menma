const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { runBattle } = require('./combinedcommands');
const { userMutex, jutsuMutex } = require('../utils/locks');

const OTSUTSUKI_BOSSES = {
    "Toneri": {
        name: "Toneri Otsutsuki",
        image: "https://www.pngplay.com/wp-content/uploads/12/Toneri-Otsutsuki-Transparent-Images.png",
        health: 150000,
        currentHealth: 150000,
        power: 150000,
        defense: 150000,
        accuracy: 1000,
        chakra: 1000,
        "statsType": "fixed",
        immunities: ["stun", "bleed", "burn", "status"],
        dodge: 0,
        background: "https://i.postimg.cc/cLxM7Gbm/image.png",
        rewardItem: "Tenseigan Scroll",
        jutsu: ["Attack", "Rasengan", "Otsutsuki's Wrath", "Truth-Seeking Orbs"]
    },
    "Urashiki": {
        name: "Urashiki Otsutsuki",
        image: "https://i.postimg.cc/HnrkFdKt/image.png",
        health: 150000,
        currentHealth: 150000,
        power: 150000,
        defense: 150000,
        accuracy: 1000,
        chakra: 1000,
        "statsType": "fixed",
        immunities: ["status", "stun", "bleed", "burn", "poison"],
        dodge: 10,
        background: "https://i.postimg.cc/7L1GNPvt/image.png",
        rewardItem: null,
        jutsu: ["Chakra tool creation", "Urashiki jutsu steal", "Palace of the dragon king"]
    }
};

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const cooldownPath = path.resolve(__dirname, '../../menma/data/otsutsuki_cooldowns.json');

const REWARD_BASE = {
    ryo: 100000,
    xp: (level = 1) => 50 + (Number(level) * 0.5)
};

function getRewardsForUser(userId, bossData) {
    const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    const playerLevel = players[userId] && players[userId].level ? players[userId].level : 1;
    const userLocation = users[userId] && users[userId].location ? users[userId].location : 'land_of_fire';

    const territoriesPath = path.resolve(__dirname, '../../menma/data/territories.json');
    let tier = 1;
    if (fs.existsSync(territoriesPath)) {
        try {
            const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
            tier = territories.territories[userLocation]?.tier || 1;
        } catch (e) { }
    }

    return {
        ryo: REWARD_BASE.ryo * tier,
        item: bossData.rewardItem,
        xp: REWARD_BASE.xp(playerLevel) * tier
    };
}

const COOLDOWN_DURATION = 20 * 60 * 1000; // 20 minutes in ms

function loadCooldowns() {
    if (!fs.existsSync(cooldownPath)) return {};
    const data = JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
    // Migration logic for old structure (userId: timestamp)
    for (const id in data) {
        if (data[id] !== null && (typeof data[id] === 'number' || typeof data[id] === 'string')) {
            data[id] = { cooldown: Number(data[id]), urashiki_defeats: 0 };
        }
    }
    return data;
}

function saveCooldowns(data) {
    fs.writeFileSync(cooldownPath, JSON.stringify(data, null, 2));
}

function isOnCooldown(userId) {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId] || !cooldowns[userId].cooldown) return false;
    return Date.now() < cooldowns[userId].cooldown;
}

function setCooldown(userId) {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) cooldowns[userId] = { cooldown: 0, urashiki_defeats: 0 };
    cooldowns[userId].cooldown = Date.now() + COOLDOWN_DURATION;
    saveCooldowns(cooldowns);
}

function incrementDefeats(userId, bossName) {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) cooldowns[userId] = { cooldown: 0, urashiki_defeats: 0 };
    if (bossName === "Urashiki Otsutsuki") {
        cooldowns[userId].urashiki_defeats = (cooldowns[userId].urashiki_defeats || 0) + 1;
    }
    saveCooldowns(cooldowns);
    return cooldowns[userId].urashiki_defeats || 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otsutsuki')
        .setDescription('Challenge the otsutsuki.'),

    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};

        if (!users[userId]) {
            return interaction.editReply({
                content: "You must enroll before challenging an Otsutsuki! Use the `/enroll` command."
            });
        }

        if (isOnCooldown(userId)) {
            const cooldowns = loadCooldowns();
            const remaining = Math.ceil((cooldowns[userId].cooldown - Date.now()) / 60000);
            return interaction.editReply({
                content: `You must wait ${remaining} more minute(s) before challenging the Otsutsuki again.`
            });
        }

        const bossSequence = ["Toneri", "Urashiki"];

        for (let i = 0; i < bossSequence.length; i++) {
            const bossKey = bossSequence[i];
            const bossData = OTSUTSUKI_BOSSES[bossKey];
            const npcId = `NPC_${bossKey}_Otsutsuki`;

            if (i > 0) {
                await interaction.channel.send({ content: `**A new Otsutsuki appears!** ${bossData.name}!` });
            }

            const battleResult = await runBattle(
                interaction,
                userId,
                npcId,
                'otsutsuki',
                bossData
            );

            // Process Battle Result
            if (battleResult && battleResult.winner && battleResult.winner.userId === userId) {
                // Victory logic
                const calculatedRewards = getRewardsForUser(userId, bossData);

                // Defeat tracking
                const totalDefeats = incrementDefeats(userId, bossData.name);
                let defeatMsg = "";

                if (bossData.name === "Urashiki Otsutsuki") {
                    defeatMsg = `\nYou have now defeated Urashiki **${totalDefeats}** times!`;
                    if (totalDefeats >= 20) {
                        calculatedRewards.item = "Chakra Tool Creation Scroll";
                        defeatMsg += `\n**Requirement Met!** You received the **Chakra Tool Creation Scroll**!`;
                    } else {
                        defeatMsg += `\nDefeat him ${20 - totalDefeats} more times to unlock the **Chakra Tool Creation Scroll**!`;
                    }
                }

                // Grant Rewards
                await userMutex.runExclusive(async () => {
                    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                    if (players[userId]) {
                        players[userId].exp = (players[userId].exp || 0) + calculatedRewards.xp;
                        players[userId].money = (players[userId].money || 0) + calculatedRewards.ryo;
                        players[userId].exp = Math.round(players[userId].exp * 10) / 10;
                    }
                    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
                });

                if (calculatedRewards.item) {
                    await jutsuMutex.runExclusive(async () => {
                        const jData = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
                        if (!jData[userId]) jData[userId] = {};
                        if (!jData[userId].scrolls) jData[userId].scrolls = [];
                        if (!jData[userId].scrolls.includes(calculatedRewards.item)) {
                            jData[userId].scrolls.push(calculatedRewards.item);
                        }
                        fs.writeFileSync(jutsusPath, JSON.stringify(jData, null, 2));
                    });
                }

                const rewardsEmbed = new EmbedBuilder()
                    .setTitle(`Victory! ${bossData.name} Defeated!`)
                    .setDescription(`You have successfully defeated ${bossData.name}!${defeatMsg}`)
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Ryo Earned', value: `+${calculatedRewards.ryo.toLocaleString()}`, inline: true },
                        { name: 'XP Gained', value: `+${calculatedRewards.xp.toLocaleString()}`, inline: true }
                    )
                    .setThumbnail(bossData.image)
                    .setTimestamp();

                if (calculatedRewards.item) {
                    rewardsEmbed.addFields({ name: 'Item Received', value: `${calculatedRewards.item}`, inline: false });
                } else {
                    rewardsEmbed.addFields({ name: 'Item Received', value: `None`, inline: false });
                }

                await interaction.channel.send({ embeds: [rewardsEmbed] });

                // If this was the last boss, set cooldown and finish
                if (i === bossSequence.length - 1) {
                    setCooldown(userId);
                    return;
                }
                // Otherwise, the loop continues to the next boss automatically
            } else {
                // Loss logic
                const lossEmbed = new EmbedBuilder()
                    .setTitle(`Defeat!`)
                    .setDescription(`${bossData.name} has defeated you. The challenge ends here.`)
                    .setColor('#ff0000')
                    .setThumbnail(bossData.image)
                    .setTimestamp();

                await interaction.channel.send({ embeds: [lossEmbed] });

                // Set cooldown on loss per user request
                setCooldown(userId);
                return;
            }
        }
    }
};
