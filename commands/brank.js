const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { runBattle, getCooldownString } = require('./combinedcommands.js');
const { userMutex, giftMutex, bountyMutex, mentorMutex } = require('../utils/locks');
const { handleClanMaterialDrop } = require('../utils/materialUtils');

const usersPath = path.resolve(__dirname, '../data/users.json');
const playersPath = path.resolve(__dirname, '../data/players.json');
const giftPath = path.resolve(__dirname, '../data/gift.json');
const anbuPath = path.resolve(__dirname, '../data/anbu.json');
const territoriesPath = path.resolve(__dirname, '../data/territories.json');
const mentorExpPath = path.resolve(__dirname, '../data/mentorexp.json');

const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";
const ANBU_ROLE_ID = '1382055740268744784';

function roundExpSmart(exp) {
    if (typeof exp !== "number") exp = Number(exp);
    const str = exp.toString();
    const dotIdx = str.indexOf(".");
    if (dotIdx === -1) return exp;
    const decimals = str.slice(dotIdx + 1);
    if (decimals.length < 2) return exp;
    const secondDigit = Number(decimals[1]);
    if (secondDigit < 5) {
        return Math.floor(exp);
    } else {
        return Math.ceil(exp);
    }
}

const TIER_NPCS = {
    1: [
        { name: "Bandit", image: "https://i.postimg.cc/GmhQvT79/image.png", baseHealth: 0.2, basePower: 0.3, baseDefense: 0.3, accuracy: 80, dodge: 0, jutsu: ["Transformation Jutsu"] },
        { name: "Wolf", image: "https://lh6.googleusercontent.com/ZgPmKO1GdhsatUZu5_PlfW0StfROatBVY6u2jKK_rawBiRiJ6TOO2GpMbqbMkxVZJlgGQarfcvw4wni1laFPlNp5-8oKlKRdTstcXOLtzET_KeumZB7wawjp5Hq04sLOUzouB6ZJII8d5eS1fE-b9g", baseHealth: 0.15, basePower: 0.35, baseDefense: 0.2, accuracy: 85, dodge: 10, jutsu: ["Bite"] }
    ],
    2: [
        { name: "Sound Genin", image: "https://comicvine.gamespot.com/a/uploads/square_small/11156/111564182/9531170-zaku.jpg", baseHealth: 0.3, basePower: 0.4, baseDefense: 0.3, accuracy: 85, dodge: 10, jutsu: ["Sound Wave"] },
        { name: "Giant Spider", image: "https://static.wikia.nocookie.net/naruto/images/6/60/Kyodaigumo.png/revision/latest/scale-to-width-down/1200?cb=20150826054336", baseHealth: 0.35, basePower: 0.45, baseDefense: 0.35, accuracy: 80, dodge: 5, jutsu: ["Web Trap"] }
    ],
    3: [
        { name: "Rain Genin", image: "https://comicvine.gamespot.com/a/uploads/scale_small/1/11863/541858-naruto_rainnin0004_1_.jpg", baseHealth: 0.4, basePower: 0.5, baseDefense: 0.4, accuracy: 90, dodge: 15, jutsu: ["Water Clone"] },
        { name: "Poison Fish", image: "https://static.wikia.nocookie.net/naruto/images/f/fc/Sanshouo.png/revision/latest?cb=20160116202142", baseHealth: 0.45, basePower: 0.55, baseDefense: 0.45, accuracy: 85, dodge: 10, jutsu: ["Poison Spit"] }
    ],
    4: [
        { name: "Sand Genin", image: "https://static.wikia.nocookie.net/naruto/images/2/20/Gaara_in_Part_I.png/revision/latest/scale-to-width-down/300?cb=20221010023824", baseHealth: 0.5, basePower: 0.6, baseDefense: 0.5, accuracy: 90, dodge: 20, jutsu: ["Sand Bullet"] },
        { name: "Wind Weasel", image: "https://static.wikia.nocookie.net/naruto/images/c/c6/Summoning_Beheading_Dance.png/revision/latest/scale-to-width-down/1200?cb=20250405213731", baseHealth: 0.4, basePower: 0.7, baseDefense: 0.3, accuracy: 95, dodge: 30, jutsu: ["Wind Scythe"] }
    ],
    5: [
        { name: "Puppet Walker", image: "https://static.wikia.nocookie.net/naruto/images/c/c2/Sasori_Hiruko.png", baseHealth: 0.6, basePower: 0.8, baseDefense: 0.6, accuracy: 95, dodge: 25, jutsu: ["Poison Needle"] },
        { name: "Giant Scorpion", image: "https://static.wikia.nocookie.net/naruto/images/2/23/Sasori_True_Form.png", baseHealth: 0.7, basePower: 0.9, baseDefense: 0.7, accuracy: 90, dodge: 15, jutsu: ["Tail Strike"] }
    ],
    6: [
        { name: "Mist Chunin", image: "https://static.wikia.nocookie.net/naruto/images/c/c6/Zabuza_Momochi.png", baseHealth: 0.8, basePower: 1.0, baseDefense: 0.8, accuracy: 100, dodge: 30, jutsu: ["Water Dragon"] },
        { name: "Demon Brother", image: "https://static.wikia.nocookie.net/naruto/images/9/90/Gozu.png", baseHealth: 0.9, basePower: 1.1, baseDefense: 0.9, accuracy: 95, dodge: 20, jutsu: ["Chain Attack"] }
    ],
    7: [
        { name: "Rock Golem", image: "https://static.wikia.nocookie.net/naruto/images/6/63/Onoki.png", baseHealth: 1.2, basePower: 1.3, baseDefense: 1.5, accuracy: 90, dodge: 10, jutsu: ["Rock Throw"] },
        { name: "Explosion Corps", image: "https://static.wikia.nocookie.net/naruto/images/c/c4/Deidara.png", baseHealth: 1.0, basePower: 1.5, baseDefense: 0.8, accuracy: 105, dodge: 35, jutsu: ["Explosive Clay"] }
    ],
    8: [
        { name: "Cloud Swordsman", image: "https://static.wikia.nocookie.net/naruto/images/4/4a/Killer_B.png", baseHealth: 1.5, basePower: 1.8, baseDefense: 1.2, accuracy: 110, dodge: 40, jutsu: ["Lightning Blade"] },
        { name: "Electric Eel", image: "https://static.wikia.nocookie.net/naruto/images/e/e8/Gyuki.png", baseHealth: 1.8, basePower: 2.0, baseDefense: 1.5, accuracy: 100, dodge: 30, jutsu: ["Thunder Shock"] }
    ],
    9: [
        { name: "Rogue Anbu", image: "https://static.wikia.nocookie.net/naruto/images/9/91/Itachi_Uchiha.png", baseHealth: 2.0, basePower: 2.5, baseDefense: 1.8, accuracy: 120, dodge: 50, jutsu: ["Fire Ball Jutsu", "Shadow Clone"] },
        { name: "Tailed Beast Clone", image: "https://static.wikia.nocookie.net/naruto/images/e/e4/Kurama.png", baseHealth: 3.0, basePower: 3.0, baseDefense: 2.0, accuracy: 110, dodge: 20, jutsu: ["Tailed Beast Bomb"] }
    ]
};

