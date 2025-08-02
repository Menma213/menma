const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { createCanvas, loadImage } = require('canvas');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../images');
const rankedRewardsPath = path.resolve(__dirname, '../../menma/data/rankedrewards.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

// Server constants
const SERVER_ID = "1381268582595297321";
const LOG_CHANNEL_ID = "1381278641144467637";
const SUMMARY_CHANNEL_ID = "1381601428740505660";

// Rank configuration
const RANK_CONFIG = {
    ranks: [
        "Genin",
        "Chuunin",
        "Jounin",
        "Sannin",
        "Master Shinobi",
        "The Shinobi God"
    ],
    divisions: [5, 4, 3, 2, 1],
    eloPerDivision: 100,
    winElo: 50,
    lossElo: 50 // For user vs user, users lose 50 ELO on loss
};

// NPC data for ranked matches
const rankedNPCs = [
    {
        name: "Kakashi",
        image: "https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png/revision/latest/scale-to-width-down/300?cb=20230803224121", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.25,
        accuracy: 90,
        dodge: 20,
        jutsu: ["Attack", "Lightning Blade", "One Thousand Years of Death"]
    },
    {
        name: "Guy",
        image: "https://static.wikia.nocookie.net/naruto/images/3/31/Might_Guy.png/revision/latest/scale-to-width-down/300?cb=20150401084456", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.25,
        accuracy: 85,
        dodge: 15,
        jutsu: ["Attack", "Dynamic Entry"]
    },
    {
        name: "Asuma",
        image: "https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.25,
        accuracy: 85,
        dodge: 15,
        jutsu: ["Attack", "Burning Ash"]
    },
    {
        name: "Kurenai",
        image: "https://static.wikia.nocookie.net/naruto/images/6/67/Kurenai_Part_I.png/revision/latest?cb=20150207094753", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.25,
        accuracy: 90,
        dodge: 25,
        jutsu: ["Attack", "Rasengan"]
    }
];

// Ranked queue system
const rankedQueue = {
    standard: new Map(), // Map of user IDs to queue entry timestamps
    custom: new Map(),   // For future use
    matches: new Map(),  // Ongoing matches (channelId -> matchData)
    logChannel: null
};

// Load jutsus and combos
let jutsuList = {};
let comboList = {};
let rankedRewards = [];

if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}
if (fs.existsSync(combosPath)) {
    comboList = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
}
if (fs.existsSync(rankedRewardsPath)) {
    rankedRewards = JSON.parse(fs.readFileSync(rankedRewardsPath, 'utf8'));
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
                    e.type === 'status' && ['stun', 'flinch'].includes(e.status)
                ),
                max: Math.max
            };

            const finalAccuracy = effect.accuracyBonus ?
                effectHandlers.getAccuracyBonus(effect, context.user.accuracy) :
                context.user.accuracy;

            const hitChance = Math.max(0, Math.min(100, finalAccuracy - context.target.dodge));
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
    status: (chance) => Math.random() < (chance || 1),
    bleed: (target) => Math.floor(target.health * 0.1),
    flinch: (chance) => Math.random() < chance,
    getAccuracyBonus: (effect, baseAccuracy) => baseAccuracy + (effect.accuracyBonus || 0)
};

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
const COMBO_EMOJI_FILLED = ":o:";
const COMBO_EMOJI_EMPTY = ":white_circle:";

// Utility functions
function getRandomChannelId() {
    return Math.floor(Math.random() * 900000 + 100000).toString();
}

function getTierAndDivision(elo) {
    if (!elo && elo !== 0) return { rank: "Genin", division: 5, elo: 0 };
    let totalDivisions = RANK_CONFIG.ranks.length * 5;
    let currentDivision = Math.floor(elo / RANK_CONFIG.eloPerDivision);
    if (currentDivision >= totalDivisions) {
        return {
            rank: "The Shinobi God",
            division: 1,
            elo: elo % RANK_CONFIG.eloPerDivision
        };
    }
    let rankIndex = Math.floor(currentDivision / 5);
    let division = 5 - (currentDivision % 5);
    return {
        rank: RANK_CONFIG.ranks[rankIndex],
        division: division,
        elo: elo % RANK_CONFIG.eloPerDivision
    };
}

// --- ELO SYSTEM REWRITE ---
function updateElo(winnerId, loserId, isNpcMatch = false) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // PATCH: If winner or loser is an NPC, do not update users.json, just return dummy values
    if (
        typeof winnerId === "string" && winnerId.startsWith("NPC_") ||
        typeof loserId === "string" && loserId.startsWith("NPC_")
    ) {
        return {
            winnerChange: isNpcMatch ? 20 : RANK_CONFIG.winElo,
            loserChange: isNpcMatch ? 0 : RANK_CONFIG.lossElo,
            winnerNew: { rank: "NPC", division: 0, elo: 0 },
            loserNew: { rank: "NPC", division: 0, elo: 0 }
        };
    }

    // Ensure elo and rank exist directly on user object
    if (typeof users[winnerId].elo !== "number") users[winnerId].elo = 0;
    if (typeof users[loserId].elo !== "number") users[loserId].elo = 0;

    const winElo = isNpcMatch ? 20 : RANK_CONFIG.winElo;
    const lossElo = isNpcMatch ? 0 : RANK_CONFIG.lossElo;

    users[winnerId].elo += winElo;
    users[loserId].elo = Math.max(0, users[loserId].elo - lossElo);

    // Update rank (and division) directly
    const winnerRank = getTierAndDivision(users[winnerId].elo);
    const loserRank = getTierAndDivision(users[loserId].elo);

    users[winnerId].rank = winnerRank.rank;
    users[loserId].rank = loserRank.rank;

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    return {
        winnerChange: winElo,
        loserChange: lossElo,
        winnerNew: winnerRank,
        loserNew: loserRank
    };
}

function getEffectiveStats(entity) {
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
    if (entity.activeEffects) {
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'buff' || effect.type === 'debuff') {
                Object.entries(effect.stats).forEach(([stat, value]) => {
                    effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                });
            }
        });
    }
    return effectiveStats;
}

