const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { createCanvas, loadImage, registerFont } = require('canvas');

// =======================================================================================
// GLOBAL MODELS, CONSTANTS, AND UTILITIES (Defined once to save code space)
// =======================================================================================

// --- File Paths ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../../menma/images'); // Adjusted path for consistency
const rankedRewardsPath = path.resolve(__dirname, '../../menma/data/rankedrewards.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

// --- Server Constants (from ranked.js) ---
const SERVER_ID = "1381268582595297321";
const LOG_CHANNEL_ID = "1381278641144467637";
const SUMMARY_CHANNEL_ID = "1381601428740505660";

//Gamepass id's
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";

// --- Emojis ---
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

// --- Data Loading (Global, loaded once) ---
let jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
let comboList = fs.existsSync(combosPath) ? JSON.parse(fs.readFileSync(combosPath, 'utf8')) : {};
let rankedRewards = fs.existsSync(rankedRewardsPath) ? JSON.parse(fs.readFileSync(rankedRewardsPath, 'utf8')) : [];

// --- Effect Handlers (Global Model for applying effects) ---
const effectHandlers = {
    /**
     * Calculates damage based on the user's and target's stats.
     * @param {object} user The user's effective stats.
     * @param {object} target The target's effective stats.
     * @param {string} formula The math.js formula for damage calculation.
     * @param {object} effect The effect object, used for properties like accuracyBonus.
     * @returns {{damage: number, hit: boolean}} The calculated damage and whether the attack hit.
     */
    damage: (user, target, formula, effect = {}) => {
        try {
            // Ensure all values are numbers for math.js context
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 80
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1, // Avoid division by zero
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0
                },
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => e.type === 'status' && ['stun', 'flinch'].includes(e.status)),
                max: Math.max
            };
            const finalAccuracy = effect.accuracyBonus ? context.user.accuracy + effect.accuracyBonus : context.user.accuracy;
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
    /**
     * Calculates buff changes based on the user's stats.
     * @param {object} user The user's stats.
     * @param {object} statsDefinition The stat changes to apply.
     * @returns {object} An object containing the stat changes.
     */
    buff: (user, statsDefinition) => {
        const changes = {};
        const context = { user: { ...user } };
        if (!statsDefinition || typeof statsDefinition !== 'object') return changes;
        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                changes[stat] = typeof formulaOrValue === 'number' ? formulaOrValue : Math.floor(math.evaluate(formulaOrValue, context));
            } catch (err) {
                console.error(`Buff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },
    /**
     * Calculates debuff changes based on the target's stats.
     * @param {object} target The target's stats.
     * @param {object} statsDefinition The stat changes to apply.
     * @returns {object} An object containing the stat changes (as negative values).
     */
    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = { 
            target: {
                power: Number(target.power) || 0,
                defense: Number(target.defense) || 0,
                health: Number(target.health) || 0,
                chakra: Number(target.chakra) || 0,
                dodge: Number(target.dodge) || 0
            } 
        };
        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                const value = typeof formulaOrValue === 'number' ? formulaOrValue : math.evaluate(formulaOrValue, context);
                changes[stat] = value < 0 ? value : -Math.abs(value);
            } catch (err) {
                console.error(`Debuff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },
    /**
     * Calculates the heal amount.
     * @param {object} user The user's stats.
     * @param {string} formula The math.js formula for heal calculation.
     * @returns {number} The calculated heal amount.
     */
    heal: (user, formula) => {
        try {
            const context = { user: { ...user } };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Heal formula error: ${formula}`, err);
            return 0;
        }
    },
    /**
     * Calculates the chakra gain amount.
     * @param {object} user The user's stats.
     * @param {string} formula The math.js formula for chakra gain calculation.
     * @returns {number} The calculated chakra amount.
     */
    chakraGain: (user, formula) => {
        try {
            if (typeof formula !== 'string' || !formula.trim()) {
                throw new Error('Invalid chakra gain formula');
            }
            const context = { user: { ...user } };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Chakra gain formula error: ${formula}`, err);
            return 0;
        }
    },
    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1),
    bleed: (target, effect = {}) => {
        // Bleed deals either a fixed damagePerTurn or 20% of health
        if (effect.damagePerTurn) return Math.floor(effect.damagePerTurn);
        return Math.floor(target.health * 0.2);
    },
    poison: (target, effect = {}) => {
        // Poison deals either a fixed damagePerTurn or 5% of health
        if (effect.damagePerTurn) return Math.floor(effect.damagePerTurn);
        return Math.floor(target.health * 0.05);
    },
    flinch: (chance) => Math.random() < chance,
    getAccuracyBonus: (effect, baseAccuracy) => baseAccuracy + (effect.accuracyBonus || 0),
    
    /**
 * Processes all active effects on a combatant at the start of a new turn.
 * This helper now deducts bleed/poison damage directly from currentHealth.
 * @param {object} combatant The combatant to process effects for (user or target).
 * @returns {{damage: number, specialEffects: string[]}} The turn's outcomes.
 */
// ...existing code...
processActiveEffects: (combatant) => {
    const result = {
        damage: 0,
        specialEffects: []
    };

    if (!combatant.activeEffects || combatant.activeEffects.length === 0) {
        return result;
    }

    const remainingEffects = [];

    combatant.activeEffects.forEach((effect) => {
        // Handle direct bleed effect
        if (effect.type === 'bleed') {
            const bleedDamage = effectHandlers.bleed(combatant, effect);
            combatant.currentHealth = Math.max(0, combatant.currentHealth - bleedDamage);
            result.specialEffects.push(`${combatant.name} is bleeding, taking ${bleedDamage} damage.`);
        }
        // Handle status effect with bleed
        if (effect.type === 'status' && effect.status === 'bleed') {
            // Use damagePerTurn if present, else default to 20% health
            let bleedDamage = effect.damagePerTurn;
            if (typeof bleedDamage !== 'number') {
                bleedDamage = Math.floor(combatant.health * 0.2);
            }
            combatant.currentHealth = Math.max(0, combatant.currentHealth - bleedDamage);
            result.specialEffects.push(`${combatant.name} is bleeding, taking ${bleedDamage} damage.`);
        }
        // Handle other status effects (e.g., burn, poison, etc.) as needed...

        // Decrement duration
        effect.duration--;

        if (effect.duration > 0) {
            remainingEffects.push(effect);
        } else {
            result.specialEffects.push(`${combatant.name}'s ${effect.type}${effect.status ? ` (${effect.status})` : ''} effect has worn off.`);
        }
    });

    combatant.activeEffects = remainingEffects;

    return result;
}
};
/**
 * Formats milliseconds into a human-readable string (e.g., "5m 30s").
 * @param {number} ms - The time in milliseconds.
 * @returns {string} The formatted time string.
 */
function getCooldownString(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}





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
// --- S-Rank Specific Image/Webhook Assets ---
const ASUMA_AVATAR = 'https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg';
const KAGAMI_AVATAR = 'https://i.redd.it/n75z59iot9se1.jpeg'; // Placeholder, use your actual Kagami avatar
const ZABUZA_AVATAR = 'https://static.wikia.nocookie.net/naruto/images/7/77/Zabuza_Anime.png/revision/latest?cb=20150125134709';
const OROCHIMARU_AVATAR = 'https://www.pngplay.com/wp-content/uploads/12/Orochimaru-PNG-Free-File-Download.png';
const KURENAI_AVATAR = 'https://static.wikia.nocookie.net/naruto/images/6/67/Kurenai_Part_I.png/revision/latest?cb=20150207094753'; // For future S-Rank
const ASUMA_BG = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg'; // Generic forest/path background
const ZABUZA_BG = 'https://i.pinimg.com/474x/a6/e4/b6/a6e4b61fd616f4452c7f52f814477bc0.jpg'; // Mist background
const OROCHIMARU_BG = 'https://i.pinimg.com/originals/c8/5c/58/c85c5897c8d9e2b2c8c5c7d0e5f0e7f7.jpg'; // Dark cave/hideout background
const CORRUPTED_BG = 'https://i.postimg.cc/SxKGdrVF/image.png'; // Corrupted/hellish background
// --- Ranked Queue System (from ranked.js) ---
const rankedQueue = {
    standard: new Map(), // Map of user IDs to queue entry timestamps
    custom: new Map(),   // For future use
    matches: new Map(),  // Ongoing matches (channelId -> matchData)
    logChannel: null
};

// --- Rank Configuration (from ranked.js) ---
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

// --- Stats Tracking for Profile (from ranked.js) ---
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

// --- Utility Functions (Global) ---

/**
 * Calculates the effective stats of an entity by applying active buffs/debuffs.
 * @param {object} entity - The entity (user or NPC) object.
 * @returns {object} The effective stats.
 */
function getEffectiveStats(entity) {
    const stats = { ...entity };
    delete stats.activeEffects; // Avoid circular reference if not careful
    const effectiveStats = {
        power: stats.power || 10,
        defense: stats.defense || 10,
        chakra: stats.chakra || 10,
        health: stats.health || 100,
        accuracy: stats.accuracy || 100,
        dodge: stats.dodge || 1
    };
    (entity.activeEffects || []).forEach(effect => {
        if (effect.type === 'buff' || effect.type === 'debuff') {
            Object.entries(effect.stats).forEach(([stat, value]) => {
                effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
            });
        }
    });
    return effectiveStats;
}

/**
 * Generates the battle image for the current round.
 * @param {object} player1 - The first player's battle object.
 * @param {object} player2 - The second player's battle object.
 * @param {string|null} customBgUrl - Optional custom background URL.
 * @returns {Promise<string>} Path to the generated image file.
 */
async function generateBattleImage(player1, player2, customBgUrl = null) {
    const width = 800, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

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

/**
 * Creates the embed and components for a player's turn to choose a move.
 * @param {object} player - The player whose turn it is.
 * @param {number} roundNum - The current round number.
 * @returns {{embed: EmbedBuilder, components: ActionRowBuilder[]}} The embed and action rows.
 */
function createMovesEmbed(player, roundNum) {
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
                .setCustomId(`move${index + 1}-${player.userId || player.id}-${roundNum}`)
                .setLabel(`${index + 1}`)
                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(disabled);
        });

    const rows = [];
    // Add up to 5 jutsu buttons in the first row
    if (jutsuButtons.length > 0) {
        const row1 = new ActionRowBuilder();
        jutsuButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
        rows.push(row1);
    }
    
    // Add remaining jutsu buttons (if any) and rest/flee buttons in the second row
    const row2 = new ActionRowBuilder();
    if (jutsuButtons.length > 5) {
        row2.addComponents(jutsuButtons[5]);
    }
    row2.addComponents(
        new ButtonBuilder()
            .setCustomId(`rest-${player.userId || player.id}-${roundNum}`)
            .setLabel('😴')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`flee-${player.userId || player.id}-${roundNum}`)
            .setLabel('❌')
            .setStyle(ButtonStyle.Primary)
    );
    rows.push(row2);

    return { embed, components: rows.slice(0, 5) }; // Discord limits to 5 action rows
}


/**
 * Extracts the jutsu name from a button custom ID.
 * @param {string} buttonId - The custom ID of the button.
 * @param {object} player - The player object to get their jutsus.
 * @returns {string|null} The jutsu name or null if not found.
 */
function getJutsuByButton(buttonId, player) {
    const match = buttonId.match(/^move(\d+)-/);
    if (!match) return null;
    const idx = parseInt(match[1], 10) - 1;
    const jutsuNames = Object.entries(player.jutsu)
        .filter(([_, jutsu]) => jutsu !== 'None')
        .map(([_, jutsuName]) => jutsuName);
    return jutsuNames[idx];
}

/**
 * Processes a player's chosen move (rest or flee).
 * @param {string} customId - The custom ID of the button pressed.
 * @param {object} basePlayer - The player object.
 * @returns {object} The action result.
 */
