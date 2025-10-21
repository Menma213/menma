const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { updateRequirements } = require('./scroll');

const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drank')
        .setDescription('Complete a simple D-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const userPfp = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

        if (!fs.existsSync(playersPath)) fs.writeFileSync(playersPath, JSON.stringify({}, null, 2));
        if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));

        let players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        if (!players[userId] || !users[userId]) {
            return interaction.reply({
                content: "❌ **You haven't enrolled yet!** Use `/enroll` to start your journey.",
                ephemeral: true
            });
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
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: false });
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

        let expReward = 1.0;
        let moneyReward = 1000

        player.exp += expReward;
        player.exp = roundExpSmart(player.exp);
        player.money += moneyReward;

        let role = user.role || "";
        if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
        const amount = getMaterialDrop(role);
        const mat = getRandomMaterial();

        let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
        if (fs.existsSync(villagePath)) {
            village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
        }
        village[mat.key] = (village[mat.key] || 0) + amount;
        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));

        let akatsukiDropMsg = "";
        if (user.occupation === "Akatsuki") {
            let akatsukiRole = user.role || "";
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
        
        user.mentorExp = (user.mentorExp || 0) + 1;
        user.drankCompleted = true;

        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        const embed = new EmbedBuilder()
            .setTitle(" **D-Rank Mission Completed!**")
            .setDescription(`**${username}** just completed a mission! 🎉\n`)
            .addFields(
                { name: " **Task Completed**", value: `> *${taskMessage}*`, inline: false },
                { name: " **EXP Earned**", value: `+ **${expReward.toLocaleString()}** EXP`, inline: true },
                { name: " **Ryo Earned**", value: `+ **$${moneyReward.toLocaleString()}**`, inline: true },
            )
            .setColor("Blue")
            .setThumbnail(userPfp)
            .setFooter({ text: "KonohaRPG • D-Rank Missions", iconURL: "https://static.wikia.nocookie.net/naruto/images/3/34/Konohagakure.png/revision/latest?cb=20160728115517" })
            .setTimestamp();

        let dropMsg = "```";
        if (user.occupation === "Akatsuki" && akatsukiDropMsg) {
            dropMsg += `\n${akatsukiDropMsg}`;
        } else if (amount > 0) {
            dropMsg += `\nYou found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
        }
        dropMsg += "```";

        await interaction.reply({ embeds: [embed], content: dropMsg });
    }
};
