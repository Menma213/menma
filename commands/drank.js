const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { updateRequirements } = require('./scroll');

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

// Add this helper function near the top
function roundExpSmart(exp) {
    if (typeof exp !== "number") exp = Number(exp);
    const str = exp.toString();
    const dotIdx = str.indexOf(".");
    if (dotIdx === -1) return exp; // integer, nothing to do
    const decimals = str.slice(dotIdx + 1);
    if (decimals.length < 2) return exp; // less than 2 digits after decimal
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

        // Ensure the users file exists
        if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        // Check if the user is enrolled
        if (!users[userId]) {
            return interaction.reply({ 
                content: "❌ **You haven't enrolled yet!** Use `/enroll` to start your journey.", 
                ephemeral: true 
            });
        }

        let player = users[userId];

        // Cooldown: 9 min (premium roles reduce this)
        const now = Date.now();

        // --- PREMIUM COOLDOWN PATCH ---
        // Role IDs
        const JINCHURIKI_ROLE = "1385641469507010640";
        const LEGENDARY_ROLE = "1385640798581952714";
        const DONATOR_ROLE = "1385640728130097182";
        let cooldownMs = 9 * 60 * 1000; // default 9 min

        // Check premium roles (jinchuriki > legendary > donator)
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 4 * 60 * 1000; // 4 min
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(4.9 * 60 * 1000); // 4.4 min
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(5.5 * 60 * 1000); // 4.84 min
        }

        if (player.lastdrank && now - player.lastdrank < cooldownMs) {
            const left = cooldownMs - (now - player.lastdrank);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: false });
        }
        player.lastdrank = now;

        // Generate a random mission
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

        // Rewards scale with level
        let expReward = 1.0;
        let moneyReward = 1000

        player.exp += expReward;
        player.exp = roundExpSmart(player.exp); // <-- round exp after adding
        player.money += moneyReward;

        // Material drop for village (Anbu roles)
        let role = player.role || "";
        if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
        const amount = getMaterialDrop(role);
        const mat = getRandomMaterial();

        // Update village.json
        let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
        if (fs.existsSync(villagePath)) {
            village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
        }
        village[mat.key] = (village[mat.key] || 0) + amount;
        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Prepare Akatsuki material drop message (but do not drop yet)
        let akatsukiDropMsg = "";
        if (player.occupation === "Akatsuki") {
            let akatsukiRole = player.role || "";
            let akatsukiAmount = getAkatsukiMaterialDrop(akatsukiRole);
            // Only drop if role is valid
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

        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Embed Message
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
            .setFooter({ text: "KonohaRPG • D-Rank Missions", iconURL:"https://static.wikia.nocookie.net/naruto/images/3/34/Konohagakure.png/revision/latest?cb=20160728115517" })
            .setTimestamp();

        // Send response (village + akatsuki drop if any)
        let dropMsg = "```";
        if (player.occupation === "Akatsuki" && akatsukiDropMsg) {
            dropMsg += `\n${akatsukiDropMsg}`;
        } else if (amount > 0) {
            dropMsg += `\nYou found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
        }
        dropMsg += "```";
        await interaction.reply({ embeds: [embed], content: dropMsg });

        // Update mission requirements
        await updateRequirements(interaction.user.id, 'd_mission');

        // Add Mentor Experience
        users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;

        // Mark drank as completed for tutorial
        users[userId].drankCompleted = true;

        // Save users.json after updating mentorExp
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    }
};

// NOTE: Make sure any level-up logic elsewhere also uses roundExpSmart or similar rounding for exp!