async function processPlayerMove(customId, basePlayer) {
    const action = customId.split('-')[0];
    if (action === 'rest') {
        basePlayer.chakra = Math.min(basePlayer.chakra + 1, 15); // Max chakra 15
        return {
            damage: 0,
            heal: 0,
            description: `${basePlayer.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }
    if (action === 'flee') {
        return { fled: true };
    }
    // This function is for rest/flee, actual jutsu execution is handled by executeJutsu
    return { damage: 0, heal: 0, description: "Invalid action.", hit: false };
}
/**
 * Executes a jutsu, applies its effects, and returns the result.
 * @param {object} baseUser - The user (player or NPC) performing the jutsu.
 * @param {object} baseTarget - The target of the jutsu.
 * @param {object} effectiveUser - The user's effective stats.
 * @param {object} effectiveTarget - The target's effective stats.
 * @param {string} jutsuName - The name of the jutsu to execute.
 * @param {number} [round=1] - The current round number for round-based jutsus.
 * @param {boolean} [isFirstActivation=false] - True if this is the first activation of a round-based jutsu.
 * @returns {object} The result of the jutsu execution.
 */
function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, round = 1, isFirstActivation = false) {
    // Check if the jutsu exists
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
        hit: true,
        jutsuUsed: jutsuName,
        roundBasedDesc: "",
        roundBasedEffects: []
    };

    // PROCESS ROUND-BASED EFFECTS AT THE START OF THE TURN
    // This is the crucial missing part. We call a helper function to process all
    // active effects on both the user and the target before the new jutsu's effects are applied.
    effectHandlers.processActiveEffects(baseUser, result);
    effectHandlers.processActiveEffects(baseTarget, result);
    
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
    
    baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
    
    // Apply immediate effects
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
                            result.description = `${baseUser.name} missed with ${jutsu.name}!`;
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
                            result.damage = effectiveTarget.health; // Set damage to target's current health
                            result.specialEffects.push("INSTANT KILL!");
                        }
                        break;
                    // Dedicated bleed effect handler as per your request
                    case 'bleed':
                        // Bleed deals 20% of target's current health each round
                        let bleedDamage = Math.floor(effectiveTarget.health * 0.2);
                        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                        baseTarget.activeEffects.push({
                            type: 'bleed',
                            duration: effect.duration || 1,
                            damagePerTurn: bleedDamage
                        });
                        result.specialEffects.push(`Applied bleed for ${effect.duration || 1} turns`);
                        break;
                    case 'status':
                        // This now only handles non-bleed status effects like poison and flinch
                        if (effectHandlers.status(effect.chance)) {
                            if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                            let damagePerTurn = effect.damagePerTurn;
                            let healPerTurn = effect.healPerTurn;
                            
                            if (effect.damagePerTurnFormula) {
                                try {
                                    damagePerTurn = Math.floor(math.evaluate(effect.damagePerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                } catch (err) {
                                    damagePerTurn = 0;
                                }
                            }
                            if (effect.healPerTurnFormula) {
                                try {
                                    healPerTurn = Math.floor(math.evaluate(effect.healPerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                } catch (err) {
                                    healPerTurn = 0;
                                }
                            }

                            baseTarget.activeEffects.push({
                                type: 'status',
                                status: effect.status,
                                duration: effect.duration || 1,
                                damagePerTurn,
                                healPerTurn
                            });
                            result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                        }
                        break;
                    case 'chakra_gain':
                        const chakraGain = effectHandlers.chakraGain(effectiveUser, effect.formula);
                        baseUser.chakra = Math.min((baseUser.chakra || 0) + chakraGain); 
                        result.chakraGain = (result.chakraGain || 0) + chakraGain;
                        if (chakraGain > 0) {
                            result.specialEffects.push(`Gained ${Math.round(chakraGain)} Chakra`);
                        }
                        break;
                }
            } catch (err) {
                console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                result.specialEffects.push(`Error applying ${effect.type} effect`);
            }
        });
    }
    
    // Handle round-based jutsu effects for current round
    if (jutsu.roundBased) {
        // Find the correct round key (supports "8-16" etc)
        let roundEffect = null;
        for (const key of Object.keys(jutsu.roundEffects || {})) {
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(Number);
                if (round >= start && round <= end) {
                    roundEffect = jutsu.roundEffects[key];
                    break;
                }
            } else if (parseInt(key) === round) {
                roundEffect = jutsu.roundEffects[key];
                break;
            }
        }

        if (roundEffect) {
            result.roundBasedDesc = roundEffect.description || "";
            // Apply effects for the current round of a round-based jutsu
            if (Array.isArray(roundEffect.effects)) {
                roundEffect.effects.forEach(effect => {
                    try {
                        switch (effect.type) {
                            case 'damage':
                                // This logic now correctly adds to the total damage and updates hit status.
                                const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
                                result.damage += damageResult.damage;
                                result.hit = damageResult.hit;
                                if (damageResult.hit && damageResult.damage > 0) {
                                    result.roundBasedEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                                } else if (!damageResult.hit) {
                                    result.roundBasedEffects.push("Attack missed!");
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
                                result.roundBasedEffects.push(`Gained buffs: ${Object.entries(buffChanges)
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
                                result.roundBasedEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;
                            case 'heal':
                                const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                result.heal += healAmount;
                                if (healAmount > 0) {
                                    result.roundBasedEffects.push(`Healed ${Math.round(healAmount)} HP`);
                                }
                                break;
                            case 'instantKill':
                                if (effectHandlers.instantKill(effect.chance)) {
                                    result.damage = effectiveTarget.health;
                                    result.roundBasedEffects.push("INSTANT KILL!");
                                }
                                break;
                            case 'bleed':
                                let bleedDamage = effect.damagePerTurn;
                                if (effect.damagePerTurnFormula) {
                                    try {
                                        bleedDamage = Math.floor(math.evaluate(effect.damagePerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                    } catch (err) {
                                        bleedDamage = 0;
                                    }
                                }
                                if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                baseTarget.activeEffects.push({
                                    type: 'bleed',
                                    duration: effect.duration || 1,
                                    damagePerTurn: bleedDamage
                                });
                                result.roundBasedEffects.push(`Applied bleed for ${effect.duration || 1} turns`);
                                break;
                            case 'status':
                                if (effectHandlers.status(effect.chance)) {
                                    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                    baseTarget.activeEffects.push({
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1,
                                        damagePerTurn: effect.damagePerTurn
                                    });
                                    result.roundBasedEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                }
                                break;
                            case 'chakra_gain':
                                const chakraGain = effectHandlers.chakraGain(effectiveUser, effect.formula);
                                baseUser.chakra = Math.min((baseUser.chakra || 0) + chakraGain);
                                result.chakraGain = (result.chakraGain || 0) + chakraGain;
                                if (chakraGain > 0) {
                                    result.roundBasedEffects.push(`Gained ${Math.round(chakraGain)} Chakra`);
                                }
                                break;
                        }
                    } catch (err) {
                        console.error(`Error processing ${effect.type} effect for round-based jutsu:`, err);
                        result.roundBasedEffects.push(`Error applying ${effect.type} effect`);
                    }
                });
            }
        }
    }
    
    return result;
}

/**
 * Creates a comprehensive battle summary embed for a single round, showing actions of both participants.
 * This is the GLOBAL ROUND SUMMARY.
 * @param {object} player1Action - The action result for player 1.
 * @param {object} player2Action - The action result for player 2.
 * @param {object} player1 - The player 1 object.
 * @param {object} player2 - The player 2 object (can be an NPC).
 * @param {number} roundNum - The current round number.
 * @param {boolean} comboCompleted1 - Whether player 1 completed a combo.
 * @param {string} comboDamageText1 - Combo text for player 1.
 * @param {boolean} comboCompleted2 - Whether player 2 completed a combo.
 * @param {string} comboDamageText2 - Combo text for player 2.
 * @param {array} player1RoundBasedSummaries - Summaries from player 1's active round-based jutsus.
 * @param {array} player2RoundBasedSummaries - Summaries from player 2's active round-based jutsus.
 * @returns {EmbedBuilder} The battle summary embed.
 */
function createBattleSummary(
    player1Action, player2Action, player1, player2, roundNum,
    comboCompleted1, comboDamageText1, comboCompleted2, comboDamageText2,
    player1RoundBasedSummaries = [], player2RoundBasedSummaries = []
) {
    // Helper to get effect emojis for an entity
    const getEffectEmojis = (entity) => {
        const emojis = [];
        (entity.activeEffects || []).forEach(effect => {
            if (effect.type === 'buff') emojis.push(EMOJIS.buff);
            if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
            if (effect.type === 'status') {
                if (EMOJIS[effect.status]) {
                    emojis.push(EMOJIS[effect.status]);
                } else {
                    emojis.push(EMOJIS.status);
                }
            }
        });
        return emojis.length ? `[${emojis.join('')}]` : '';
    };

    // Helper to format jutsu descriptions, especially for multi-round jutsus
    const formatJutsuDescription = (jutsuName, roundNumber, user, target) => {
        const jutsu = jutsuList[jutsuName];
        if (!jutsu) {
            // Check for stun/flinch/drown status effect
            const statusEffect = (user.activeEffects || []).find(e =>
                e.type === 'status' && ['stun', 'flinch', 'drown'].includes(e.status)
            );
            if (statusEffect) {
                switch (statusEffect.status) {
                    case 'stun': return `${user.name} is stunned and can't move!`;
                    case 'flinch': return `${user.name} flinched!`;
                    case 'drown': return `${user.name} is drowning and can't act!`;
                    default: return `${user.name} is incapacitated!`;
                }
            }
            return `${user.name} used an unknown jutsu.`;
        }

        let finalDescription = jutsu.description;

        // Handle multi-round jutsu descriptions
        if (jutsu.roundBased && jutsu.roundEffects) {
            for (const roundKey in jutsu.roundEffects) {
                const [start, end] = roundKey.split('-').map(Number);
                if (end) {
                    if (roundNumber >= start && roundNumber <= end) {
                        finalDescription = jutsu.roundEffects[roundKey].description;
                        break;
                    }
                } else if (roundNumber === start) {
                    finalDescription = jutsu.roundEffects[roundKey].description;
                    break;
                }
            }
        }

        // Replace dynamic keywords
        if (finalDescription) {
            finalDescription = finalDescription
                .replace(/\buser\b/gi, user.name)
                .replace(/\btarget\b/gi, target.name);
        }

        return finalDescription || jutsu.description;
    };

    // Helper to get combo progress text
    const getComboProgressText = (user, comboCompleted) => {
        if (player2.isNpc || comboCompleted || !user.comboState?.combo) return "";

        const combo = user.comboState.combo;
        const usedJutsus = user.comboState.usedJutsus || new Set();
        const remainingJutsus = combo.requiredJutsus.filter(jutsu => !usedJutsus.has(jutsu));
        const progressBar = `${COMBO_EMOJI_FILLED.repeat(usedJutsus.size)}${COMBO_EMOJI_EMPTY.repeat(remainingJutsus.length)}`;
        return `\nCombo Progress: ${progressBar} (${Math.round((usedJutsus.size / combo.requiredJutsus.length) * 100)}%)`;
    };

    // Helper to check for active status effects that prevent action
    const getStatusEffectMessage = (entity) => {
        const statusEffect = (entity.activeEffects || []).find(e =>
            e.type === 'status' && e.canAttack === false
        );
        if (statusEffect) {
            switch (statusEffect.status) {
                case 'stun': return `${entity.name} is stunned and can't move!`;
                case 'flinch': return `${entity.name} flinched!`;
                case 'drown': return `${entity.name} is drowning and can't act!`;
                default: return `${entity.name} is incapacitated!`;
            }
        }
        return null;
    };

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400');

    // Player 1 Details (User)
    let p1MaxHealth = player1.maxHealth || player1.health || 100;
    let p1Health = Math.round(
        Math.max(
            -999999999999,
            Math.min(
                p1MaxHealth,
                (typeof player1.currentHealth === "number" ? player1.currentHealth : player1.health || 0)
            )
        )
    );
    let p1Chakra = Math.round(player1.chakra || 0);
    const p1EffectEmojis = getEffectEmojis(player1);
    const p2EffectEmojis = getEffectEmojis(player2);

    // Status effect override for player1
    let p1StatusMsg = getStatusEffectMessage(player1);
    let p1Description;
    if (p1StatusMsg && (!player1Action.jutsuUsed || player1Action.isStatusEffect)) {
        p1Description = p1StatusMsg;
    } else if (player1Action.isRest) {
        p1Description = player1Action.description;
    } else if (player1Action.fled) {
        p1Description = `${player1.name} fled from battle!`;
    } else {
        p1Description = formatJutsuDescription(player1Action.jutsuUsed, roundNum, player1, player2);
    }

    if (player1Action.damage) {
        p1Description += ` for ${Math.round(player1Action.damage)} damage!`;
    } else if (player1Action.heal) {
        p1Description += ` for ${Math.round(player1Action.heal)} HP!`;
    } else if (!player1Action.isRest && !player1Action.fled && !p1StatusMsg) {
        p1Description += '...!';
    }

    if (comboCompleted1) {
        p1Description += comboDamageText1;
    }

    // Player 2 Details (User or NPC)
    let p2MaxHealth = player2.maxHealth || player2.health || 100;
    let p2Health = Math.round(
        Math.max(
            -999999999999,
            Math.min(
                p2MaxHealth,
                (typeof player2.currentHealth === "number" ? player2.currentHealth : player2.health || 0)
            )
        )
    );
    let p2Chakra = Math.round(player2.chakra || 0);

    // Status effect override for player2
    let p2StatusMsg = getStatusEffectMessage(player2);
    let p2Description;
    if (p2StatusMsg && (!player2Action.jutsuUsed || player2Action.isStatusEffect)) {
        p2Description = p2StatusMsg;
    } else if (player2Action.isRest) {
        p2Description = player2Action.description;
    } else if (player2Action.fled) {
        p2Description = `${player2.name} fled from battle!`;
    } else {
        p2Description = formatJutsuDescription(player2Action.jutsuUsed, roundNum, player2, player1);
    }

    if (player2Action.damage) {
        p2Description += ` for ${Math.round(player2Action.damage)} damage!`;
    } else if (player2Action.heal) {
        p2Description += ` for ${Math.round(player2Action.heal)} HP!`;
    } else if (!player2Action.isRest && !player2Action.fled && !p2StatusMsg) {
        p2Description += '...!';
    }

    if (comboCompleted2) {
        p2Description += comboDamageText2;
    }

    // Add fields for better organization
    embed.addFields(
        {
            name: `${p1EffectEmojis} ${player1.name}`,
            value: `${p1Description}\n\n**HP:** ${p1Health}\n**Chakra:** ${p1Chakra}`,
            inline: true
        },
        {
            name: `${p2EffectEmojis} ${player2.name}`,
            value: `${p2Description}\n\n**HP:** ${p2Health}\n**Chakra:** ${p2Chakra}`,
            inline: true
        }
    );

    // --- NEW: Handle ongoing status effects with damage/heal values ---
    const activeStatusEffects = [];
    [player1, player2].forEach(p => {
        (p.activeEffects || []).forEach(effect => {
            if (effect.type === 'status' && (effect.damagePerTurn || effect.healPerTurn)) {
                let damageText = '';
                if (typeof effect.damagePerTurn === "number" && !isNaN(effect.damagePerTurn)) {
                    damageText = `(takes **${Math.round(effect.damagePerTurn)}** damage this turn)`;
                } else if (typeof effect.healPerTurn === "number" && !isNaN(effect.healPerTurn)) {
                    damageText = `(heals **${Math.round(effect.healPerTurn)}** HP this turn)`;
                } else {
                    damageText = '';
                }
                const statusName = effect.status.charAt(0).toUpperCase() + effect.status.slice(1);
                activeStatusEffects.push(`${p.name} is affected by ${statusName}! ${damageText}`);
            }
        });
    });

    if (activeStatusEffects.length > 0) {
        embed.addFields({
            name: 'Ongoing Effects',
            value: activeStatusEffects.join('\n'),
            inline: false
        });
    }

    // Handle round-based summaries from active jutsus
    const roundBasedSummaries = [];
    // Process player 1's effects
    player1RoundBasedSummaries.forEach(s => {
        let text = s.desc.replace(/\buser\b/gi, player1.name).replace(/\btarget\b/gi, player2.name);
        if (s.effects && s.effects.length > 0) {
            s.effects.forEach(effect => {
                if (effect.type === 'damage' && effect.value) {
                    text += ` (Dealt ${Math.round(effect.value)} damage)`;
                } else if (effect.type === 'heal' && effect.value) {
                    text += ` (Healed for ${Math.round(effect.value)} HP)`;
                }
            });
        }
        roundBasedSummaries.push(`*${text}*`);
    });

    // Process player 2's effects
    player2RoundBasedSummaries.forEach(s => {
        let text = s.desc.replace(/\buser\b/gi, player2.name).replace(/\btarget\b/gi, player1.name);
        if (s.effects && s.effects.length > 0) {
            s.effects.forEach(effect => {
                if (effect.type === 'damage' && effect.value) {
                    text += ` (Dealt ${Math.round(effect.value)} damage)`;
                } else if (effect.type === 'heal' && effect.value) {
                    text += ` (Healed for ${Math.round(effect.value)} HP)`;
                }
            });
        }
        roundBasedSummaries.push(`*${text}*`);
    });

    if (roundBasedSummaries.length > 0) {
        embed.addFields({
            name: 'Round Effects',
            value: roundBasedSummaries.join('\n'),
            inline: false
        });
    }

    // Add combo progress if applicable
    const comboProgressText1 = getComboProgressText(player1, comboCompleted1);
    if (comboProgressText1) {
        embed.addFields({ name: 'Your Combo', value: comboProgressText1, inline: false });
    }

    const comboProgressText2 = getComboProgressText(player2, comboCompleted2);
    if (comboProgressText2) {
        embed.addFields({ name: 'Opponent Combo', value: comboProgressText2, inline: false });
    }

    // Handle image and custom background logic
    let imageUrl = null;
    let customBgUrl = null;
    if (player1Action.jutsuUsed && jutsuList[player1Action.jutsuUsed]) {
        const jutsu = jutsuList[player1Action.jutsuUsed];
        if (jutsu.image_url) {
            imageUrl = jutsu.image_url;
        }
        if (jutsu.custombackground && jutsu.custombackground.round === roundNum) {
            customBgUrl = jutsu.custombackground.url;
        }
    }
    if (player2Action.jutsuUsed && jutsuList[player2Action.jutsuUsed]) {
        const jutsu = jutsuList[player2Action.jutsuUsed];
        if (jutsu.image_url) {
            imageUrl = jutsu.image_url;
        }
        if (jutsu.custombackground && jutsu.custombackground.round === roundNum) {
            customBgUrl = jutsu.custombackground.url;
        }
    }

    if (customBgUrl) {
        embed.setImage(customBgUrl);
    } else if (imageUrl) {
        embed.setImage(imageUrl);
    }

    return embed;
}