async function checkAnbuQuestCompletion(interaction, userId) {
    const anbuData = JSON.parse(await fs.readFile(anbuPath, 'utf8'));

    if (anbuData.quest && anbuData.quest[userId] && anbuData.quest[userId].brank >= 10 && anbuData.quest[userId].drank >= 10) {
        if (!anbuData.members) {
            anbuData.members = {};
        }
        anbuData.members[userId] = { status: 'Anbu', joinedAt: new Date().toISOString() };
        delete anbuData.quest[userId];

        await fs.writeFile(anbuPath, JSON.stringify(anbuData, null, 2));

        try {
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.add(ANBU_ROLE_ID);
            await interaction.channel.send({ content: `Congratulations, <@${userId}>! You have completed the Anbu initiation quest and are now a member of the Anbu.` });
        } catch (error) {
            console.error(`Failed to assign Anbu role or send message for user ${userId}:`, error);
        }
    }
}

function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 50000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Single NPC battle'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            await interaction.deferReply({ ephemeral: false });

            let onCooldown = false;
            let cooldownLeft = 0;
            let userLocation = 'land_of_fire';

            await userMutex.runExclusive(async () => {
                const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                if (!users[userId]) {
                    throw new Error("You need to enroll first!");
                }

                const now = Date.now();
                let cooldownMs = 12 * 60 * 1000;
                const memberRoles = interaction.member.roles.cache;
                if (memberRoles.has(JINCHURIKI_ROLE)) {
                    cooldownMs = 5.5 * 60 * 1000;
                } else if (memberRoles.has(LEGENDARY_ROLE)) {
                    cooldownMs = Math.round(7 * 60 * 1000);
                } else if (memberRoles.has(DONATOR_ROLE)) {
                    cooldownMs = Math.round(8 * 60 * 1000);
                }

                if (users[userId].lastbrank && now - users[userId].lastbrank < cooldownMs) {
                    onCooldown = true;
                    cooldownLeft = cooldownMs - (now - users[userId].lastbrank);
                } else {
                    users[userId].lastbrank = now;
                    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
                    userLocation = users[userId].location || 'land_of_fire';
                }
            });

            if (onCooldown) {
                return interaction.editReply({ content: `You can do this again in ${getCooldownString(cooldownLeft)}.` });
            }

            const territories = JSON.parse(await fs.readFile(territoriesPath, 'utf8'));
            const playersData = JSON.parse(await fs.readFile(playersPath, 'utf8'));
            const playerLevel = playersData[userId]?.level || 1;

            const userLocationValue = userLocation || 'land_of_fire';
            const currentTier = territories.territories[userLocation]?.tier || 1;
            const tierNpcs = TIER_NPCS[currentTier] || TIER_NPCS[1];

            let selectedNpc;
            if (playerLevel < 20) {
                selectedNpc = TIER_NPCS[1].find(npc => npc.name === "Bandit") || TIER_NPCS[1][0];
            } else {
                selectedNpc = tierNpcs[Math.floor(Math.random() * tierNpcs.length)];
            }

            const { winner } = await runBattle(interaction, userId, `NPC_${selectedNpc.name}`, 'brank', selectedNpc);

            try { await interaction.deleteReply(); } catch (e) { }

            if (winner && winner.userId === userId) {
                const expReward = 50 * currentTier;
                const moneyReward = 1000 * currentTier;

                // Update Player and User data with locks
                await userMutex.runExclusive(async () => {
                    const pd = JSON.parse(await fs.readFile(playersPath, 'utf8'));
                    const ud = JSON.parse(await fs.readFile(usersPath, 'utf8'));

                    if (pd[userId]) {
                        pd[userId].exp += expReward;
                        pd[userId].money += moneyReward;
                        pd[userId].exp = Math.round(pd[userId].exp * 10) / 10;
                    }

                    if (ud[userId]) {
                        ud[userId].brankWon = true; // Update tutorial variable
                    }

                    await fs.writeFile(playersPath, JSON.stringify(pd, null, 2));
                    await fs.writeFile(usersPath, JSON.stringify(ud, null, 2));
                });

                // Update Mentor EXP
                await mentorMutex.runExclusive(async () => {
                    const me = JSON.parse(await fs.readFile(mentorExpPath, 'utf8').catch(() => "{}"));
                    if (!me[userId]) me[userId] = { exp: 0, last_train: 0 };
                    me[userId].exp += 1;
                    await fs.writeFile(mentorExpPath, JSON.stringify(me, null, 2));
                });

                const victoryEmbed = new EmbedBuilder()
                    .setTitle("Victory!")
                    .setDescription(`You defeated ${selectedNpc.name}!\n\n**Rewards:**\n+ ${expReward} EXP\n+ $${moneyReward} Money\n\nRewards have been added to your account balance.`)
                    .setColor("#00FF00");

                await interaction.followUp({ embeds: [victoryEmbed] });
            }
        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: error.message, ephemeral: true }).catch(() => { });
            } else {
                await interaction.reply({ content: error.message, ephemeral: true }).catch(() => { });
            }
        }
    }
};