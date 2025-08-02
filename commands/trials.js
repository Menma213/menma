const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');

// Emoji constants
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

// Combo system definition
const COMBOS = {
    "Basic Combo": {
        name: "Basic Combo",
        requiredJutsus: ["Attack", "Transformation Jutsu"],
        resultMove: {
            name: "Empowered Attack",
            damage: 10000,
            damageType: "true"
        }
    },
    "Lightning Hound Combo": {
        name: "Lightning Hound Combo",
        requiredJutsus: ["Summon Ninken", "Lightning Blade"],
        resultMove: {
            name: "Lightning Hound Combo",
            damage: 15000,
            damageType: "true",
            effects: [
                {
                    type: "debuff",
                    stats: { dodge: -20 },
                    duration: 2
                },
                {
                    type: "status",
                    status: "stun",
                    chance: 0.3,
                    duration: 1
                },
                {
                    type: "status",
                    status: "mist",
                    duration: 2
                }
            ]
        }
    },
    "Genesis Combo": {
        name: "Genesis Combo",
        requiredJutsus: ["Cherry Blossom Impact", "Creation Rebirth"],
        resultMove: {
            name: "Genesis Combo",
            damage: 12000,
            damageType: "true",
            effects: [
                {
                    type: "heal",
                    formula: "user.health * 0.5"
                }
            ]
        }
    },
    "Flame Reaper Combo": {
        name: "Flame Reaper Combo",
        requiredJutsus: ["Fireball Jutsu", "Reaper Death Seal"],
        resultMove: {
            name: "Flame Reaper Combo",
            damage: 18000,
            damageType: "true",
            effects: [
                {
                    type: "status",
                    status: "reaper_seal",
                    chance: 1,
                    duration: 3
                }
            ]
        }
    },
    "Water Clone Combo": {
        name: "Water Clone Combo",
        requiredJutsus: ["Water Dragon Jutsu", "Shadow Clone Jutsu"],
        resultMove: {
            name: "Water Clone Combo",
            damage: 14000,
            damageType: "true",
            effects: [
                {
                    type: "debuff",
                    stats: { accuracy: -30 },
                    duration: 2
                }
            ]
        }
    },
    "Flash Combo": {
        name: "Flash Combo",
        requiredJutsus: ["Rasengan", "Flying Raijin Jutsu"],
        resultMove: {
            name: "Flash Combo",
            damage: 20000,
            damageType: "true",
            effects: [
                {
                    type: "status",
                    status: "stun",
                    chance: 0.5,
                    duration: 1
                }
            ]
        }
    },
    "Forest Genesis Combo": {
        name: "Forest Genesis Combo",
        requiredJutsus: ["Creation Rebirth", "Great Forest Crumbling"],
        resultMove: {
            name: "Forest Genesis Combo",
            damage: 22000,
            damageType: "true",
            effects: [
                {
                    type: "heal",
                    formula: "user.health * 0.3"
                },
                {
                    type: "status",
                    status: "bleed",
                    chance: 0.7,
                    duration: 3
                }
            ]
        }
    },
    "Ultimate Combo": {
        name: "Ultimate Combo",
        requiredJutsus: ["Shadow Clone Jutsu", "Rasenshuriken"],
        resultMove: {
            name: "Ultimate Combo",
            damage: 30000,
            damageType: "true",
            effects: [
                {
                    type: "debuff",
                    stats: { power: -30, defense: -30 },
                    duration: 3
                }
            ]
        }
    }
};