// --- ELO System Functions (from ranked.js) ---

/**
 * Gets the rank and division based on ELO.
 * @param {number} elo - The user's ELO.
 * @returns {{rank: string, division: number, elo: number}} The rank details.
 */
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

/**
 * Updates ELO for winner and loser.
 * @param {string} winnerId - The ID of the winner.
 * @param {string} loserId - The ID of the loser.
 * @param {boolean} isNpcMatch - True if the match was against an NPC.
 * @returns {{winnerChange: number, loserChange: number, winnerNew: object, loserNew: object}} ELO changes and new ranks.
 */
function updateElo(winnerId, loserId, isNpcMatch = false) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // If winner or loser is an NPC, do not update users.json, just return dummy values
    if (
        (typeof winnerId === "string" && winnerId.startsWith("NPC_")) ||
        (typeof loserId === "string" && loserId.startsWith("NPC_"))
    ) {
        const winElo = isNpcMatch ? 20 : RANK_CONFIG.winElo;
        const lossElo = isNpcMatch ? 0 : RANK_CONFIG.lossElo;
        return {
            winnerChange: winElo,
            loserChange: lossElo,
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

/**
 * Generates an image showing ELO changes.
 * @param {object} user - The user object for whom to generate the image.
 * @param {number} oldElo - The user's ELO before the match.
 * @param {number} newElo - The user's ELO after the match.
 * @param {boolean} isWinner - True if the user won the match.
 * @returns {Promise<string>} Path to the generated image file.
 */
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

/**
 * Generates an image displaying ranked rewards.
 * @param {object} user - The user object.
 * @param {number} userElo - The user's current ELO.
 * @param {string} userRank - The user's current rank.
 * @param {number} userDiv - The user's current division.
 * @param {object|null} claimable - The next claimable reward, or null.
 * @param {object|null} nextReward - The next upcoming reward, or null.
 * @returns {Promise<string>} Path to the generated image file.
 */
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
        ctx.fillStyle = theme.text;
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

// --- B-Rank NPCs Database ---
const BRANK_NPCS = [
    {
        name: "Bandit",
        image: "https://static.wikia.nocookie.net/naruto/images/9/9c/Mizuki.png/revision/latest?cb=20210529210947&path-prefix=fr",
        baseHealth: 1.5,
        basePower: 0.8,
        baseDefense: 0.3,
        accuracy: 80,
        dodge: 10,
        jutsu: ["Attack", "Serpents Wrath", "Shuriken Throw"]
    }
];
// --- A-Rank NPCs Database with multipliers ---
const ARANK_NPCS = [
    {
        name: "Jugo",
        image: "https://i.postimg.cc/vmfSx5V1/17-D3-B777-0-FC6-4-EE4-957-D-513-CC60-D8924.png",
        baseHealth: 4.0,
        basePower: 1.2,
        baseDefense: 0.8,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Monster Claw"]
    },

    {
        name: "Temari",
        image: "https://i.postimg.cc/1tS7G4Gv/6-CCACDF3-9612-4831-8-D31-046-BEA1586-D9.png",
        baseHealth: 2.5,
        basePower: 1.0,
        baseDefense: 0.5,
        accuracy: 90,
        dodge: 0,
        jutsu: ["Attack", "Wind Scythe"]
    },

    {
        name: "Kankuro",
        image: "https://i.postimg.cc/y8wbNLk4/5-F95788-A-754-C-4-BA6-B0-E0-39-BCE2-FDCF04.png",
        baseHealth: 3.5,
        basePower: 1.1,
        baseDefense: 0.7,
        accuracy: 80,
        dodge: 0,
        jutsu: ["Attack", "Puppet Master"]
    },

    {
        name: "Suigetsu",
        image: "https://i.postimg.cc/GmBfrW3x/54-AE56-B1-E2-EE-4179-BD24-EEC282-A8-B3-BF.png",
        baseHealth: 3.0,
        basePower: 1.0,
        baseDefense: 0.6,
        accuracy: 75,
        dodge: 0,
        jutsu: ["Attack", "Water Dragon Jutsu"]
    },

    {
        name: "Fuguki",
        image: "https://i.postimg.cc/QMJJrm7q/064262-C0-1-BC4-47-B2-A06-A-59-DC193-C0285.png",
        baseHealth: 4.0,
        basePower: 1.2,
        baseDefense: 0.8,
        accuracy: 70,
        dodge: 0,
        jutsu: ["Attack", "Samehada Slash"]
    },

    {
        name: "Jinpachi",
        image: "https://i.postimg.cc/SsZLnKD2/809-EBF4-E-70-EF-4-C83-BCE4-3-D6-C228-B1239.png",
        baseHealth: 3.5,
        basePower: 1.1,
        baseDefense: 0.7,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Greast Forest Crumbling"]
    },

    {
        name: "Kushimaru",
        image: "https://i.postimg.cc/3wTF6VkR/53-BE91-D0-8-A53-47-C9-BD48-A06728-AFE79-C.png",
        baseHealth: 2.8,
        basePower: 1.1,
        baseDefense: 0.6,
        accuracy: 95,
        dodge: 0,
        jutsu: ["Attack", "One Thousand Slashes"]
    },

    {
        name: "Baki",
        image: "https://i.postimg.cc/Jn7c7XcC/5997-D785-7-C7-D-4-BC0-93-DB-CCF7-CA3-CDB56.png",
        baseHealth: 3.0,
        basePower: 1.0,
        baseDefense: 0.7,
        accuracy: 85,
        dodge: 0,
        jutsu: ["Attack", "Wind Scythe"]

    }
];


// =======================================================================================
// CORE BATTLE LOGIC (Shared across all battle commands)
// =======================================================================================

/**
 * Handles the main battle loop for any two participants (user vs user, user vs NPC).
 * This function encapsulates the turn-based combat, effect application, and summary generation.
 * @param {object} interaction - The Discord interaction object.
 * @param {string} player1Id - The ID of the first player (always a user).
 * @param {string} player2Id - The ID of the second player (user or NPC_name).
 * @param {string} battleType - Type of battle (e.g., 'brank', 'arank', 'ranked', 'fight').
 */

// Accept npcTemplate as an optional parameter for custom NPCs (like Hokage Trials)
async function runBattle(interaction, player1Id, player2Id, battleType, npcTemplate = null) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const client = interaction.client; // Get client from interaction
    // Initialize player1 (always a user)
    const player1User = await client.users.fetch(player1Id);
    let player1 = {
        ...users[player1Id],
        userId: player1Id,
        name: player1User.username,
        avatar: player1User.avatar,
        discriminator: player1User.discriminator,
        // CRITICAL FIX: Ensure health, power, defense, etc. are initialized as numbers
        health: Number(users[player1Id].health) || 0,
        currentHealth: Number(users[player1Id].health) || 0,
        power: Number(users[player1Id].power) || 0,
        defense: Number(users[player1Id].defense) || 0,
        chakra: Number(users[player1Id].chakra) || 10,
        activeEffects: [],
        accuracy: 100,
        dodge: 0,
        jutsu: users[player1Id].jutsu || {},
        maxHealth: Number(users[player1Id].health) || 0, // Store max health for healing calculations
        comboState: users[player1Id].Combo && comboList[users[player1Id].Combo] ? { combo: comboList[users[player1Id].Combo], usedJutsus: new Set() } : null
    };
    // Initialize player2 (user or NPC)
    let player2;
    const isPlayer2NPC = player2Id.startsWith('NPC_');
    let npcData = null;
    if (isPlayer2NPC) {
        const npcName = player2Id.replace('NPC_', '');
        // Use npcTemplate for trials, else use database for brank/arank/ranked
        if (npcTemplate) {
            npcData = { ...npcTemplate };
        } else if (battleType === 'brank') {
            npcData = BRANK_NPCS.find(npc => npc.name === npcName) || BRANK_NPCS[0];
        } else if (battleType === 'arank') {
            npcData = ARANK_NPCS.find(npc => npc.name === npcName) || ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
        } else {
            // ranked
            npcData = rankedNPCs.find(npc => npc.name === npcName) || rankedNPCs[0];
        }
        if (!npcData) {
            console.error(`NPC data not found for ${npcName}. Using fallback.`);
            npcData = { // Fallback NPC
                name: "Rogue Ninja",
                image: "https://static.wikia.nocookie.net/naruto/images/3/3f/Thug.png/revision/latest?cb=20181118072602",
                health: 100,
                power: 50,
                defense: 30,
                accuracy: 80,
                dodge: 10,
                jutsu: ["Attack"]
            };
        }
        player2 = {
            ...npcData,
            userId: player2Id,
            name: npcData.name,
            // CRITICAL FIX: Ensure health, power, defense, etc. are initialized as numbers
           health: Math.floor((player1.maxHealth || player1.health) * (npcData.baseHealth || 1)) || 0,
            currentHealth: Math.floor((player1.health) * (npcData.baseHealth || 1)) || 0,
            power: Math.floor(player1.power * (npcData.basePower || 1)) || 0,
            defense: Math.floor(player1.defense * (npcData.baseDefense || 1)) || 0,
            accuracy: Number(npcData.accuracy) || 0,
            dodge: Number(npcData.dodge) || 0,
            chakra: 10,
            activeEffects: [],
            jutsu: Object.fromEntries(npcData.jutsu.map((j, i) => [i, j]))
        };
    } else {
        const player2User = await client.users.fetch(player2Id);
        player2 = {
            ...users[player2Id],
            userId: player2Id,
            name: player2User.username,
            avatar: player2User.avatar,
            discriminator: player2User.discriminator,
            // CRITICAL FIX: Ensure health, power, defense, etc. are initialized as numbers
            health: Number(users[player2Id].health) || 0,
            currentHealth: Number(users[player2Id].health) || 0,
            power: Number(users[player2Id].power) || 0,
            defense: Number(users[player2Id].defense) || 0,
            chakra: Number(users[player2Id].chakra) || 10,
            activeEffects: [],
            accuracy: 100,
            dodge: 0,
            jutsu: users[player2Id].jutsu || {},
            maxHealth: Number(users[player2Id].health) || 0,
            comboState: users[player2Id].Combo && comboList[users[player2Id].Combo] ? { combo: comboList[users[player2Id].Combo], usedJutsus: new Set() } : null
        };
    }

    // --- BLOODLINE STATE ---
    const bloodlineState = {
        [player1.userId]: { active: false, roundsLeft: 0, used: false },
        [player2.userId]: { active: false, roundsLeft: 0, used: false }
    };

    // --- ROUND-BASED JUTSU STATE ---
    let player1ActiveJutsus = {};
    let player2ActiveJutsus = {};
    let player1RoundBasedSummaries = [];
    let player2RoundBasedSummaries = [];

    let roundNum = 1;
    let battleActive = true;
    let totalDamageDealt1 = 0;
    let totalDamageTaken1 = 0;
    let totalDamageDealt2 = 0;
    let totalDamageTaken2 = 0;

    // Determine the channel to send messages to (interaction.channel for brank/arank/fight, new channel for ranked)
    let battleChannel = interaction.channel;
    if (battleType === 'ranked') {
        const guild = await client.guilds.fetch(SERVER_ID);
        const channelName = `ranked-${Math.floor(Math.random() * 900000 + 100000).toString()}`; // Generate random ID
        
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
        if (!isPlayer2NPC) { // Only add if player2 is a user
            permissionOverwrites.push({
                id: player2Id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        battleChannel = await guild.channels.create({
            name: channelName,
            type: 0, // GUILD_TEXT
            permissionOverwrites
        });

        // Send invitation for ranked battles
        const invitationEmbed = new EmbedBuilder()
            .setTitle('🏆 RANKED BATTLE INITIATED')
            .setDescription(
                `Welcome to the ultimate test of strength and will!\n\n` +
                `Step into the arena and prove yourself as the strongest shinobi. ` +
                `Climb the ranks, defeat your rivals, and aim to become the next Hokage!\n\n` +
                `**Do <@${player1Id}> and ${isPlayer2NPC ? player2.name : `<@${player2Id}>`} swear to fight fairly under the gaze of the Shinigami, god of death?**\n` +
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

        const invitationMsg = await battleChannel.send({
            content: isPlayer2NPC ? `<@${player1Id}>` : `<@${player1Id}> <@${player2Id}>`,
            embeds: [invitationEmbed],
            components: [acceptRow]
        });

        const acceptedPlayers = new Set();
        let declined = false;

        // Wait for acceptance
        await new Promise((resolve) => {
            const collector = invitationMsg.createMessageComponentCollector({
                filter: i => (i.user.id === player1Id || (!isPlayer2NPC && i.user.id === player2Id)),
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'ranked_accept') {
                    acceptedPlayers.add(i.user.id);
                    await i.reply({ content: `You have accepted the challenge!`, ephemeral: true });
                    await battleChannel.send(`<@${i.user.id}> has accepted.`);
                    
                    if (acceptedPlayers.size === (isPlayer2NPC ? 1 : 2)) {
                        collector.stop('accepted');
                    }
                } else if (i.customId === 'ranked_decline') {
                    declined = true;
                    await i.reply({ content: `You have declined the challenge. The match is cancelled.`, ephemeral: true });
                    await battleChannel.send(`<@${i.user.id}> has declined. The match is cancelled.`);
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

                if (reason === 'accepted') {
                    await battleChannel.send('**# RANKED BATTLE**\nLet the battle begin!');
                    resolve();
                } else {
                    if (acceptedPlayers.size === 1) {
                        const winnerId = [...acceptedPlayers][0];
                        const loserId = winnerId === player1Id ? player2Id : player1Id;
                        await battleChannel.send(`<@${winnerId}> has accepted, but ${isPlayer2NPC ? player2.name : `<@${loserId}>`} did not respond in time. <@${winnerId}> wins by default!`);
                        
                        if (!isPlayer2NPC) { // Only update ELO if the loser was a real player
                            const eloUpdate = updateElo(winnerId, loserId, false);
                            try {
                                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                                if (logChannel) {
                                    await logChannel.send(`[RANKED] ${winnerId} wins by default (opponent did not accept) +${eloUpdate.winnerChange} ELO`);
                                }
                            } catch (e) {}
                        } else {
                            // If NPC didn't accept, user wins against NPC. Award 20 ELO.
                            const oldElo = users[player1Id]?.elo || 0;
                            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                            if (typeof usersData[player1Id].elo !== "number") usersData[player1Id].elo = 0;
                            usersData[player1Id].elo += 20;
                            const newRank = getTierAndDivision(usersData[player1Id].elo);
                            usersData[player1Id].rank = newRank.rank;
                            fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
                            let summaryChannel;
                            try { summaryChannel = await client.channels.fetch(SUMMARY_CHANNEL_ID); } catch (e) { summaryChannel = battleChannel; }
                            await summaryChannel.send(
                                `<@${player1Id}> defeated an NPC by default and gained +20 ELO! (Current Elo: ${usersData[player1Id].elo})`
                            );
                        }
                    } else {
                        await battleChannel.send('The battle has been cancelled due to no response.');
                    }
                    battleActive = false; // Stop battle loop
                    // Delete channel after a delay
                    setTimeout(async () => {
                        try { await battleChannel.delete("Ranked match invitation expired/declined (auto-cleanup)"); } catch (e) {}
                    }, 2000);
                    resolve();
                }
            });
        });

        if (!battleActive) return; // If battle was cancelled/declined
    }


    let battleResult = null;
    while (battleActive) {
        // --- Apply and Update Effects (Buffs, Debuffs, Statuses) ---
        [player1, player2].forEach(entity => {
            // Apply damage/heal from bleed, poison etc.
            (entity.activeEffects || []).forEach(effect => {
                if (effect.type === 'bleed') {
                    const bleedDamage = effectHandlers.bleed(entity);
                    entity.currentHealth = Math.max(0, entity.currentHealth - bleedDamage);
                    // Add to round summary
                    if (entity.userId === player1.userId) {
                        player1RoundBasedSummaries.push({ desc: `${entity.name} takes ${bleedDamage} damage from bleeding!` });
                    } else {
                        player2RoundBasedSummaries.push({ desc: `${entity.name} takes ${bleedDamage} damage from bleeding!` });
                    }
                }
                // Decrement duration
                if (effect.duration > 0) effect.duration--;
            });
            // Filter out expired effects
            entity.activeEffects = (entity.activeEffects || []).filter(e => e.duration > 0);
        });

        // --- Bloodline Logic ---
        for (const player of [player1, player2]) {
            const playerBloodline = player.bloodline;
            const state = bloodlineState[player.userId];
            let bloodlineEmbed = null;
            const opponent = player.userId === player1.userId ? player2 : player1;

            // Nara is always passive
            if (playerBloodline === "Nara") {
                player.chakra = Math.min(player.chakra + 3); // Max chakra 15
                bloodlineEmbed = new EmbedBuilder()
                    .setTitle("Battle IQ")
                    .setDescription(`${BLOODLINE_DEPARTMENTS[playerBloodline]}\n\n${player.name} activates **${BLOODLINE_NAMES[playerBloodline]}**!\nBattle IQ grants +3 chakra this round!`)
                    .setImage(BLOODLINE_GIFS[playerBloodline])
                    .setColor(0x8B4513);
                await battleChannel.send({ embeds: [bloodlineEmbed] });
            }

            // Uchiha bloodline rounds decrement
            if (playerBloodline === "Uchiha" && state.active) {
                state.roundsLeft--;
                if (state.roundsLeft <= 0) {
                    state.active = false;
                    player.accuracy = 100; // Reset accuracy
                }
            }

            // Auto-activate bloodline if threshold is met and not used
            if (!state.used && playerBloodline && playerBloodline !== "Nara") {
                let shouldActivate = false;
                const hp = typeof player.currentHealth === "number" ? player.currentHealth : 0;
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
                                .setDescription(`${flavor}\n\n${player.name} activates **${BLOODLINE_NAMES[playerBloodline]}**!\nHyper Regeneration restores 50% HP!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            state.used = true;
                            break;
                        case "Uzumaki":
                            player.chakra = 15;
                            bloodlineEmbed = new EmbedBuilder()
                                .setTitle(BLOODLINE_NAMES[playerBloodline])
                                .setDescription(`${flavor}\n\n${player.name} activates **${BLOODLINE_NAMES[playerBloodline]}**!\nUzumaki Will surges, chakra set to 15!`)
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
                                    .setDescription(`${flavor}\n\n${player.name} activates **${BLOODLINE_NAMES[playerBloodline]}**!\nByakugan drains ${drained} chakra from the enemy!`)
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
                                .setDescription(`${flavor}\n\n${player.name} activates **${BLOODLINE_NAMES[playerBloodline]}**!\nSharingan grants 100% accuracy and stuns the enemy for 2 rounds!`)
                                .setImage(BLOODLINE_GIFS[playerBloodline])
                                .setColor(0x8B4513);
                            state.used = true;
                            break;
                    }
                    if (bloodlineEmbed) {
                        await battleChannel.send({ embeds: [bloodlineEmbed] });
                    }
                }
            }
        }

        // --- Round-Based Jutsu Logic ---
        player1RoundBasedSummaries = [];
        player2RoundBasedSummaries = [];

        // Helper to get round-based description and apply effects
        const applyRoundBasedEffects = (activeJutsus, user, target, summariesArray) => {
            for (const jutsuName in activeJutsus) {
                const data = activeJutsus[jutsuName];
                const jutsu = jutsuList[jutsuName];
                if (jutsu?.roundBased) {
                    const currentRound = data.round + 1; // Round number for the effect
                    let roundEffect = null;
                    for (const key of Object.keys(jutsu.roundEffects || {})) {
                        if (key.includes('-')) {
                            const [start, end] = key.split('-').map(Number);
                            if (currentRound >= start && currentRound <= end) {
                                roundEffect = jutsu.roundEffects[key];
                                break;
                            }
                        } else if (parseInt(key) === currentRound) {
                            roundEffect = jutsu.roundEffects[key];
                            break;
                        }
                    }

                    if (roundEffect) {
                        const effectiveUser = getEffectiveStats(user);
                        const effectiveTarget = getEffectiveStats(target);
                        let desc = roundEffect.description || "";
                        desc = desc
                            .replace(/undefined/g, user.name)
                            .replace(/\buser\b/gi, user.name)
                            .replace(/\btarget\b/gi, target.name);

                        // Collect effect values for summary
                        const effectSummary = [];

                        // Apply effects for this round of the active jutsu
                        if (Array.isArray(roundEffect.effects)) {
                            roundEffect.effects.forEach(effect => {
                                try {
                                    switch (effect.type) {
                                        case 'damage': {
                                            const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
                                            if (damageResult.hit && damageResult.damage > 0) {
                                                target.currentHealth = Math.max(0, target.currentHealth - damageResult.damage);
                                                effectSummary.push({ type: 'damage', value: damageResult.damage });
                                            }
                                            break;
                                        }
                                        case 'buff': {
                                            const buffChanges = effectHandlers.buff(user, effect.stats);
                                            if (!user.activeEffects) user.activeEffects = [];
                                            user.activeEffects.push({
                                                type: 'buff',
                                                stats: buffChanges,
                                                duration: effect.duration || 1
                                            });
                                            effectSummary.push({ type: 'buff', value: buffChanges });
                                            break;
                                        }
                                        case 'debuff': {
                                            const debuffChanges = effectHandlers.debuff(target, effect.stats);
                                            if (!target.activeEffects) target.activeEffects = [];
                                            target.activeEffects.push({
                                                type: 'debuff',
                                                stats: debuffChanges,
                                                duration: effect.duration || 1
                                            });
                                            effectSummary.push({ type: 'debuff', value: debuffChanges });
                                            break;
                                        }
                                        case 'heal': {
                                            const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                            if (healAmount > 0) {
                                                user.currentHealth = Math.min(user.currentHealth + healAmount, user.maxHealth);
                                                effectSummary.push({ type: 'heal', value: healAmount });
                                            }
                                            break;
                                        }
                                        case 'instantKill': {
                                            if (effectHandlers.instantKill(effect.chance)) {
                                                target.currentHealth = 0;
                                                effectSummary.push({ type: 'instantKill', value: true });
                                            }
                                            break;
                                        }
                                        case 'bleed': {
                                            // Bleed deals 20% of target's current health each round
                                            let bleedDamage = Math.floor(effectiveTarget.health * 0.2);
                                            if (effect.damagePerTurnFormula) {
                                                try {
                                                    bleedDamage = Math.floor(math.evaluate(effect.damagePerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                                } catch (err) {
                                                    bleedDamage = 0;
                                                }
                                            }
                                            if (!target.activeEffects) target.activeEffects = [];
                                            target.activeEffects.push({
                                                type: 'bleed',
                                                duration: effect.duration || 1,
                                                damagePerTurn: bleedDamage
                                            });
                                            effectSummary.push({ type: 'bleed', value: bleedDamage });
                                            break;
                                        }
                                        case 'status': {
                                            if (effectHandlers.status(effect.chance)) {
                                                if (!target.activeEffects) target.activeEffects = [];
                                                let damagePerTurn = effect.damagePerTurn;
                                                let healPerTurn = effect.healPerTurn;
                                                if (effect.damagePerTurnFormula) {
                                                    try {
                                                        damagePerTurn = Math.floor(math.evaluate(effect.damagePerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                                    } catch (err) {
                                                        damagePerTurn = 0;
                                                    }
                                                }
                                                if (effect.healPerTurnFormula) {
                                                    try {
                                                        healPerTurn = Math.floor(math.evaluate(effect.healPerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                                    } catch (err) {
                                                        healPerTurn = 0;
                                                    }
                                                }
                                                target.activeEffects.push({
                                                    type: 'status',
                                                    status: effect.status,
                                                    duration: effect.duration || 1,
                                                    damagePerTurn,
                                                    healPerTurn
                                                });
                                                effectSummary.push({ type: 'status', value: effect.status });
                                            }
                                            break;
                                        }
                                        case 'chakra_gain': {
                                            const chakraGain = effectHandlers.chakraGain(effectiveUser, effect.formula);
                                            user.chakra = Math.min((user.chakra || 0) + chakraGain);
                                            effectSummary.push({ type: 'chakra_gain', value: chakraGain });
                                            break;
                                        }
                                    }
                                } catch (err) {
                                    effectSummary.push({ type: effect.type, error: err.message });
                                }
                            });
                        }

                        // Legacy support for old roundEffect keys
                        if (roundEffect.damage) {
                            const { damage, hit } = effectHandlers.damage(effectiveUser, effectiveTarget, roundEffect.damage.formula, roundEffect.damage);
                            if (hit && damage > 0) {
                                target.currentHealth = Math.max(0, target.currentHealth - damage);
                                effectSummary.push({ type: 'damage', value: damage });
                            }
                        }
                        if (roundEffect.heal) {
                            const healAmount = effectHandlers.heal(effectiveUser, roundEffect.heal.formula);
                            if (healAmount > 0) {
                                user.currentHealth = Math.min(user.currentHealth + healAmount, user.maxHealth);
                                effectSummary.push({ type: 'heal', value: healAmount });
                            }
                        }
                        if (roundEffect.status) {
                            if (!target.activeEffects) target.activeEffects = [];
                            target.activeEffects.push({
                                type: 'status',
                                status: roundEffect.status,
                                duration: roundEffect.duration || 1
                            });
                            effectSummary.push({ type: 'status', value: roundEffect.status });
                        }
                        if (roundEffect.debuff) {
                            const debuffChanges = effectHandlers.debuff(target, roundEffect.debuff.stats);
                            if (!target.activeEffects) target.activeEffects = [];
                            target.activeEffects.push({
                                type: 'debuff',
                                stats: debuffChanges,
                                duration: roundEffect.duration || 1
                            });
                            effectSummary.push({ type: 'debuff', value: debuffChanges });
                        }
                        if (roundEffect.buff) {
                            const buffChanges = effectHandlers.buff(user, roundEffect.buff.stats);
                            if (!user.activeEffects) user.activeEffects = [];
                            user.activeEffects.push({
                                type: 'buff',
                                stats: buffChanges,
                                duration: roundEffect.duration || 1
                            });
                            effectSummary.push({ type: 'buff', value: buffChanges });
                        }
                        if (roundEffect.bleed) {
                            let bleedDamage = roundEffect.bleed.damagePerTurn;
                            if (roundEffect.bleed.damagePerTurnFormula) {
                                try {
                                    bleedDamage = Math.floor(math.evaluate(roundEffect.bleed.damagePerTurnFormula, { user: effectiveUser, target: effectiveTarget }));
                                } catch (err) {
                                    bleedDamage = 0;
                                }
                            }
                            if (!target.activeEffects) target.activeEffects = [];
                            target.activeEffects.push({
                                type: 'bleed',
                                duration: roundEffect.bleed.duration || 1,
                                damagePerTurn: bleedDamage
                            });
                            effectSummary.push({ type: 'bleed', value: bleedDamage });
                        }
                        if (roundEffect.chakra_gain) {
                            const chakraGain = effectHandlers.chakraGain(effectiveUser, roundEffect.chakra_gain.formula);
                            user.chakra = Math.min((user.chakra || 0) + chakraGain, 15);
                            effectSummary.push({ type: 'chakra_gain', value: chakraGain });
                        }

                        summariesArray.push({ desc, effects: effectSummary });
                    }
                    activeJutsus[jutsuName].round++;
                    // Remove completed jutsu
                    const maxRound = Math.max(...Object.keys(jutsu.roundEffects || {}).map(k => {
                        const parts = k.split('-');
                        return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                    }));
                    if (data.round >= maxRound) {
                        delete activeJutsus[jutsuName];
                    }
                }
            }
        };

        applyRoundBasedEffects(player1ActiveJutsus, player1, player2, player1RoundBasedSummaries);
        applyRoundBasedEffects(player2ActiveJutsus, player2, player1, player2RoundBasedSummaries);

        // --- Determine Custom Background for Battle Image ---
        let customBgUrl = null;
        const getActiveCustomBg = (activeJutsus) => {
            for (const jName in activeJutsus) {
                const jutsu = jutsuList[jName];
                if (jutsu?.custombackground && activeJutsus[jName].round >= jutsu.custombackground.round) {
                    return jutsu.custombackground.url;
                }
            }
            return null;
        };
        const p1Bg = getActiveCustomBg(player1ActiveJutsus);
        const p2Bg = getActiveCustomBg(player2ActiveJutsus);
        customBgUrl = p1Bg || p2Bg; // Player 1's background takes precedence if both apply

        // --- Player 1's Turn ---
        const { embed: embed1, components: components1 } = createMovesEmbed(player1, roundNum);
        const moveMessage1 = await battleChannel.send({
            content: `<@${player1.userId}>`,
            embeds: [embed1],
            components: components1,
            fetchReply: true
        });

        const battleImagePath = await generateBattleImage(player1, player2, customBgUrl);
        const battleImage = new AttachmentBuilder(battleImagePath);
        await battleChannel.send({ files: [battleImage] });

        const player1Action = await new Promise(resolve => {
            const collector = moveMessage1.createMessageComponentCollector({
                filter: i => i.user.id === player1.userId && i.customId.endsWith(`-${player1.userId}-${roundNum}`),
                time: 90000 // 90 seconds
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                } catch (err) {
                    console.error("Error in deferUpdate (player1):", err);
                    // Optionally reply with ephemeral error if interaction is still valid
                    try {
                        await i.reply({ content: "Your action could not be processed (expired interaction).", ephemeral: true });
                    } catch (e) {}
                }
                if (i.customId.startsWith('move')) {
                    const jutsuName = getJutsuByButton(i.customId, player1);
                    const jutsu = jutsuList[jutsuName];
                    const effective1 = getEffectiveStats(player1);
                    const effective2 = getEffectiveStats(player2);

                    // Handle round-based jutsu activation (first cast)
                    if (jutsu?.roundBased && !player1ActiveJutsus[jutsuName]) {
                        const result = executeJutsu(player1, player2, effective1, effective2, jutsuName, 1, true);
                        if (!result.hit && result.specialEffects?.includes("Not enough chakra!")) {
                            resolve(result); // Resolve with chakra error
                            collector.stop();
                            return;
                        }
                        player1ActiveJutsus[jutsuName] = { round: 1 };
                        resolve(result);
                        collector.stop();
                        return;
                    }
                    const result = executeJutsu(player1, player2, effective1, effective2, jutsuName);
                    if (player1.comboState && player1.comboState.combo.requiredJutsus.includes(jutsuName)) {
                        player1.comboState.usedJutsus.add(jutsuName);
                    }
                    resolve(result);
                } else {
                    try {
                        resolve(await processPlayerMove(i.customId, player1));
                    } catch (err) {
                        console.error("Error processing player move (player1):", err);
                        resolve({ damage: 0, heal: 0, description: "Error processing move.", hit: false });
                    }
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
                        fled: true,
                        isRest: true // Treat as rest for summary purposes if no action
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
            await battleChannel.send(`${player1.name} fled from the battle!`);
            if (battleType === 'ranked' && !isPlayer2NPC) { // Only log if PvP ranked
                try {
                    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(`[RANKED] ${player1.name} (${player1.userId}) fled from the match against ${player2.name} (${player2.userId})`);
                    }
                } catch (e) {}
                await handleMatchEnd(battleChannel, player2, player1, users, roundNum, {
                    winner: { dealt: totalDamageDealt2, taken: totalDamageTaken2 },
                    loser: { dealt: totalDamageDealt1, taken: totalDamageTaken1 }
                }, battleType); // Player 2 wins by default
            }
            break;
        }

        // --- Player 2's Turn (NPC or Player) ---
        let player2Action;
        if (isPlayer2NPC) {
            const effective1 = getEffectiveStats(player1);
            const effective2 = getEffectiveStats(player2);
            player2Action = npcChooseMove(player2, player1, effective2, effective1);
        } else {
            const { embed: embed2, components: components2 } = createMovesEmbed(player2, roundNum);
            const moveMessage2 = await battleChannel.send({
                content: `<@${player2.userId}>`,
                embeds: [embed2],
                components: components2,
                fetchReply: true
            });

            player2Action = await new Promise(resolve => {
                const collector = moveMessage2.createMessageComponentCollector({
                    filter: i => i.user.id === player2.userId && i.customId.endsWith(`-${player2.userId}-${roundNum}`),
                    time: 90000 // 90 seconds
                });

                collector.on('collect', async i => {
                    try {
                        await i.deferUpdate();
                    } catch (err) {
                        console.error("Error in deferUpdate (player2):", err);
                        try {
                            await i.reply({ content: "Your action could not be processed (expired interaction).", ephemeral: true });
                        } catch (e) {}
                    }
                    if (i.customId.startsWith('move')) {
                        const jutsuName = getJutsuByButton(i.customId, player2);
                        const jutsu = jutsuList[jutsuName];
                        const effective1 = getEffectiveStats(player1);
                        const effective2 = getEffectiveStats(player2);

                        // Handle round-based jutsu activation (first cast)
                        if (jutsu?.roundBased && !player2ActiveJutsus[jutsuName]) {
                            const result = executeJutsu(player2, player1, effective2, effective1, jutsuName, 1, true);
                            if (!result.hit && result.specialEffects?.includes("Not enough chakra!")) {
                                resolve(result); // Resolve with chakra error
                                collector.stop();
                                return;
                            }
                            player2ActiveJutsus[jutsuName] = { round: 1 };
                            resolve(result);
                            collector.stop();
                            return;
                        }
                        const result = executeJutsu(player2, player1, effective2, effective1, jutsuName);
                        if (player2.comboState && player2.comboState.combo.requiredJutsus.includes(jutsuName)) {
                            player2.comboState.usedJutsus.add(jutsuName);
                        }
                        resolve(result);
                    } else {
                        try {
                            resolve(await processPlayerMove(i.customId, player2));
                        } catch (err) {
                            console.error("Error processing player move (player2):", err);
                            resolve({ damage: 0, heal: 0, description: "Error processing move.", hit: false });
                        }
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
                            fled: true,
                            isRest: true
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
                await battleChannel.send(`${player2.name} fled from the battle!`);
                if (battleType === 'ranked' && !isPlayer2NPC) { // Only log if PvP ranked
                    try {
                        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                        if (logChannel) {
                            await logChannel.send(`[RANKED] ${player2.name} (${player2.userId}) fled from the match against ${player1.name} (${player1.userId})`);
                        }
                    } catch (e) {}
                }
                break;
            }
        }

        // --- Apply Player Actions and Update Health/Chakra ---
        // Always update currentHealth for both players/NPCs
        player2.currentHealth = Math.max(0, player2.currentHealth - (player1Action.damage || 0));
        player1.currentHealth = Math.max(0, player1.currentHealth - (player2Action.damage || 0));
        player1.currentHealth = Math.min(player1.currentHealth + (player1Action.heal || 0), player1.maxHealth);
        player2.currentHealth = Math.min(player2.currentHealth + (player2Action.heal || 0), player2.health);

        // --- Combo Logic ---
        let comboCompleted1 = false, comboDamageText1 = "";
        if (player1.comboState && player1.comboState.combo.requiredJutsus.every(jutsu => player1.comboState.usedJutsus.has(jutsu))) {
            const combo = player1.comboState.combo;
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
            
            player2.currentHealth = Math.max(0, player2.currentHealth - comboResult.damage);
            if (comboResult.heal) {
                player1.currentHealth = Math.min(player1.currentHealth + comboResult.heal, player1.maxHealth);
            }
            comboCompleted1 = true;
            comboDamageText1 = `\n${player1.name} lands a **${combo.name}**! ${comboResult.specialEffects.join(' ')}`;
            player1.comboState.usedJutsus.clear(); // Reset combo progress
            totalDamageDealt1 += comboResult.damage || 0;
        }

        let comboCompleted2 = false, comboDamageText2 = "";
        if (!isPlayer2NPC && player2.comboState && player2.comboState.combo.requiredJutsus.every(jutsu => player2.comboState.usedJutsus.has(jutsu))) {
            const combo = player2.comboState.combo;
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
            
            player1.currentHealth = Math.max(0, player1.currentHealth - comboResult.damage);
            if (comboResult.heal) {
                player2.currentHealth = Math.min(player2.currentHealth + comboResult.heal, player2.maxHealth);
            }
            comboCompleted2 = true;
            comboDamageText2 = `\n${player2.name} lands a **${combo.name}**! ${comboResult.specialEffects.join(' ')}`;
            player2.comboState.usedJutsus.clear(); // Reset combo progress
            totalDamageDealt2 += comboResult.damage || 0;
        }

        // --- Global Round Summary ---
        const summaryEmbed = createBattleSummary(
            player1Action, player2Action, player1, player2, roundNum,
            comboCompleted1, comboDamageText1, comboCompleted2, comboDamageText2,
            player1RoundBasedSummaries, player2RoundBasedSummaries
        );
        await battleChannel.send({ embeds: [summaryEmbed] });

        if (player1.currentHealth <= 0 || player2.currentHealth <= 0) {
            battleActive = false;
            let winner = null;
            let loser = null;
            
            if (player1.currentHealth > 0 && player2.currentHealth <= 0) {
                winner = player1;
                loser = player2;
                // Send the same reward embed and drop message as in brankCommand
               if (battleType === 'brank') {
                    const expReward = math.random(5.0, 8.0);
                    const moneyReward = 500 + Math.floor((player1.level || 1) * 20);

                    // Update user data
                    player1.exp = (player1.exp || 0) + expReward;
                    player1.money = (player1.money || 0) + moneyReward;
                    player1.wins = (player1.wins || 0) + 1;
                    player1.mentorExp = (player1.mentorExp || 0) + 1;
                    player1.brankWon = true;
                    // Restore health after battle
                    player1.health = player1.maxHealth || player1.health;
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                    // Material drop logic (copied from brank.js)
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
                    if (player1.occupation === "Akatsuki") {
                        let akatsukiRole = player1.role || "";
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
                            `<@${player1.userId}> has earned ${expReward.toFixed(1)} exp!\n<@${player1.userId}> has earned $${moneyReward}!`
                        )
                        .setColor('#006400');

                    await battleChannel.send({ embeds: [rewardEmbed], content: dropMsg });
                }
                
                if (battleType === 'trials') battleResult = 'win';
            } else if (player2.currentHealth > 0 && player1.currentHealth <= 0) {
                winner = player2;
                loser = player1;
                await battleChannel.send(`**${winner.name}** has defeated **${loser.name}**!`);
                if (battleType === 'trials') battleResult = 'lose';
            } else {
                await battleChannel.send(`It's a draw!`);
                if (battleType === 'trials') battleResult = 'lose';
                break;
            }
        

            // Handle match end (ELO, summaries, channel cleanup)
            await handleMatchEnd(battleChannel, winner, loser, users, roundNum, {
                winner: {
                    dealt: winner.userId === player1.userId ? totalDamageDealt1 : totalDamageDealt2,
                    taken: winner.userId === player1.userId ? totalDamageTaken1 : totalDamageTaken2
                },
                loser: {
                    dealt: loser.userId === player1.userId ? totalDamageDealt1 : totalDamageDealt2,
                    taken: loser.userId === player1.userId ? totalDamageTaken1 : totalDamageTaken2
                }
            }, battleType);
            break;
        }
        }

        // --- Passive Chakra Regen ---
        player1.chakra = Math.min(player1.chakra + 2);
        player2.chakra = Math.min(player2.chakra + 2);
    // Auto-delete channel after a delay for ranked battles
    if (battleType === 'ranked') {
        setTimeout(async () => {
            try {
                await battleChannel.delete("Ranked match ended (auto-cleanup)");
            } catch (e) {
                console.error("Failed to delete ranked channel:", e);
            }
        }, 15000); // 15 seconds delay
    }
    // For trials, return the result so the trialsCommand can check win/lose
    if (battleType === 'trials') {
        return battleResult;
    }
}


/**
 * Handles the end of a battle, including ELO updates and sending summaries.
 * @param {object} channel - The Discord channel where the battle took place.
 * @param {object} winner - The winner's battle object.
 * @param {object} loser - The loser's battle object.
 * @param {object} usersData - The full users data object.
 * @param {number} roundNum - The number of rounds played.
 * @param {object} damageStats - Object containing total damage dealt/taken for winner and loser.
 * @param {string} battleType - The type of battle (e.g., 'ranked', 'brank', 'fight').
 */
async function handleMatchEnd(channel, winner, loser, usersData, roundNum = 0, damageStats = { winner: {}, loser: {} }, battleType) {
    const client = channel.client; // Get client from channel

    const isWinnerNPC = winner.userId.startsWith("NPC_");
    const isLoserNPC = loser.userId.startsWith("NPC_");

    let eloUpdate = { winnerChange: 0, loserChange: 0, winnerNew: {}, loserNew: {} };

    // Only update ELO for real users in ranked battles
    if (battleType === 'ranked') {
        if (!isWinnerNPC && !isLoserNPC) { // User vs User ranked
            eloUpdate = updateElo(winner.userId, loser.userId, false);
        } else if (!isWinnerNPC && isLoserNPC) { // User vs NPC ranked (winner is user)
            eloUpdate = updateElo(winner.userId, loser.userId, true); // isNpcMatch = true
        } else if (isWinnerNPC && !isLoserNPC) { // NPC vs User ranked (winner is NPC, loser is user)
            eloUpdate = updateElo(loser.userId, winner.userId, true); // Loser is user, update their ELO based on loss to NPC
        }
    }

    // Update users.json for real users
    if (!isWinnerNPC) {
        const winnerUserInDb = usersData[winner.userId];
        if (winnerUserInDb) {
            winnerUserInDb.elo = (winnerUserInDb.elo || 0) + eloUpdate.winnerChange;
            winnerUserInDb.rank = getTierAndDivision(winnerUserInDb.elo).rank;
        }
    }
    if (!isLoserNPC) {
        const loserUserInDb = usersData[loser.userId];
        if (loserUserInDb) {
            loserUserInDb.elo = Math.max(0, (loserUserInDb.elo || 0) - eloUpdate.loserChange);
            loserUserInDb.rank = getTierAndDivision(loserUserInDb.elo).rank;
        }
    }
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));

    // Prepare stats for summary embeds
    const winnerStats = {
        power: winner.power || 0, defense: winner.defense || 0,
        health: winner.health || 0, chakra: winner.chakra || 0,
        accuracy: winner.accuracy || 0, dodge: winner.dodge || 0,
        elo: (isWinnerNPC ? "N/A" : usersData[winner.userId]?.elo || 0),
        rank: (isWinnerNPC ? "NPC" : usersData[winner.userId]?.rank || "Genin")
    };
    const loserStats = {
        power: loser.power || 0, defense: loser.defense || 0,
        health: loser.health || 0, chakra: loser.chakra || 0,
        accuracy: loser.accuracy || 0, dodge: loser.dodge || 0,
        elo: (isLoserNPC ? "N/A" : usersData[loser.userId]?.elo || 0),
        rank: (isLoserNPC ? "NPC" : usersData[loser.userId]?.rank || "Genin")
    };

    const winnerDamageDealt = damageStats?.winner?.dealt ?? "N/A";
    const winnerDamageTaken = damageStats?.winner?.taken ?? "N/A";
    const loserDamageDealt = damageStats?.loser?.dealt ?? "N/A";
    const loserDamageTaken = damageStats?.loser?.taken ?? "N/A";

    let winnerImagePath = null;
    let loserImagePath = null;

    // Only generate and send winner/loser embeds for ranked battles
    if (battleType === 'ranked') {
        if (!isWinnerNPC) {
            winnerImagePath = await generateEloImage(winner, (usersData[winner.userId]?.elo || 0) - eloUpdate.winnerChange, usersData[winner.userId]?.elo || 0, true);
        }
        if (!isLoserNPC) {
            loserImagePath = await generateEloImage(loser, (usersData[loser.userId]?.elo || 0) + eloUpdate.loserChange, usersData[loser.userId]?.elo || 0, false);
        }

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
            .setFooter({ text: "Congratulations on your victory!" });
        
        if (winnerImagePath) {
            winnerEmbed.setImage(`attachment://winner_elo.png`);
        }

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
            .setFooter({ text: "Better luck next time!" });

        if (loserImagePath) {
            loserEmbed.setImage(`attachment://loser_elo.png`);
        }

        // Send to summary channel (or battle channel if summary channel not found)
        let summaryChannel;
        try {
            summaryChannel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
        } catch (e) {
            summaryChannel = channel;
        }

        if (!isWinnerNPC) {
            await summaryChannel.send({
                content: `🏆 <@${winner.userId}>`,
                embeds: [winnerEmbed],
                files: winnerImagePath ? [{ attachment: winnerImagePath, name: "winner_elo.png" }] : []
            });
        } else {
            // If NPC won, send a simpler message to the battle channel
            await channel.send(`The NPC ${winner.name} was victorious!`);
        }

        if (!isLoserNPC) {
            await summaryChannel.send({
                content: `💔 <@${loser.userId}>`,
                embeds: [loserEmbed],
                files: loserImagePath ? [{ attachment: loserImagePath, name: "loser_elo.png" }] : []
            });
        }
    } else {
        // For non-ranked battles, only send simple win/lose messages (already handled in runBattle)
        // Do not send winner/loser summary embeds
    }


}

/**
 * NPC AI for choosing a move.
 * @param {object} baseNpc - The NPC object.
 * @param {object} basePlayer - The player object.
 * @param {object} effectiveNpc - The NPC's effective stats.
 * @param {object} effectivePlayer - The player's effective stats.
 * @returns {object} The chosen action result.
 */
function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer) {
    // Check for stun/flinch/other status effects that prevent action
    const statusEffect = (baseNpc.activeEffects || []).find(e =>
        e.type === 'status' && ['stun', 'flinch', 'drown'].includes(e.status)
    );
    if (statusEffect) {
        let statusMsg = "";
        switch (statusEffect.status) {
            case 'stun':
                statusMsg = `${baseNpc.name} is stunned and can't move!`;
                break;
            case 'flinch':
                statusMsg = `${baseNpc.name} flinched and couldn't act!`;
                break;
            case 'drown':
                statusMsg = `${baseNpc.name} is drowning and can't act!`;
                break;
            default:
                statusMsg = `${baseNpc.name} is confused!`;
        }
        // Mark the action as a status effect for summary display
        return {
            damage: 0,
            heal: 0,
            description: statusMsg,
            specialEffects: [statusEffect.status.charAt(0).toUpperCase() + statusEffect.status.slice(1) + " active"],
            hit: false,
            opponentIsStunned: true,
            isStatusEffect: true, // <-- Add this flag for summary
            jutsuUsed: null // So summary doesn't try to look up a jutsu
        };
    }
    

    // Bleed/poison/dot effects are handled in the round summary, not as a move

    // Flying Raijin patch: If player has flying_raijin, set npc accuracy to 0 for this attack
    let originalAccuracy = baseNpc.accuracy;
    let flyingRaijinIdx = (basePlayer.activeEffects || []).findIndex(e => e.type === 'status' && e.status === 'flying_raijin');
    let usedFlyingRaijin = false;
    if (flyingRaijinIdx !== -1) {
        baseNpc.accuracy = 0;
        usedFlyingRaijin = true;
    }

    // Always use jutsuList for NPC jutsu, just like users
    // NPC jutsu is an object: {0: "Attack", 1: "Substitution Jutsu", ...}
    // But sometimes it's an array, so normalize
    let npcJutsuArr = [];
    if (Array.isArray(baseNpc.jutsu)) {
        npcJutsuArr = baseNpc.jutsu;
    } else if (typeof baseNpc.jutsu === "object" && baseNpc.jutsu !== null) {
        npcJutsuArr = Object.values(baseNpc.jutsu);
    }

    // Filter available jutsu based on chakra
    const availableJutsuNames = npcJutsuArr.filter(jName => {
        const jutsu = jutsuList[jName];
        return jutsu && (jutsu.chakraCost || 0) <= (baseNpc.chakra || 0);
    });

    if (availableJutsuNames.length === 0) {
        baseNpc.chakra = Math.min((baseNpc.chakra || 0) + 1, 15);
        return {
            damage: 0,
            heal: 0,
            description: `${baseNpc.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }

    // Pick a random jutsu from available
    const randomJutsuName = availableJutsuNames[Math.floor(Math.random() * availableJutsuNames.length)];
    // Use executeJutsu just like for users
    const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsuName);

    // Restore accuracy after attack if Flying Raijin was used
    if (usedFlyingRaijin) {
        baseNpc.accuracy = originalAccuracy;
        // Remove the flying_raijin status so it only works for one attack
        (basePlayer.activeEffects || []).splice(flyingRaijinIdx, 1);
    }

    result.jutsuUsed = randomJutsuName;
    return result;}
    

    



// =======================================================================================
// COMMANDS IMPLEMENTATION (Using global models and battle logic)
// =======================================================================================

// --- brank: Single NPC fight ---
async function brankCommand(interaction) {
    const userId = interaction.user.id;
    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    if (!users[userId]) {
        return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    const npcId = "NPC_Bandit";
    // Run the battle and wait for it to finish
    await runBattle(interaction, userId, npcId, 'brank');

    // After battle, reload user and NPC data to check outcome
    const usersAfter = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    const player = usersAfter[userId];
    // Find the Bandit NPC definition
    const banditNpc = BRANK_NPCS[0];

    // If player won (player health > 0 and NPC health <= 0)
    if (player && player.health > 0) {
        // --- COOLDOWN SYSTEM (from brank.js) ---
        const now = Date.now();
        // Premium cooldown roles
        const JINCHURIKI_ROLE = "1385641469507010640";
        const LEGENDARY_ROLE = "1385640798581952714";
        const DONATOR_ROLE = "1385640728130097182";
        let cooldownMs = 12 * 60 * 1000; // default 12 min

        // Check premium roles (jinchuriki > legendary > donator)
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 5.5 * 60 * 1000; // 5 min 30 sec
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(7 * 60 * 1000); // 7 min
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(8 * 60 * 1000); // 8 min
        }
        player.lastbrank = now;
        fs.writeFileSync(usersPath, JSON.stringify(usersAfter, null, 2));

        const expReward = math.random(5.0, 8.0);
        const moneyReward = 500 + Math.floor((player.level || 1) * 20);

        // Update user data
        player.exp = (player.exp || 0) + expReward;
        player.money = (player.money || 0) + moneyReward;
        player.wins = (player.wins || 0) + 1;
        player.mentorExp = (player.mentorExp || 0) + 1;
        player.brankWon = true;
        // Restore health after battle
        player.health = player.maxHealth || player.health;
        fs.writeFileSync(usersPath, JSON.stringify(usersAfter, null, 2));

        // Material drop logic (copied from brank.js)
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

        // Reward embed
        const rewardEmbed = new EmbedBuilder()
            .setTitle(`Battle End! ${player.name} has won!`)
            .setDescription(
                `<@${userId}> has earned ${expReward.toFixed(1)} exp!\n<@${userId}> has earned $${moneyReward}!`
            )
            .setColor('#006400');

        await interaction.followUp({ embeds: [rewardEmbed], content: dropMsg });
    }
}
// --- arank: Multiple NPC fight (50 battles, rewards, and bonus logic) ---
async function arankCommand(interaction) {
    const userId = interaction.user.id;
    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    if (!users[userId]) {
        return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    // --- COOLDOWN LOGIC (match arank.js) ---
    const now = Date.now();
    let cooldownMs = 20 * 60 * 1000; // default 20 min
    const memberRoles = interaction.member.roles.cache;
    if (memberRoles.has(JINCHURIKI_ROLE)) {
        cooldownMs = 12 * 60 * 1000;
    } else if (memberRoles.has(LEGENDARY_ROLE)) {
        cooldownMs = Math.round(12 * 60 * 1000 * 1.1); // 13.2 min
    } else if (memberRoles.has(DONATOR_ROLE)) {
        cooldownMs = Math.round(12 * 60 * 1000 * 1.1 * 1.1); // 14.52 min
    }
    if (users[userId].lastArank && now - users[userId].lastArank < cooldownMs) {
        const left = cooldownMs - (now - users[userId].lastArank);
        const min = Math.floor(left / 60000);
        const sec = Math.floor((left % 60000) / 1000);
        return interaction.editReply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: false });
    }
    users[userId].lastArank = now;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // --- 50 ENEMY LOOP ---
    let totalEnemiesDefeated = 0;
    let playerLost = false;
    let player = { ...users[userId] };
    player.currentHealth = player.health;
    player.chakra = player.chakra || 10;
    player.activeEffects = [];
    player.accuracy = 100;
    player.dodge = 0;
    player.jutsu = users[userId].jutsu || {};

    // Combo tracking state
    let comboState = null;
    if (player.Combo && comboList[player.Combo]) {
        comboState = {
            combo: comboList[player.Combo],
            usedJutsus: new Set()
        };
        player.comboState = comboState;
    }

    // Chakra regen rates per rank
    const CHAKRA_REGEN = {
        'Academy Student': 1,
        'Genin': 2,
        'Chunin': 2,
        'Jounin': 2
    };

    // Reward calculation (from arank.js)
    function calculateRewards(totalEnemiesDefeated, player) {
        const baseExp = 0.2;
        const baseMoney = 200 + Math.floor((player.level || 1) * 5);
        if ((totalEnemiesDefeated + 1) % 5 === 0) {
            let bonusExp = Math.max(2 * (player.level || 1), baseExp);
            let bonusMoney = baseMoney;
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
    }

    // Material drop logic (from arank.js)
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

    // --- 50 ENEMY LOOP ---
    while (totalEnemiesDefeated < 50 && !playerLost) {
        // Pick a random A-Rank NPC from ARANK_NPCS
        const randomNpc = ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
        const npcId = `NPC_${randomNpc.name}`;

        // Reset NPC stats for each fight
        let npc = {
            ...randomNpc,
            userId: npcId,
            name: randomNpc.name,
            currentHealth: randomNpc.health,
            chakra: 10,
            activeEffects: [],
            jutsu: Object.fromEntries(randomNpc.jutsu.map((j, i) => [i, j]))
        };

        // Reset player effects for each fight (but keep health/chakra as is)
        player.activeEffects = [];
        player.comboState = comboState;

        // Run the battle (single fight)
        await runBattle(interaction, userId, npcId, 'arank');

        // Reload player stats after battle (in case they changed)
        const usersAfter = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        player = { ...usersAfter[userId], currentHealth: usersAfter[userId].health, chakra: usersAfter[userId].chakra || 10, activeEffects: [], jutsu: usersAfter[userId].jutsu || {} };
        player.comboState = comboState;

        // Check if player lost (health <= 0)
        if (player.currentHealth <= 0 || player.health <= 0) {
            playerLost = true;
            await interaction.followUp(`**Defeat!** You were defeated by ${npc.name} after defeating ${totalEnemiesDefeated} enemies.`);
            break;
        }

        // Player won this round
        totalEnemiesDefeated++;

        // --- REWARDS ---
        const rewards = calculateRewards(totalEnemiesDefeated - 1, player);
        usersAfter[userId].exp = (usersAfter[userId].exp || 0) + rewards.exp;
        usersAfter[userId].money = (usersAfter[userId].money || 0) + rewards.money;
        usersAfter[userId].wins = (usersAfter[userId].wins || 0) + 1;
        usersAfter[userId].health = player.health;
        fs.writeFileSync(usersPath, JSON.stringify(usersAfter, null, 2));

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
                .setTitle(`Battle End!`)
                .setDescription(
                    `**JACKPOT REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nYou've completed 50 enemies in this mission!`
                )
                .setColor('#FFD700');
        } else if (rewards.isBonus) {
            rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End!!`)
                .setDescription(
                    `**BONUS REWARD!**\n<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}`
                )
                .setColor('#00BFFF');
        } else {
            rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End!`)
                .setDescription(
                    `<@${userId}> has earned ${rewards.exp} exp!\n<@${userId}> has earned $${rewards.money}!\nEnemies Defeated: ${totalEnemiesDefeated}`
                )
                .setColor('#006400');
        }

        await interaction.followUp({
            embeds: [rewardEmbed],
            content: dropMsg
        });

        // Ask if player wants to continue (unless it's the last enemy)
        if (totalEnemiesDefeated < 50) {
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
                await interaction.followUp("Mission ended by player.");
                break;
            }
        }
    }

    // Final summary if player survived all 50
    if (!playerLost && totalEnemiesDefeated >= 50) {
        await interaction.followUp(`**Congratulations!** You have successfully completed all 50 A-Rank battles!`);
    }
}

 
   

