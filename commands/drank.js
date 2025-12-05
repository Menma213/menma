const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { updateRequirements } = require('./scroll');

const playersPath = path.resolve(__dirname, '../data/players.json');
const usersPath = path.resolve(__dirname, '../data/users.json');
const villagePath = path.resolve(__dirname, '../data/village.json');

const anbuPath = path.resolve(__dirname, '../data/anbu.json');
const ANBU_ROLE_ID = '1382055740268744784';

async function checkAnbuQuestCompletion(interaction, userId) {
    const anbuData = JSON.parse(fs.readFileSync(anbuPath, 'utf8'));

    // Check if the user is on the quest and has met the requirements
    if (anbuData.quest && anbuData.quest[userId] && anbuData.quest[userId].brank >= 10 && anbuData.quest[userId].drank >= 10) {
        // Add to members
        if (!anbuData.members) {
            anbuData.members = {};
        }
        anbuData.members[userId] = { status: 'Anbu', joinedAt: new Date().toISOString() };

        // Remove from quest
        delete anbuData.quest[userId];

        // Save the updated data
        fs.writeFileSync(anbuPath, JSON.stringify(anbuData, null, 2));

        try {
            // Assign the role
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.add(ANBU_ROLE_ID);

            // Send congratulatory message
            await interaction.channel.send({ content: `Congratulations, <@${userId}>! You have completed the Anbu initiation quest and are now a member of the Anbu.` });
        } catch (error) {
            console.error(`Failed to assign Anbu role or send message for user ${userId}:`, error);
        }
    }
}

function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

function getMaterialDrop(role) {
    if (role === "Hokage") return Math.floor(Math.random() * 3) + 12; // 12-14
    if (role === "Right Hand Man") return Math.floor(Math.random() * 3) + 10; // 10-12
    if (role === "Guard") return Math.floor(Math.random() * 3) + 8; // 8-10
    if (role === "Spy") return Math.floor(Math.random() * 3) + 2; // 2-4
    return 0;
}

function getAkatsukiMaterialDrop(role) {
    if (role === "Akatsuki Leader") return Math.floor(Math.random() * 3) + 12;
    if (role === "Co-Leader") return Math.floor(Math.random() * 3) + 10;
    if (role === "Bruiser") return Math.floor(Math.random() * 3) + 8;
    if (role === "Scientist") return Math.floor(Math.random() * 3) + 2;
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

function getRandomAkatsukiMaterial() {
    const mats = [
        { name: "Metal", emoji: "🪙", key: "metal" },
        { name: "Gunpowder", emoji: "💥", key: "gunpowder" },
        { name: "Copper", emoji: "🔌", key: "copper" }
    ];
    return mats[Math.floor(Math.random() * mats.length)];
}

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

const { userMutex } = require('../utils/locks');

// ... existing imports ...

// ... helper functions ...

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drank')
        .setDescription('Complete a simple D-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const userPfp = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

        await interaction.deferReply({ ephemeral: false });

        await userMutex.runExclusive(async () => {
            if (!fs.existsSync(playersPath)) fs.writeFileSync(playersPath, JSON.stringify({}, null, 2));
            if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));

            let players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

            if (!players[userId] || !users[userId]) {
                return interaction.editReply({
                    content: "❌ **You haven't enrolled yet!** Use `/enroll` to start your journey."
                });
            }

            // --- Anbu Quest Tracking ---
            const anbuData = JSON.parse(fs.readFileSync(anbuPath, 'utf8'));
            if (anbuData.quest && anbuData.quest[userId]) {
                if (anbuData.quest[userId].drank < 10) {
                    anbuData.quest[userId].drank++;
                    fs.writeFileSync(anbuPath, JSON.stringify(anbuData, null, 2));
                }
                // Check for quest completion
                await checkAnbuQuestCompletion(interaction, userId);
            }

            let player = players[userId];
            let user = users[userId];

            const now = Date.now();

            const JINCHURIKI_ROLE = "1385641469507010640";
            const LEGENDARY_ROLE = "1385640798581952714";
            const DONATOR_ROLE = "1385640728130097182";
            let cooldownMs = 9 * 60 * 1000;

            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 4 * 60 * 1000;
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = Math.round(4.9 * 60 * 1000);
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = Math.round(5.5 * 60 * 1000);
            }

            if (user.lastdrank && now - user.lastdrank < cooldownMs) {
                const left = cooldownMs - (now - user.lastdrank);
                return interaction.editReply({ content: `You can do this again in ${getCooldownString(left)}.` });
            }
            user.lastdrank = now;

            const tasks = [
                "washed all the windows in the Hokage’s office.",
                "helped an elderly villager carry groceries across the market.",
                "caught a runaway cat that had escaped from a shopkeeper.",
                "delivered important messages between village officials.",
                "watered the training grounds before a big Chunin exam test.",
                "helped repair a broken fence in the village outskirts.",
                "retrieved a lost kunai for a Genin in training.",
                "assisted in the academy by sparring with students.",
                "guided a lost child back home safely.",
                "cleaned up the streets after a festival."
            ];
            let taskMessage = tasks[Math.floor(Math.random() * tasks.length)];

            const territoriesPath = path.resolve(__dirname, '../data/territories.json');
            const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
            const userLocation = user.location || 'land_of_fire';
            const currentTier = territories.territories[userLocation]?.tier || 1;

            let expReward = (1 + (player.level * 0.1)) * currentTier;
            let moneyReward = 1000 * currentTier;

            player.exp += expReward;
            player.exp = roundExpSmart(player.exp);
            player.money += moneyReward;

            const { handleClanMaterialDrop } = require('../utils/materialUtils');
            const drops = handleClanMaterialDrop(userId, currentTier);

            let dropMsg = "```";
            if (drops) {
                dropMsg += "\nClan Materials Found:\n";
                for (const [mat, qty] of Object.entries(drops)) {
                    dropMsg += `${mat}: ${qty}\n`;
                }
            }
            dropMsg += "```";

            if (!drops) dropMsg = "";

            const embed = new EmbedBuilder()
                .setColor('#87CEEB') // Sky Blue for D-Rank
                .setTitle('D-Rank Mission Completed!')
                .setDescription(`**${username}** ${taskMessage}`)
                .addFields(
                    { name: 'Rewards', value: `Experience: +${expReward}\nMoney: +${moneyReward} Ryo`, inline: true }
                )
                .setThumbnail(userPfp)
                .setTimestamp();

            fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

            // Update drankCompleted for tutorial
            users[userId].drankCompleted = true;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await interaction.editReply({ embeds: [embed], content: dropMsg ? dropMsg : null });
        });
    }
};