// Combo emoji constants
const COMBO_EMOJI_FILLED = "⭕";
const COMBO_EMOJI_EMPTY = "⚪";

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '../../menma/images');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Effect handlers
const effectHandlers = {
    damage: (user, target, formula, effect = {}) => {
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
                },
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => 
                    e.type === 'status' && 
                    ['stun', 'flinch'].includes(e.status)
                ),
                max: Math.max
            };
            const finalAccuracy = effect.accuracyBonus ? 
                effectHandlers.getAccuracyBonus(effect, context.user.accuracy) : 
                context.user.accuracy;
            const hitChance = Math.max(0, Math.min(100, finalAccuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            if (!hits) return { damage: 0, hit: false };
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

        if (statsDefinition && typeof statsDefinition === 'object') {
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
    status: (chance) => Math.random() < (chance || 1),
    bleed: (target) => Math.floor(target.health * 0.1),
    flinch: (chance) => Math.random() < chance,
    getAccuracyBonus: (effect, baseAccuracy) => baseAccuracy + (effect.accuracyBonus || 0)
};

// Hokage Trials Data
const HOKAGE_TRIALS = [
    {
        name: "Kakashi Hatake",
        image: "https://www.pngplay.com/wp-content/uploads/12/Kakashi-Hatake-Transparent-Background.png",
        health: 35000,
        power: 1800,
        defense: 1200,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Lightning Blade", "Summon Ninken"],
        combos: ["Lightning Hound Combo"]
    },
    {
        name: "Tsunade",
        image: "https://static.wikia.nocookie.net/all-worlds-alliance/images/5/5a/8-83829_senju-tsunade-random-pinterest-boruto-and-naruto-png.png/revision/latest?cb=20190502024736",
        health: 42000,
        power: 2100,
        defense: 1500,
        accuracy: 90,
        dodge: 15,
        jutsu: ["Attack", "Cherry Blossom Impact", "Creation Rebirth"],
        combos: ["Genesis Combo"]
    },
    {
        name: "Hiruzen Sarutobi",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hiruzen-Sarutobi-PNG-Photos.png",
        health: 48000,
        power: 2300,
        defense: 1700,
        accuracy: 92,
        dodge: 20,
        jutsu: ["Attack", "Fireball Jutsu", "Reaper Death Seal"],
        combos: ["Flame Reaper Combo"]
    },
    {
        name: "Tobirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Tobirama-Senju-PNG-Pic-Background.png",
        health: 54000,
        power: 2500,
        defense: 1800,
        accuracy: 97,
        dodge: 30,
        jutsu: ["Attack", "Water Dragon Jutsu", "Shadow Clone Jutsu"],
        combos: ["Water Clone Combo"]
    },
    {
        name: "Minato Namikaze",
        image: "https://www.pngplay.com/wp-content/uploads/12/Minato-Namikaze-Transparent-Free-PNG.png",
        health: 60000,
        power: 2700,
        defense: 2000,
        accuracy: 100,
        dodge: 40,
        jutsu: ["Attack", "Rasengan", "Flying Raijin Jutsu"],
        combos: ["Flash Combo"]
    },
    {
        name: "Hashirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hashirama-Senju-No-Background.png",
        health: 70000,
        power: 3000,
        defense: 2200,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Creation Rebirth", "Great Forest Crumbling"],
        combos: ["Forest Genesis Combo"]
    },
    {
        name: "Naruto Uzumaki",
        image: "https://pngimg.com/d/naruto_PNG18.png",
        health: 80000,
        power: 3500,
        defense: 2500,
        accuracy: 98,
        dodge: 35,
        jutsu: ["Attack", "Shadow Clone Jutsu", "Rasenshuriken"],
        combos: ["Ultimate Combo"]
    }
];

// Bloodline emoji/gif/name/department definitions (copied from srank.js/brank.js)
const BLOODLINE_EMOJIS = {
    Uchiha: "🩸",
    Hyuga: "👁️",
    Uzumaki: "🌀",
    Senju: "🌳",
    Nara: "🪙"
};
const BLOODLINE_GIFS = {
    Uchiha: "https://media.tenor.com/0QwQvQkQwQwAAAAd/sharingan.gif",
    Hyuga: "https://media.tenor.com/Hyuga.gif",
    Uzumaki: "https://media.tenor.com/Uzumaki.gif",
    Senju: "https://media.tenor.com/Senju.gif",
    Nara: "https://media.tenor.com/Nara.gif"
};
const BLOODLINE_NAMES = {
    Uchiha: "Sharingan",
    Hyuga: "Byakugan",
    Uzumaki: "Uzumaki Will",
    Senju: "Hyper Regeneration",
    Nara: "Battle IQ"
};
const BLOODLINE_DEPARTMENTS = {
    Uchiha: "A crimson aura flickers in your eyes.",
    Hyuga: "Your veins bulge as your vision sharpens.",
    Uzumaki: "A spiral of energy wells up from deep within.",
    Senju: "Your body pulses with ancient vitality.",
    Nara: "Your mind sharpens, calculating every move."
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trials')
        .setDescription('Beat The Hokage Trails!'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Load user data
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // --- Trials cooldown (LastTrials, 20 minutes) ---
        const now = Date.now();

        // --- PREMIUM COOLDOWN PATCH ---
        // Role IDs
        const JINCHURIKI_ROLE = "1385641469507010640";
        const LEGENDARY_ROLE = "1385640798581952714";
        const DONATOR_ROLE = "1385640728130097182";
        let cooldownMs = 20 * 60 * 1000; // default 20 min

        // Check premium roles (jinchuriki > legendary > donator)
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 13 * 60 * 1000; // 13 min
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(14 * 60 * 1000 ); // 14.3 min
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(15 * 60 * 1000 ); // 15.73 min
        }

        if (users[userId].LastTrials && now - users[userId].LastTrials < cooldownMs) {
            const left = cooldownMs - (now - users[userId].LastTrials);
            const min = Math.floor(left / 60000);
            const sec = Math.floor((left % 60000) / 1000);
            return interaction.reply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: false });
        }
        users[userId].LastTrials = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // --- Initialize player ---
        const player = {
            ...users[userId],
            name: interaction.user.username,
            activeEffects: [],
            accuracy: 100,
            dodge: 0
        };

        // Add this line to get bloodline and check validity
        const playerBloodline = player.bloodline;
        const knownBloodlines = Object.keys(BLOODLINE_NAMES);

        let currentTrialIndex = 0;
        let battleActive = true;
        let userLost = false;
        // Fix: Declare bloodlineActive and bloodlineRoundsLeft before use
        let bloodlineActive = false;
        let bloodlineRoundsLeft = 0;
        let bloodlineUsed = false;

        // --- Add round-based jutsu tracking ---
        let playerActiveJutsus = {};
        let playerRoundBasedSummaries = [];

        // --- Battle loop, no try/catch wrapper ---
        let firstBattle = true;
        while (currentTrialIndex < HOKAGE_TRIALS.length && battleActive) {
            const npcTemplate = HOKAGE_TRIALS[currentTrialIndex];
            const npc = {
                name: npcTemplate.name,
                image: npcTemplate.image,
                health: npcTemplate.health,
                power: npcTemplate.power,
                defense: npcTemplate.defense,
                chakra: 10,
                jutsu: npcTemplate.jutsu,
                activeEffects: [],
                accuracy: npcTemplate.accuracy,
                dodge: npcTemplate.dodge,
                combos: npcTemplate.combos,
                currentHealth: npcTemplate.health
            };

            // Reset player stats for each trial (like arank)
            player.health = users[userId].health;
            player.chakra = users[userId].chakra || 10;
            player.activeEffects = [];
            player.accuracy = 100;
            player.dodge = 0;
            let playerHealth = player.health;
            let npcHealth = npc.health;

            let roundNum = 1;

            // Combo state
            let comboState = null;
            if (player.Combo && COMBOS[player.Combo]) {
                comboState = {
                    combo: COMBOS[player.Combo],
                    usedJutsus: new Set()
                };
            }

            // Helper to get avatar image URL (like brank.js)
            function getUserAvatarUrl(user) {
                if (user.avatar) {
                    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
                } else {
                    const defaultAvatarNumber = parseInt(user.discriminator) % 5;
                    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                }
            }

            // Helper for rounded rectangles (copied from brank.js)
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

            // Canvas-based battle image generator (brank.js style)
            // PATCH: Use brank.js-style custom background and robust image loading
            const generateBattleImage = async (player, npc, playerHealth, npcHealth, interaction, roundNum = 1) => {
                const width = 800, height = 400;
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                // --- Custom background handling like brank.js ---
                let bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
                let customBg = null;

                // PATCH: Check active jutsus for custombackground for this round
                // 1. Check round-based jutsu (playerActiveJutsus)
                for (const jName of Object.keys(playerActiveJutsus)) {
                    const jutsu = jutsuList[jName];
                    if (jutsu && jutsu.custombackground && playerActiveJutsus[jName].round >= jutsu.custombackground.round) {
                        customBg = jutsu.custombackground.url;
                        break;
                    }
                }
                // 2. Check if any jutsu used this round (single-use, not round-based) has a custombackground for this round
                if (!customBg && typeof player.lastUsedJutsu === 'string') {
                    const jutsu = jutsuList[player.lastUsedJutsu];
                    if (jutsu && jutsu.custombackground && roundNum >= jutsu.custombackground.round) {
                        customBg = jutsu.custombackground.url;
                    }
                }
                if (customBg) bgUrl = customBg;

                // --- AVATAR PATCH (from brank.js) ---
                let playerImgUrl;
                if (interaction.user.avatar) {
                    playerImgUrl = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
                } else {
                    const defaultAvatarNumber = parseInt(interaction.user.discriminator) % 5;
                    playerImgUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                }
                let npcImgUrl = npc.image || 'https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg';

                // Robust image loading (like brank.js)
                async function robustLoadImage(url) {
                    try {
                        return await loadImage(url);
                    } catch {
                        // fallback: try to download and load from disk if needed
                        const https = require('https');
                        const tmpDir = path.resolve(__dirname, '../images/tmp');
                        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                        const tmpFile = path.join(tmpDir, `img_${Date.now()}_${Math.floor(Math.random()*10000)}.png`);
                        await new Promise((resolve, reject) => {
                            const file = fs.createWriteStream(tmpFile);
                            https.get(url, res => {
                                if (res.statusCode !== 200) {
                                    file.close(() => {});
                                    try { fs.unlinkSync(tmpFile); } catch {}
                                    return reject(new Error(`Failed to download image: ${url}`));
                                }
                                res.pipe(file);
                                file.on('finish', () => file.close(resolve));
                            }).on('error', err => {
                                file.close(() => {});
                                try { fs.unlinkSync(tmpFile); } catch {}
                                reject(err);
                            });
                        });
                        const img = await loadImage(tmpFile);
                        try { fs.unlinkSync(tmpFile); } catch {}
                        return img;
                    }
                }

                const bgImg = await robustLoadImage(bgUrl);
                const enemyImg = await robustLoadImage(npcImgUrl);
                const playerImg = await robustLoadImage(playerImgUrl);

                // Positions and sizes
                const charW = 150, charH = 150;
                const playerX = width - 50 - charW, playerY = 120;
                const npcX = 50, npcY = 120;
                const nameY = 80, barY = 280;
                const nameH = 28, barH = 22;

                // Draw background
                ctx.drawImage(bgImg, 0, 0, width, height);

                // Draw NPC character (rounded rect)
                ctx.save();
                roundRect(ctx, npcX, npcY, charW, charH, 10);
                ctx.clip();
                ctx.drawImage(enemyImg, npcX, npcY, charW, charH);
                ctx.restore();
                // Border
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#6e1515";
                roundRect(ctx, npcX, npcY, charW, charH, 10);
                ctx.stroke();

                // Draw Player character (rounded rect)
                ctx.save();
                roundRect(ctx, playerX, playerY, charW, charH, 10);
                ctx.clip();
                ctx.drawImage(playerImg, playerX, playerY, charW, charH);
                ctx.restore();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#6e1515";
                roundRect(ctx, playerX, playerY, charW, charH, 10);
                ctx.stroke();

                // Draw name tags (rounded rect, semi-transparent)
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
                ctx.fillText(npc.name, npcX + charW / 2, nameY + nameH / 2);
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

                // Health bars (rounded rect, with fill and text)
                // NPC
                const npcHealthPercent = Math.max((npcHealth / npc.health), 0);
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
                const playerHealthPercent = Math.max((playerHealth / player.health), 0);
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

                // Save to file
                const imagesDir = path.resolve(__dirname, '../images');
                if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                }
                const imagePath = path.join(imagesDir, `battle_${interaction.user.id}_${Date.now()}.png`);
                fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
                return imagePath;
            };

            // Create moves embed with simplified slot system
            const createMovesEmbed = () => {
                const embed = new EmbedBuilder()
                    .setTitle(`${player.name}`)
                    .setColor('#006400')
                    .setDescription(
                        `${player.name}, It is your turn!\nUse buttons to make a choice.\n\n` +
                        Object.entries(player.jutsu)
                            .filter(([_, jutsu]) => jutsu !== 'None')
                            .map(([_, jutsuName], index) => {
                                const jutsuData = jutsuList[jutsuName];
                                return `${index + 1}: ${jutsuData?.name || jutsuName}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                            })
                            .join('\n') +
                        `\n\n[😴] to focus your chakra.\n[❌] to flee from battle.\n\nChakra: ${player.chakra}`
                    );

                const jutsuButtons = Object.entries(player.jutsu)
                    .filter(([_, jutsu]) => jutsu !== 'None')
                    .map(([_, jutsuName], index) => {
                        const jutsu = jutsuList[jutsuName];
                        const disabled = player.chakra < (jutsu?.chakraCost || 0);
                        return new ButtonBuilder()
                            .setCustomId(`move${index + 1}-${userId}-${roundNum}`)
                            .setLabel(`${index + 1}`)
                            .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                            .setDisabled(disabled);
                    });

                const rows = [];
                if (jutsuButtons.length > 0) {
                    const row1 = new ActionRowBuilder();
                    jutsuButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
                    rows.push(row1);
                }
                if (jutsuButtons.length > 5) {
                    const row2 = new ActionRowBuilder();
                    row2.addComponents(jutsuButtons[5]);
                    row2.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rest-${userId}-${roundNum}`)
                            .setLabel('😴')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`flee-${userId}-${roundNum}`)
                            .setLabel('❌')
                            .setStyle(ButtonStyle.Primary)
                    );
                    rows.push(row2);
                } else {
                    const row2 = new ActionRowBuilder();
                    row2.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rest-${userId}-${roundNum}`)
                            .setLabel('😴')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`flee-${userId}-${roundNum}`)
                            .setLabel('❌')
                            .setStyle(ButtonStyle.Primary)
                    );
                    rows.push(row2);
                }
                return { embed, components: rows.slice(0, 5) };
            };

            const getJutsuByButton = (buttonId) => {
                const match = buttonId.match(/^move(\d+)-/);
                if (!match) return null;
                const idx = parseInt(match[1], 10) - 1;
                const jutsuNames = Object.entries(player.jutsu)
                    .filter(([_, jutsu]) => jutsu !== 'None')
                    .map(([_, jutsuName]) => jutsuName);
                return jutsuNames[idx];
            };

            // --- PATCH: Add round-based jutsu support for player ---
            // Helper to get round effect for a round-based jutsu
            function getRoundEffect(roundEffects, currentRound) {
                for (const [roundRange, effectData] of Object.entries(roundEffects)) {
                    const [start, end] = roundRange.split('-').map(Number);
                    if ((end && currentRound >= start && currentRound <= end) ||
                        (!end && currentRound === start)) {
                        return effectData;
                    }
                }
                return null;
            }

            // PATCH: Update executeJutsu to support round-based jutsu activation for player and collect round-based summaries
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

                // --- PATCH: Handle round-based jutsu activation for player only ---
                if (jutsu.roundBased && baseUser === player) {
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
                        baseUser.chakra -= jutsu.chakraCost || 0;
                    }

                    // Determine round number for this jutsu
                    const roundNum = isRoundBasedActivation ? 1 : (playerActiveJutsus[jutsuName]?.round || 1);

                    const roundEffect = getRoundEffect(jutsu.roundEffects, roundNum);
                    let desc = "";
                    let effectsSummary = [];
                    let damage = 0, heal = 0, hit = true;

                    if (roundEffect) {
                        // Replace placeholders in description
                        desc = roundEffect.description
                            .replace(/\buser\b/gi, `<@${baseUser.id || userId}>`)
                            .replace(/\btarget\b/gi, baseTarget.name)
                            .replace(/\[Player\]/g, baseUser.name)
                            .replace(/\[Enemy\]/g, baseTarget.name);

                        // Apply effects if present
                        if (roundEffect.effects) {
                            roundEffect.effects.forEach(effect => {
                                let tempResult = { damage: 0, heal: 0, specialEffects: [], hit: true };
                                switch (effect.type) {
                                    case 'damage':
                                        const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
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

                    // PATCH: Push round-based summary for display in embed
                    playerRoundBasedSummaries.push({
                        desc: desc,
                        effects: effectsSummary
                    });

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
            const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
                const action = customId.split('-')[0];
                
                if (action === 'rest') {
                    basePlayer.chakra += 1;
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
                
                // action is now the slot key (e.g. slot1, slot2, etc.)
                const jutsuName = basePlayer.jutsu[action];
                if (!jutsuName) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `Invalid move.`,
                        specialEffects: [],
                        hit: false
                    };
                }
                // PATCH: Activate round-based jutsu if not already active
                if (jutsu?.roundBased && !playerActiveJutsus[jutsuName]) {
                    const result = executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, jutsuName, 1, true);
                    if (result.hit) {
                        playerActiveJutsus[jutsuName] = { round: 1 };
                        playerRoundBasedSummaries.push({
                            desc: result.roundBasedDesc,
                            effects: result.roundBasedEffects
                        });
                    }
                    result.jutsuUsed = jutsuName;
                    return result;
                }
                return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, jutsuName);
            };
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

                // Check for combos first
                if (baseNpc.combos) {
                    for (const comboName of baseNpc.combos) {
                        const combo = COMBOS[comboName];
                        if (!baseNpc.currentCombo) {
                            // Start new combo if first jutsu is available
                            if (baseNpc.jutsu.includes(combo.requiredJutsus[0])) {
                                const jutsu = jutsuList[combo.requiredJutsus[0]];
                                if (baseNpc.chakra >= (jutsu?.chakraCost || 0)) {
                                    baseNpc.currentCombo = {
                                        combo,
                                        usedJutsus: new Set([combo.requiredJutsus[0]])
                                    };
                                    return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, combo.requiredJutsus[0]);
                                }
                            }
                        } else if (baseNpc.currentCombo.combo.name === comboName) {
                            // Continue existing combo
                            if (baseNpc.jutsu.includes(combo.requiredJutsus[1])) {
                                const jutsu = jutsuList[combo.requiredJutsus[1]];
                                if (baseNpc.chakra >= (jutsu?.chakraCost || 0)) {
                                    baseNpc.currentCombo.usedJutsus.add(combo.requiredJutsus[1]);
                                    // Execute combo
                                    const result = {
                                        damage: combo.resultMove.damage,
                                        heal: 0,
                                        description: `${baseNpc.name} performs ${combo.resultMove.name}!`,
                                        specialEffects: [],
                                        hit: true,
                                        isCombo: true
                                    };
                                    
                                    // Apply combo effects
                                    if (combo.resultMove.effects) {
                                        combo.resultMove.effects.forEach(effect => {
                                            switch (effect.type) {
                                                case 'damage':
                                                    result.damage += effect.damage || 0;
                                                    result.specialEffects.push(`Dealt ${effect.damage} damage`);
                                                    break;
                                                case 'heal':
                                                    const healAmount = effectHandlers.heal(baseNpc, effect.formula);
                                                    result.heal += healAmount;
                                                    baseNpc.currentHealth = Math.min(baseNpc.currentHealth + healAmount, baseNpc.health);
                                                    result.specialEffects.push(`Healed ${healAmount} HP`);
                                                    break;
                                                case 'debuff':
                                                    const debuffChanges = effectHandlers.debuff(basePlayer, effect.stats);
                                                    basePlayer.activeEffects.push({
                                                        type: 'debuff',
                                                        stats: debuffChanges,
                                                        duration: effect.duration || 1
                                                    });
                                                    result.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                                        .map(([k, v]) => `${k}: ${v}`)
                                                        .join(', ')} for ${effect.duration || 1} turns`);
                                                    break;
                                                case 'status':
                                                    if (effectHandlers.status(effect.chance || 1)) {
                                                        basePlayer.activeEffects.push({
                                                            type: 'status',
                                                            status: effect.status,
                                                            duration: effect.duration || 1,
                                                            damagePerTurn: effect.damagePerTurn
                                                        });
                                                        result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                                    }
                                                    break;
                                            }
                                        });
                                    }
                                    
                                    baseNpc.currentCombo = null;
                                    return result;
                                }
                            }
                        }
                    }
                }

                // If no combo action, choose from available jutsus
                const availableJutsu = baseNpc.jutsu.filter(j => {
                    const jutsu = jutsuList[j];
                    return jutsu && (jutsu.chakraCost || 0) <= baseNpc.chakra;
                });

                if (availableJutsu.length === 0) {
                    baseNpc.chakra = Math.min(baseNpc.chakra + 2, baseNpc.chakra);
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseNpc.name} gathered chakra and rested`,
                        specialEffects: ["+2 Chakra"],
                        hit: true
                    };
                }

                const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
                return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
            };
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

            // Create battle summary (match arank style for stun/flinch/missed text)
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

                // Use local variable for current health
                const currentNpc = npc;
                if (typeof currentNpc.currentHealth !== 'number') currentNpc.currentHealth = npcHealth;

                const playerEffectEmojis = getEffectEmojis(player);
                const npcEffectEmojis = getEffectEmojis(currentNpc);

                // Use arank-style status text for player/npc
                const playerDesc = playerAction.isRest ? playerAction.description :
                    !playerAction.hit ? (playerAction.specialEffects.includes("Stun active") ? "is stunned!" :
                                        playerAction.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") :
                    (jutsuList[playerAction.jutsuUsed]?.description || playerAction.description);

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
                                    const chakraDrain = jutsu?.effects?.[0]?.chakraDrain || 3;
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

                // PATCH: Add round-based jutsu summaries to round summary embed
                const roundBasedText = (summaries) => {
                    if (!summaries || !summaries.length) return "";
                    return summaries.map(s => {
                        let txt = `\n${s.desc}`;
                        if (s.effects && s.effects.length) {
                            txt += `\nEffects: ${s.effects.join(', ')}`;
                        }
                        return txt;
                    }).join('\n');
                };

                // PATCH: Update createBattleSummary to include round-based summaries
                const embed = new EmbedBuilder()
                    .setTitle(`Round: ${roundNum}!`)
                    .setColor('#006400')
                    .setDescription(
                        `${playerEffectEmojis}@${player.name} ${playerDesc}` +
                        `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                        roundBasedText(playerRoundBasedSummaries) +
                        `\n\n${npcEffectEmojis}${npcDesc}` +
                        `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
                        (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '') +
                        comboProgressText
                    )
                    .addFields({
                        name: 'Battle Status',
                        value: `${player.name} | ${Math.round(player.currentHealth ?? playerHealth)} HP\n${currentNpc.name} | ${Math.round(currentNpc.currentHealth ?? npcHealth)} HP\nChakra: ${player.chakra}            Chakra: ${currentNpc.chakra}`
                    });

                // Add jutsu image/gif if available
                const playerJutsu = jutsuList[playerAction.jutsuUsed];
                if (playerJutsu?.image_url) {
                    embed.setImage(playerJutsu.image_url);
                }

                return embed;
            };

            // --- Battle loop ---
            // Only call interaction.reply once, use followUp for all subsequent messages
            if (firstBattle) {
                await interaction.reply({ content: `**Trial Battle Started!**\nYou are facing **${npc.name}**!` });
                firstBattle = false;
            } else {
                await interaction.followUp({ content: `**Next Trial!** Prepare to face **${npc.name}**!` });
            }

            while (battleActive) {
                // Update effect durations at start of turn
                [player, npc].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (typeof effect.duration === 'number' && effect.duration > 0) effect.duration--;
                    });
                    entity.activeEffects = entity.activeEffects.filter(e => !e.duration || e.duration > 0);
                });

                // --- Bloodline ability auto-activation (main player only, passive for Nara) ---
                let bloodlineEmbed = null;

                // Only run bloodline logic if playerBloodline is valid
                if (playerBloodline && knownBloodlines.includes(playerBloodline)) {
                    // Nara is always passive
                    if (playerBloodline === "Nara") {
                        player.chakra += 3;
                        bloodlineEmbed = new EmbedBuilder()
                            .setTitle("Battle IQ")
                            .setDescription(`${BLOODLINE_DEPARTMENTS[playerBloodline]}\n\n<@${player.id || userId}> activates **${BLOODLINE_NAMES[playerBloodline]}**!\nBattle IQ grants +3 chakra this round!`)
                            .setImage(BLOODLINE_GIFS[playerBloodline])
                            .setColor(0x8B4513);
                        await interaction.followUp({ embeds: [bloodlineEmbed] });
                    }

                    // Uchiha bloodline rounds decrement
                    if (playerBloodline === "Uchiha" && bloodlineActive) {
                        bloodlineRoundsLeft--;
                        if (bloodlineRoundsLeft <= 0) {
                            bloodlineActive = false;
                            player.accuracy = 100;
                        }
                    }

                    // --- Auto-activate bloodline if threshold is met and not used ---
                    if (!bloodlineUsed && playerBloodline && playerBloodline !== "Nara") {
                        let shouldActivate = false;
                        // Always use player.maxHealth for threshold checks
                        const hp = typeof playerHealth === "number" ? playerHealth : 0;
                        const maxHp = typeof player.maxHealth === "number" ? player.maxHealth : 100;
                        const chakra = typeof player.chakra === "number" ? player.chakra : 0;
                        switch (playerBloodline) {
                            case "Senju":
                                shouldActivate = hp <= maxHp * 0.5;
                                break;
                            case "Uzumaki":
                                shouldActivate = hp <= maxHp * 0.5 && chakra < 15;
                                break;
                            case "Hyuga":
                                shouldActivate = chakra >= 15 && npc.chakra > 0;
                                break;
                            case "Uchiha":
                                shouldActivate = !bloodlineActive && hp <= maxHp * 0.5;
                                break;
                        }
                        if (shouldActivate) {
                            const flavor = BLOODLINE_DEPARTMENTS[playerBloodline] || "You feel a surge of power!";
                            switch (playerBloodline) {
                                case "Senju":
                                    playerHealth = Math.min(hp + Math.floor(maxHp * 0.5), maxHp);
                                    bloodlineEmbed = new EmbedBuilder()
                                        .setTitle(BLOODLINE_NAMES[playerBloodline])
                                        .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nHyper Regeneration restores 50% HP!`)
                                        .setImage(BLOODLINE_GIFS[playerBloodline])
                                        .setColor(0x8B4513);
                                    bloodlineUsed = true;
                                    break;
                                case "Uzumaki":
                                    player.chakra = 15;
                                    bloodlineEmbed = new EmbedBuilder()
                                        .setTitle(BLOODLINE_NAMES[playerBloodline])
                                        .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nUzumaki Will surges, chakra set to 15!`)
                                        .setImage(BLOODLINE_GIFS[playerBloodline])
                                        .setColor(0x8B4513);
                                    bloodlineUsed = true;
                                    break;
                                case "Hyuga":
                                    {
                                        const drained = Math.min(npc.chakra, 5);
                                        npc.chakra -= drained;
                                        player.chakra = Math.min(player.chakra + drained, 15);
                                        bloodlineEmbed = new EmbedBuilder()
                                            .setTitle(BLOODLINE_NAMES[playerBloodline])
                                            .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nByakugan drains ${drained} chakra from the enemy!`)
                                            .setImage(BLOODLINE_GIFS[playerBloodline])
                                            .setColor(0x8B4513);
                                    }
                                    break;
                                case "Uchiha":
                                    player.accuracy = 100;
                                    bloodlineActive = true;
                                    bloodlineRoundsLeft = 2;
                                    if (!npc.activeEffects) npc.activeEffects = [];
                                    npc.activeEffects.push({
                                        type: 'status',
                                        status: 'stun',
                                        duration: 2
                                    });
                                    bloodlineEmbed = new EmbedBuilder()
                                        .setTitle(BLOODLINE_NAMES[playerBloodline])
                                        .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nSharingan grants 100% accuracy and stuns the enemy for 2 rounds!`)
                                        .setImage(BLOODLINE_GIFS[playerBloodline])
                                        .setColor(0x8B4513);
                                    bloodlineUsed = true;
                                    break;
                            }
                            if (bloodlineEmbed) {
                                await interaction.followUp({ embeds: [bloodlineEmbed] });
                            }
                        }
                    }
                } // End bloodline logic block

                // PATCH: Add round-based jutsu summaries to round summary embed
                const roundBasedText = (summaries) => {
                    if (!summaries || !summaries.length) return "";
                    return summaries.map(s => {
                        let txt = `\n${s.desc}`;
                        if (s.effects && s.effects.length) {
                            txt += `\nEffects: ${s.effects.join(', ')}`;
                        }
                        return txt;
                    }).join('\n');
                };

                const { embed, components } = createMovesEmbed();
                const moveMessage = await interaction.followUp({
                    embeds: [embed],
                    components: components,
                    fetchReply: true
                });

                // PATCH: Pass roundNum to generateBattleImage, no customBgUrl param
                const battleImage = new AttachmentBuilder(
                    await generateBattleImage(player, npc, playerHealth, npcHealth, interaction, roundNum)
                );
                await interaction.followUp({ files: [battleImage] });

                // Player turn
                const playerAction = await new Promise(resolve => {
                    const collector = moveMessage.createMessageComponentCollector({
                        filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                        time: 90000 // 1 minute 30 seconds
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        if (i.customId.startsWith('move')) {
                            const jutsuName = getJutsuByButton(i.customId);
                            player.lastUsedJutsu = jutsuName; // PATCH: Track last used jutsu
                            const result = executeJutsu(player, npc, getEffectiveStats(player), getEffectiveStats(npc), jutsuName);
                            if (comboState?.combo.requiredJutsus.includes(jutsuName)) {
                                comboState.usedJutsus.add(jutsuName);
                            }
                            result.jutsuUsed = jutsuName;
                            resolve(result);
                        } else {
                            resolve(await processPlayerMove(i.customId, player, npc, getEffectiveStats(player), getEffectiveStats(npc)));
                        }
                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: `<@${userId}> fled, did not make a move.`,
                                specialEffects: ["Missed opportunity!"],
                                hit: false,
                                fled: true,
                                timedOut: true
                            });
                        }
                        moveMessage.edit({ 
                            components: components.map(row => {
                                const disabledRow = ActionRowBuilder.from(row);
                                disabledRow.components.forEach(c => c.setDisabled(true));
                                return disabledRow;
                            })
                        }).catch(() => {});
                    });
                });

                if (playerAction.fled) {
                    battleActive = false;
                    userLost = true;
                    if (playerAction.timedOut) {
                        await interaction.followUp(`<@${userId}> fled, did not make a move.`);
                    } else {
                        await interaction.followUp(`<@${userId}> fled.`);
                    }
                    break;
                }

                // Combo logic
                let comboCompletedThisRound = false;
                let comboDamageText = "";
                if (
                    comboState &&
                    comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
                ) {
                    npcHealth -= comboState.combo.resultMove.damage;
                    if (typeof npc.currentHealth === 'number') npc.currentHealth -= comboState.combo.resultMove.damage;
                    comboCompletedThisRound = true;
                    comboDamageText = `\n${player.name} deals ${comboState.combo.resultMove.damage} additional true damage by landing a ${comboState.combo.resultMove.name}!`;
                    comboState.usedJutsus.clear();
                }

                // Apply player action results
                npcHealth -= playerAction.damage || 0;
                if (typeof npc.currentHealth === 'number') npc.currentHealth -= playerAction.damage || 0;
                if (playerAction.heal) {
                    playerHealth = Math.min(playerHealth + playerAction.heal, player.health);
                }

                // NPC turn (if still alive)
                let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
                if (npcHealth > 0) {
                    npcAction = npcChooseMove(npc, player, getEffectiveStats(npc), getEffectiveStats(player));
                    playerHealth -= npcAction.damage || 0;
                    if (npcAction.heal) {
                        npcHealth = Math.min(npcHealth + npcAction.heal, npc.health);
                        if (typeof npc.currentHealth === 'number') npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                    }
                }

                playerHealth = Math.max(0, playerHealth);
                npcHealth = Math.max(0, npcHealth);
                if (typeof npc.currentHealth === 'number') npc.currentHealth = Math.max(0, npc.currentHealth);

                let summaryEmbed = createBattleSummary(playerAction, npcAction);
                if (comboCompletedThisRound) {
                    summaryEmbed.setDescription(
                        summaryEmbed.data.description + comboDamageText
                    );
                }
                await interaction.followUp({
                    embeds: [summaryEmbed]
                });

                // Win/loss for this Hokage
                if (playerHealth <= 0 || npcHealth <= 0) {
                    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (playerHealth > 0) {
                        // Give 100k money per Hokage
                        const expReward = 0.2;
                        const moneyReward = 10000;
                        users[userId].exp += expReward;
                        users[userId].money += moneyReward;
                        users[userId].wins += 1;
                        users[userId].health = player.health;
                        const rewardEmbed = new EmbedBuilder()
                            .setTitle(`Battle End! ${player.name} has defeated ${npc.name}!`)
                            .setDescription(
                                `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!`
                            )
                            .setColor('#006400');
                        await interaction.followUp({ embeds: [rewardEmbed] });
                        await updateRequirements(interaction.user.id, 'trial_mission');
                        
                        // --- Jutsu Drop System ---
                        // Map trial index to jutsu drop
                        const jutsuDropMap = [
                            "One Thousand Years of Death", // Kakashi
                            "Creation Rebirth",           // Tsunade
                            "Burning Ash",                // Hiruzen
                            "Water Dragon Jutsu",         // Tobirama
                            "Flying Raijin Jutsu",        // Minato
                            "Great Forest Crumbling",     // Hashirama
                            "Rasenshuriken"               // Naruto
                        ];
                        const dropJutsu = jutsuDropMap[currentTrialIndex];
                        if (dropJutsu) {
                            const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
                            let jutsuData = fs.existsSync(jutsuPath) ? JSON.parse(fs.readFileSync(jutsuPath, 'utf8')) : {};
                            if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [] };
                            if (!Array.isArray(jutsuData[userId].usersjutsu)) jutsuData[userId].usersjutsu = [];
                            if (!jutsuData[userId].usersjutsu.includes(dropJutsu)) {
                                jutsuData[userId].usersjutsu.push(dropJutsu);
                                fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));
                                await interaction.followUp({ content: `🎉 You obtained a new jutsu: **${dropJutsu}**!` });
                            }
                        }
                        // Move to next Hokage if any
                        currentTrialIndex++;
                        if (currentTrialIndex < HOKAGE_TRIALS.length) {
                            // Do NOT send "Next Trial!" here, let the outer loop handle it
                            break;
                        } else {
                            battleActive = false;
                        }
                    } else {
                        users[userId].losses += 1;
                        users[userId].health = player.health;
                        await interaction.followUp(`**Defeat!** You were defeated by ${npc.name}...`);
                        battleActive = false;
                        userLost = true;
                    }
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }

                // PATCH: After round, clear round-based summaries for next round
                playerRoundBasedSummaries = [];

                // Passive chakra regen
                player.chakra += 2;
                npc.chakra += 2;

                roundNum++;
                if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
            } // Closing brace for the inner while loop
        } // Closing brace for the outer while loop

        // Set trialsResult for tutorial tracking
        const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!usersFinal[userId]) usersFinal[userId] = {};
        if (userLost) {
            usersFinal[userId].trialsResult = "lose";
        } else if (currentTrialIndex >= HOKAGE_TRIALS.length) {
            usersFinal[userId].trialsResult = "win";
        }
        fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
    }
};