// --- Hokage Trials Data ---
const HOKAGE_TRIALS = [
    {
        name: "Kakashi Hatake",
        image: "https://www.pngplay.com/wp-content/uploads/12/Kakashi-Hatake-Transparent-Background.png",
        baseHealth: 3,
        basePower: 2.1,
        baseDefense: 1.5,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Lightning Blade", "Summon Ninken"],
        combos: ["Lightning Hound Combo"],
        dropJutsu: "One Thousand Years of Death"
    },
    {
        name: "Tsunade",
        image: "https://static.wikia.nocookie.net/all-worlds-alliance/images/5/5a/8-83829_senju-tsunade-random-pinterest-boruto-and-naruto-png.png/revision/latest?cb=20190502024736",
        baseHealth: 4,
        basePower: 3,
        baseDefense: 4,
        accuracy: 90,
        dodge: 15,
        jutsu: ["Attack", "Cherry Blossom Impact", "Creation Rebirth"],
        combos: ["Genesis Combo"],
        dropJutsu: "Creation Rebirth"
    },
    {
        name: "Hiruzen Sarutobi",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hiruzen-Sarutobi-PNG-Photos.png",
        baseHealth: 6,
        basePower: 3,
        baseDefense: 8,
        accuracy: 92,
        dodge: 20,
        jutsu: ["Attack", "Fireball Jutsu", "Burning Ash"],
        combos: ["Flame Reaper Combo"],
        dropJutsu: "Burning Ash"
    },
    {
        name: "Tobirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Tobirama-Senju-PNG-Pic-Background.png",
        baseHealth: 5,
        basePower: 10,
        baseDefense: 11,
        accuracy: 97,
        dodge: 30,
        jutsu: ["Attack", "Water Dragon Jutsu", "Shadow Clone Jutsu"],
        combos: ["Water Clone Combo"],
        dropJutsu: "Water Dragon Jutsu"
    },
    {
        name: "Minato Namikaze",
        image: "https://www.pngplay.com/wp-content/uploads/12/Minato-Namikaze-Transparent-Free-PNG.png",
        baseHealth: 6,
        basePower: 8,
        baseDefense: 12,
        accuracy: 100,
        dodge: 40,
        jutsu: ["Attack", "Rasengan", "Flying Raijin Jutsu"],
        combos: ["Flash Combo"],
        dropJutsu: "Flying Raijin Jutsu"
    },
    {
        name: "Hashirama Senju",
        image: "https://www.pngplay.com/wp-content/uploads/12/Hashirama-Senju-No-Background.png",
        baseHealth: 10,
        basePower: 3,
        baseDefense: 8,
        accuracy: 95,
        dodge: 25,
        jutsu: ["Attack", "Creation Rebirth", "Great Forest Crumbling"],
        combos: ["Forest Genesis Combo"],
        dropJutsu: "Great Forest Crumbling"
    },
    {
        name: "Naruto Uzumaki",
        image: "https://pngimg.com/d/naruto_PNG18.png",
        baseHealth: 8,
        basePower: 13,
        baseDefense: 9,
        accuracy: 98,
        dodge: 35,
        jutsu: ["Attack", "Shadow Clone Jutsu", "Rasenshuriken"],
        combos: ["Ultimate Combo"],
        dropJutsu: "Rasenshuriken"
    }
];
// --- trials: Hokage trials ---
async function trialsCommand(interaction) {
    const userId = interaction.user.id;
    const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    if (!users[userId]) {
        return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    // --- Trials cooldown (LastTrials, 20 minutes) ---
    const now = Date.now();

    // --- PREMIUM COOLDOWN PATCH ---
    // Role IDs (these would typically be fetched from your Discord server config)
    const JINCHURIKI_ROLE = "1385641469507010640"; // Example ID
    const LEGENDARY_ROLE = "1385640798581952714"; // Example ID
    const DONATOR_ROLE = "1385640728130097182";  // Example ID
    let cooldownMs = 25 * 60 * 1000; // default 25 min

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
        return interaction.editReply({ content: `You can do this again in ${min}m ${sec}s.`, ephemeral: false });
    }
    
    // Always start the trials from the beginning
    let currentTrialIndex = 0;
    let userLostTrial = false;

    // Loop through Hokage trials
    while (currentTrialIndex < HOKAGE_TRIALS.length && !userLostTrial) {
        const npcTemplate = HOKAGE_TRIALS[currentTrialIndex];
        const npcId = `NPC_${npcTemplate.name}`; // Unique ID for trial NPCs

        await interaction.followUp({ content: `**Trial Battle ${currentTrialIndex + 1}/${HOKAGE_TRIALS.length} Started!**\nYou are facing **${npcTemplate.name}**!` });
        // Pass npcTemplate to runBattle so the correct Hokage NPC is used
        const battleResult = await runBattle(interaction, userId, npcId, 'trials', npcTemplate);

        if (battleResult === 'win') {
            // Player won this trial
            const expReward = 0.2;
            const moneyReward = 10000;
            
            users[userId].exp = (users[userId].exp || 0) + expReward;
            users[userId].money = (users[userId].money || 0) + moneyReward;
            users[userId].wins = (users[userId].wins || 0) + 1;

            const rewardEmbed = new EmbedBuilder()
                .setTitle(`Trial ${currentTrialIndex + 1} Cleared!`)
                .setDescription(
                    `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!`
                )
                .setColor('#006400');
            await interaction.followUp({ embeds: [rewardEmbed] });

            // Handle Jutsu Drop
            const dropJutsu = npcTemplate.dropJutsu;
            if (dropJutsu) {
                const userJutsuInventoryPath = path.resolve(__dirname, '../../menma/data/userJutsuInventory.json');
                let userJutsuData = fs.existsSync(userJutsuInventoryPath) ? JSON.parse(fs.readFileSync(userJutsuInventoryPath, 'utf8')) : {};
                if (!userJutsuData[userId]) userJutsuData[userId] = { usersjutsu: [] };
                if (!Array.isArray(userJutsuData[userId].usersjutsu)) userJutsuData[userId].usersjutsu = [];

                if (!userJutsuData[userId].usersjutsu.includes(dropJutsu)) {
                    userJutsuData[userId].usersjutsu.push(dropJutsu);
                    fs.writeFileSync(userJutsuInventoryPath, JSON.stringify(userJutsuData, null, 2));
                    await interaction.followUp({ content: ` You obtained a new jutsu: **${dropJutsu}**!` });
                } else {
                    await interaction.followUp({ content: `You already know **${dropJutsu}**!` });
                }
            }
            
            // Move to the next trial
            currentTrialIndex++; 
            
        } else { // Battle result is 'lose' or player fled
            userLostTrial = true;
            users[userId].losses = (users[userId].losses || 0) + 1;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await interaction.followUp(`**Trial Failed!** You were defeated by ${npcTemplate.name}.`);
            break; // Exit the trial loop
        }
    }

    // Final summary after all trials or early exit
    users[userId].LastTrials = now; // Update cooldown after the entire trial sequence
    if (!userLostTrial && currentTrialIndex >= HOKAGE_TRIALS.length) {
        await interaction.followUp(`**Congratulations!** You have successfully completed all Hokage Trials!`);
        users[userId].trialsResult = "win"; // For tutorial tracking
    } else if (userLostTrial) {
        users[userId].trialsResult = "lose"; // For tutorial tracking
    }
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}