// Image generation functions
// PATCH: Accept a custom background URL for battle image, like brank.js
async function generateBattleImage(player1, player2, customBgUrl = null) {
    const width = 800, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // PATCH: Use custom background if provided
    let bgImg;
    try {
        if (customBgUrl) {
            bgImg = await loadImage(customBgUrl);
        } else {
            bgImg = await loadImage('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg');
        }
    } catch {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
    }
    if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, width, height);
    }

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
    const p1X = 50, p1Y = 120;
    const p2X = width - 50 - charW, p2Y = 120;
    const nameY = 80, barY = 280;
    const nameH = 28, barH = 22;

    // Get avatars
    let p1AvatarUrl, p2AvatarUrl;

    // Player 1: always a user
    if (player1.avatar) {
        p1AvatarUrl = `https://cdn.discordapp.com/avatars/${player1.userId || player1.id}/${player1.avatar}.png?size=256`;
    } else {
        const defaultAvatarNumber = parseInt(player1.discriminator) % 5;
        p1AvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
    }

    // Player 2: could be user or NPC
    if (player2.image) {
        // NPC: use their image property
        p2AvatarUrl = player2.image;
    } else if (player2.avatar) {
        p2AvatarUrl = `https://cdn.discordapp.com/avatars/${player2.userId || player2.id}/${player2.avatar}.png?size=256`;
    } else {
        const defaultAvatarNumber = parseInt(player2.discriminator) % 5;
        p2AvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
    }

    // Load and draw avatars
    let p1Img, p2Img;
    try {
        p1Img = await loadImage(p1AvatarUrl);
        ctx.save();
        roundRect(ctx, p1X, p1Y, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(p1Img, p1X, p1Y, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(ctx, p1X, p1Y, charW, charH, 10);
        ctx.stroke();
    } catch (err) {
        console.error("Error loading player 1 avatar:", err);
    }

    try {
        p2Img = await loadImage(p2AvatarUrl);
        ctx.save();
        roundRect(ctx, p2X, p2Y, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(p2Img, p2X, p2Y, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(ctx, p2X, p2Y, charW, charH, 10);
        ctx.stroke();
    } catch (err) {
        console.error("Error loading player 2 avatar:", err);
    }

    // Name tags
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Player 1 name
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    roundRect(ctx, p1X, nameY, charW, nameH, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(player1.name, p1X + charW / 2, nameY + nameH / 2);
    ctx.shadowBlur = 0;
    
    // Player 2 name
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    roundRect(ctx, p2X, nameY, charW, nameH, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(player2.name, p2X + charW / 2, nameY + nameH / 2);
    ctx.shadowBlur = 0;

    // Health bars
    const p1HealthPercent = Math.max(player1.currentHealth / player1.health, 0);
    const p2HealthPercent = Math.max(player2.currentHealth / player2.health, 0);
    
    // Player 1 health
    ctx.save();
    ctx.fillStyle = "#333";
    roundRect(ctx, p1X, barY, charW, barH, 5);
    ctx.fill();
    ctx.fillStyle = "#4CAF50";
    roundRect(ctx, p1X, barY, charW * p1HealthPercent, barH, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.restore();
    
    // Player 2 health
    ctx.save();
    ctx.fillStyle = "#333";
    roundRect(ctx, p2X, barY, charW, barH, 5);
    ctx.fill();
    ctx.fillStyle = "#ff4444";
    roundRect(ctx, p2X, barY, charW * p2HealthPercent, barH, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
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
    if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
    }
    const filename = `battle_${player1.userId || player1.id}_${player2.userId || player2.id}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    const out = fs.createWriteStream(fullPath);
    const stream = canvas.createPNGStream();
    
    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
    });
    
    return fullPath;
}

async function generateEloImage(user, oldElo, newElo, isWinner) {
    const width = 600, height = 220;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Theme colors
    const bgColor = isWinner ? '#1a3a1a' : '#3a1a1a';
    const primaryColor = isWinner ? '#4ade80' : '#ef4444';
    const secondaryColor = isWinner ? '#22c55e' : '#dc2626';
    const textColor = '#ffffff';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // ELO bar
    const barX = 120, barY = 90, barW = 360, barH = 28;
    const oldRank = getTierAndDivision(oldElo);
    const newRank = getTierAndDivision(newElo);
    const progress = Math.max(0, Math.min(1, (newElo % 100) / 100));
    
    ctx.save();
    ctx.fillStyle = '#222c';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 14);
    ctx.fill();
    ctx.restore();

    // Progress bar
    ctx.save();
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(1, secondaryColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 14);
    ctx.fill();
    ctx.restore();

    // ELO gained/lost in center
    ctx.font = 'bold 22px Segoe UI, Arial';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${isWinner ? '+' : ''}${newElo - oldElo} ELO`, barX + barW / 2, barY + barH / 2 + 7);

    // Current rank (left)
    ctx.font = 'bold 15px Segoe UI, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${newRank.rank} Div. ${newRank.division}`, barX, barY - 8);
    ctx.font = '10px Segoe UI, Arial';
    ctx.fillText('Current Rank', barX, barY + barH + 16);

    // Previous rank (right)
    ctx.font = 'bold 15px Segoe UI, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${oldRank.rank} Div. ${oldRank.division}`, barX + barW, barY - 8);
    ctx.font = '10px Segoe UI, Arial';
    ctx.fillText('Previous Rank', barX + barW, barY + barH + 16);

    // Progress text below bar
    ctx.font = '11px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${newElo % 100}/100`, barX + barW / 2, barY + barH + 16);

    // Save to file
    if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
    }
    const filename = `elo_${user.id || user.userId}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    const out = fs.createWriteStream(fullPath);
    const stream = canvas.createPNGStream();
    
    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
    });
    
    return fullPath;
}

async function generateRankedRewardsImage(user, userElo, userRank, userDiv, claimable, nextReward) {
    const width = 700, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Theme colors by rank
    const themes = {
        "Genin":    { bg: "#0a1a3a", accent: "#1e3a8a", text: "#e0eaff", border: "#274690" },
        "Chuunin":  { bg: "#1e4023", accent: "#4ade80", text: "#eaffea", border: "#22c55e" },
        "Jounin":   { bg: "#0e3c3c", accent: "#2dd4bf", text: "#eafffa", border: "#14b8a6" },
        "Sannin":   { bg: "#2a1a3a", accent: "#a78bfa", text: "#f3eaff", border: "#7c3aed" },
        "Master Shinobi": { bg: "#3a3a1a", accent: "#fde68a", text: "#fffbe0", border: "#facc15" },
        "The Shinobi God": { bg: "#0a2a3a", accent: "#67e8f9", text: "#e0faff", border: "#06b6d4" }
    };
    const theme = themes[userRank] || themes["Genin"];

    // Background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.fillText('Ranked Rewards', width / 2, 50);

    // Rank box
    ctx.fillStyle = `${theme.accent}33`;
    ctx.beginPath();
    ctx.roundRect(50, 80, width - 100, 60, 10);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'left';
    ctx.fillText('Your Rank:', 70, 110);

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = theme.text;
    ctx.fillText(`${userRank} Div. ${userDiv} (${userElo} ELO)`, 180, 110);

    // Upcoming rewards
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'left';
    ctx.fillText('Upcoming Rewards', 70, 170);

    ctx.fillStyle = `${theme.bg}cc`;
    ctx.beginPath();
    ctx.roundRect(50, 180, width - 100, 100, 10);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (nextReward) {
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = theme.text;
        ctx.fillText(`${nextReward.rank} Div. ${nextReward.division} (${nextReward.elo} ELO)`, 70, 210);
        
        ctx.font = '16px Arial';
        ctx.fillText(`1️⃣ ${nextReward.reward1.name}: ${nextReward.reward1.desc}`, 70, 240);
        ctx.fillText(`2️⃣ ${nextReward.reward2.name}: ${nextReward.reward2.desc}`, 70, 270);
    } else {
        ctx.font = '18px Arial';
        ctx.fillStyle = theme.text;
        ctx.fillText('No more upcoming rewards', 70, 230);
    }

    // Available claims
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText('Available Claims', 70, 310);

    ctx.fillStyle = `${theme.bg}cc`;
    ctx.beginPath();
    ctx.roundRect(50, 320, width - 100, 100, 10);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (claimable) {
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = theme.text;
        ctx.fillText(`${claimable.rank} Div. ${claimable.division} (${claimable.elo} ELO)`, 70, 350);
        
        ctx.font = '16px Arial';
        ctx.fillText(`1️⃣ ${claimable.reward1.name}: ${claimable.reward1.desc}`, 70, 380);
        ctx.fillText(`2️⃣ ${claimable.reward2.name}: ${claimable.reward2.desc}`, 70, 410);
    } else {
        ctx.font = '18px Arial';
        ctx.fillStyle = theme.text;
        ctx.fillText('No claimable rewards at this time', 70, 370);
    }

    // Footer
    ctx.font = 'italic 15px Arial';
    ctx.fillStyle = `${theme.text}cc`;
    ctx.textAlign = 'center';
    ctx.fillText('*All these gifts are sent to your gift inventory, check using /gift inventory.*', width / 2, 470);

    // Save to file
    if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
    }
    const filename = `rewards_${user.id}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    const out = fs.createWriteStream(fullPath);
    const stream = canvas.createPNGStream();
    
    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
    });
    
    return fullPath;
}

// Bloodline emoji/gif/name/department definitions (copied from srank.js/brank.js)
const BLOODLINE_EMOJIS = {
    Uchiha: "🩸",
    Hyuga: "👁️",
    Uzumaki: "🌀",
    Senju: "🌳",
    Nara: "🪙"
};
const BLOODLINE_GIFS = {
    Uchiha: "https://giffiles.alphacoders.com/125/125975.gif",
    Hyuga: "https://media.tenor.com/_-VIS8Dz7G0AAAAM/youridb-crypto.gif",
    Uzumaki: "https://i.pinimg.com/originals/63/8e/d1/638ed104fabbdc2ceca6965ea5d28e2b.gif",
    Senju: "https://i.namu.wiki/i/2xdVtn3GJw6UT1Hk2YBvN8e_gqy-VATq0-gsTr6p20ZPX54JAWeWQthstFSEpWjWB6itpvvurkOCM8_du9LkQQ.gif",
    Nara: "https://media.tenor.com/KyyQbu1wd_oAAAAM/anime-naruto.gif"
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

// Add at the top to track stats for profile
const rankedStatsCache = {}; // userId -> { jutsuUsage: {}, totalDamage: 0, rounds: 0 }

function recordJutsuUsage(userId, jutsuName, damage) {
    if (!rankedStatsCache[userId]) rankedStatsCache[userId] = { jutsuUsage: {}, totalDamage: 0, rounds: 0 };
    if (!rankedStatsCache[userId].jutsuUsage[jutsuName]) rankedStatsCache[userId].jutsuUsage[jutsuName] = 0;
    rankedStatsCache[userId].jutsuUsage[jutsuName]++;
    rankedStatsCache[userId].totalDamage += damage || 0;
    rankedStatsCache[userId].rounds++;
}

function getMostUsedJutsu(userId) {
    const usage = rankedStatsCache[userId]?.jutsuUsage || {};
    let max = 0, most = "None";
    for (const [jutsu, count] of Object.entries(usage)) {
        if (count > max) { max = count; most = jutsu; }
    }
    return most;
}

function getAverageDamage(userId) {
    const stats = rankedStatsCache[userId];
    if (!stats || !stats.rounds) return "N/A";
    return Math.round(stats.totalDamage / stats.rounds);
}

// Ranked battle functions
async function startRankedBattle(client, player1Id, player2Id, mode) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    // Fetch player1 user object
    const player1User = await client.users.fetch(player1Id);
    // PATCH: If player2 is NPC, do not fetch user
    const player2User = player2Id.startsWith('NPC_') ? 
        rankedNPCs.find(npc => npc.name === player2Id.replace('NPC_', '')) : 
        await client.users.fetch(player2Id);

    const guild = await client.guilds.fetch(SERVER_ID);
    const channelName = `ranked-${getRandomChannelId()}`;
    
    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        {
            id: player1Id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
    ];

    // PATCH: Only add permission overwrite for player2 if not NPC
    if (!player2Id.startsWith('NPC_')) {
        permissionOverwrites.push({
            id: player2Id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        });
    }

    const channel = await guild.channels.create({
        name: channelName,
        type: 0,
        permissionOverwrites
    });

    // Invitation Embed
    const invitationEmbed = new EmbedBuilder()
        .setTitle('🏆 RANKED: STANDARD MODE')
        .setDescription(
            `Welcome to the ultimate test of strength and will!\n\n` +
            `Step into the arena and prove yourself as the strongest shinobi. ` +
            `Climb the ranks, defeat your rivals, and aim to become the next Hokage!\n\n` +
            `**Do <@${player1Id}> and ${player2Id.startsWith('NPC_') ? player2Id.replace('NPC_', '') : `<@${player2Id}>`} swear to fight fairly under the gaze of the Shinigami, god of death?**\n` +
            `*Ορκίζομαι να πολεμήσω δίκαια υπό το βλέμμα του Shinigami!*\n\n` +
            `:hourglass: **Invitation expires in 1 minute.**`
        )
        .setColor('#e67e22')
        .setImage('https://static0.gamerantimages.com/wordpress/wp-content/uploads/2024/01/the_valley_of_the_end-1.jpg')
        .setFooter({ text: 'Both must accept to begin the battle.' });

    const acceptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ranked_accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('ranked_decline')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger)
    );

    const invitationMsg = await channel.send({
        content: player2Id.startsWith('NPC_') ? 
            `<@${player1Id}>` : 
            `<@${player1Id}> <@${player2Id}>`,
        embeds: [invitationEmbed],
        components: [acceptRow]
    });

    const accepted = new Set();
    let declined = false;

    await new Promise((resolve) => {
        const collector = invitationMsg.createMessageComponentCollector({
            filter: i => [player1Id, player2Id].includes(i.user.id),
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'ranked_accept') {
                accepted.add(i.user.id);
                await i.reply({ content: `You have accepted the challenge!`, ephemeral: true });
                await channel.send(`<@${i.user.id}> has accepted.`);
                
                if (accepted.size === (player2Id.startsWith('NPC_') ? 1 : 2)) {
                    collector.stop('both_accepted');
                }
            } else if (i.customId === 'ranked_decline') {
                declined = true;
                await i.reply({ content: `You have declined the challenge. The match is cancelled.`, ephemeral: true });
                await channel.send(`<@${i.user.id}> has declined. The match is cancelled.`);
                collector.stop('declined');
            }
        });

        collector.on('end', async (collected, reason) => {
            await invitationMsg.edit({
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ranked_accept')
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('ranked_decline')
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    )
                ]
            });

            if (reason === 'both_accepted' || (player2Id.startsWith('NPC_') && accepted.size === 1)) {
                await channel.send('**# RANKED: STANDARD MODE**\nLet the battle begin!');
                resolve();
            } else if (declined) {
                // Always delete the channel on decline
                setTimeout(async () => {
                    try { await channel.delete("Ranked match invitation declined (auto-cleanup)"); } catch (e) {}
                }, 2000);
                resolve();
            } else {
                if (accepted.size === 1) {
                    const winnerId = [...accepted][0];
                    const loserId = winnerId === player1Id ? player2Id : player1Id;
                    await channel.send(`<@${winnerId}> has accepted, but ${loserId.startsWith('NPC_') ? loserId.replace('NPC_', '') : `<@${loserId}>`} did not respond in time. <@${winnerId}> wins by default!`);
                    
                    if (!loserId.startsWith('NPC_')) {
                        const eloUpdate = updateElo(winnerId, loserId);
                        try {
                            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                            if (logChannel) {
                                await logChannel.send(`[RANKED] ${winnerId} wins by default (opponent did not accept) +${eloUpdate.winnerChange} ELO`);
                            }
                        } catch (e) {}
                    }
                } else {
                    await channel.send('The ranked match has been cancelled due to no response.');
                }
                // Always delete the channel on timeout or no response
                setTimeout(async () => {
                    try { await channel.delete("Ranked match invitation expired (auto-cleanup)"); } catch (e) {}
                }, 2000);
                resolve();
            }
        });
    });

    if (declined || (player2Id.startsWith('NPC_') ? accepted.size !== 1 : accepted.size !== 2)) {
        // Channel will be deleted above, just return
        return;
    }

    // Initialize player objects
    let player1 = {
        ...users[player1Id],
        userId: player1Id,
        name: player1User.username,
        avatar: player1User.avatar,
        discriminator: player1User.discriminator,
        activeEffects: [],
        accuracy: 100,
        dodge: 0,
        currentHealth: users[player1Id].health,
        chakra: users[player1Id].chakra || 10
    };

    let player2;
    if (player2Id.startsWith('NPC_')) {
        const npcData = rankedNPCs.find(npc => npc.name === player2Id.replace('NPC_', ''));
        player2 = {
            ...npcData,
            userId: player2Id,
            name: npcData.name,
            health: Math.floor(users[player1Id].health * npcData.baseHealth),
            currentHealth: Math.floor(users[player1Id].health * npcData.baseHealth),
            power: Math.floor(users[player1Id].power * npcData.basePower),
            defense: Math.floor(users[player1Id].defense * npcData.baseDefense),
            accuracy: npcData.accuracy,
            dodge: npcData.dodge,
            chakra: 10,
            activeEffects: []
        };
    } else {
        player2 = {
            ...users[player2Id],
            userId: player2Id,
            name: player2User.username,
            avatar: player2User.avatar,
            discriminator: player2User.discriminator,
            activeEffects: [],
            accuracy: 100,
            dodge: 0,
            currentHealth: users[player2Id].health,
            chakra: users[player2Id].chakra || 10
        };
    }

    // Combo state
    let comboState1 = null, comboState2 = null;
    if (player1.Combo && comboList[player1.Combo]) {
        comboState1 = { combo: comboList[player1.Combo], usedJutsus: new Set() };
    }
    if (!player2Id.startsWith('NPC_') && player2.Combo && comboList[player2.Combo]) {
        comboState2 = { combo: comboList[player2.Combo], usedJutsus: new Set() };
    }

    let roundNum = 1;
    let totalDamageDealt1 = 0;
    let totalDamageTaken1 = 0;
    let totalDamageDealt2 = 0;
    let totalDamageTaken2 = 0;

    // --- BLOODLINE STATE ---
    // Ensure maxHealth is set for both players
    if (typeof player1.maxHealth !== "number" || player1.maxHealth < player1.currentHealth) {
        player1.maxHealth = typeof player1.currentHealth === "number" ? player1.currentHealth : 100;
    }
    if (typeof player2.maxHealth !== "number" || player2.maxHealth < player2.currentHealth) {
        player2.maxHealth = typeof player2.currentHealth === "number" ? player2.currentHealth : 100;
    }
    // Track bloodline state for both
    const bloodlineState = {
        [player1.userId]: { active: false, roundsLeft: 0, used: false },
        [player2.userId]: { active: false, roundsLeft: 0, used: false }
    };

    // --- ROUND-BASED JUTSU STATE ---
    // Track active round-based jutsus and summaries for both players (not NPCs)
    let player1ActiveJutsus = {};
    let player2ActiveJutsus = {};
    let player1RoundBasedSummaries = [];
    let player2RoundBasedSummaries = [];

    // Battle loop
    let battleActive = true;
    while (battleActive) {
        // --- BLOODLINE LOGIC FOR BOTH PLAYERS ---
        for (const player of [player1, player2]) {
            const playerBloodline = player.bloodline;
            const state = bloodlineState[player.userId];
            let bloodlineEmbed = null;

            // Nara is always passive
            if (playerBloodline === "Nara") {
                player.chakra += 3;
                bloodlineEmbed = new EmbedBuilder()
                    .setTitle("Battle IQ")
                    .setDescription(`${BLOODLINE_DEPARTMENTS[playerBloodline]}\n\n<@${player.userId}> activates **${BLOODLINE_NAMES[playerBloodline]}**!\nBattle IQ grants +3 chakra this round!`)
                    .setImage(BLOODLINE_GIFS[playerBloodline])
                    .setColor(0x8B4513);
                await channel.send({ embeds: [bloodlineEmbed] });
            }

            // Uchiha bloodline rounds decrement
            if (playerBloodline === "Uchiha" && state.active) {
                state.roundsLeft--;
                if (state.roundsLeft <= 0) {
                    state.active = false;
                    player.accuracy = 100;
                }
            }

            // --- Auto-activate bloodline if threshold is met and not used ---
            if (!state.used && playerBloodline && playerBloodline !== "Nara") {
                let shouldActivate = false;
                const hp = typeof player.currentHealth === "number" ? player.currentHealth : 0;
                const maxHp = typeof player.maxHealth === "number" ? player.maxHealth : 100;
                const chakra = typeof player.chakra === "number" ? player.chakra : 0;
                // Find opponent
                const opponent = player.userId === player1.userId ? player2 : player1;
                switch (playerBloodline) {
                    case "Senju":
                        shouldActivate = hp <= maxHp * 0.5;
                        break;
                    case "Uzumaki":
                        shouldActivate = hp <= maxHp * 0.5 && chakra < 15;
                        break;
                    case "Hyuga":
                        shouldActivate = chakra >= 15 && opponent.chakra > 0;
                        break;
                    case "Uchiha":
                        shouldActivate = !state.active && hp <= maxHp * 0.5;
                        break;
                }
                if (shouldActivate) {
                    const flavor = BLOODLINE_DEPARTMENTS[playerBloodline] || "You feel a surge of power!";
                    switch (playerBloodline) {
                        case "Senju":
                            player.currentHealth = Math.min(hp + Math.floor(maxHp * 0.5), maxHp);
                            bloodlineEmbed = new EmbedBuilder()
                                .setTitle(BLOODLINE_NAMES[playerBloodline])
                                .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nHyper Regeneration restores 50% HP!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            state.used = true;
                            break;
                        case "Uzumaki":
                            player.chakra = 15;
                            bloodlineEmbed = new EmbedBuilder()
                                .setTitle(BLOODLINE_NAMES[playerBloodline])
                                .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nUzumaki Will surges, chakra set to 15!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            state.used = true;
                            break;
                        case "Hyuga":
                            {
                                const drained = Math.min(opponent.chakra, 5);
                                opponent.chakra -= drained;
                                player.chakra = Math.min(player.chakra + drained, 15);
                                bloodlineEmbed = new EmbedBuilder()
                                    .setTitle(BLOODLINE_NAMES[playerBloodline])
                                    .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nByakugan drains ${drained} chakra from the enemy!`)
                                    .setImage(BLOODLINE_GIFS[playerBloodline])
                                    .setColor(0x8B4513);
                                state.used = true;
                            }
                            break;
                        case "Uchiha":
                            player.accuracy = 100;
                            state.active = true;
                            state.roundsLeft = 2;
                            if (!opponent.activeEffects) opponent.activeEffects = [];
                            opponent.activeEffects.push({
                                type: 'status',
                                status: 'stun',
                                duration: 2
                            });
                            bloodlineEmbed = new EmbedBuilder()
                                .setTitle(BLOODLINE_NAMES[playerBloodline])
                                .setDescription(`${flavor}\n\nYou activate **${BLOODLINE_NAMES[playerBloodline]}**!\nSharingan grants 100% accuracy and stuns the enemy for 2 rounds!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            state.used = true;
                            break;
                    }
                    if (bloodlineEmbed) {
                        await channel.send({ embeds: [bloodlineEmbed] });
                    }
                }
            }
        }

        // --- ROUND-BASED JUTSU LOGIC FOR BOTH PLAYERS ---
        // Prepare round-based summaries and queue up effects for application after image
        let pendingPlayer1RoundBasedEffects = [];
        let pendingPlayer2RoundBasedEffects = [];
        player1RoundBasedSummaries = [];
        player2RoundBasedSummaries = [];

        // Only for real users
        if (!player1.userId.startsWith('NPC_')) {
            Object.entries(player1ActiveJutsus).forEach(([jutsuName, data]) => {
                const jutsu = jutsuList[jutsuName];
                if (jutsu?.roundBased) {
                    const effectivePlayer = getEffectiveStats(player1);
                    const effectiveOpponent = getEffectiveStats(player2);
                    const currentRound = data.round + 1;
                    const roundKey = Object.keys(jutsu.roundEffects || {}).find(k => {
                        // Support keys like "1", "2-5", "8-16", etc.
                        if (k.includes('-')) {
                            const [start, end] = k.split('-').map(Number);
                            return currentRound >= start && currentRound <= end;
                        }
                        return Number(k) === currentRound;
                    });
                    let desc = "";
                    if (roundKey && jutsu.roundEffects[roundKey]?.description) {
                        desc = jutsu.roundEffects[roundKey].description;
                        desc = desc
                            .replace(/undefined/g, player1.name)
                            .replace(/\buser\b/gi, `<@${player1.userId || player1.id}>`)
                            .replace(/\btarget\b/gi, player2.name)
                            .replace(/\[Player\]/g, player1.name)
                            .replace(/\[Enemy\]/g, player2.name);
                    }
                    player1RoundBasedSummaries.push({
                        desc: desc,
                        effects: []
                    });
                    // You may want to process effects here if needed
                    player1ActiveJutsus[jutsuName].round++;
                    // Remove completed jutsu
                    const maxRound = Math.max(...Object.keys(jutsu.roundEffects || {}).map(k => {
                        const parts = k.split('-');
                        return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                    }));
                    if (data.round >= maxRound) {
                        delete player1ActiveJutsus[jutsuName];
                    }
                }
            });
        }
        if (!player2.userId.startsWith('NPC_')) {
            Object.entries(player2ActiveJutsus).forEach(([jutsuName, data]) => {
                const jutsu = jutsuList[jutsuName];
                if (jutsu?.roundBased) {
                    const effectivePlayer = getEffectiveStats(player2);
                    const effectiveOpponent = getEffectiveStats(player1);
                    const currentRound = data.round + 1;
                    const roundKey = Object.keys(jutsu.roundEffects || {}).find(k => {
                        if (k.includes('-')) {
                            const [start, end] = k.split('-').map(Number);
                            return currentRound >= start && currentRound <= end;
                        }
                        return Number(k) === currentRound;
                    });
                    let desc = "";
                    if (roundKey && jutsu.roundEffects[roundKey]?.description) {
                        desc = jutsu.roundEffects[roundKey].description;
                        desc = desc
                            .replace(/undefined/g, player2.name)
                            .replace(/\buser\b/gi, `<@${player2.userId || player2.id}>`)
                            .replace(/\btarget\b/gi, player1.name)
                            .replace(/\[Player\]/g, player2.name)
                            .replace(/\[Enemy\]/g, player1.name);
                    }
                    player2RoundBasedSummaries.push({
                        desc: desc,
                        effects: []
                    });
                    player2ActiveJutsus[jutsuName].round++;
                    // Remove completed jutsu
                    const maxRound = Math.max(...Object.keys(jutsu.roundEffects || {}).map(k => {
                        const parts = k.split('-');
                        return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                    }));
                    if (data.round >= maxRound) {
                        delete player2ActiveJutsus[jutsuName];
                    }
                }
            });
        }

        // Calculate effective stats
        const effective1 = getEffectiveStats(player1);
        const effective2 = getEffectiveStats(player2);

        // --- PATCH: CUSTOM BACKGROUND LOGIC LIKE brank.js ---
        // If any active round-based jutsu has a custom background and is active, use it
        let customBgUrl = null;
        function getActiveCustomBg(activeJutsus) {
            for (const jName of Object.keys(activeJutsus)) {
                const jutsu = jutsuList[jName];
                if (jutsu?.custombackground && activeJutsus[jName].round >= jutsu.custombackground.round) {
                    return jutsu.custombackground.url;
                }
            }
            return null;
        }
        if (!player1.userId.startsWith('NPC_')) {
            const url = getActiveCustomBg(player1ActiveJutsus);
            if (url) customBgUrl = url;
        }
        if (!player2.userId.startsWith('NPC_')) {
            const url = getActiveCustomBg(player2ActiveJutsus);
            if (url) customBgUrl = url;
        }

        // Player 1's turn
        const { embed: embed1, components: components1 } = createMovesEmbedPvP(player1, roundNum);
        const moveMessage1 = await channel.send({
            content: `<@${player1.userId}>`,
            embeds: [embed1],
            components: components1,
            fetchReply: true
        });

        // PATCH: Generate battle image with custom background if any
        const battleImagePath1 = await generateBattleImage(player1, player2, customBgUrl);
        const battleImage1 = new AttachmentBuilder(battleImagePath1);
        await channel.send({ files: [battleImage1] });

        // --- PATCH: Now apply round-based jutsu effects (damage/heal) after image is sent ---
        pendingPlayer1RoundBasedEffects.forEach(eff => {
            if (eff.damage && eff.damage > 0) {
                player2.currentHealth -= eff.damage;
            }
            if (eff.heal && eff.heal > 0) {
                player1.currentHealth = Math.min(player1.currentHealth + eff.heal, player1.health);
            }
        });
        pendingPlayer2RoundBasedEffects.forEach(eff => {
            if (eff.damage && eff.damage > 0) {
                player1.currentHealth -= eff.damage;
            }
            if (eff.heal && eff.heal > 0) {
                player2.currentHealth = Math.min(player2.currentHealth + eff.heal, player2.health);
            }
        });

        // --- PATCH: PLAYER 1 ACTION ---
        const player1Action = await new Promise(resolve => {
            const collector = moveMessage1.createMessageComponentCollector({
                filter: i => i.user.id === player1.userId && i.customId.endsWith(`-${player1.userId}-${roundNum}`),
                time: 90000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId.startsWith('move')) {
                    const jutsuName = getJutsuByButtonPvP(i.customId, player1);
                    const jutsu = jutsuList[jutsuName];
                    // --- PATCH: Handle round-based jutsu activation for player1 ---
                    if (jutsu?.roundBased && !player1ActiveJutsus[jutsuName]) {
                        const result = executeJutsu(
                            player1, player2, effective1, effective2, jutsuName, 1, true
                        );
                        if (!result.hit) {
                            resolve(result);
                            collector.stop();
                            return;
                        }
                        player1ActiveJutsus[jutsuName] = { round: 1 };
                        player1RoundBasedSummaries.push({
                            desc: result.roundBasedDesc,
                            effects: result.roundBasedEffects
                        });
                        result.jutsuUsed = jutsuName;
                        resolve(result);
                        collector.stop();
                        return;
                    }
                    const result = executeJutsu(player1, player2, effective1, effective2, jutsuName);
                    if (comboState1?.combo.requiredJutsus.includes(jutsuName)) {
                        comboState1.usedJutsus.add(jutsuName);
                    }
                    result.jutsuUsed = jutsuName;
                    resolve(result);
                } else {
                    resolve(await processPlayerMove(i.customId, player1, player2, effective1, effective2));
                }
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    resolve({
                        damage: 0,
                        heal: 0,
                        description: `${player1.name} did not make a move.`,
                        specialEffects: ["Missed opportunity!"],
                        hit: false,
                        fled: true
                    });
                }
                moveMessage1.edit({
                    components: components1.map(row => {
                        const disabledRow = ActionRowBuilder.from(row);
                        disabledRow.components.forEach(c => c.setDisabled(true));
                        return disabledRow;
                    })
                }).catch(() => {});
            });
        });

        if (player1Action.fled) {
            battleActive = false;
            await channel.send(`${player1.name} fled from the battle!`);
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${player1.name} (${player1.userId}) fled from the match against ${player2.name} (${player2.userId})`);
                }
            } catch (e) {}
            break;
        }

        // Player 2's turn (NPC or player)
        let player2Action;
        if (player2Id.startsWith('NPC_')) {
            // --- PATCH: Use npcChooseMove for NPC logic ---
            player2Action = npcChooseMove(player2, player1, effective2, effective1);
            await channel.send(`${player2.name} uses ${player2Action.jutsuUsed || player2Action.description}!`);
        } else {
            // Player turn
            const { embed: embed2, components: components2 } = createMovesEmbedPvP(player2, roundNum);
            const moveMessage2 = await channel.send({
                content: `<@${player2.userId}>`,
                embeds: [embed2],
                components: components2,
                fetchReply: true
            });

            player2Action = await new Promise(resolve => {
                const collector = moveMessage2.createMessageComponentCollector({
                    filter: i => i.user.id === player2.userId && i.customId.endsWith(`-${player2.userId}-${roundNum}`),
                    time: 90000
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    if (i.customId.startsWith('move')) {
                        const jutsuName = getJutsuByButtonPvP(i.customId, player2);
                        const jutsu = jutsuList[jutsuName];
                        // --- PATCH: Handle round-based jutsu activation for player2 ---
                        if (jutsu?.roundBased && !player2ActiveJutsus[jutsuName]) {
                            const result = executeJutsu(
                                player2, player1, effective2, effective1, jutsuName, 1, true
                            );
                            if (!result.hit) {
                                resolve(result);
                                collector.stop();
                                return;
                            }
                            player2ActiveJutsus[jutsuName] = { round: 1 };
                            player2RoundBasedSummaries.push({
                                desc: result.roundBasedDesc,
                                effects: result.roundBasedEffects
                            });
                            result.jutsuUsed = jutsuName;
                            resolve(result);
                            collector.stop();
                            return;
                        }
                        const result = executeJutsu(player2, player1, effective2, effective1, jutsuName);
                        if (comboState2?.combo.requiredJutsus.includes(jutsuName)) {
                            comboState2.usedJutsus.add(jutsuName);
                        }
                        result.jutsuUsed = jutsuName;
                        resolve(result);
                    } else {
                        resolve(await processPlayerMove(i.customId, player2, player1, effective2, effective1));
                    }
                    collector.stop();
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${player2.name} did not make a move.`,
                            specialEffects: ["Missed opportunity!"],
                            hit: false,
                            fled: true
                        });
                    }
                    moveMessage2.edit({
                        components: components2.map(row => {
                            const disabledRow = ActionRowBuilder.from(row);
                            disabledRow.components.forEach(c => c.setDisabled(true));
                            return disabledRow;
                        })
                    }).catch(() => {});
                });
            });

            if (player2Action.fled) {
                battleActive = false;
                await channel.send(`${player2.name} fled from the battle!`);
                try {
                    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(`[RANKED] ${player2.name} (${player2.userId}) fled from the match against ${player1.name} (${player1.userId})`);
                    }
                } catch (e) {}
                break;
            }
        }

        // Apply both actions
        let comboCompleted1 = false, comboDamageText1 = "";
        if (comboState1 && comboState1.combo.requiredJutsus.every(jutsu => comboState1.usedJutsus.has(jutsu))) {
            const combo = comboState1.combo;
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
                            const healAmount = effectHandlers.heal(player1, effect.formula || "0");
                            comboResult.heal += healAmount;
                            comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                            break;
                        case 'status':
                            if (!player2.activeEffects) player2.activeEffects = [];
                            player2.activeEffects.push({
                                type: 'status',
                                status: effect.status,
                                duration: effect.duration || 1
                            });
                            comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                            break;
                        case 'debuff':
                            const debuffChanges = effectHandlers.debuff(player2, effect.stats);
                            if (!player2.activeEffects) player2.activeEffects = [];
                            player2.activeEffects.push({
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
            
            player2.currentHealth -= comboResult.damage;
            if (comboResult.heal) {
                player1.currentHealth = Math.min(player1.currentHealth + comboResult.heal, player1.health);
            }
            comboCompleted1 = true;
            comboDamageText1 = `\n${player1.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`;
            comboState1.usedJutsus.clear();
            totalDamageDealt1 += comboResult.damage || 0;
        }

        let comboCompleted2 = false, comboDamageText2 = "";
        if (comboState2 && comboState2.combo.requiredJutsus.every(jutsu => comboState2.usedJutsus.has(jutsu))) {
            const combo = comboState2.combo;
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
                            const healAmount = effectHandlers.heal(player2, effect.formula || "0");
                            comboResult.heal += healAmount;
                            comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                            break;
                        case 'status':
                            if (!player1.activeEffects) player1.activeEffects = [];
                            player1.activeEffects.push({
                                type: 'status',
                                status: effect.status,
                                duration: effect.duration || 1
                            });
                            comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                            break;
                        case 'debuff':
                            const debuffChanges = effectHandlers.debuff(player1, effect.stats);
                            if (!player1.activeEffects) player1.activeEffects = [];
                            player1.activeEffects.push({
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
            
            player1.currentHealth -= comboResult.damage;
            if (comboResult.heal) {
                player2.currentHealth = Math.min(player2.currentHealth + comboResult.heal, player2.health);
            }
            comboCompleted2 = true;
            comboDamageText2 = `\n${player2.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`;
            comboState2.usedJutsus.clear();
            totalDamageDealt2 += comboResult.damage || 0;
        }

        // Apply player actions
        player2.currentHealth -= player1Action.damage || 0;
        if (player1Action.heal) {
            player1.currentHealth = Math.min(player1.currentHealth + player1Action.heal, player1.health);
        }
        totalDamageDealt1 += player1Action.damage || 0;
        totalDamageTaken2 += player1Action.damage || 0;

        player1.currentHealth -= player2Action.damage || 0;
        if (player2Action.heal) {
            player2.currentHealth = Math.min(player2.currentHealth + player2Action.heal, player2.health);
        }
        totalDamageDealt2 += player2Action.damage || 0;
        totalDamageTaken1 += player2Action.damage || 0;

        // Show round summary
        let summaryEmbed1 = createBattleSummaryPvP(
            player1Action, player1, player2, roundNum, comboCompleted1, comboDamageText1,
            player1RoundBasedSummaries, player2RoundBasedSummaries, player1, player2
        );
        await channel.send({ embeds: [summaryEmbed1] });

        // Check for win/loss
        if (player1.currentHealth <= 0 || player2.currentHealth <= 0) {
            battleActive = false;
            let winner, loser;
            
            if (player1.currentHealth > 0 && player2.currentHealth <= 0) {
                winner = player1;
                loser = player2;
                await channel.send(`**${winner.name}** has defeated **${loser.name}**!`);
            } else if (player2.currentHealth > 0 && player1.currentHealth <= 0) {
                winner = player2;
                loser = player1;
                await channel.send(`**${winner.name}** has defeated **${loser.name}**!`);
            } else {
                await channel.send(`It's a draw!`);
                break;
            }

            // Handle match end
            if (!loser.userId.startsWith('NPC_')) {
                const eloUpdate = await handleMatchEnd(channel, winner, loser, users, roundNum, {
                    winner: {
                        dealt: winner === player1 ? totalDamageDealt1 : totalDamageDealt2,
                        taken: winner === player1 ? totalDamageTaken1 : totalDamageTaken2
                    },
                    loser: {
                        dealt: loser === player1 ? totalDamageDealt1 : totalDamageDealt2,
                        taken: loser === player1 ? totalDamageTaken1 : totalDamageTaken2
                    }
                });

                try {
                    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(`[RANKED] ${winner.name} (${winner.userId}) has won against ${loser.name} (${loser.userId})`);
                    }
                } catch (e) {}
            } else {
                // PATCH: When users play against NPCs, award only 20 ELO for a win, and send a short summary to summary channel
                if (
                    typeof winner.userId === "string" && winner.userId.startsWith("NPC_") ||
                    typeof loser.userId === "string" && loser.userId.startsWith("NPC_")
                ) {
                    // Award ELO only to user, 20 ELO
                    const userWinner = winner.userId.startsWith("NPC_") ? loser : winner;
                    const userLoser = winner.userId.startsWith("NPC_") ? winner : loser;
                    // PATCH: Only update ELO for real user, skip for NPC
                    if (!userWinner.userId.startsWith("NPC_")) {
                        const oldElo = users[userWinner.userId]?.elo || 0;
                        // Directly update users.json for userWinner
                        const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        if (typeof usersData[userWinner.userId].elo !== "number") usersData[userWinner.userId].elo = 0;
                        usersData[userWinner.userId].elo += 20;
                        // Update rank as well
                        const newRank = getTierAndDivision(usersData[userWinner.userId].elo);
                        usersData[userWinner.userId].rank = newRank.rank;
                        fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
                        // Short summary to summary channel
                        let summaryChannel;
                        try {
                            summaryChannel = await channel.client.channels.fetch(SUMMARY_CHANNEL_ID);
                        } catch (e) {
                            summaryChannel = channel;
                        }
                        await summaryChannel.send(
                            `<@${userWinner.userId}> defeated an NPC and gained +20 ELO! (Current Elo: ${usersData[userWinner.userId].elo})`
                        );
                    }
                }
            }
            // Always delete the channel after the reward/summary message is sent, like user vs user
            setTimeout(async () => {
                try { await channel.delete("Ranked match ended (auto-cleanup)"); } catch (e) {}
            }, 15000);
            break;
        }

        // Passive chakra regen (use brank.js logic: 2 per round for both, max 15)
        player1.chakra = Math.min((typeof player1.chakra === "number" ? player1.chakra : 0) + 2, 15);
        player2.chakra = Math.min((typeof player2.chakra === "number" ? player2.chakra : 0) + 2, 15);

        roundNum++;
    }

    // Auto-delete channel after 15 seconds
    setTimeout(async () => {
        try {
            await channel.delete("Ranked match ended (auto-cleanup)");
        } catch (e) {}
    }, 15000);
}

async function handleMatchEnd(channel, winner, loser, users, roundNum = 0, damageStats = { winner: {}, loser: {} }) {
    // PATCH: If winner or loser is an NPC, skip ELO/rank updates and summary
    if (
        typeof winner.userId === "string" && winner.userId.startsWith("NPC_") ||
        typeof loser.userId === "string" && loser.userId.startsWith("NPC_")
    ) {
        // Just return, do not attempt to update ELO or send summary
        return;
    }

    // --- ELO SYSTEM PATCH: Use .elo directly ---
    const oldWinnerElo = users[winner.userId].elo || 0;
    const oldLoserElo = users[loser.userId].elo || 0;
    const eloUpdate = updateElo(winner.userId, loser.userId);

    // Update ranks in users.json
    const updatedUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // --- PATCH: Ensure .elo exists for both winner and loser ---
    if (typeof updatedUsers[winner.userId].elo !== "number") updatedUsers[winner.userId].elo = 0;
    if (typeof updatedUsers[loser.userId].elo !== "number") updatedUsers[loser.userId].elo = 0;

    updatedUsers[winner.userId].rank = getTierAndDivision(updatedUsers[winner.userId].elo).rank;
    updatedUsers[loser.userId].rank = getTierAndDivision(updatedUsers[loser.userId].elo).rank;
    fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2));

    const winnerUser = updatedUsers[winner.userId];
    const loserUser = updatedUsers[loser.userId];

    // Calculate stats
    const winnerStats = {
        power: winnerUser.power || 0,
        defense: winnerUser.defense || 0,
        health: winnerUser.health || 0,
        chakra: winnerUser.chakra || 0,
        accuracy: winnerUser.accuracy || 0,
        dodge: winnerUser.dodge || 0,
        elo: winnerUser.elo || 0,
        rank: winnerUser.rank || "Genin"
    };
    const loserStats = {
        power: loserUser.power || 0,
        defense: loserUser.defense || 0,
        health: loserUser.health || 0,
        chakra: loserUser.chakra || 0,
        accuracy: loserUser.accuracy || 0,
        dodge: loserUser.dodge || 0,
        elo: loserUser.elo || 0,
        rank: loserUser.rank || "Genin"
    };

    const winnerDamageDealt = damageStats?.winner?.dealt ?? "N/A";
    const winnerDamageTaken = damageStats?.winner?.taken ?? "N/A";
    const loserDamageDealt = damageStats?.loser?.dealt ?? "N/A";
    const loserDamageTaken = damageStats?.loser?.taken ?? "N/A";

    // Generate ELO images
    const winnerImagePath = await generateEloImage(winner, oldWinnerElo, winnerUser.elo, true);
    const loserImagePath = await generateEloImage(loser, oldLoserElo, loserUser.elo, false);

    // Prepare summary embeds
    const winnerEmbed = new EmbedBuilder()
        .setTitle("🏆 Battle Summary")
        .setColor("#22c55e")
        .setDescription(
            `**Result:** Victory\n` +
            `**Rounds Played:** ${roundNum}\n` +
            `**Total Damage Dealt:** ${winnerDamageDealt}\n` +
            `**Total Damage Taken:** ${winnerDamageTaken}\n\n` +
            `**Your Stats:**\n` +
            `> Power: ${winnerStats.power}\n` +
            `> Defense: ${winnerStats.defense}\n` +
            `> Health: ${winnerStats.health}\n` +
            `> Chakra: ${winnerStats.chakra}\n` +
            `> Accuracy: ${winnerStats.accuracy}\n` +
            `> Dodge: ${winnerStats.dodge}\n` +
            `> Rank: ${winnerStats.rank}\n` +
            `> ELO: ${winnerStats.elo}\n\n` +
            `**Enemy Stats:**\n` +
            `> Power: ${loserStats.power}\n` +
            `> Defense: ${loserStats.defense}\n` +
            `> Health: ${loserStats.health}\n` +
            `> Chakra: ${loserStats.chakra}\n` +
            `> Accuracy: ${loserStats.accuracy}\n` +
            `> Dodge: ${loserStats.dodge}\n` +
            `> Rank: ${loserStats.rank}\n` +
            `> ELO: ${loserStats.elo}`
        )
        .setImage(`attachment://winner_elo.png`)
        .setFooter({ text: "Congratulations on your victory!" });

    const loserEmbed = new EmbedBuilder()
        .setTitle("💔 Battle Summary")
        .setColor("#dc2626")
        .setDescription(
            `**Result:** Defeat\n` +
            `**Rounds Played:** ${roundNum}\n` +
            `**Total Damage Dealt:** ${loserDamageDealt}\n` +
            `**Total Damage Taken:** ${loserDamageTaken}\n\n` +
            `**Your Stats:**\n` +
            `> Power: ${loserStats.power}\n` +
            `> Defense: ${loserStats.defense}\n` +
            `> Health: ${loserStats.health}\n` +
            `> Chakra: ${loserStats.chakra}\n` +
            `> Accuracy: ${loserStats.accuracy}\n` +
            `> Dodge: ${loserStats.dodge}\n` +
            `> Rank: ${loserStats.rank}\n` +
            `> ELO: ${loserStats.elo}\n\n` +
            `**Enemy Stats:**\n` +
            `> Power: ${winnerStats.power}\n` +
            `> Defense: ${winnerStats.defense}\n` +
            `> Health: ${winnerStats.health}\n` +
            `> Chakra: ${winnerStats.chakra}\n` +
            `> Accuracy: ${winnerStats.accuracy}\n` +
            `> Dodge: ${winnerStats.dodge}\n` +
            `> Rank: ${winnerStats.rank}\n` +
            `> ELO: ${winnerStats.elo}`
        )
        .setImage(`attachment://loser_elo.png`)
        .setFooter({ text: "Better luck next time!" });

    // Send to summary channel
    let summaryChannel;
    try {
        summaryChannel = await channel.client.channels.fetch(SUMMARY_CHANNEL_ID);
    } catch (e) {
        summaryChannel = channel;
    }

    await summaryChannel.send({
        content: `🏆 <@${winner.userId}>`,
        embeds: [winnerEmbed],
        files: [{ attachment: winnerImagePath, name: "winner_elo.png" }]
    });
    await summaryChannel.send({
        content: `💔 <@${loser.userId}>`,
        embeds: [loserEmbed],
        files: [{ attachment: loserImagePath, name: "loser_elo.png" }]
    });

    return eloUpdate;
}

