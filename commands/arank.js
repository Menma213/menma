const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll'); // <-- Add this import
const { addMentorExp } = require('./mentors.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Add emoji constants at the top after requires
const EMOJIS = {
    buff: "<:buff:1364946947055816856>",
    debuff: "<:debuff:1368242212374188062>",
    stun: "<:stun:1368243608695738399>",
    heal: "<:heal:1368243632045297766>",
    bleed: "<:bleed:1368243924346605608>",
    flinch: "<:flinch:1368243647711023124>",
    curse: "<:curse:1368243540978827294>",
    status: "<:status:1368243589498540092>"
};
const COMBO_EMOJI_FILLED = ":o:";
const COMBO_EMOJI_EMPTY = ":white_circle:";
// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

// Cooldown time in milliseconds (18 minutes)
const COOLDOWN_TIME = 20 * 60 * 1000;

// Chakra regen rates per rank
const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chunin': 2,
    'Jounin': 2
};

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Remove the COMBOS variable and load combos from combos.json
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
let comboList = {};
if (fs.existsSync(combosPath)) {
    comboList = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
}

// Effect handlers with improved error handling
const effectHandlers = {
    damage: (user, target, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0
                }
            };
            
            const hitChance = Math.max(0, Math.min(100, context.user.accuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            
            if (!hits) {
                return { damage: 0, hit: false };
            }
            
            const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
            return { damage, hit: true };
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return { damage: 0, hit: false };
        }
    },

    buff: (user, statsDefinition) => {
        const changes = {};
        const context = {
            user: {
                power: Number(user.power) || 0,
                defense: Number(user.defense) || 0,
                health: Number(user.health) || 0,
                chakra: Number(user.chakra) || 0,
                accuracy: Number(user.accuracy) || 100
            }
        };

        if (!statsDefinition || typeof statsDefinition !== 'object') {
            return changes;
        }
        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                changes[stat] = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : Math.floor(math.evaluate(formulaOrValue, context));
            } catch (err) {
                console.error(`Buff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = {
            target: {
                power: Number(target.power) || 0,
                defense: Number(target.defense) || 1,
                health: Number(target.health) || 0,
                chakra: Number(target.chakra) || 0,
                accuracy: Number(target.accuracy) || 100,
                dodge: Number(target.dodge) || 0
            }
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                const value = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : math.evaluate(formulaOrValue, context);
                changes[stat] = value < 0 ? value : -Math.abs(value);
            } catch (err) {
                console.error(`Debuff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    heal: (user, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0
                }
            };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Heal formula error: ${formula}`, err);
            return 0;
        }
    },

    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1)
};

// Add these utility functions near the top (after requires)
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

// Register a font (optional, for better appearance)
try {
    registerFont(path.join(__dirname, '../assets/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
    registerFont(path.join(__dirname, '../assets/Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
} catch (e) {
    // If font files are missing, fallback to system fonts
}

// Utility function to get round effect (copied from brank.js)
function getRoundEffect(roundEffects, currentRound) {
    for (const [roundRange, effectData] of Object.entries(roundEffects)) {
        if (roundRange.includes('-')) {
            const [start, end] = roundRange.split('-').map(Number);
            if (currentRound >= start && currentRound <= end) return effectData;
        } else {
            if (currentRound === Number(roundRange)) return effectData;
        }
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arank')
        .setDescription('Fight multiple NPCs in an A-Rank mission'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            
            if (!users[userId]) {
                return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // --- PREMIUM COOLDOWN PATCH ---
            // Role IDs
            const JINCHURIKI_ROLE = "1385641469507010640";
            const LEGENDARY_ROLE = "1385640798581952714";
            const DONATOR_ROLE = "1385640728130097182";
            let cooldownMs = 20 * 60 * 1000; // default 20 min

            // Check premium roles (jinchuriki > legendary > donator)
            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 12 * 60 * 1000; // 12 min
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = Math.round(12 * 60 * 1000 * 1.1); // 13.2 min
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = Math.round(12 * 60 * 1000 * 1.1 * 1.1); // 14.52 min
            }

            const now = Date.now();
            const lastUsed = users[userId].lastArank || 0;
            const timeLeft = cooldownMs - (now - lastUsed);

            if (timeLeft > 0) {
                const minutes = Math.ceil(timeLeft / 60000);
                return interaction.followUp({ 
                    content: `You can use this command again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
                    ephemeral: true 
                });
            }

            // Update last used time
            users[userId].lastArank = now;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            if (!fs.existsSync(usersPath)) {
                return interaction.followUp({ content: "Database not found.", ephemeral: true });
            }

            if (!users[userId]) {
                return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // Initialize player
            const player = {
                ...users[userId],
                name: interaction.user.username,
                id: interaction.user.id,
                userId: interaction.user.id,
                activeEffects: [],
                accuracy: 100,
                dodge: 0
            };

            // Combo tracking state
            let comboState = null;
            if (player.Combo && comboList[player.Combo]) {
                comboState = {
                    combo: comboList[player.Combo],
                    usedJutsus: new Set()
                };
            }

            // NPC data with unique stats and images
            const npcData = [
                {
                    name: "Jugo",
                    image: "https://i.postimg.cc/vmfSx5V1/17-D3-B777-0-FC6-4-EE4-957-D-513-CC60-D8924.png",
                    basePower: 0.9,
                    baseDefense: 0.8,
                    baseHealth: 0.9,
                    accuracy: 85,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Cursed Seal Transformation"]
                },
                {
                    name: "Temari",
                    image: "https://i.postimg.cc/1tS7G4Gv/6-CCACDF3-9612-4831-8-D31-046-BEA1586-D9.png",
                    basePower: 0.3,
                    baseDefense: 0.2,
                    baseHealth: 0.8,
                    accuracy: 90,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Wind Scythe Jutsu"]
                },
                {
                    name: "Kankuro",
                    image: "https://i.postimg.cc/y8wbNLk4/5-F95788-A-754-C-4-BA6-B0-E0-39-BCE2-FDCF04.png",
                    basePower: 0.85,
                    baseDefense: 0.9,
                    baseHealth: 0.6,
                    accuracy: 80,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Puppet Technique"]
                },
                {
                    name: "Suigetsu",
                    image: "https://i.postimg.cc/GmBfrW3x/54-AE56-B1-E2-EE-4179-BD24-EEC282-A8-B3-BF.png",
                    basePower: 0.8,
                    baseDefense: 0.5,
                    baseHealth: 0.9,
                    accuracy: 75,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Water Transformation"]
                },
                {
                    name: "Fuguki",
                    image: "https://i.postimg.cc/QMJJrm7q/064262-C0-1-BC4-47-B2-A06-A-59-DC193-C0285.png",
                    basePower: 1.0,
                    baseDefense: 0.95,
                    baseHealth: 0.9,
                    accuracy: 70,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Samehada Slash"]
                },
                {
                    name: "Jinpachi",
                    image: "https://i.postimg.cc/SsZLnKD2/809-EBF4-E-70-EF-4-C83-BCE4-3-D6-C228-B1239.png",
                    basePower: 0.9,
                    baseDefense: 0.85,
                    baseHealth: 0.95,
                    accuracy: 85,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Blaze Release"]
                },
                {
                    name: "Kushimaru",
                    image: "https://i.postimg.cc/3wTF6VkR/53-BE91-D0-8-A53-47-C9-BD48-A06728-AFE79-C.png",
                    basePower: 0.95,
                    baseDefense: 0.75,
                    baseHealth: 0.9,
                    accuracy: 95,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Silent Killing"]
                },
                {
                    name: "Baki",
                    image: "https://i.postimg.cc/Jn7c7XcC/5997-D785-7-C7-D-4-BC0-93-DB-CCF7-CA3-CDB56.png",
                    basePower: 0.9,
                    baseDefense: 0.9,
                    baseHealth: 0.9,
                    accuracy: 85,
                    dodge: 0,
                    jutsu: ["Attack", "Substitution Jutsu", "Wind Blade"]
                }
            ];

            // NPC images (in line with npcData order)
            const npcImages = [
                "https://media.discordapp.net/attachments/1354605859103178895/1364667218570514462/image.png?ex=680a80e3&is=68092f63&hm=186262085b1f88de745c6f83c7ff5a9c085faa25f5c3c51a497bdf865df6e4bf&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667330067562576/image.png?ex=680a80fd&is=68092f7d&hm=c5517d8549c73a1f8e40104d731a926248ba907151d6dd85af9e3262dbf8a0b8&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667676235923506/image.png?ex=680a8150&is=68092fd0&hm=f4f93d5da9a12eea2a97d7f8188207c89e6f930320333243f80c7119ead3e8b6&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667843660087428/image.png?ex=680a8178&is=68092ff8&hm=5d97ffb093ee70fff0253a5398befc4784321cc9e1b57fe2b41643fc9a90ded3&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667943425671248/image.png?ex=680a8190&is=68093010&hm=f99928b4fd95e31ad6b69a2bff4fbb428652242d65e76de82459fba8863ecfb4&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668009624502293/image.png?ex=680a819f&is=6809301f&hm=1cc03f61f8f2839c4681a9b1bc4e2bf639b0c1096cb356b9c48ebf72c0fec1a4&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668134488932434/image.png?ex=680a81bd&is=6809303d&hm=0db75d1e5fea2e69634de70c5f8519e0897b9f10f1f21bd70a37233b569f0796&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668218433863772/image.png?ex=680a81d1&is=68093051&hm=376294508040f09a111aaaad5626a49c46cdfe4f055cfcf87870b3eb6dada4df&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1289641866597241035/1364586273133690930/image.png?ex=680a3580&is=6808e400&hm=cbdc018af3b83d959346219ee5e4877de9d97b10cfb03c81d90f9d04c6434169&=&format=webp&quality=lossless"
            ];

            let totalEnemiesDefeated = 0;
            let roundNum = 1;
            let playerHealth = player.health;
            let playerChakra = player.chakra;
            let playerActiveEffects = [];

            // Generate NPC with scaling difficulty and unique stats, now random
            const generateNpc = () => {
                const npcTemplate = npcData[Math.floor(Math.random() * npcData.length)];
                const scalingFactor = 1 + Math.floor(totalEnemiesDefeated / 4) * 0.5;
                return {
                    name: npcTemplate.name,
                    image: npcTemplate.image,
                    health: Math.floor(player.health * npcTemplate.baseHealth * scalingFactor + player.defense * 3),
                    power: Math.floor(player.power * npcTemplate.basePower * scalingFactor + player.level * 3),
                    defense: Math.floor(player.defense * npcTemplate.baseDefense * scalingFactor + player.level * 2),
                    chakra: 10,
                    jutsu: npcTemplate.jutsu,
                    activeEffects: [],
                    accuracy: npcTemplate.accuracy + Math.floor(totalEnemiesDefeated / 4) * 5,
                    dodge: npcTemplate.dodge + Math.floor(totalEnemiesDefeated / 4) * 3,
                    currentHealth: 0 // Will be set when NPC is created
                };
            };

            let currentNpc = generateNpc();
            currentNpc.currentHealth = currentNpc.health;

            // Generate battle image with improved centering, name above, HP bar below, no footer
            const generateBattleImage = async (activeJutsu = null) => {
                const width = 800, height = 400;
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                // --- PATCH: Custom background for round-based jutsu ---
                let bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
                let customBg = null;
                if (activeJutsu && activeJutsu.custombackground && activeJutsu.custombackground.round && roundNum >= activeJutsu.custombackground.round) {
                    customBg = activeJutsu.custombackground.url;
                }
                if (customBg) bgUrl = customBg;

                // Load images
                let bgImg, npcImg, playerImg;
                try { bgImg = await loadImage(bgUrl); } catch { bgImg = null; }
                try { npcImg = await loadImage(currentNpc.image); } catch { npcImg = null; }
                let playerImgUrl;
                if (interaction.user.avatar) {
                    playerImgUrl = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
                } else {
                    const defaultAvatarNumber = parseInt(interaction.user.discriminator) % 5;
                    playerImgUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                }
                try { playerImg = await loadImage(playerImgUrl); } catch { playerImg = null; }

                // Draw background
                if (bgImg) ctx.drawImage(bgImg, 0, 0, width, height);
                else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, width, height); }

                // Helper for rounded rectangles
                function roundRect(ctx, x, y, w, h, r) {
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.lineTo(x + w - r, y);
                    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                    ctx.lineTo(x + w, y + h - r);
                    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                    ctx.lineTo(x + r, y + h);
                    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                    ctx.lineTo(x, y + r);
                    ctx.quadraticCurveTo(x, y, x + r, y);
                    ctx.closePath();
                }

                // Positions
                const charW = 150, charH = 150;
                const playerX = width - 50 - charW, playerY = 120;
                const npcX = 50, npcY = 120;
                const nameY = 80, barY = 280;
                const nameH = 28, barH = 22;

                // Draw NPC character
                if (npcImg) {
                    ctx.save();
                    roundRect(ctx, npcX, npcY, charW, charH, 10);
                    ctx.clip();
                    ctx.drawImage(npcImg, npcX, npcY, charW, charH);
                    ctx.restore();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "#6e1515";
                    roundRect(ctx, npcX, npcY, charW, charH, 10);
                    ctx.stroke();
                }

                // Draw Player character
                if (playerImg) {
                    ctx.save();
                    roundRect(ctx, playerX, playerY, charW, charH, 10);
                    ctx.clip();
                    ctx.drawImage(playerImg, playerX, playerY, charW, charH);
                    ctx.restore();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "#6e1515";
                    roundRect(ctx, playerX, playerY, charW, charH, 10);
                    ctx.stroke();
                }

                // Draw name tags
                ctx.font = "bold 18px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // NPC name
                ctx.save();
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = "#000";
                roundRect(ctx, npcX, nameY, charW, nameH, 5);
                ctx.fill();
                ctx.restore();
                ctx.fillStyle = "#fff";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(currentNpc.name, npcX + charW / 2, nameY + nameH / 2);
                ctx.shadowBlur = 0;
                // Player name
                ctx.save();
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = "#000";
                roundRect(ctx, playerX, nameY, charW, nameH, 5);
                ctx.fill();
                ctx.restore();
                ctx.fillStyle = "#fff";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(player.name, playerX + charW / 2, nameY + nameH / 2);
                ctx.shadowBlur = 0;

                // Health bars
                // NPC
                const npcHealthPercent = Math.max((currentNpc.currentHealth ?? currentNpc.health) / currentNpc.health, 0);
                ctx.save();
                ctx.fillStyle = "#333";
                roundRect(ctx, npcX, barY, charW, barH, 5);
                ctx.fill();
                ctx.fillStyle = "#ff4444";
                roundRect(ctx, npcX, barY, charW * npcHealthPercent, barH, 5);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "13px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 1;
                ctx.shadowBlur = 0;
                ctx.restore();

                // Player
                const playerHealthPercent = Math.max(playerHealth / player.health, 0);
                ctx.save();
                ctx.fillStyle = "#333";
                roundRect(ctx, playerX, barY, charW, barH, 5);
                ctx.fill();
                ctx.fillStyle = "#4CAF50";
                roundRect(ctx, playerX, barY, charW * playerHealthPercent, barH, 5);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "13px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 1;
                ctx.shadowBlur = 0;
                ctx.restore();

                // VS text
                ctx.save();
                ctx.font = "bold 48px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#fff";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText("VS", width / 2, height / 2);
                ctx.restore();

                // Return buffer instead of saving to file
                return canvas.toBuffer('image/png');
            };

            // --- ROUND-BASED JUTSU STATE ---
            let playerActiveJutsus = {};
            let playerRoundBasedSummaries = [];

            // Execute a jutsu with base and effective stats
            const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, currentRound = 1, isRoundBasedActivation = false) => {
                const jutsu = jutsuList[jutsuName];
                if (!jutsu) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name} attempted unknown jutsu: ${jutsuName}`,
                        specialEffects: ["Jutsu failed!"],
                        hit: false,
                        jutsuUsed: jutsuName
                    };
                }

                // --- ROUND-BASED JUTSU HANDLING ---
                if (jutsu.roundBased) {
                    // Only deduct chakra on first activation
                    if (isRoundBasedActivation) {
                        if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                                specialEffects: ["Chakra exhausted!"],
                                hit: false,
                                jutsuUsed: jutsuName
                            };
                        }
                        baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
                    }

                    const roundEffect = getRoundEffect(jutsu.roundEffects, currentRound);
                    let desc = "";
                    let effectsSummary = [];
                    let damage = 0, heal = 0, hit = true;

                    if (roundEffect) {
                        // Replace placeholders in description
                        desc = roundEffect.description
                            .replace(/\buser\b/gi, `<@${baseUser.id || baseUser.userId}>`)
                            .replace(/\btarget\b/gi, baseTarget.name)
                            .replace(/\[Player\]/g, baseUser.name)
                            .replace(/\[Enemy\]/g, baseTarget.name);

                        // Apply effects if present
                        if (roundEffect.effects) {
                            roundEffect.effects.forEach(effect => {
                                let tempResult = { damage: 0, heal: 0, specialEffects: [], hit: true };
                                switch (effect.type) {
                                    case 'damage':
                                        const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula);
                                        tempResult.damage += damageResult.damage;
                                        tempResult.hit = damageResult.hit;
                                        if (damageResult.hit && damageResult.damage > 0) {
                                            tempResult.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                                        } else if (!damageResult.hit) {
                                            tempResult.specialEffects.push("Attack missed!");
                                        }
                                        break;
                                    case 'buff':
                                        const buffChanges = effectHandlers.buff(baseUser, effect.stats);
                                        if (!baseUser.activeEffects) baseUser.activeEffects = [];
                                        baseUser.activeEffects.push({
                                            type: 'buff',
                                            stats: buffChanges,
                                            duration: effect.duration || 1
                                        });
                                        tempResult.specialEffects.push(`Gained buffs: ${Object.entries(buffChanges)
                                            .map(([k, v]) => `${k}: +${v}`)
                                            .join(', ')} for ${effect.duration || 1} turns`);
                                        break;
                                    case 'debuff':
                                        const debuffChanges = effectHandlers.debuff(baseTarget, effect.stats);
                                        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                        baseTarget.activeEffects.push({
                                            type: 'debuff',
                                            stats: debuffChanges,
                                            duration: effect.duration || 1
                                        });
                                        tempResult.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(', ')} for ${effect.duration || 1} turns`);
                                        break;
                                    case 'heal':
                                        const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                        tempResult.heal += healAmount;
                                        if (healAmount > 0) {
                                            tempResult.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                                        }
                                        break;
                                    case 'status':
                                        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                        baseTarget.activeEffects.push({
                                            type: 'status',
                                            status: effect.status,
                                            duration: effect.duration || 1,
                                            damagePerTurn: effect.damagePerTurn
                                        });
                                        tempResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                        break;
                                }
                                damage += tempResult.damage || 0;
                                heal += tempResult.heal || 0;
                                if (tempResult.specialEffects.length) effectsSummary.push(...tempResult.specialEffects);
                                if (tempResult.hit === false) hit = false;
                            });
                        }
                    } else {
                        desc = `${baseUser.name}'s ${jutsu.name} is inactive this round.`;
                        hit = false;
                    }

                    return {
                        damage,
                        heal,
                        description: desc,
                        specialEffects: effectsSummary,
                        hit,
                        jutsuUsed: jutsuName,
                        isRoundBased: true,
                        roundBasedDesc: desc,
                        roundBasedEffects: effectsSummary
                    };
                }

                const result = {
                    damage: 0,
                    heal: 0,
                    description: jutsu.description || `${baseUser.name} used ${jutsu.name}`,
                    specialEffects: [],
                    hit: true,
                    jutsuUsed: jutsuName
                };

                if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                        specialEffects: ["Chakra exhausted!"],
                        hit: false,
                        jutsuUsed: jutsuName
                    };
                }
                baseUser.chakra -= jutsu.chakraCost || 0;

                jutsu.effects.forEach(effect => {
                    try {
                        switch (effect.type) {
                            case 'damage':
                                const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula);
                                result.damage += damageResult.damage;
                                result.hit = damageResult.hit;
                                if (damageResult.hit && damageResult.damage > 0) {
                                    result.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                                } else if (!damageResult.hit) {
                                    result.specialEffects.push("Attack missed!");
                                }
                                break;

                            case 'buff':
                                const buffChanges = effectHandlers.buff(baseUser, effect.stats);
                                if (!baseUser.activeEffects) baseUser.activeEffects = [];
                                baseUser.activeEffects.push({
                                    type: 'buff',
                                    stats: buffChanges,
                                    duration: effect.duration || 1
                                });
                                result.specialEffects.push(`Gained buffs: ${Object.entries(buffChanges)
                                    .map(([k, v]) => `${k}: +${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;

                            case 'debuff':
                                const debuffChanges = effectHandlers.debuff(baseTarget, effect.stats);
                                if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                baseTarget.activeEffects.push({
                                    type: 'debuff',
                                    stats: debuffChanges,
                                    duration: effect.duration || 1
                                });
                                result.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;

                            case 'heal':
                                const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                result.heal += healAmount;
                                if (healAmount > 0) {
                                    result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                                }
                                break;

                            case 'instantKill':
                                if (effectHandlers.instantKill(effect.chance)) {
                                    result.damage = effectiveTarget.health;
                                    result.specialEffects.push("INSTANT KILL!");
                                }
                                break;

                            case 'status':
                                if (effectHandlers.status(effect.chance)) {
                                    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                    const statusEffect = {
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1
                                    };
                                    
                                    // Add extra properties for specific status types
                                    if (effect.status === 'bleed' || effect.status === 'drowning') {
                                        statusEffect.damagePerTurn = baseTarget.health * 0.1;
                                    }
                                    
                                    baseTarget.activeEffects.push(statusEffect);
                                    result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                }
                                break;

                            case 'chakra_gain':
                                let gainAmount = 0;
                                if (typeof effect.amount === 'number') {
                                    gainAmount = effect.amount;
                                } else {
                                    try {
                                        gainAmount = Math.max(0, math.evaluate(effect.amount, { user: baseUser }));
                                    } catch(e) { 
                                        console.error("chakra_gain formula error", e); 
                                        gainAmount = 0;
                                    }
                                }
                                baseUser.chakra = Math.min((baseUser.chakra || 0) + gainAmount, 10);
                                if (gainAmount > 0) {
                                    result.specialEffects.push(`Gained ${Math.round(gainAmount)} Chakra`);
                                }
                                break;
                        }
                    } catch (err) {
                        console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                        result.specialEffects.push(`Error applying ${effect.type} effect`);
                    }
                });

                return result;
            };

            // Create moves embed with simplified slot system
            const createMovesEmbed = () => {
                const embed = new EmbedBuilder()
                    .setTitle(`${player.name}`)
                    .setColor('#006400')
                    .setDescription(
                        `${player.name}, It is your turn!\nUse reactions to make a choice.\n\n` +
                        Object.entries(player.jutsu)
                            .filter(([_, jutsu]) => jutsu !== 'None')
                            .map(([slot, jutsu], index) => {
                                const jutsuData = jutsuList[jutsu];
                                return `${index + 1}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData?.chakraCost} Chakra)` : ''}`;
                            })
                            .join('\n') +
                        `\n\n[:sleeping:] to focus your chakra.\n[:x:] to flee from battle.\n\nChakra: ${player.chakra}`
                    );

                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
                const rows = [];
                
                // Add jutsu buttons
                Object.entries(player.jutsu).forEach(([slot, jutsuName], index) => {
                    if (jutsuName !== 'None') {
                        const jutsu = jutsuList[jutsuName];
                        const disabled = player.chakra < (jutsu?.chakraCost || 0);
                        
                        currentRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`jutsu${slot}-${userId}-${roundNum}`)
                                .setLabel(`${index + 1}`)
                                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(disabled)
                        );
                        
                        buttonCount++;
                        
                        if (buttonCount === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                            buttonCount = 0;
                        }
                    }
                });

                // Add rest and flee buttons to the last row if there's space
                if (buttonCount < 3) {
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rest-${userId}-${roundNum}`)
                            .setEmoji('😴')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`flee-${userId}-${roundNum}`)
                            .setEmoji('❌')
                            .setStyle(ButtonStyle.Primary)
                    );
                    if (currentRow.components.length > 0) {
                        rows.push(currentRow);
                    }
                } else {
                    if (currentRow.components.length > 0) {
                        rows.push(currentRow);
                    }
                    if (rows.length < 5) {
                        const utilityRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`rest-${userId}-${roundNum}`)
                                    .setEmoji('😴')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`flee-${userId}-${roundNum}`)
                                    .setEmoji('❌')
                                    .setStyle(ButtonStyle.Primary)
                            );
                        rows.push(utilityRow);
                    }
                }

                return { embed, components: rows.slice(0, 5) }; // Ensure we don't exceed Discord's 5-row limit
            };

            // Process player move with effective stats
            const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
                const action = customId.split('-')[0];
                
                if (action === 'rest') {
                    // Directly increment the player's chakra so it persists
                    player.chakra = Math.min((player.chakra || 0) + 1,);
                    return {
                        damage: 0,
                        heal: 0,
                        description: `gathered chakra and rested`,
                        specialEffects: ["+1 Chakra"],
                        hit: true,
                        isRest: true
                    };
                }
                
                if (action === 'flee') {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `has fled from battle!`,
                        specialEffects: [],
                        hit: true,
                        fled: true
                    };
                }
                
                return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
            };

            // NPC chooses move with effective stats
            const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
                const stunnedEffect = baseNpc.activeEffects.find(e => e.type === 'status' && e.status === 'stun');
                if (stunnedEffect) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseNpc.name} is stunned and can't move!`,
                        specialEffects: ["Stun active"],
                        hit: false
                    };
                }

                const availableJutsu = baseNpc.jutsu.filter(j => {
                    const jutsu = jutsuList[j];
                    return jutsu && (jutsu.chakraCost || 0) <= baseNpc.chakra;
                });

                if (availableJutsu.length === 0) {
                    baseNpc.chakra = Math.min(baseNpc.chakra + 1, 10);
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseNpc.name} gathered chakra and rested`,
                        specialEffects: ["+1 Chakra"],
                        hit: true
                    };
                }

                const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
                return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
            };

            // Calculate effective stats considering active effects
            const getEffectiveStats = (entity) => {
                const stats = { ...entity };
                delete stats.activeEffects;

                const effectiveStats = {
                    power: stats.power || 10,
                    defense: stats.defense || 10,
                    chakra: stats.chakra || 10,
                    health: stats.health || 100,
                    accuracy: stats.accuracy || 100,
                    dodge: stats.dodge || 0
                };

                entity.activeEffects.forEach(effect => {
                    if (effect.type === 'buff' || effect.type === 'debuff') {
                        Object.entries(effect.stats).forEach(([stat, value]) => {
                            effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                        });
                    }
                });

                return effectiveStats;
            };

            // Create battle summary
            const createBattleSummary = (playerAction, npcAction) => {
                // Get active effect emojis
                const getEffectEmojis = (entity) => {
                    const emojis = [];
                    entity.activeEffects.forEach(effect => {
                        if (effect.type === 'buff') emojis.push(EMOJIS.buff);
                        if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
                        if (effect.type === 'status') {
                            switch (effect.status) {
                                case 'stun': emojis.push(EMOJIS.stun); break;
                                case 'bleed': emojis.push(EMOJIS.bleed); break;
                                case 'flinch': emojis.push(EMOJIS.flinch); break;
                                case 'cursed': emojis.push(EMOJIS.curse); break;
                                default: emojis.push(EMOJIS.status);
                            }
                        }
                    });
                    return emojis.length ? `[${emojis.join('')}] ` : '';
                };

                const playerEffectEmojis = getEffectEmojis(player);
                const npcEffectEmojis = getEffectEmojis(currentNpc);

                const playerDesc = playerAction.isRest ? playerAction.description :
                                  !playerAction.hit ? (playerAction.specialEffects.includes("Stun active") ? "is stunned!" :
                                                     playerAction.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") : 
                                  jutsuList[playerAction.jutsuUsed]?.description || playerAction.description;
                
                const npcDesc = !npcAction.hit ? (npcAction.specialEffects.includes("Stun active") ? `${currentNpc.name} is stunned!` :
                                                 npcAction.specialEffects.includes("Flinch active") ? `${currentNpc.name} flinched!` : `${currentNpc.name} missed!`) : 
                               npcAction.description;

                let statusEffects = [];
                
                // Handle active status effects
                [player, currentNpc].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (effect.type === 'status') {
                            switch(effect.status) {
                                case 'bleed':
                                    const bleedDamage = Math.floor(entity.health * 0.1);
                                    entity.currentHealth -= bleedDamage;
                                    statusEffects.push(`${entity.name} is bleeding! (-${bleedDamage} HP)`);
                                    break;
                                case 'drowning':
                                    const drowningDamage = Math.floor(entity.health * 0.1);
                                    entity.currentHealth -= drowningDamage;
                                    const jutsu = jutsuList['Water Prison'];
                                    const chakraDrain = jutsu.effects[0].chakraDrain || 3;
                                    entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                                    statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                                    break;
                            }
                        }
                    });
                });

                // Combo progress UI
                let comboProgressText = "";
                if (comboState && comboState.combo) {
                    // Only show if at least one combo jutsu was used this round
                    const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
                        comboState.usedJutsus.has(jutsu)
                    );
                    if (usedThisRound) {
                        const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
                        const total = comboState.combo.requiredJutsus.length;
                        comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
                    }
                }

                // --- PATCH: Show round-based jutsu summaries ---
                const roundBasedText = (summaries) => {
                    if (!summaries || !summaries.length) return "";
                    return summaries.map(s => {
                        // PATCH: Replace keywords AFTER player/npc are defined
                        let desc = s.desc;
                        if (player && player.userId) {
                            desc = desc.replace(/\buser\b/gi, `<@${player.userId}>`);
                        }
                        if (currentNpc && currentNpc.name) {
                            desc = desc.replace(/\btarget\b/gi, currentNpc.name);
                        }
                        if (player && player.name) {
                            desc = desc.replace(/\[Player\]/g, player.name);
                        }
                        if (currentNpc && currentNpc.name) {
                            desc = desc.replace(/\[Enemy\]/g, currentNpc.name);
                        }
                        return `\n${desc}${s.effects && s.effects.length ? `\n${s.effects.map(e => `• ${e}`).join('\n')}` : ''}`;
                    }).join('\n');
                };

                const embed = new EmbedBuilder()
                    .setTitle(`Round: ${roundNum}!`)
                    .setColor('#006400')
                    .setDescription(
                        `${playerEffectEmojis}${player.name} ${playerDesc}` +
                        `${playerAction.damage ? ` for ${Math.round(playerAction.damage)} damage!` : 
                         playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                        comboProgressText +
                        roundBasedText(playerRoundBasedSummaries) +
                        `\n\n${npcEffectEmojis}${currentNpc.name} ${npcDesc}` +
                        `${npcAction.damage ? ` for ${Math.round(npcAction.damage)} damage!` : 
                         npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
                        roundBasedText([]) + // If you add NPC round-based summaries, put here
                        (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
                    )
                    .addFields({
                        name: 'Battle Status',
                        value: `${player.name} | ${Math.round(playerHealth)} HP | ${player.chakra} Chakra\n` +
                               `${currentNpc.name} | ${Math.round(currentNpc.currentHealth)} HP | ${currentNpc.chakra} Chakra`
                    });

                // Add jutsu image/gif if available
                const playerJutsu = jutsuList[playerAction.jutsuUsed];
                if (playerJutsu?.image_url) {
                    embed.setImage(playerJutsu.image_url);
                }

                return embed;
            };

            // Calculate rewards with bonus every 5th enemy, scaling bonus by player level
            const calculateRewards = () => {
                // Normal rewards: lower base
                const baseExp = 0.2;
                const baseMoney = 200 + Math.floor(player.level * 5);

                // Bonus every 5th enemy
                if ((totalEnemiesDefeated + 1) % 5 === 0) {
                    // --- NEW BONUS MULTIPLIER LOGIC ---
                    // Bonus exp and money scale with player level
                    let bonusExp = Math.max(2 * player.level, baseExp);
                    let bonusMoney = baseMoney;
                    // Jackpot for 50th enemy
                    if (totalEnemiesDefeated + 1 === 50) {
                        return {
                            exp: Math.floor(bonusExp * 2),
                            money: Math.floor(bonusMoney * 2),
                            isJackpot: true
                        };
                    }
                    return {
                        exp: Math.floor(bonusExp),
                        money: Math.floor(bonusMoney),
                        isBonus: true
                    };
                }
                return {
                    exp: baseExp,
                    money: baseMoney,
                    isNormal: true
                };
            };

            // --- BATTLE LOOP ---
            try {
                let battleActive = true;
                while (battleActive) {
                    // --- PATCH: Gather round-based jutsu summaries but do NOT apply damage/heal yet ---
                    let pendingPlayerRoundBasedEffects = [];
                    playerRoundBasedSummaries = [];
                    Object.entries(playerActiveJutsus).forEach(([jutsuName, data]) => {
                        const jutsu = jutsuList[jutsuName];
                        if (jutsu?.roundBased) {
                            const effectivePlayer = getEffectiveStats(player);
                            const effectiveNpc = getEffectiveStats(currentNpc);

                            const result = executeJutsu(
                                player,
                                currentNpc,
                                effectivePlayer,
                                effectiveNpc,
                                jutsuName,
                                data.round + 1
                            );

                            // --- PATCH: Replace keywords in summary with actual values ---
                            let desc = result.roundBasedDesc
                                .replace(/undefined/g, player.name)
                                .replace(/\buser\b/gi, `${player.name}`)
                                .replace(/\btarget\b/gi, currentNpc.name)
                                .replace(/\[player\]/g, player.name || interaction.user.username)
                                .replace(/\[enemy\]/g, currentNpc.name);

                            playerRoundBasedSummaries.push({
                                desc: desc,
                                effects: result.roundBasedEffects
                            });

                            // --- PATCH: Queue up effects for application after move selection ---
                            pendingPlayerRoundBasedEffects.push({
                                damage: result.damage,
                                heal: result.heal
                            });

                            playerActiveJutsus[jutsuName].round++;

                            // Remove completed jutsu
                            const maxRound = Math.max(...Object.keys(jutsu.roundEffects).map(k => {
                                const parts = k.split('-');
                                return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                            }));

                            if (data.round >= maxRound) {
                                delete playerActiveJutsus[jutsuName];
                            }
                        }
                    });

                    // Calculate effective stats for this turn
                    const effectivePlayer = getEffectiveStats(player);
                    const effectiveNpc = getEffectiveStats(currentNpc);

                    // --- PATCH: Find active round-based jutsu for custom background ---
                    let activeJutsu = null;
                    Object.keys(playerActiveJutsus).forEach(jName => {
                        const jutsu = jutsuList[jName];
                        if (jutsu?.custombackground && playerActiveJutsus[jName].round >= jutsu.custombackground.round) {
                            activeJutsu = jutsu;
                        }
                    });

                    // Player turn
                    const { embed, components } = createMovesEmbed();
                    const moveMessage = await interaction.followUp({
                        embeds: [embed],
                        components: components,
                        fetchReply: true
                    });

                    // Send battle image with custom background if needed
                    const battleImage = new AttachmentBuilder(await generateBattleImage(activeJutsu));
                    await interaction.followUp({ files: [battleImage] });

                    // --- PATCH: Now apply round-based jutsu effects (damage/heal) after image is sent ---
                    pendingPlayerRoundBasedEffects.forEach(eff => {
                        if (eff.damage && eff.damage > 0) {
                            currentNpc.currentHealth -= eff.damage;
                        }
                        if (eff.heal && eff.heal > 0) {
                            playerHealth = Math.min(playerHealth + eff.heal, player.health);
                        }
                    });

                    // --- PLAYER TURN BUTTON HANDLING ---
                    const playerAction = await new Promise(resolve => {
                        const collector = moveMessage.createMessageComponentCollector({
                            filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                            time: 120000 // 2 minutes
                        });

                        collector.on('collect', async i => {
                            await i.deferUpdate();
                            let action = i.customId.split('-')[0];
                            if (action.startsWith('jutsu')) {
                                // Extract slot index from customId
                                const slot = action.replace('jutsu', '');
                                const jutsuName = player.jutsu[slot];
                                const jutsu = jutsuList[jutsuName];

                                // --- ROUND-BASED JUTSU ACTIVATION ---
                                if (jutsu?.roundBased) {
                                    if (!playerActiveJutsus[jutsuName]) {
                                        const result = executeJutsu(
                                            player,
                                            currentNpc,
                                            getEffectiveStats(player),
                                            getEffectiveStats(currentNpc),
                                            jutsuName,
                                            1,
                                            true // activation
                                        );
                                        if (!result.hit) {
                                            resolve(result);
                                            collector.stop();
                                            return;
                                        }
                                        playerActiveJutsus[jutsuName] = { round: 1 };
                                        playerRoundBasedSummaries.push({
                                            desc: result.roundBasedDesc,
                                            effects: result.roundBasedEffects
                                        });
                                        result.jutsuUsed = jutsuName;
                                        resolve(result);
                                        collector.stop();
                                        return;
                                    }
                                }

                                // Normal jutsu
                                const result = executeJutsu(
                                    player,
                                    currentNpc,
                                    getEffectiveStats(player),
                                    getEffectiveStats(currentNpc),
                                    jutsuName
                                );
                                // Combo tracking
                                if (
                                    comboState &&
                                    result.jutsuUsed &&
                                    comboState.combo.requiredJutsus.includes(result.jutsuUsed)
                                ) {
                                    comboState.usedJutsus.add(result.jutsuUsed);
                                }
                                result.jutsuUsed = jutsuName;
                                resolve(result);
                            } else {
                                const result = await processPlayerMove(i.customId, player, currentNpc, getEffectiveStats(player), getEffectiveStats(currentNpc));
                                resolve(result);
                            }
                            collector.stop();
                        });

                        collector.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                resolve({
                                    damage: 0,
                                    heal: 0,
                                    description: `fled, did not make a move`,
                                    specialEffects: [],
                                    hit: false,
                                    fled: true
                                });
                            }
                            moveMessage.edit({ 
                                components: components.map(row => {
                                    const disabledRow = ActionRowBuilder.from(row);
                                    disabledRow.components.forEach(c => c.setDisabled(true));
                                    return disabledRow;
                                })
                            }).catch(console.error);
                        });
                    });

                    if (playerAction.fled) {
                        battleActive = false;
                        await interaction.followUp(`${player.name} fled from the battle!`);
                        return;
                    }

                    // Apply player action results
                    currentNpc.currentHealth -= playerAction.damage || 0;
                    if (playerAction.heal) {
                        playerHealth = Math.min(playerHealth + playerAction.heal, player.health);
                    }

                    // Combo completion check and bonus damage
                    let comboCompletedThisRound = false;
                    let comboDamageText = "";
                    if (
                        comboState &&
                        comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
                    ) {
                        const combo = comboState.combo;
                        let comboResult = {
                            damage: combo.damage || 0,
                            heal: 0,
                            specialEffects: [],
                            hit: true
                        };
                        if (combo.effects && Array.isArray(combo.effects)) {
                            combo.effects.forEach(effect => {
                                switch (effect.type) {
                                    case 'damage':
                                        comboResult.damage += effect.value || 0;
                                        comboResult.specialEffects.push(`Dealt ${effect.value || 0} damage`);
                                        break;
                                    case 'heal':
                                        const healAmount = effectHandlers.heal(player, effect.formula || "0");
                                        comboResult.heal += healAmount;
                                        comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                                        break;
                                    case 'status':
                                        if (!currentNpc.activeEffects) currentNpc.activeEffects = [];
                                        currentNpc.activeEffects.push({
                                            type: 'status',
                                            status: effect.status,
                                            duration: effect.duration || 1
                                        });
                                        comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                        break;
                                    case 'debuff':
                                        const debuffChanges = effectHandlers.debuff(currentNpc, effect.stats);
                                        if (!currentNpc.activeEffects) currentNpc.activeEffects = [];
                                        currentNpc.activeEffects.push({
                                            type: 'debuff',
                                            stats: debuffChanges,
                                            duration: effect.duration || 1
                                        });
                                        comboResult.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(', ')} for ${effect.duration || 1} turns`);
                                        break;
                                }
                            });
                        }
                        currentNpc.currentHealth -= comboResult.damage;
                        if (comboResult.heal) {
                            playerHealth = Math.min(playerHealth + comboResult.heal, player.health);
                        }
                        comboCompletedThisRound = true;
                        comboDamageText = `\n${player.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`;
                        comboState.usedJutsus.clear();
                    }

                    // NPC turn (if still alive)
                    let npcAction = { damage: 0, heal: 0, description: `${currentNpc.name} is defeated`, specialEffects: [], hit: false };
                    if (currentNpc.currentHealth > 0) {
                        npcAction = npcChooseMove(currentNpc, player, effectiveNpc, effectivePlayer);
                        playerHealth -= npcAction.damage || 0;
                        if (npcAction.heal) {
                            currentNpc.currentHealth = Math.min(currentNpc.currentHealth + npcAction.heal, currentNpc.health);
                        }
                    }

                  
                    // Generate fresh battle image
                    const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                    // Show results with fresh image
                    // Add combo completion summary if needed
                    let summaryEmbed = createBattleSummary(playerAction, npcAction);
                    if (comboCompletedThisRound) {
                        summaryEmbed.setDescription(
                            summaryEmbed.data.description + comboDamageText
                        );
                    }
                    await interaction.followUp({
                        embeds: [summaryEmbed],
                        files: [newBattleImage]
                    });

                    // Clear round-based summaries after displaying
                    playerRoundBasedSummaries = [];

                    // Check if current enemy is defeated
                    if (currentNpc.currentHealth <= 0) {
                        totalEnemiesDefeated++;
                        const rewards = calculateRewards();
                        
                        // Update user stats
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].exp += rewards.exp;
                        users[userId].money += rewards.money;
                        users[userId].wins += 1;
                        users[userId].health = player.health;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        // Generate fresh victory image
                        const victoryImage = new AttachmentBuilder(await generateBattleImage());

                        // --- MATERIAL DROP SYSTEM ---
                        let role = player.role || "";
                        if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
                        const amount = getMaterialDrop(role);
                        const mat = getRandomMaterial();

                        // Only add to village and show if amount > 0
                        let villageDropMsg = "";
                        if (amount > 0) {
                            const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
                            let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
                            if (fs.existsSync(villagePath)) {
                                village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
                            }
                            village[mat.key] = (village[mat.key] || 0) + amount;
                            fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
                            villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
                        }

                        // Akatsuki drop
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
                                .setTitle(`Battle End! ${player.name} has won!`)
                                .setDescription(
                                    `**JACKPOT REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nYou've completed 50 enemies in this mission!`
                                )
                                .setColor('#FFD700');
                        } else if (rewards.isBonus) {
                            rewardEmbed = new EmbedBuilder()
                                .setTitle(`Battle End! ${player.name} has won!`)
                                .setDescription(
                                    `**BONUS REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}`
                                )
                                .setColor('#00BFFF');
                        } else {
                            rewardEmbed = new EmbedBuilder()
                                .setTitle(`Battle End! ${player.name} has won!`)
                                .setDescription(
                                    `<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}`
                                )
                                .setColor('#006400');
                        }

                        await interaction.followUp({
                            embeds: [rewardEmbed],
                            content: dropMsg,
                            files: [victoryImage]
                        });

                        // Check if player wants to continue
                        const continueRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('continue')
                                .setLabel('Continue Mission')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('stop')
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
                                if (collected.size === 0) resolve('stop');
                            });
                        });

                        if (choice === 'stop') {
                            battleActive = false;
                            await interaction.followUp("Mission ended by player.");
                            // Immediately return from the execute function to prevent any further code (including reward/material drop)
                            return;
                        }

                        // Prepare next enemy with fresh stats (reset health/chakra/effects)
                        currentNpc = generateNpc();
                        currentNpc.currentHealth = currentNpc.health;
                        playerHealth = player.health;
                        player.chakra = player.chakra || 10; // reset to base chakra
                        player.activeEffects = [];
                        roundNum = 1;
                        // Do NOT send a fresh battle image here! The moves embed will send the image after.
                    }
                    // Check if player is defeated
                    else if (playerHealth <= 0) {
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].losses += 1;
                        users[userId].health = player.health;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        await interaction.followUp(`**Defeat!** You were defeated by ${currentNpc.name}...`);
                        battleActive = false;
                        // Do not give mentor exp or update requirements on loss
                        return;
                    }

                    // Persist player stats across battles
                    player.health = playerHealth;
                    player.chakra = playerChakra;
                    player.activeEffects = playerActiveEffects;

                    // Passive chakra regen
                    player.chakra += CHAKRA_REGEN[player.rank] || 1;
                    currentNpc.chakra += 2; // NPCs get standard regen

                    roundNum++;
                    
                    // Add delay between rounds if battle continues
                    if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // --- MATERIAL DROP SYSTEM ---
                let role = player.role || "";
                if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
                const amount = getMaterialDrop(role);
                const mat = getRandomMaterial();

                // Only add to village and show if amount > 0
                let villageDropMsg = "";
                if (amount > 0) {
                    const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
                    let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
                    if (fs.existsSync(villagePath)) {
                        village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
                    }
                    village[mat.key] = (village[mat.key] || 0) + amount;
                    fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
                    villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
                }

                // Akatsuki drop
                let akatsukiDropMsg = "";
                if (player.occupation === "Akatsuki") {
                    let akatsukiAmount = 0;
                    let akatsukiRole = player.role || "";
                    if (akatsukiRole === "Scientist") akatsukiAmount = Math.floor(Math.random() * 3) + 2;
                    else if (akatsukiRole === "Bruiser") akatsukiAmount = Math.floor(Math.random() * 3) + 8;
                    else if (akatsukiRole === "Co-Leader") akatsukiAmount = Math.floor(Math.random() * 3) + 10;
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

                // Reward embed
                const expReward = 2 + Math.floor(player.level * 40);
                const moneyReward = 800 + Math.floor(player.level * 30);
                const rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End! ${player.name} has won!`)
                    .setDescription(
                        `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!`
                    )
                    .setColor('#006400');

                // Send response (only show drop lines if > 0)
                let dropMsg = "```";
                if (villageDropMsg) dropMsg += `\n${villageDropMsg}`;
                if (akatsukiDropMsg) dropMsg += `${akatsukiDropMsg}`;
                dropMsg += "```";
                await interaction.followUp({ embeds: [rewardEmbed], content: dropMsg });

                // After you determine the user has won an A-Rank fight and it's the 4th win (or multiple of 4):
                if (users[userId].arankWins && users[userId].arankWins % 4 === 0) {
                    let role = player.role || "";
                    if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
                    const amount = getMaterialDrop(role);
                    const mat = getRandomMaterial();

                    // Only add to village and show if amount > 0
                    let villageDropMsg = "";
                    if (amount > 0) {
                        let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
                        if (fs.existsSync(villagePath)) {
                            village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
                        }
                        village[mat.key] = (village[mat.key] || 0) + amount;
                        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
                        villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
                    }

                    // Akatsuki drop
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

                    // Send response (village + akatsuki drop if any)
                    let dropMsg = "```";
                    if (player.occupation === "Akatsuki" && akatsukiDropMsg) {
                        dropMsg += `\n${akatsukiDropMsg}`;
                    } else if (amount > 0) {
                        dropMsg += `\nYou found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
                    }
                    dropMsg += "```";
                    await interaction.followUp({ content: dropMsg });
                }

                await updateRequirements(interaction.user.id, 'a_mission');
                await addMentorExp(userId, 1);
            } catch (error) {
               
                console.error('Mission error:', error);
                await interaction.followUp('An error occurred during the mission!');
            }
        } catch (error) {
            console.error('Mission error:', error);
            await interaction.followUp('An error occurred during the mission!');
        }
    }
};