const rankedNPCs = [
    {
        name: "Kakashi",
        image: "https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png/revision/latest/scale-to-width-down/300?cb=20230803224121", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.5,
        accuracy: 90,
        dodge: 20,
        jutsu: ["Attack", "Lightning Blade", "One Thousand Years of Death"]
    },
    {
        name: "Guy",
        image: "https://static.wikia.nocookie.net/naruto/images/3/31/Might_Guy.png/revision/latest/scale-to-width-down/300?cb=20150401084456", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.5,
        accuracy: 85,
        dodge: 15,
        jutsu: ["Attack", "Dynamic Entry"]
    },
    {
        name: "Asuma",
        image: "https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.5,
        accuracy: 85,
        dodge: 15,
        jutsu: ["Attack", "Burning Ash"]
    },
    {
        name: "Kurenai",
        image: "https://static.wikia.nocookie.net/naruto/images/6/67/Kurenai_Part_I.png/revision/latest?cb=20150207094753", // Replace with actual image URL
        basePower: 1.25,
        baseDefense: 1.25,
        baseHealth: 1.5,
        accuracy: 90,
        dodge: 25,
        jutsu: ["Attack", "Rasengan"]
    }
];


async function rankedCommand(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const userId = interaction.user.id;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    if (!users[userId]) {
        return interaction.editReply({ content: "You need to enroll first!", ephemeral: true });
    }
    
    const opt = interaction.options.getString('option');
    if (opt === 'rewards') {
        return await handleRankedRewards(interaction);
    }

    const mode = 'standard';

    // Check if already in queue
    if (rankedQueue[mode].has(userId)) {
        return interaction.editReply({ content: "You're already in the ranked queue!", ephemeral: true });
    }

    // Check if already in a match (prevent joining queue if in active battle channel)
    const activeMatch = Array.from(rankedQueue.matches.values()).find(
        match => match.player1 === userId || match.player2 === userId
    );
    if (activeMatch) {
        return interaction.editReply({ content: `You're already in a ranked match in <#${activeMatch.channelId}>!`, ephemeral: true });
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

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ranked_cancel_queue')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
    const message = await interaction.fetchReply();

    let matched = false;
    const filter = i => i.customId === 'ranked_cancel_queue' && i.user.id === userId;
    const collector = message.createMessageComponentCollector({ filter, time: 60000 }); // Use message collector

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
        await i.update({ content: "You have left the ranked queue.", embeds: [], components: [] });
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
            await runBattle(interaction, userId, opponentId, 'ranked');
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
        await runBattle(interaction, userId, npcId, 'ranked');
    }
}

