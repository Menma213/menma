const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Emoji constants (same as arank.js)
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

// Combo system (same as arank.js)
const COMBOS = {
    "Basic Combo": {
        name: "Basic Combo",
        requiredJutsus: ["Attack", "Transformation Jutsu"],
        resultMove: {
            name: "Empowered Attack",
            damage: 10000,
            damageType: "true"
        }
    }
};

// Combo emoji constants
const COMBO_EMOJI_FILLED = "⭕";
const COMBO_EMOJI_EMPTY = "⚪";

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '../../menma/images');

// Load data
let jutsuList = {};
let jutsuData = {};
if (fs.existsSync(jutsusPath)) jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
if (fs.existsSync(jutsuPath)) jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));

// Define S-rank bosses directly
const srankBosses = {
    "haku": {
        name: "Haku",
        image: "https://static.wikia.nocookie.net/naruto/images/3/35/Haku%27s_shinobi_attire.png/revision/latest/scale-to-width-down/1200?cb=20160610212143", // Replace with actual image
        health: 250,
        power: 100,
        defense: 50,
        jutsu: ["Attack, Needle Assault"],  // Changed to use their signature move"],
        reward: "Needle Assault",
        rewardChance: 0.5,
        rewardScroll: "Needle Assault Scroll",
        accuracy: 90,
        dodge: 15
    },
    "zabuza": {
        name: "Zabuza",
        image: "https://static.wikia.nocookie.net/villains/images/7/7d/Zabuza.png/revision/latest?cb=20181118072602", // Replace with actual image
        health: 300,
        power: 150,
        defense: 100,
        jutsu: ["Attack, Silent Assassination"],  // Changed to use their signature move
        reward: "Silent Assassination",
        rewardChance: 0.3,
        rewardScroll: "Silent Assassination Scroll",
        accuracy: 85,
        dodge: 40
    },
    "orochimaru": {
        name: "Orochimaru",
        image: "https://www.pngplay.com/wp-content/uploads/12/Orochimaru-PNG-Free-File-Download.png", // Replace with actual image
        health: 400,
        power: 300,
        defense: 200,
        jutsu: ["Attack, Serpents Wrath"],  // Changed to use their signature move
        reward: "Serpents Wrath",
        rewardChance: 0.3,
        rewardScroll: "Serpents Wrath Scroll",
        accuracy: 95,
        dodge: 20
    }
};


// Effect handlers (same as arank.js)
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

// Add chakra regen rates per rank (copy from arank.js)
const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chuunin': 2,
    'Jounin': 3
};

