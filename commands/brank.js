// brank.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle, getCooldownString } = require('./combinedcommands.js');

const math = require('mathjs');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";

async function handleBrankReward(interaction, player1) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const playersData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../menma/data/players.json'), 'utf8'));
    const playerLevel = playersData[player1.userId]?.level || 1;

    // Calculate rewards
    const expReward = 10 + (playerLevel * 0.2);
    // mark brank tutorial as completed for this user
    if (!users[player1.userId]) users[player1.userId] = {};
    users[player1.userId].brankWon = true;
    // Add +1 mentor EXP on brank win
    if (users[player1.userId]) {
        users[player1.userId].mentorExp = (users[player1.userId].mentorExp || 0) + 1;
    }
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    const moneyReward = 500 + Math.floor((player1.level || 1) * 20);

    // --- Send rewards to gift inventory (gift.json) ---
    // Load gift inventory
    const giftDataPath = giftPath;
    let giftData = fs.existsSync(giftDataPath) ? JSON.parse(fs.readFileSync(giftDataPath, 'utf8')) : {};
    if (!giftData[player1.userId]) giftData[player1.userId] = [];

    // Helper to generate unique gift ID
    function generateGiftId(userGifts) {
        let id;
        do {
            id = Math.floor(Math.random() * 50000) + 1;
        } while (userGifts && userGifts.some(g => g.id === id));
        return id;
    }

    // Add EXP reward as a gift
    giftData[player1.userId].push({
        id: generateGiftId(giftData[player1.userId]),
        type: 'exp',
        amount: expReward,
        from: 'brank',
        date: Date.now()
    });

    // Add Money reward as a gift
    giftData[player1.userId].push({
        id: generateGiftId(giftData[player1.userId]),
        type: 'money',
        amount: moneyReward,
        from: 'brank',
        date: Date.now()
    });

    // --- Material drop logic (copied from brank.js, but sent to gift inventory) ---
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

    // Village drop
    let role = player1.role || "";
    if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
    const amount = getMaterialDrop(role);
    const mat = getRandomMaterial();

    // Only add to gift inventory if amount > 0
    let villageDropMsg = "";
    if (amount > 0) {
        giftData[player1.userId].push({
            id: generateGiftId(giftData[player1.userId]),
            type: 'material',
            name: mat.name,
            key: mat.key,
            amount: amount,
            from: 'brank',
            date: Date.now()
        });
        villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
    }

    // Akatsuki drop
    let akatsukiDropMsg = "";
    if (player1.occupation === "Akatsuki") {
        let akatsukiRole = player1.role || "";
        let akatsukiAmount = getAkatsukiMaterialDrop(akatsukiRole);
        if (akatsukiAmount > 0) {
            const akatsukiMat = getRandomAkatsukiMaterial();
            giftData[player1.userId].push({
                id: generateGiftId(giftData[player1.userId]),
                type: 'material',
                name: akatsukiMat.name,
                key: akatsukiMat.key,
                amount: akatsukiAmount,
                from: 'brank',
                date: Date.now()
            });
            akatsukiDropMsg = `You found ${akatsukiAmount} ${akatsukiMat.name} ${akatsukiMat.emoji} during the mission\n`;
        }
    }

    // Save updated gift inventory
    fs.writeFileSync(giftDataPath, JSON.stringify(giftData, null, 2));

    // Prepare drop message
    let dropMsg = "```";
    if (player1.occupation === "Akatsuki" && akatsukiDropMsg) {
        dropMsg += `\n${akatsukiDropMsg}`;
    } else if (amount > 0) {
        dropMsg += `\n${villageDropMsg}`;
    }
    dropMsg += "```";

    // Reward embed
    const rewardEmbed = new EmbedBuilder()
        .setTitle(`Battle End! ${player1.name} has won!`)
        .setDescription(
            `<@${player1.userId}> has earned $${moneyReward}!\n<@${player1.userId}> has earned ${expReward.toFixed(1)} exp!`
        )
        .setColor('#006400');

    // Send the result as a normal channel message so it appears with a current timestamp (after the battle)
    await interaction.channel.send({ embeds: [rewardEmbed], content: dropMsg });

    // Delete the original deferred reply (the "thinking..." placeholder) so only the post-battle message remains
    try {
        await interaction.deleteReply();
    } catch (err) {
        console.error('Failed to delete deferred reply:', err);
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Single NPC battle'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Cooldown system
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
            const left = cooldownMs - (now - users[userId].lastbrank);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: false });
        }

        users[userId].lastbrank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        await interaction.deferReply({ ephemeral: false });

        const npcId = "NPC_Bandit";
        const { winner } = await runBattle(interaction, userId, npcId, 'brank');

        if (winner && winner.userId === userId) {
            await handleBrankReward(interaction, winner);
        }
    }
};