/**
 * Handles the ranked rewards display and claiming.
 * @param {object} interaction - The Discord interaction.
 */
async function handleRankedRewards(interaction) {
    const userId = interaction.user.id;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const user = users[userId];

    if (!user || typeof user.elo !== "number") {
        return interaction.reply({ content: "You haven't played ranked yet!", ephemeral: true });
    }
    
    const userElo = user.elo || 0;
    const userRankObj = getTierAndDivision(userElo);
    const userRank = userRankObj.rank;
    const userDiv = userRankObj.division;

    let nextReward = null;
    let claimable = null;
    
    for (const reward of rankedRewards) {
        if (reward.elo > userElo && (!nextReward || reward.elo < nextReward.elo)) {
            nextReward = reward;
        }
        
        // Check if reward is claimable and not already claimed
        if (reward.elo <= userElo && !(user.claimedRewards || []).includes(reward.elo)) {
            if (!claimable || reward.elo > claimable.elo) { // Get the highest claimable reward
                claimable = reward;
            }
        }
    }

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
    const replyMessage = await interaction.followUp({
        content: '',
        files: [{ attachment: imagePath, name: "rewards.png" }],
        components: row ? [row] : []
    });

    if (claimable) {
        const filter = i => i.customId === 'ranked_claim' && i.user.id === userId;
        const collector = replyMessage.createMessageComponentCollector({ filter, time: 60000, max: 1 });
        
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

            const updatedUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!updatedUsers[userId].claimedRewards) updatedUsers[userId].claimedRewards = [];
            updatedUsers[userId].claimedRewards.push(claimable.elo);
            fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2));

            await i.reply({ content: `Reward sent to your gift inventory! Use /gift inventory to claim it.`, ephemeral: true });
            // Disable the button after claiming
            await replyMessage.edit({
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ranked_claim')
                            .setLabel('Claimed!')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    )
                ]
            }).catch(console.error);
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && replyMessage && replyMessage.editable) {
                await replyMessage.edit({
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('ranked_claim')
                                .setLabel('Claim (Expired)')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        )
                    ]
                }).catch(console.error);
            }
        });
    }
}