// Register a font (optional, for better appearance)
try {
    registerFont(path.join(__dirname, '../assets/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
    registerFont(path.join(__dirname, '../assets/Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
} catch (e) {
    // If font files are missing, fallback to system fonts
}


// Add these utility functions near the top (after requires)
function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

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

// Bloodline emoji/gif/name/department definitions (future-proofed)
const BLOODLINE_EMOJIS = {
    Uchiha: "🩸", // fallback to unicode for button
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
// Department/flavor text for each bloodline
const BLOODLINE_DEPARTMENTS = {
    Uchiha: "A crimson aura flickers in your eyes.",
    Hyuga: "Your veins bulge as your vision sharpens.",
    Uzumaki: "A spiral of energy wells up from deep within.",
    Senju: "Your body pulses with ancient vitality.",
    Nara: "Your mind sharpens, calculating every move."
};

// Helper to parse custom emoji string
function parseCustomEmoji(emojiStr) {
    if (!emojiStr) return null;
    const match = emojiStr.match(/^<:([a-zA-Z0-9_]+):(\d+)>$/);
    if (match) {
        return { id: match[2], name: match[1] };
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('srank')
        .setDescription('Embark on a dangerous S-Rank mission'),

    async execute(interaction) {
        try {
            // Remove any reply/editReply before deferReply
            await interaction.deferReply();

            const userId = interaction.user.id;

            // Load user data
            if (!fs.existsSync(usersPath)) {
                return await interaction.followUp({ content: "Database not found.", ephemeral: true });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return await interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // Only allow solo play
            let players = [
                { 
                    id: userId, 
                    username: interaction.user.username, 
                    ...users[userId],
                    activeEffects: [],
                    accuracy: 100,
                    dodge: 0,
                    bloodline: users[userId].bloodline // keep bloodline for reference
                }
            ];

            // Initialize combo state for main player
            let comboState = null;
            if (users[userId].Combo && COMBOS[users[userId].Combo]) {
                comboState = {
                    combo: COMBOS[users[userId].Combo],
                    usedJutsus: new Set()
                };
            }

            // --- COOLDOWN SYSTEM ---
            const now = Date.now();

            // --- PREMIUM COOLDOWN PATCH ---
            // Role IDs
            const JINCHURIKI_ROLE = "1385641469507010640";
            const LEGENDARY_ROLE = "1385640798581952714";
            const DONATOR_ROLE = "1385640728130097182";
            let cooldownMs = 18 * 60 * 1000; // default 18 min

            // Check premium roles (jinchuriki > legendary > donator)
            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 10 * 60 * 1000; // 10 min
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = Math.round(12 * 60 * 1000 ); // 11 min
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = Math.round(13 * 60 * 1000); // 12.1 min
            }

            if (users[userId].lastsrank && now - users[userId].lastsrank < cooldownMs) {
                const left = cooldownMs - (now - users[userId].lastsrank);
                return interaction.followUp({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: true });
            }
            users[userId].lastsrank = now;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            // Change boss selection options
            const bossOptions = Object.entries(srankBosses).map(([bossId, boss]) => ({
                label: boss.name,
                value: bossId
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('srank_boss_selection')
                .setPlaceholder('Select an opponent')
                .addOptions(bossOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('S-Rank Mission')
                .setDescription('These are the ninja you can fight currently.\n\n' + 
                    bossOptions.map((boss, index) => `${index + 1}️⃣: ${boss.label}`).join('\n'))
                .setColor('#006400')

            const message = await interaction.followUp({
                embeds: [embed],
                components: [row]
            });

            // Handle boss selection
            const filter = i => i.user.id === userId && i.customId === 'srank_boss_selection';
            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    // Remove deferUpdate here to avoid double-acknowledgement error
                    // await i.deferUpdate();
                    collector.stop();
                    
                    const bossId = i.values[0];
                    const boss = srankBosses[bossId];
                    
                    // Initialize boss with scaling based on player count
                    const playerCount = players.length;
                    const npc = {
                        ...boss,
                        activeEffects: [],
                        jutsu: boss.jutsu.map(j => jutsuList[j] ? j : 'Attack'),
                        currentHealth: boss.health * (1 + (playerCount - 1) * 0.5), // Scale health with player count
                        power: boss.power * (1 + (playerCount - 1) * 0.2), // Slightly scale power
                        chakra: 10,
                        accuracy: boss.accuracy || 85,
                        dodge: boss.dodge || 15
                    };

                    // Calculate total player stats
                    const totalPlayerHealth = players.reduce((sum, p) => sum + p.health, 0);
                    let currentPlayerHealth = totalPlayerHealth;  // Initialize currentPlayerHealth

                    // Replace S-rank battle image generator with brank's version
                    const generateBattleImage = async () => {
                        // Canvas setup (copied from brank.js)
                        const width = 800, height = 400;
                        const canvas = createCanvas(width, height);
                        const ctx = canvas.getContext('2d');

                        // Load images (try direct URL first)
                        const bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
                        const npcImgUrl = npc.image;
                        // Use user id and avatar hash for Discord avatar, fallback to default
                        let playerImgUrl;
                        if (interaction.user.avatar) {
                            playerImgUrl = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
                        } else {
                            const defaultAvatarNumber = parseInt(interaction.user.discriminator) % 5;
                            playerImgUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                        }

                        let bgImg, npcImg, playerImg;
                        try { bgImg = await loadImage(bgUrl); } catch { bgImg = null; }
                        try { npcImg = await loadImage(npcImgUrl); } catch { npcImg = null; }
                        try { playerImg = await loadImage(playerImgUrl); } catch { playerImg = null; }

                        // Draw background
                        if (bgImg) ctx.drawImage(bgImg, 0, 0, width, height);

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

                        // Positions (copied from brank.js)
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
                        ctx.fillText(players[0].username, playerX + charW / 2, nameY + nameH / 2);
                        ctx.shadowBlur = 0;

                        // Health bars
                        // NPC
                        const npcHealthPercent = Math.max((npc.currentHealth ?? npc.health) / npc.health, 0);
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
                        const p = players[0];
                        const maxHP = typeof p.maxHealth === 'number' ? p.maxHealth : (typeof p.health === 'number' ? p.health : 100);
                        const currHP = typeof p.health === 'number' ? p.health : maxHP;
                        const playerHealthPercent = Math.max(currHP / maxHP, 0);
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

                        return canvas.toBuffer('image/png');
                    };

                    // Execute a jutsu (same as arank.js)
                    const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) => {
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

                        const result = {
                            damage: 0,
                            heal: 0,
                            description: jutsu.description || `${baseUser.name} used ${jutsu.name}`,
                            specialEffects: [],
                            hit: false,
                            jutsuUsed: jutsuName
                        };

                        if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                                specialEffects: ["Not enough chakra!"],
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
                                            result.description = `${baseUser.name || 'Unknown'} missed with ${jutsu.name}!`;
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
                                        baseUser.chakra += gainAmount;
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

                    // Create moves embed for current player 
                    const createMovesEmbed = (currentPlayerIndex) => {
                        const currentPlayer = players[currentPlayerIndex];
                        let currentJutsu = null;
                        
                        const embed = new EmbedBuilder()
                            .setTitle(`${currentPlayer.username}, It is your turn!`)
                            .setColor('#006400')
                            .setDescription(
                                `Use buttons to make a choice.\n\n` +
                                Object.entries(currentPlayer.jutsu)
                                    .filter(([_, jutsu]) => jutsu !== 'None')
                                    .map(([_, jutsuName], index) => {
                                        const jutsuData = jutsuList[jutsuName];
                                        if (jutsuData) currentJutsu = jutsuData;
                                        return `${index + 1}: ${jutsuData?.name || jutsuName}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                                    })
                                    .join('\n') +
                                '\n\n[😴] to focus your chakra.\n' +
                                '[❌] to flee from battle.\n\n' +
                                `Chakra: ${currentPlayer.chakra}`
                            );
                    
                    
                        const rows = [];
                        let currentRow = new ActionRowBuilder();
                        let buttonCount = 0;
                        
                        // Add jutsu buttons with unique custom_id per button (slot index)
                        Object.entries(currentPlayer.jutsu).forEach(([slot, jutsuName], index) => {
                            if (jutsuName !== 'None') {
                                const jutsu = jutsuList[jutsuName];
                                const disabled = currentPlayer.chakra < (jutsu?.chakraCost || 0);
                                
                                if (buttonCount === 5) {
                                    rows.push(currentRow);
                                    currentRow = new ActionRowBuilder();
                                    buttonCount = 0;
                                }
                                
                                // Make custom_id unique by including slot and player id and roundNum
                                currentRow.addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`jutsu${slot}-${currentPlayer.id}-${roundNum}`)
                                        .setLabel(`${index + 1}`)
                                        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                        .setDisabled(disabled)
                                );
                                
                                buttonCount++;
                            }
                        });
                    
                        // Add utility buttons with unique custom_id
                        if (buttonCount < 3) {
                            currentRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`rest-${currentPlayer.id}-${roundNum}`)
                                    .setLabel('😴')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`flee-${currentPlayer.id}-${roundNum}`)
                                    .setLabel('❌')
                                    .setStyle(ButtonStyle.Primary)
                            );
                            if (currentRow.components.length > 0) {
                                rows.push(currentRow);
                            }
                        } else {
                            if (currentRow.components.length > 0) {
                                rows.push(currentRow);
                            }
                            const utilityRow = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`rest-${currentPlayer.id}-${roundNum}`)
                                        .setLabel('😴')
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`flee-${currentPlayer.id}-${roundNum}`)
                                        .setLabel('❌')
                                        .setStyle(ButtonStyle.Danger)
                                );
                            rows.push(utilityRow);
                        }
                    
                        return { embed, components: rows.slice(0, 5) };
                    };

                    // Process player move
                    const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
                        const action = customId.split('-')[0];
                        if (action === 'rest') {
                            basePlayer.chakra += 1;
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${basePlayer.username} gathered chakra and rested`,
                                specialEffects: ["+1 Chakra"],
                                hit: true,
                                isRest: true
                            };
                        }
                        if (action === 'flee') {
                            return { fled: true };
                        }
                        // If it's a jutsu button, extract slot and use it to get the jutsu name
                        if (action.startsWith('jutsu')) {
                            const slot = action.replace('jutsu', '');
                            const jutsuName = basePlayer.jutsu[slot];
                            // Combo tracking
                            if (comboState && comboState.combo.requiredJutsus.includes(jutsuName)) {
                                comboState.usedJutsus.add(jutsuName);
                            }
                            return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, jutsuName);
                        }
                        // fallback
                        return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
                    };

                    // NPC chooses move
                    const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
                        // Always use their signature move if they have chakra
                        const signature = baseNpc.jutsu[0];  // Their signature move is now the only move
                        
                        // Don't bother checking chakra, just attack
                        if (signature) {
                            const target = players.reduce((lowest, current) => 
                                (current.health > 0 && (!lowest || current.health < lowest.health)) ? current : lowest, null);
                                
                            if (target) {
                                return executeJutsu(baseNpc, target, effectiveNpc, getEffectiveStats(target), signature);
                            }
                        }
                    
                        // This should rarely happen since they'll always try to use their signature move
                        return {
                            damage: 0,
                            heal: 0,
                            description: `${baseNpc.name} failed to attack`,
                            specialEffects: [],
                            hit: false
                        };
                    };

                    // Calculate effective stats
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

                    // Create battle summary with effect emojis
                    const createBattleSummary = (playerActions, npcAction) => {
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

                        const playerEffectEmojis = players.map(p => getEffectEmojis(p));
                        const npcEffectEmojis = getEffectEmojis(npc);

                        let statusEffects = [];
                        [...players, npc].forEach(entity => {
                            entity.activeEffects.forEach(effect => {
                                if (effect.type === 'status') {
                                    switch(effect.status) {
                                        case 'bleed':
                                            const bleedDamage = Math.floor(entity.health * 0.1);
                                            statusEffects.push(`${entity.username || entity.name} is bleeding! (-${bleedDamage} HP)`);
                                            break;
                                        case 'drowning':
                                            const drowningDamage = Math.floor(entity.health * 0.1);
                                            const jutsu = jutsuList['Water Prison'];
                                            const chakraDrain = jutsu.effects[0].chakraDrain || 3;
                                            statusEffects.push(`${entity.username || entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                                            break;
                                    }
                                }
                            });
                        });

                        // Combo progress UI
                        let comboProgressText = "";
                        if (comboState && comboState.combo) {
                            const filled = comboState.combo.requiredJutsus.filter(j => comboState.usedJutsus.has(j)).length;
                            if (filled > 0) {
                                const total = comboState.combo.requiredJutsus.length;
                                comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
                            }
                        }

                        const embed = new EmbedBuilder()
                            .setTitle(`Round: ${roundNum}!`)
                            .setColor('#006400')
                            .setDescription(
                                players.map((p, i) => {
                                    const action = playerActions[i];
                                    if (!action.hit) {
                                        return `${playerEffectEmojis[i]}${p.username} ${action.description}`;
                                    }
                                    return `${playerEffectEmojis[i]}${p.username} ${action.description}` +
                                        `${action.damage ? ` for ${Math.round(action.damage)}!` : action.heal ? ` for ${Math.round(action.heal)} HP!` : '!'}`;
                                }).join('\n\n') +
                                `\n\n${npcEffectEmojis}${npc.name} ${npcAction.description}` +
                                `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
                                (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '') +
                                comboProgressText
                            )
                            .addFields({
                                name: 'Battle Status',
                                value: players.map(p => `${p.username} | ${Math.round(p.health)} HP (${p.chakra} Chakra)`).join('\n') +
                                    `\n${npc.name} | ${Math.round(npc.currentHealth)} HP (${npc.chakra} Chakra)`
                            });

                        // Add jutsu image/gif if available
                        if (playerActions.length > 0) {
                            const jutsuUsed = playerActions[0].jutsuUsed;
                            const jutsuInfo = jutsuList[jutsuUsed];
                            if (jutsuInfo?.image_url) {
                                embed.setImage(jutsuInfo.image_url);
                            }
                        }

                        return embed;
                    };

                    // Start battle (remove initial battle image)
                    await interaction.followUp({ 
                        content: `**S-Rank Mission**\nDefeat ${npc.name}!`
                    });

                    let battleActive = true;
                    let roundNum = 1;
                    // Define mainPlayer and playerBloodline before the battle loop
                    const mainPlayer = players[0];
                    const playerBloodline = mainPlayer.bloodline;
                    let bloodlineActive = false;
                    let bloodlineRoundsLeft = 0;
                    let bloodlineUsed = false; // Only allow once per battle except Nara

                    // Ensure maxHealth is set for mainPlayer before the battle loop
                    if (typeof mainPlayer.maxHealth !== "number" || mainPlayer.maxHealth < mainPlayer.health) {
                        mainPlayer.maxHealth = typeof mainPlayer.health === "number" ? mainPlayer.health : 100;
                    }

                    while (battleActive) {
                        // --- Bloodline ability auto-activation (main player only, passive for Nara) ---
                        let bloodlineEmbed = null;
                        // Nara is always passive
                        if (playerBloodline === "Nara") {
                            mainPlayer.chakra += 3;
                            bloodlineEmbed = new EmbedBuilder()
                                .setTitle("Battle IQ")
                                .setDescription(`${BLOODLINE_DEPARTMENTS[playerBloodline]}\n\n<@${mainPlayer.id}> activates **${BLOODLINE_NAMES[playerBloodline]}**!\nBattle IQ grants +3 chakra this round!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            await interaction.followUp({ embeds: [bloodlineEmbed] });
                        }

                        // Uchiha bloodline rounds decrement
                        if (playerBloodline === "Uchiha" && bloodlineActive) {
                            bloodlineRoundsLeft--;
                            if (bloodlineRoundsLeft <= 0) {
                                bloodlineActive = false;
                                mainPlayer.accuracy = 100;
                            }
                        }

                        // --- Auto-activate bloodline if threshold is met and not used ---
                        if (!bloodlineUsed && playerBloodline && playerBloodline !== "Nara") {
                            let shouldActivate = false;
                            // Always use mainPlayer.maxHealth for threshold checks
                            const hp = typeof mainPlayer.health === "number" ? mainPlayer.health : 0;
                            const maxHp = typeof mainPlayer.maxHealth === "number" ? mainPlayer.maxHealth : 100;
                            const chakra = typeof mainPlayer.chakra === "number" ? mainPlayer.chakra : 0;
                            switch (playerBloodline) {
                                case "Senju":
                                    shouldActivate = hp <= maxHp * 0.5;
                                    break;
                                case "Uzumaki":
                                    shouldActivate = hp <= maxHp * 0.5;
                                    break;
                                case "Hyuga":
                                    shouldActivate = chakra >= 15;
                                    break;
                                case "Uchiha":
                                    shouldActivate =  hp <= maxHp * 0.5;
                                    break;
                            }
                            if (shouldActivate) {
                                const flavor = BLOODLINE_DEPARTMENTS[playerBloodline] || "You feel a surge of power!";
                                switch (playerBloodline) {
                                    case "Senju":
                                        mainPlayer.health = Math.min(hp + Math.floor(maxHp * 0.5), maxHp);
                                        bloodlineEmbed = new EmbedBuilder()
                                            .setTitle(BLOODLINE_NAMES[playerBloodline])
                                            .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nHyper Regeneration restores 50% HP!`)
                                            .setImage(BLOODLINE_GIFS[playerBloodline])
                                            .setColor(0x8B4513);
                                        bloodlineUsed = true;
                                        break;
                                    case "Uzumaki":
                                        mainPlayer.chakra += 15;
                                        bloodlineEmbed = new EmbedBuilder()
                                            .setTitle(BLOODLINE_NAMES[playerBloodline])
                                            .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nUzumaki Will surges, chakra increased by 15!`)
                                            .setImage(BLOODLINE_GIFS[playerBloodline])
                                            .setColor(0x8B4513);
                                        bloodlineUsed = true;
                                        break;
                                    case "Hyuga":
                                        {
                                            const drained = Math.min(npc.chakra, 5);
                                            npc.chakra -= drained;
                                            mainPlayer.chakra = Math.min(mainPlayer.chakra + drained, 15);
                                            bloodlineEmbed = new EmbedBuilder()
                                                .setTitle(BLOODLINE_NAMES[playerBloodline])
                                                .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nByakugan drains ${drained} chakra from the enemy!`)
                                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                                .setColor(0x8B4513);
                                            bloodlineUsed = true;
                                        }
                                        break;
                                    case "Uchiha":
                                        mainPlayer.accuracy = 100;
                                        bloodlineActive = true;
                                        bloodlineRoundsLeft = 2;
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

                        // Update effect durations
                        [...players, npc].forEach(entity => {
                            if (!entity.activeEffects) entity.activeEffects = [];
                            entity.activeEffects.forEach(effect => {
                                if (effect.duration > 0) effect.duration--;
                            });
                            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                        });

                        // Process status effects
                        [...players, npc].forEach(entity => {
                            entity.activeEffects.forEach(effect => {
                                if (effect.type === 'status') {
                                    switch(effect.status) {
                                        case 'bleed':
                                            const bleedDamage = Math.floor(entity.health * 0.1);
                                            if (players.includes(entity)) {
                                                entity.health -= bleedDamage;
                                            } else {
                                                npc.currentHealth -= bleedDamage;
                                            }
                                            break;
                                        case 'drowning':
                                            const drowningDamage = Math.floor(entity.health * 0.1);
                                            if (players.includes(entity)) {
                                                entity.health -= drowningDamage;
                                            } else {
                                                npc.currentHealth -= drowningDamage;
                                            }
                                            const jutsu = jutsuList['Water Prison'];
                                            const chakraDrain = jutsu.effects[0].chakraDrain || 3;
                                            entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                                            break;
                                    }
                                }
                            });
                        });

                        // Player turns
                        const playerActions = [];
                        for (let i = 0; i < players.length; i++) {
                            const currentPlayer = players[i];
                            const effectivePlayer = getEffectiveStats(currentPlayer);
                            const effectiveNpc = getEffectiveStats(npc);

                            // Skip if player is dead
                            if (currentPlayer.health <= 0) {
                                playerActions.push({
                                    damage: 0,
                                    heal: 0,
                                    description: `${currentPlayer.username} is unable to fight!`,
                                    specialEffects: [],
                                    hit: false
                                });
                                continue;
                            }

                            // --- Moves embed ---
                            const { embed, components } = (() => {
                                const base = createMovesEmbed(i);
                                // Remove bloodline button logic
                                return base;
                            })();

                            const moveMessage = await interaction.followUp({
                                content: `${currentPlayer.username}, it's your turn!`,
                                embeds: [embed],
                                components: components,
                                fetchReply: true
                            });

                            // Then send fresh battle image
                            const battleImage = new AttachmentBuilder(await generateBattleImage());
                            await interaction.followUp({ files: [battleImage] });

                            const playerAction = await new Promise(resolve => {
                                const collector = moveMessage.createMessageComponentCollector({
                                    filter: ii => ii.user.id === currentPlayer.id && ii.customId.endsWith(`-${currentPlayer.id}-${roundNum}`),
                                    time: 60000
                                });

                                collector.on('collect', async ii => {
                                    await ii.deferUpdate();
                                    // --- Normal jutsu/rest/flee ---
                                    resolve(await processPlayerMove(ii.customId, currentPlayer, npc, effectivePlayer, effectiveNpc));
                                    collector.stop();
                                });

                                collector.on('end', (collected, reason) => {
                                    if (reason === 'time') {
                                        resolve({ fled: true });
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
                                await interaction.followUp(`${currentPlayer.username} fled from the battle!`);
                                break;
                            }

                            // Apply player action
                            npc.currentHealth -= playerAction.damage || 0;
                            if (playerAction.heal) {
                                currentPlayer.health = Math.min(currentPlayer.health + playerAction.heal, currentPlayer.maxHealth);
                                currentPlayerHealth = players.reduce((sum, p) => sum + p.health, 0); // Update total health
                            }

                            playerActions.push(playerAction);
                        }

                        if (!battleActive) break;

                        // NPC turn if still alive
                        let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
                        if (npc.currentHealth > 0 && players.some(p => p.health > 0)) {
                            const effectiveNpc = getEffectiveStats(npc);
                            const effectivePlayer = getEffectiveStats(players[0]); // Just use first player for NPC targeting
                            npcAction = npcChooseMove(npc, players[0], effectiveNpc, effectivePlayer);
                            players.forEach(p => p.health -= npcAction.damage || 0);
                            currentPlayerHealth = players.reduce((sum, p) => sum + p.health, 0); // Update total health after NPC damage
                            if (npcAction.heal) {
                                npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                            }
                        }

                        // Check combo completion
                        let comboCompletedThisRound = false;
                        if (
                            comboState &&
                            comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
                        ) {
                            npc.currentHealth -= comboState.combo.resultMove.damage;
                            comboCompletedThisRound = true;
                            comboState.usedJutsus.clear();
                        }

                       

                        // Move chakra regen to BEFORE battle summary
                        players.forEach(p => {
                            const rank = users[p.id].rank || 'Academy Student';
                            p.chakra += CHAKRA_REGEN[rank] || 1;
                        });
                        npc.chakra += 2; // Boss chakra regen

                        // Generate fresh battle image
                        const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                        // Show results
                        let summaryEmbed = createBattleSummary(playerActions, npcAction);
                        if (comboCompletedThisRound) {
                            summaryEmbed.setDescription(
                                summaryEmbed.data.description +
                                `\n${players[0].username} deals ${comboState.combo.resultMove.damage} additional true damage by landing a ${comboState.combo.resultMove.name}!`
                            );
                        }

                        // Fix chakra display in summary embed
                        summaryEmbed.data.fields[0].value = players.map(p => `${p.username} | ${Math.round(p.health)} HP (${p.chakra} Chakra)`).join('\n') +
                            `\n${npc.name} | ${Math.round(npc.currentHealth)} HP (${npc.chakra} Chakra)`;

                        await interaction.followUp({
                            embeds: [summaryEmbed],
                            files: [newBattleImage]
                        });

                        // Check battle outcome
                        if (npc.currentHealth <= 0) {
                            // Victory - calculate rewards
                            const expReward = 0.7;
                            const moneyReward = 1000 + Math.floor(players[0].level * 30);

                            players.forEach(player => {
                                users[player.id].exp += expReward;
                                users[player.id].money += moneyReward;
                                users[player.id].wins += 1;
                                users[player.id].health = player.health;

                                // Reward chance check
                                const roll = Math.random();
                                if (roll < boss.rewardChance) {
                                    if (!jutsuData[player.id]) {
                                        jutsuData[player.id] = { 
                                            usersjutsu: [],
                                            scrolls: []
                                        };
                                    }
                                    // Ensure scrolls array exists
                                    if (!Array.isArray(jutsuData[player.id].scrolls)) {
                                        jutsuData[player.id].scrolls = [];
                                    }
                                    // Check if player already has the jutsu or scroll
                                    const hasJutsu = Array.isArray(jutsuData[player.id].usersjutsu) && jutsuData[player.id].usersjutsu.includes(boss.reward);
                                    const hasScroll = jutsuData[player.id].scrolls.includes(boss.rewardScroll);

                                    if (!hasJutsu && !hasScroll) {
                                        jutsuData[player.id].scrolls.push(boss.rewardScroll);
                                        interaction.followUp(`\`${player.username} found a ${boss.rewardScroll}!\``);
                                    }
                                } else {
                                    interaction.followUp(`\`${player.username} did not find ${boss.rewardScroll}. You have a ${Math.floor(boss.rewardChance * 100)}% chance of finding it.\``);
                                }
                            });

                            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                            fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));

                            const victoryEmbed = new EmbedBuilder()
                                .setTitle('Battle End!')
                                .setColor('#00FF00')
                                .setDescription(players.map(p => 
                                    `<@${p.id}> has earned ${expReward} exp!\n` +
                                    `<@${p.id}> has earned ${moneyReward} Ryo!`
                                ).join('\n'));

                            await interaction.followUp({ embeds: [victoryEmbed] });

                            await updateRequirements(interaction.user.id, 's_mission');

                            // --- MATERIAL DROP SYSTEM ---
                            // Only drop materials if this is a solo mission (players.length === 1)
                            let role = users[userId].role || "";
                            if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
                            const amount = getMaterialDrop(role);
                            const mat = getRandomMaterial();

                            // Village drop
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
                            if (users[userId].occupation === "Akatsuki") {
                                // Akatsuki drop logic (copy from arank/brank)
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
                                let akatsukiRole = users[userId].role || "";
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

                            // Send material drop message (block message)
                            let dropMsg = "```";
                            if (users[userId].occupation === "Akatsuki" && akatsukiDropMsg) {
                                dropMsg += `\n${akatsukiDropMsg}`;
                            } else if (villageDropMsg) {
                                dropMsg += `\n${villageDropMsg}`;
                            }
                            dropMsg += "```";
                            await interaction.followUp({ content: dropMsg });

                            battleActive = false;

                            // Mark S-rank as win for tutorial
                            users[userId].srankResult = "win";
                            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        } else if (players.every(p => p.health <= 0)) {
                            // Defeat
                            const defeatEmbed = new EmbedBuilder()
                                .setTitle('Mission Failed')
                                .setColor('#FF0000')
                                .setDescription(`You were defeated by ${npc.name}...`);
                            await interaction.followUp({ embeds: [defeatEmbed] });
                            battleActive = false;

                            // Mark S-rank as loss for tutorial
                            users[userId].srankResult = "lose";
                            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        }

                        roundNum++;
                    }

                    // Add mentor experience after mission completion
                    users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                } catch (error) {
                    console.error("Battle error:", error);
                    await interaction.followUp("An error occurred during the battle!");
                }
            });

            collector.on('end', async () => {
            });
        } catch (error) {
            console.error("Command error:", error);
            await interaction.followUp({ content: "An error occurred while executing this command." });
        }
    }
};