// Battle helper functions
function createMovesEmbedPvP(player, roundNum) {
    const embed = new EmbedBuilder()
        .setTitle(`${player.name}`)
        .setColor('#006400')
        .setDescription(
            `${player.name}, it is your turn!\nUse buttons to make a choice.\n\n` +
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
            const disabled = (typeof player.chakra === "number" ? player.chakra : 0) < (jutsu?.chakraCost || 0);
            return new ButtonBuilder()
                .setCustomId(`move${index + 1}-${player.userId}-${roundNum}`)
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
                .setCustomId(`rest-${player.userId}-${roundNum}`)
                .setLabel('😴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`flee-${player.userId}-${roundNum}`)
                .setLabel('❌')
                .setStyle(ButtonStyle.Primary)
        );
        rows.push(row2);
    } else {
        const row2 = new ActionRowBuilder();
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`rest-${player.userId}-${roundNum}`)
                .setLabel('😴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`flee-${player.userId}-${roundNum}`)
                .setLabel('❌')
                .setStyle(ButtonStyle.Primary)
        );
        rows.push(row2);
    }

    return { embed, components: rows.slice(0, 5) };
}

function getJutsuByButtonPvP(buttonId, player) {
    const match = buttonId.match(/^move(\d+)-/);
    if (!match) return null;
    const idx = parseInt(match[1], 10) - 1;
    const jutsuNames = Object.entries(player.jutsu)
        .filter(([_, jutsu]) => jutsu !== 'None')
        .map(([_, jutsuName]) => jutsuName);
    return jutsuNames[idx];
}

