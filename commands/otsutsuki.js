const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { runBattle } = require('./combinedcommands');
const { userMutex, jutsuMutex } = require('../utils/locks');

const TONERI_NPC = {
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
    jutsu: [
        "Attack",
        "Rasengan",
        "Otsutsuki's Wrath",
        "Truth-Seeking Orbs"
    ]
};



const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const cooldownPath = path.resolve(__dirname, '../../menma/data/otsutsuki_cooldowns.json');

const TONERI_REWARDS = {
    ryo: 100000,
    item: "Tenseigan Scroll",
    xp: (level = 1) => 50 + (Number(level) * 0.5)
};

function getToneriRewardsForUser(userId) {
    const players = fs.existsSync(path.resolve(__dirname, '../../menma/data/players.json')) ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../menma/data/players.json'), 'utf8')) : {};
    const users = fs.existsSync(path.resolve(__dirname, '../../menma/data/users.json')) ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../menma/data/users.json'), 'utf8')) : {};
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
        ryo: TONERI_REWARDS.ryo * tier,
        item: TONERI_REWARDS.item,
        xp: TONERI_REWARDS.xp(playerLevel) * tier
    };
}

const COOLDOWN_DURATION = 20 * 60 * 1000; // 20 minutes in ms


function loadCooldowns() {
    if (!fs.existsSync(cooldownPath)) return {};
    return JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
}

function saveCooldowns(data) {
    fs.writeFileSync(cooldownPath, JSON.stringify(data, null, 2));
}

function isOnCooldown(userId) {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) return false;
    return Date.now() < cooldowns[userId];
}

function setCooldown(userId) {
    const cooldowns = loadCooldowns();
    cooldowns[userId] = Date.now() + COOLDOWN_DURATION;
    saveCooldowns(cooldowns);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otsutsuki')
        .setDescription('Challenge the otsutsuki.'),

    async execute(interaction) {
        // Defer the reply to give time for the battle logic to run
        await interaction.deferReply();

        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};

        if (!users[userId]) {

            return interaction.editReply({
                content: "You must enroll before challenging an Otsutsuki! Use the `/enroll` command."
            });
        }

        // Check for cooldown
        if (isOnCooldown(userId)) {
            const cooldowns = loadCooldowns();
            const remaining = Math.ceil((cooldowns[userId] - Date.now()) / 60000);
            return interaction.editReply({
                content: `You must wait ${remaining} more minute(s) before challenging the Otsutsuki again.`
            });
        }

        const npcId = "NPC_Toneri_Otsutsuki";
        // Assuming runBattle handles the entire battle interaction and returns 'win' or 'lose'
        const battleResult = await runBattle(
            interaction,
            userId,
            npcId,
            'otsutsuki',
            TONERI_NPC
        );
        try {
            await interaction.editReply({ content: 'Battle sequence concluded. Processing results...', components: [] });
        } catch (error) {
            // Log if we can't edit the initial message, but continue execution.
            console.error('Could not edit initial deferred reply:', error);
        }
        // -------------------------

        if (battleResult && battleResult.winner && battleResult.winner.userId === userId) {
            // Set cooldown for 20 minutes
            setCooldown(userId);

            // Get the calculated rewards for the user
            const calculatedRewards = getToneriRewardsForUser(userId);

            // Update rewards directly via mutexes
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
                    const jutsuData = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
                    if (!jutsuData[userId]) jutsuData[userId] = {};
                    if (!jutsuData[userId].scrolls) jutsuData[userId].scrolls = [];
                    if (!jutsuData[userId].scrolls.includes(calculatedRewards.item)) {
                        jutsuData[userId].scrolls.push(calculatedRewards.item);
                    }
                    fs.writeFileSync(jutsusPath, JSON.stringify(jutsuData, null, 2));
                });
            }

            // Create rewards embed
            const rewardsEmbed = new EmbedBuilder()
                .setTitle(`Victory! ${TONERI_NPC.name} Defeated!`)
                .setDescription(`You have successfully defeated the powerful Otsutsuki! Your rewards have been added directly to your account.`)
                .setColor('#00ff00')
                .addFields(
                    {
                        name: 'Ryo Earned',
                        value: `+${calculatedRewards.ryo.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: 'XP Gained',
                        value: `+${calculatedRewards.xp.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: 'Item Received',
                        value: `${TONERI_REWARDS.item}`,
                        inline: false
                    }
                )
                .setFooter({ text: 'The peace of the world is safe... for now.' })
                .setTimestamp()
                .setThumbnail(TONERI_NPC.image);


            await interaction.followUp({
                embeds: [rewardsEmbed],
                components: []
            });
        } else {
            // Treat any non-'win' result as a loss
            const lossEmbed = new EmbedBuilder()
                .setTitle(`Defeat!`)
                .setDescription(`${TONERI_NPC.name} has defeated you.`)
                .setColor('#ff0000')
                .setFooter({ text: 'You can try as many times as you want!' })
                .setTimestamp()
                .setThumbnail(TONERI_NPC.image);

            await interaction.followUp({
                embeds: [lossEmbed],
                components: []
            });
        }
    }
};