// --- fight: User vs user challenge and battle ---
const fightInvites = new Map();
async function fightCommand(interaction) {
    const userId = interaction.user.id;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    if (!users[userId]) {
        return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
    }
    
    const opponent = interaction.options.getUser('user');
    if (!opponent || opponent.id === userId) {
        return interaction.reply({ content: "You must mention a valid user to challenge.", ephemeral: true });
    }
    if (!users[opponent.id]) {
        return interaction.reply({ content: "The challenged user must be enrolled.", ephemeral: true });
    }

    // Create fight invitation
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle(' Fight Invitation!')
        .setDescription(`<@${opponent.id}>, do you accept <@${userId}>'s challenge?`)
        .setFooter({ text: 'You have 60 seconds to respond' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('accept_fight')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline_fight')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

    const response = await interaction.reply({ 
        content: `<@${opponent.id}>`,
        embeds: [embed], 
        components: [row],
        fetchReply: true 
    });

    const filter = i => (i.customId === 'accept_fight' || i.customId === 'decline_fight') && i.user.id === opponent.id;
    const collector = response.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        await i.deferUpdate();
        if (i.customId === 'accept_fight') {
            await response.edit({ content: "Fight accepted! Starting battle...", components: [] });
            await runBattle(interaction, userId, opponent.id, 'fight');
        } else {
            await response.edit({ content: "Fight declined.", components: [] });
        }
        collector.stop();
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            response.edit({ content: "Fight invitation expired.", components: [] });
        }
    });
}
// --- PERIODIC QUEUE CHECK (from ranked.js) ---
// This ensures that queued players are matched with NPCs if no other player is found.
// It needs the Discord client instance to fetch channels.
if (!global.__rankedQueueIntervalStarted) {
    global.__rankedQueueIntervalStarted = true;
    setInterval(() => {
        // This assumes `global.client` is available. In a real Discord bot, you'd pass the client
        // instance to this module or have a way to access it.
        // For this context, we'll assume `global.client` is set up in the main bot file.
        checkQueue(global.client, 'standard');
    }, 10000); // Check every 10 seconds
}