async function processPlayerMove(customId, basePlayer, baseOpponent, effectivePlayer, effectiveOpponent) {
    const action = customId.split('-')[0];
    if (action === 'rest') {
        basePlayer.chakra = Math.min(basePlayer.chakra + 1, 10);
        return {
            damage: 0,
            heal: 0,
            description: `${basePlayer.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true
        };
    }
    if (action === 'flee') {
        return { fled: true };
    }
    return executeJutsu(basePlayer, baseOpponent, effectivePlayer, effectiveOpponent, action);
}

function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, round = 1, isFirstActivation = false) {
    const jutsu = jutsuList[jutsuName];
    if (!jutsu) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} attempted unknown jutsu: ${jutsuName}`,
            specialEffects: ["Jutsu failed!"],
            hit: false
        };
    }
    
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} used ${jutsu.name}`,
        specialEffects: [],
        hit: true
    };
    
    if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
            specialEffects: ["Chakra exhausted!"],
            hit: false
        };
    }
    
    baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
    
    if (Array.isArray(jutsu.effects)) {
        jutsu.effects.forEach(effect => {
            try {
                switch (effect.type) {
                    case 'damage':
                        const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
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
                            .join(', ')} for ${effect.duration || 1} turns`);;
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
                            baseTarget.activeEffects.push({
                                type: 'status',
                                status: effect.status,
                                duration: effect.duration || 1
                            });
                            result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                        }
                        break;
                }
            } catch (err) {
                console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                result.specialEffects.push(`Error applying ${effect.type} effect`);
            }
        });
    }
    
    // Handle round-based jutsu effects
    if (jutsu.roundBased) {
        const roundKey = `round-${round}`;
        if (jutsu.roundEffects && jutsu.roundEffects[roundKey]) {
            const roundEffect = jutsu.roundEffects[roundKey];
            // Apply each effect in the round
            if (roundEffect.damage) {
                const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, roundEffect.damage.formula, roundEffect.damage);
                result.damage += damageResult.damage;
                result.hit = damageResult.hit;
                if (damageResult.hit && damageResult.damage > 0) {
                    result.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                } else if (!damageResult.hit) {
                    result.specialEffects.push("Attack missed!");
                }
            }
            if (roundEffect.heal) {
                const healAmount = effectHandlers.heal(effectiveUser, roundEffect.heal.formula);
                result.heal += healAmount;
                if (healAmount > 0) {
                    result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                }
            }
            if (roundEffect.status) {
                if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                baseTarget.activeEffects.push({
                    type: 'status',
                    status: roundEffect.status,
                    duration: roundEffect.duration || 1
                });
                result.specialEffects.push(`Applied ${roundEffect.status} for ${roundEffect.duration || 1} turns`);
            }
            if (roundEffect.debuff) {
                const debuffChanges = effectHandlers.debuff(baseTarget, roundEffect.debuff.stats);
                if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                baseTarget.activeEffects.push({
                    type: 'debuff',
                    stats: debuffChanges,
                    duration: roundEffect.duration || 1
                });
                result.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')} for ${roundEffect.duration || 1} turns`);
            }
        }
    }
    
    return result;
}