/**
 * Checks the ranked queue for matches and timeouts.
 * @param {object} client - The Discord client instance.
 * @param {string} mode - The queue mode (e.g., 'standard').
 */
async function checkQueue(client, mode = 'standard') {
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
        if (!rankedQueue[mode].has(userId)) continue; // Already removed by a match

        rankedQueue[mode].delete(userId);

        // Select random NPC
        const npc = rankedNPCs[Math.floor(Math.random() * rankedNPCs.length)];
        const npcId = `NPC_${npc.name}`;

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(`[RANKED] Matching ${userId} with NPC ${npc.name} after queue timeout.`);
            }
        } catch (e) {}
        
        // Load the user's data to base the NPC stats on
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user) {
            console.error(`User data not found for ${userId}. Cannot start battle.`);
            continue;
        }

        // --- Create a more robust dummy interaction object for `runBattle` ---
        const dummyInteraction = {
            client: client,
            user: await client.users.fetch(userId),
            guild: await client.guilds.fetch(SERVER_ID),
            // Mock the reply methods to avoid crashes, returning a mock message object
            deferReply: async () => ({}),
            editReply: async () => ({}),
            fetchReply: async () => ({}),
            followUp: async (content) => {
                const channel = await dummyInteraction.guild.channels.create({
                    name: `ranked-${dummyInteraction.user.username.toLowerCase()}`,
                    type: 0, // Text channel
                    permissionOverwrites: [{
                        id: dummyInteraction.guild.id,
                        deny: ['ViewChannel']
                    }]
                });
                return channel.send(content);
            },
            options: { getSubcommand: () => 'ranked' }
        };

        // --- Use a try...catch block to prevent terminal crashes ---
        try {
            console.log(`Attempting to start battle for timed-out user: ${userId}`);
            await runBattle(dummyInteraction, userId, npcId, 'ranked');
        } catch (error) {
            console.error(`[CRITICAL] Failed to start battle for user ${userId} and NPC ${npcId}:`, error);
        }
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
                await logChannel.send(`[RANKED] Match found: <@${player1}> vs <@${player2}>.`);
            }
        } catch (e) {}

        // --- Create a more robust dummy interaction object for `runBattle` ---
        const dummyInteraction = {
            client: client,
            user: await client.users.fetch(player1),
            guild: await client.guilds.fetch(SERVER_ID),
            deferReply: async () => ({}),
            editReply: async () => ({}),
            fetchReply: async () => ({}),
            followUp: async (content) => {
                 const channel = await dummyInteraction.guild.channels.create({
                    name: `ranked-${dummyInteraction.user.username.toLowerCase()}-vs-${player2.name.toLowerCase()}`,
                    type: 0, // Text channel
                    permissionOverwrites: [{
                        id: dummyInteraction.guild.id,
                        deny: ['ViewChannel']
                    }]
                });
                return channel.send(content);
            },
            options: { getSubcommand: () => 'ranked' }
        };
        
        // --- Use a try...catch block to prevent terminal crashes ---
        try {
            console.log(`Attempting to start battle between users: ${player1} and ${player2}`);
            await runBattle(dummyInteraction, player1, player2, 'ranked');
        } catch (error) {
            console.error(`[CRITICAL] Failed to start battle between ${player1} and ${player2}:`, error);
        }
    }
}


// =======================================================================================
// SLASH COMMAND BUILDER
// =======================================================================================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('mission')
        .setDescription('All battle commands combined')
        .addSubcommand(sub =>
            sub.setName('brank').setDescription('Single NPC battle')
        )
        .addSubcommand(sub =>
            sub.setName('arank').setDescription('Multiple NPC battle')
        )
        .addSubcommand(sub =>
            sub.setName('trials').setDescription('Hokage trials')
        )
        .addSubcommand(sub =>
            sub.setName('ranked')
                .setDescription('Ranked queue and rewards')
                .addStringOption(option =>
                    option.setName('option')
                        .setDescription('Show rewards or join ranked queue')
                        .addChoices(
                            { name: 'rewards', value: 'rewards' }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('fight')
                .setDescription('User vs user battle')
                .addUserOption(opt => opt.setName('user').setDescription('User to challenge').setRequired(true))
        ),

    async execute(interaction) {
        // Ensure command is used in the main server for ranked functionality
        if (interaction.options.getSubcommand() === 'ranked' && interaction.guild.id !== SERVER_ID) {
            return interaction.reply({ content: 'The ranked command can only be used in the main server.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case 'brank':
                return await brankCommand(interaction);
            case 'arank':
                return await arankCommand(interaction);
            case 'trials':
                return await trialsCommand(interaction);
            case 'ranked':
                return await rankedCommand(interaction);
            case 'fight':
                return await fightCommand(interaction);
            default:
                return interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
        }
    },
    // Export checkQueue for the main bot file to call periodically
    checkQueue,
    getMostUsedJutsu, // Export for profile.js or similar
    getAverageDamage // Export for profile.js or similar
};