// --- PATCH: ROUND SUMMARY DISPLAYS ROUND-BASED DESCRIPTION LIKE brank.js ---
function createBattleSummaryPvP(
    playerAction, player, opponent, roundNum, comboCompleted, comboDamageText,
    playerRoundBasedSummaries = [], opponentRoundBasedSummaries = [], player1, player2
) {
    const getEffectEmojis = (entity) => {
        const emojis = [];
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'buff') emojis.push(EMOJIS.buff);
            if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
            if (effect.type === 'status') emojis.push(EMOJIS.status);
        });
        return emojis.length ? `[${emojis.join('')}] ` : '';
    };

    const playerEffectEmojis = getEffectEmojis(player);
    const opponentEffectEmojis = getEffectEmojis(opponent);

    const playerDesc = playerAction.isRest ? playerAction.description :
        !playerAction.hit ? (
            playerAction.specialEffects?.includes("Stun active") ? "is stunned!" :
            playerAction.specialEffects?.includes("Flinch active") ? "flinched!" : "missed!"
        ) :
        (jutsuList[playerAction.jutsuUsed]?.description || playerAction.description);

    let comboProgressText = "";
    if (player.Combo && comboList[player.Combo]) {
        const combo = comboList[player.Combo];
        const usedJutsus = player.comboState?.usedJutsus || new Set();
    function roundBasedText(summaries, currentPlayer, currentOpponent) {
        if (!summaries || !summaries.length) return "";
        return summaries
            .filter(s => s.desc && s.desc.trim().length > 0)
            .map(s => `\n${s.desc}`)
            .join('\n');
    }
            if (s.effects && s.effects.length) {
                txt += `\nEffects: ${s.effects.join(', ')}`;
            }
            return txt;
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${playerEffectEmojis}${player.name} ${playerDesc}` +
            `${playerAction.damage ? ` for ${Math.round(playerAction.damage)} damage!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
            (comboCompleted ? comboDamageText : "") +
            roundBasedText(playerRoundBasedSummaries, player1, player2) +
            `\n\n${opponentEffectEmojis}${opponent.name} || ${Math.round(opponent.currentHealth)} HP` +
            roundBasedText(opponentRoundBasedSummaries, player2, player1) +
            comboProgressText
        )
        .addFields({
            name: 'Battle Status',
            value: `${player.name} | ${Math.round(player.currentHealth)} HP\n${opponent.name} | ${Math.round(opponent.currentHealth)} HP\nChakra: ${player.chakra}            Chakra: ${opponent.chakra}`
        });

    const playerJutsu = jutsuList[playerAction.jutsuUsed];
    if (playerJutsu?.image_url) {
        embed.setImage(playerJutsu.image_url);
    }

    return embed;
}

// Gift inventory functions
function getGiftInventory(userId) {
    let giftData = {};
    if (fs.existsSync(giftPath)) {
        giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
    }
    if (!giftData[userId]) giftData[userId] = {};
    return giftData;
}

function saveGiftInventory(giftData) {
    fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
}

function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 5000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// Ranked rewards handler
async function handleRankedRewards(interaction) {
    const userId = interaction.user.id;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const user = users[userId];

    if (!user || typeof user.elo !== "number") {
        // PATCH: Use flags for ephemeral
        return interaction.reply({ content: "You haven't played ranked yet!", flags: 64 });
    }
    
    const userElo = user.elo || 0;
    const userRankObj = getTierAndDivision(userElo);
    const userRank = userRankObj.rank;
    const userDiv = userRankObj.division;

    // Find next reward and claimable reward
    let nextReward = null;
    let claimable = null;
    
    // PATCH: If you need to track claimed rewards, you can keep a claimedRewards array on the user object (not inside ranked)
    for (const reward of rankedRewards) {
        if (reward.elo > userElo && (!nextReward || reward.elo < nextReward.elo)) {
            nextReward = reward;
        }
        
        if (reward.elo <= userElo && !user.claimedRewards?.includes(reward.elo)) {
            if (!claimable || reward.elo > claimable.elo) {
                claimable = reward;
            }
        }
    }

    // Generate rewards image
    const imagePath = await generateRankedRewardsImage(
        interaction.user,
        userElo,
        userRank,
        userDiv,
        claimable,
        nextReward
    );

    const row = claimable
        ? new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ranked_claim')
                .setLabel('Claim')
                .setStyle(ButtonStyle.Success)
        )
        : null;

    await interaction.deferReply();
    await interaction.followUp({
        content: '',
        files: [imagePath],
        components: row ? [row] : []
    });

    if (claimable) {
        const filter = i => i.customId === 'ranked_claim' && i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
        
        collector.on('collect', async i => {
            let giftData = getGiftInventory(userId);
            if (!giftData[userId]) giftData[userId] = [];
            const id = generateGiftId(giftData[userId]);
            
            giftData[userId].push({
                id,
                type: 'ranked_reward',
                reward: claimable,
                date: Date.now()
            });
            
            saveGiftInventory(giftData);

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId].claimedRewards) users[userId].claimedRewards = [];
            users[userId].claimedRewards.push(claimable.elo);
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await i.reply({ content: `Reward sent to your gift inventory! Use /gift inventory to claim it.` });
        });
    }
}

// Queue management
async function checkQueue(client, mode = 'standard') {
    // Check for players who have been in queue for over 1 minute
    const now = Date.now();
    const queueTimeout = 60000; // 1 minute

    // Collect users who have timed out
    const timedOutUsers = [];
    for (const [userId, entryTime] of rankedQueue[mode].entries()) {
        if (now - entryTime >= queueTimeout) {
            timedOutUsers.push(userId);
        }
    }

    // Immediately match each timed out user with an NPC and remove from queue
    for (const userId of timedOutUsers) {
        rankedQueue[mode].delete(userId);

        // Select random NPC
        const npc = rankedNPCs[Math.floor(Math.random() * rankedNPCs.length)];
        const npcId = `NPC_${npc.name}`;

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(`[RANKED] Matching ${userId} with NPC ${npc.name} after queue timeout`);
            }
        } catch (e) {}

        await startRankedBattle(client, userId, npcId, mode);
    }

    // After handling timeouts, match any remaining users in pairs
    while (rankedQueue[mode].size >= 2) {
        const players = Array.from(rankedQueue[mode].keys()).slice(0, 2);
        const [player1, player2] = players;

        rankedQueue[mode].delete(player1);
        rankedQueue[mode].delete(player2);

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(`[RANKED] Match found: <@${player1}> vs <@${player2}>`);
            }
        } catch (e) {}

        await startRankedBattle(client, player1, player2, mode);
    }
}

// --- PATCH: NPC MOVE LOGIC ---
// Helper for NPC move selection (similar to brank.js)
function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer) {
    // Check for stun
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

    // Flying Raijin patch: If player has flying_raijin, set npc accuracy to 0 for this attack
    let originalAccuracy = baseNpc.accuracy;
    let flyingRaijinIdx = basePlayer.activeEffects.findIndex(e => e.type === 'status' && e.status === 'flying_raijin');
    let usedFlyingRaijin = false;
    if (flyingRaijinIdx !== -1) {
        baseNpc.accuracy = 0;
        usedFlyingRaijin = true;
    }

    // Filter available jutsu based on chakra
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
    const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);

    // Restore accuracy after attack if Flying Raijin was used
    if (usedFlyingRaijin) {
        baseNpc.accuracy = originalAccuracy;
        // Remove the flying_raijin status so it only works for one attack
        basePlayer.activeEffects.splice(flyingRaijinIdx, 1);
    }

    result.jutsuUsed = randomJutsu;
    return result;
}

// --- PERIODIC QUEUE CHECK PATCH ---
// Start a periodic queue check every 10 seconds
if (!global.__rankedQueueIntervalStarted) {
    global.__rankedQueueIntervalStarted = true;
    setInterval(() => {
        // You may need to pass your Discord client instance here if available
        // For most bots, you can require the client from your main file or pass it in
        // For this patch, assume client is globally available as global.client
        if (global.client) {
            module.exports.checkQueue(global.client, 'standard');
        }
    }, 10000); // every 10 seconds
}

// Main command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranked')
        .setDescription('Ranked queue and rewards')
        .addStringOption(option =>
            option.setName('option')
                .setDescription('Show rewards or join ranked')
                .addChoices(
                    { name: 'rewards', value: 'rewards' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.guild || interaction.guild.id !== SERVER_ID) {
            // PATCH: Use flags for ephemeral
            return interaction.reply({ content: 'This command can only be used in the main server.', flags: 64 });
        }

        const userId = interaction.user.id;
        const opt = interaction.options.getString('option');

        if (opt === 'rewards') {
            return await handleRankedRewards(interaction);
        }

        const mode = 'standard';

        if (!fs.existsSync(usersPath)) {
            // PATCH: Use flags for ephemeral
            return interaction.reply({ content: "Database not found.", flags: 64 });
        }
        
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            // PATCH: Use flags for ephemeral
            return interaction.reply({ content: "You need to enroll first!", flags: 64 });
        }
        
        // Check if already in queue
        if (rankedQueue[mode].has(userId)) {
            // PATCH: Use flags for ephemeral
            return interaction.reply({ content: "You're already in the ranked queue!", flags: 64 });
        }

        // Check if already in a match
        for (const match of rankedQueue.matches.values()) {
            if (match.player1 === userId || match.player2 === userId) {
                // PATCH: Use flags for ephemeral
                return interaction.reply({ content: "You're already in a ranked match!", flags: 64 });
            }
        }

        // Add to queue with timestamp
        rankedQueue[mode].set(userId, Date.now());

        // Log queue entry
        try {
            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(`[RANKED] ${interaction.user.tag} (${userId}) has entered the ${mode} queue.`);
            }
        } catch (e) {}

        // Timer embed logic
        let seconds = 60;
        const embed = new EmbedBuilder()
            .setTitle("Ranked Queue")
            .setDescription(`Searching for an opponent...\n\nTime left: **${seconds}** seconds`)
            .setColor("#e67e22")
            .setFooter({ text: "You will be matched with a bot if no user is found." });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ranked_cancel_queue')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        const message = await interaction.fetchReply();

        let matched = false;
        const filter = i => i.customId === 'ranked_cancel_queue' && i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        // Timer update interval
        const interval = setInterval(async () => {
            if (matched) return;
            seconds--;
            if (seconds <= 0) return;
            try {
                await message.edit({
                    embeds: [
                        EmbedBuilder.from(embed)
                            .setDescription(`Searching for an opponent...\n\nTime left: **${seconds}** seconds`)
                    ],
                    components: [row]
                });
            } catch (e) {}
        }, 1000);

        // Listen for cancel
        collector.on('collect', async i => {
            matched = true;
            clearInterval(interval);
            rankedQueue[mode].delete(userId);
            await i.update({ content: "You have left the ranked queue.", embeds: [], components: [], ephemeral: true });
        });

        // Poll for match every 2 seconds
        for (let t = 0; t < 60 && !matched; t += 2) {
            await new Promise(res => setTimeout(res, 2000));
            // Check for another user in queue
            const others = Array.from(rankedQueue[mode].keys()).filter(id => id !== userId);
            if (others.length > 0) {
                matched = true;
                clearInterval(interval);
                const opponentId = others[0];
                rankedQueue[mode].delete(userId);
                rankedQueue[mode].delete(opponentId);
                try {
                    await message.edit({
                        content: "Opponent found! Starting match...",
                        embeds: [],
                        components: []
                    });
                } catch (e) {}
                try {
                    const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(`[RANKED] Match found: <@${userId}> vs <@${opponentId}>`);
                    }
                } catch (e) {}
                await startRankedBattle(interaction.client, userId, opponentId, mode);
                return;
            }
        }

        // Timer expired, match with bot if not cancelled
        if (!matched) {
            matched = true;
            clearInterval(interval);
            rankedQueue[mode].delete(userId);
            try {
                await message.edit({
                    content: "No users found. You are being matched with a bot...",
                    embeds: [],
                    components: []
                });
            } catch (e) {}
            const npc = rankedNPCs[Math.floor(Math.random() * rankedNPCs.length)];
            const npcId = `NPC_${npc.name}`;
            try {
                const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${interaction.user.tag} (${userId}) matched with bot (${npc.name}) after timer.`);
                }
            } catch (e) {}
            await startRankedBattle(interaction.client, userId, npcId, mode);
        }
    },

    // Export queue check for regular intervals
    checkQueue,
    // Export stats helpers for profile.js
    getMostUsedJutsu,
    getAverageDamage
};