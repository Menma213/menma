const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');
const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');

// Effect emojis (from brank.js)
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
const COMBO_EMOJI_FILLED = "⭕";
const COMBO_EMOJI_EMPTY = "⚪";

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '../../menma/images');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');

// Load data
let jutsuList = {};
let jutsuData = {};
let COMBOS = {};
if (fs.existsSync(jutsusPath)) jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
if (fs.existsSync(jutsuPath)) jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
if (fs.existsSync(combosPath)) COMBOS = JSON.parse(fs.readFileSync(combosPath, 'utf8'));

/**
 * Deletes all webhooks in the channel managed by the bot.
 * This is crucial to prevent the Discord API's webhook limit (15) from being reached.
 * @param {object} interaction The Discord interaction object.
 */
async function cleanupWebhooks(interaction) {
    try {
        const webhooks = await interaction.channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
            if (webhook.owner && webhook.owner.id === interaction.client.user.id) {
                await webhook.delete();
            }
        }
        console.log("Cleaned up webhooks successfully.");
    } catch (error) {
        console.error("Failed to clean up webhooks:", error);
    }
}


// Define S-rank bosses with progression requirements
const srankBosses = {
    "haku": {
        name: "Haku",
        image: "https://static.wikia.nocookie.net/naruto/images/3/35/Haku%27s_shinobi_attire.png/revision/latest/scale-to-width-down/1200?cb=20160610212143",
        health: 2050,
        power: 900,
        defense: 340,
        jutsu: ["Attack", "Needle Assault"],
        reward: "Needle Assault",
        rewardChance: 0.5,
        rewardScroll: "Needle Assault Scroll",
        accuracy: 90,
        dodge: 15,
        exp: 2.5,
        money: 10000,
        lore: [
            "Haku was once a child with a tragic past, orphaned by the very powers he possessed. He wandered the snowy lands, shunned and alone, until Zabuza found him. Under Zabuza's wing, Haku found purpose, becoming his loyal protector.",
            "Haku doesn't want anyone to hurt Zabuza, which is why we need to take him down first."
        ],
        requiredDefeats: 0,
        unlocks: "zabuza"
    },
    "zabuza": {
        name: "Zabuza",
        image: "https://i.postimg.cc/6pn0FP6j/image.png",
        health: 3500,
        power: 1500,
        defense: 800,
        jutsu: ["Attack", "Silent Assassination", "Hidden Mist"],
        reward: "Silent Assassination",
        rewardChance: 0.3,
        rewardScroll: "Silent Assassination Scroll",
        accuracy: 95,
        dodge: 60, // Very high dodge as described
        exp: 5.0,
        money: 25000,
        lore: [
            "Zabuza Momochi, the Demon of the Hidden Mist, is a legendary swordsman feared for his ruthless tactics. He seeks power above all, and his only bond is with Haku.",
            "Defeating Zabuza will shake the criminal underworld."
        ],
        requiredDefeats: 1, // Requires Haku to be defeated first
        unlocks: "orochimaru",
        corrupted: true
    },
    "orochimaru": {
        name: "Orochimaru",
        image: "https://www.pngplay.com/wp-content/uploads/12/Orochimaru-PNG-Free-File-Download.png",
        health: 5000,
        power: 2000,
        defense: 1200,
        jutsu: ["Attack", "Serpents Wrath", "Poison Mist"],
        reward: "Serpents Wrath",
        rewardChance: 0.3,
        rewardScroll: "Serpents Wrath Scroll",
        accuracy: 95,
        dodge: 25,
        exp: 8.0,
        money: 50000,
        lore: [
            "Orochimaru, once a Leaf Sannin, now walks a dark path in pursuit of forbidden jutsu and immortality. His experiments have left a trail of terror.",
            "Facing Orochimaru means facing the unknown."
        ],
        requiredDefeats: 2, // Requires both Haku and Zabuza to be defeated
        unlocks: null,
        corrupted: true
    }
};

// Effect handlers (updated from brank.js)
const effectHandlers = {
    damage: (user, target, formula, effect = {}) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100,
                    dodge: Number(user.dodge) || 0
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0,
                    accuracy: Number(target.accuracy) || 100
                },
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => 
                    e.type === 'status' && 
                    ['stun', 'flinch'].includes(e.status)
                ),
                max: Math.max
            };

            // Apply accuracy bonus if present
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

// Add chakra regen rates per rank
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

// Utility functions
function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

// Bloodline emoji/gif/name/department definitions
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

// Story avatar and landscape URLs
const ASUMA_AVATAR = 'https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg';
const HAKU_AVATAR = 'https://www.giantbomb.com/a/uploads/scale_medium/9/95613/2237215-haku22.jpg';
const KAGAMI_AVATAR = 'https://i.redd.it/n75z59iot9se1.jpeg';
const HAKU_CORRUPT_AVATAR = 'https://i.postimg.cc/c1kJqHXq/image.png';
const ZABUZA_AVATAR = 'https://i.postimg.cc/6pn0FP6j/image.png';
const ZABUZA_CORRUPT_AVATAR = 'https://i.postimg.cc/XYZ123/zabuza_corrupt.png'; // Replace with actual image
const OROCHIMARU_AVATAR = 'https://static.wikia.nocookie.net/naruto/images/1/14/Orochimaru_Infobox.png/revision/latest/scale-to-width-down/1200?cb=20150925223113';
const OROCHIMARU_CORRUPT_AVATAR = 'https://i.postimg.cc/XYZ123/orochimaru_corrupt.png'; // Replace with actual image

const HAKU_BG = 'https://i.pinimg.com/474x/a6/e4/b6/a6e4b61fd616f4452c7f52f814477bc0.jpg';
const HAKU_CORRUPT_BG = 'https://i.postimg.cc/SxKGdrVF/image.png';
const ZABUZA_BG = 'https://i.postimg.cc/SxKGdrVF/image.png';
const OROCHIMARU_BG = 'https://static.wikia.nocookie.net/naruto/images/6/67/Kusagakure_Hideout.png/revision/latest?cb=20150419140238';

// Helper to get or create a webhook for a character in the current channel
async function getCharacterWebhook(channel, name, avatar) {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === name);
    if (!wh) {
        wh = await channel.createWebhook({ name, avatar });
    }
    return wh;
}

// Helper to send a webhook message
async function sendCharacterWebhook(channel, name, avatar, content) {
    if (!content || !content.trim()) return;
    const wh = await getCharacterWebhook(channel, name, avatar);
    return wh.send({ content }).catch(() => {});
}

// Battle utilities
class BattleUtils {
    static getEffectiveStats(entity) {
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

        (entity.activeEffects || []).forEach(effect => {
            if (effect.type === 'buff' || effect.type === 'debuff') {
                Object.entries(effect.stats).forEach(([stat, value]) => {
                    effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                });
            }
        });

        return effectiveStats;
    }

    static getRoundEffect(roundEffects, currentRound) {
        for (const [roundRange, effectData] of Object.entries(roundEffects)) {
            const [start, end] = roundRange.split('-').map(Number);
            if ((end && currentRound >= start && currentRound <= end) || 
                (!end && currentRound === start)) {
                return effectData;
            }
        }
        return null;
    }

    static async generateBattleImage(interaction, player, playerHealth, npc, bgUrl, npcImgUrl) {
        const width = 800, height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

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
        ctx.fillText(player.username, playerX + charW / 2, nameY + nameH / 2);
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
    }
}

// Generate the moves embed for the current player
function createMovesEmbed(player, roundNum, userId, jutsuList) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
        .setTitle(`${player.username}`)
        .setColor('#006400')
        .setDescription(
            `${player.username}, It is your turn!\nUse buttons to make a choice.\n\n` +
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
        .map(([slot, jutsuName], index) => {
            const jutsu = jutsuList[jutsuName];
            const disabled = player.chakra < (jutsu?.chakraCost || 0);
            return new ButtonBuilder()
                .setCustomId(`move${index + 1}-${userId}-${roundNum}`)
                .setLabel(`${index + 1}`)
                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(disabled);
        });

    const rows = [];
    // First row: up to 5 jutsu buttons
    if (jutsuButtons.length > 0) {
        const row1 = new ActionRowBuilder();
        jutsuButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
        rows.push(row1);
    }
    // Second row: 6th jutsu (if any), rest, flee
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
        // If 5 or fewer jutsu, put rest/flee on a new row
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
}

// Execute a jutsu
function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) {
    const jutsu = jutsuList[jutsuName];
    if (!jutsu) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.username} attempted unknown jutsu: ${jutsuName}`,
            specialEffects: ["Jutsu failed!"],
            hit: false
        };
    }

    const result = {
        damage: 0,
        heal: 0,
        description: jutsu.description || `${baseUser.username} used ${jutsu.name}`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuName
    };
    
    if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.username} failed to perform ${jutsu.name} (not enough chakra)`,
            specialEffects: ["Chakra exhausted!"],
            hit: false
        };
    }
    
    baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
    
    (jutsu.effects || []).forEach(effect => {
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
                        baseTarget.activeEffects.push({
                            type: 'status',
                            status: effect.status,
                            duration: effect.duration || 1,
                            damagePerTurn: effect.damagePerTurn
                        });
                        result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                    }
                    break;
                case 'chakra_gain':
                    baseUser.chakra += effect.amount || 0;
                    result.specialEffects.push(`Gained ${effect.amount} Chakra`);
                    break;
            }
        } catch (err) {
            console.error(`Error processing ${effect.type} effect:`, err);
            result.specialEffects.push(`Error applying ${effect.type} effect`);
        }
    });
    
    return result;
}

// Process player move
async function processPlayerMove(customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) {
    const action = customId.split('-')[0];
    if (action === 'rest') {
        basePlayer.chakra = Math.min(basePlayer.chakra + 1, basePlayer.chakra + 5);
        return {
            damage: 0,
            heal: 0,
            description: `${basePlayer.username} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }
    if (action === 'flee') return { fled: true };
    
    const idx = parseInt(action.replace('move', '')) - 1;
    const jutsuNames = Object.entries(basePlayer.jutsu)
        .filter(([_, jutsu]) => jutsu !== 'None')
        .map(([_, jutsuName]) => jutsuName);
    const jutsuName = jutsuNames[idx];
    
    return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, jutsuName);
}

// NPC chooses move
function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer) {
    // Check if stunned
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
    return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
}

// Create battle summary
function createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState) {
    const { EmbedBuilder } = require('discord.js');
    
    const getEffectEmojis = (entity) => {
        const emojis = [];
        (entity.activeEffects || []).forEach(effect => {
            if (effect.type === 'buff') emojis.push(EMOJIS.buff);
            if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
            if (effect.type === 'status') emojis.push(EMOJIS[effect.status] || EMOJIS.status);
        });
        return emojis.length ? `[${emojis.join('')}] ` : '';
    };

    const playerEffectEmojis = getEffectEmojis(player);
    const npcEffectEmojis = getEffectEmojis(npc);

    const getActionDescription = (action, user, target) => {
        if (action.isRest) return action.description;
        if (!action.hit) {
            if (action.specialEffects?.includes("Stun active")) return "is stunned!";
            if (action.specialEffects?.includes("Flinch active")) return "flinched!";
            return "missed!";
        }
        return jutsuList[action.jutsuUsed]?.description || action.description || `${user.username || user.name} acted.`;
    };

    const playerDesc = getActionDescription(playerAction, player, npc);
    const npcDesc = getActionDescription(npcAction, npc, player);

    // Handle active status effects (bleed/drowning)
    let statusEffects = [];
    [player, npc].forEach(entity => {
        if (!entity.activeEffects) return;
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'status') {
                switch(effect.status) {
                    case 'bleed': {
                        const bleedDamage = Math.floor(entity.health * 0.1);
                        statusEffects.push(`${entity.username || entity.name} is bleeding! (-${bleedDamage} HP)`);
                        break;
                    }
                    case 'drowning': {
                        const drowningDamage = Math.floor(entity.health * 0.1);
                        statusEffects.push(`${entity.username || entity.name} is drowning! (-${drowningDamage} HP)`);
                        break;
                    }
                }
            }
        });
    });

    // Combo progress UI
    let comboProgressText = "";
    if (comboState && comboState.combo) {
        const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
            comboState.usedJutsus.has(jutsu)
        );
        if (usedThisRound) {
            const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
            const total = comboState.combo.requiredJutsus.length;
            comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${playerEffectEmojis}${player.username} ${playerDesc}` +
            `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : 
             playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
            comboProgressText +
            `\n\n${npcEffectEmojis}${npc.name} ${npcDesc}` +
            `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : 
             npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
            (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
        )
        .addFields({
            name: 'Battle Status',
            value: `${player.username} | ${Math.round(player.health)} HP | ${player.chakra} Chakra\n${npc.name} | ${Math.round(npc.currentHealth ?? npc.health)} HP | ${npc.chakra} Chakra`
        });

    return embed;
}

// Main S-rank battle function
async function runSrankBattle(interaction, users, userId, players, jutsuList, bossConfig, bgUrl, npcImgUrl, bossName) {
    // Setup boss
    let npc = {
        ...bossConfig,
        activeEffects: [],
        jutsu: Array.isArray(bossConfig.jutsu) ? bossConfig.jutsu.map(j => jutsuList[j] ? j : 'Attack') : ['Attack'],
        currentHealth: bossConfig.health,
        power: bossConfig.power,
        defense: bossConfig.defense,
        chakra: 999,
        accuracy: bossConfig.accuracy || 85,
        dodge: bossConfig.dodge || 15
    };
    
    let player = players.find(p => p.id === userId);
    player.maxHealth = player.maxHealth || player.health;
    player.chakra = player.chakra || 10;
    player.activeEffects = player.activeEffects || [];
    
    // Special condition for Zabuza - player starts at 60% health
    if (bossName === "zabuza") {
        player.health = Math.floor(player.health * 0.6);
    }
    
    let roundNum = 1;
    let comboState = null;
    if (users[userId].Combo && COMBOS[users[userId].Combo]) {
        comboState = {
            combo: COMBOS[users[userId].Combo],
            usedJutsus: new Set()
        };
    }

    while (player.health > 0 && npc.currentHealth > 0) {
        // Calculate effective stats
        const effectivePlayer = BattleUtils.getEffectiveStats(player);
        const effectiveNpc = BattleUtils.getEffectiveStats(npc);

        // Player's turn
        const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);
        const moveMsg = await interaction.followUp({
            content: `${player.username}, it's your turn!`,
            embeds: [embed],
            components: components,
            fetchReply: true
        });

        // Generate battle image
        const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, bgUrl, npcImgUrl));
        await interaction.followUp({ files: [battleImage] });

        // Player move
        const playerAction = await new Promise(resolve => {
            const collector = moveMsg.createMessageComponentCollector({
                filter: ii => ii.user.id === userId,
                time: 60000
            });
            
            collector.on('collect', async ii => {
                await ii.deferUpdate();
                const actionResult = await processPlayerMove(ii.customId, player, npc, effectivePlayer, effectiveNpc);
                
                // Track combo progress
                if (comboState && actionResult.jutsuUsed && comboState.combo.requiredJutsus.includes(actionResult.jutsuUsed)) {
                    comboState.usedJutsus.add(actionResult.jutsuUsed);
                }
                
                resolve(actionResult);
                collector.stop();
            });
            
            collector.on('end', (collected, reason) => {
                if (reason === 'time') resolve({ fled: true });
            });
        });

        if (playerAction.fled) {
            await interaction.followUp(`${player.username} fled from the battle!`);
            return "loss";
        }

        // Apply player action results
        npc.currentHealth -= playerAction.damage || 0;
        if (playerAction.heal) {
            player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
        }

        // Process combos
        const processCombo = () => {
            if (!comboState) return { completed: false, damageText: "" };
            
            if (comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))) {
                npc.currentHealth -= comboState.combo.damage;
                comboState.usedJutsus.clear();
                return {
                    completed: true,
                    damageText: `\n${player.username} lands a ${comboState.combo.name}! Dealt ${comboState.combo.damage} true damage!`
                };
            }
            return { completed: false, damageText: "" };
        };

        const comboResult = processCombo();

        // NPC's turn (if still alive)
        let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
        if (npc.currentHealth > 0) {
            npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
            player.health -= npcAction.damage || 0;
            if (npcAction.heal) {
                npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
            }
        }

        // Clamp health values
        player.health = Math.max(0, player.health);
        npc.currentHealth = Math.max(0, npc.currentHealth);

        // Show round summary
        const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState);
        if (comboResult.completed) {
            summaryEmbed.setDescription(
                summaryEmbed.data.description + comboResult.damageText
            );
        }
        await interaction.followUp({ embeds: [summaryEmbed] });

        // Check for win/loss
        if (player.health <= 0) {
            users[userId].srankResult = "loss";
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await interaction.followUp(`**You have been defeated by ${bossName}! Game Over.**`);
            return "loss";
        }
        if (npc.currentHealth <= 0) {
             users[userId].srankResult = "win";
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await interaction.followUp(`**${bossName} has been defeated! You win!**`);
            
            // Reward player
            const expReward = bossConfig.exp;
            const moneyReward = bossConfig.money;
            
            // Update user data
            users[userId].exp = (users[userId].exp || 0) + expReward;
            users[userId].money = (users[userId].money || 0) + moneyReward;
            users[userId].health = player.maxHealth; // Restore full health
            
            // Track boss defeats
            if (!users[userId].srankDefeats) users[userId].srankDefeats = {};
            users[userId].srankDefeats[bossName.toLowerCase()] = (users[userId].srankDefeats[bossName.toLowerCase()] || 0) + 1;
            
            // Save user data
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            
            // Reward embed
            const rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End! ${player.username} has won!`)
                .setDescription(
                    `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward.toLocaleString()}!`
                )
                .setColor('#006400');
                
            await interaction.followUp({ embeds: [rewardEmbed] });
            return "win";
        }

        // Passive chakra regen
        player.chakra += CHAKRA_REGEN[player.rank] || 1;
        npc.chakra += 2;

        // Update effect durations
        [player, npc].forEach(entity => {
            entity.activeEffects.forEach(effect => {
                if (effect.duration > 0) effect.duration--;
            });
            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
        });

        roundNum++;
        if (player.health > 0 && npc.currentHealth > 0) await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return "unknown";
}

// Story handler for Haku
async function runHakuStory(interaction, users, userId, players, jutsuList) {
    const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
    const hakuWebhook = await getCharacterWebhook(interaction.channel, "Haku", HAKU_AVATAR);
    const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
    const hakuCorruptWebhook = await getCharacterWebhook(interaction.channel, "Corrupted Haku", HAKU_CORRUPT_AVATAR);

    let skipStory = false;
    
    // Asuma intro + story
    const storyRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('haku_story_continue').setLabel('Continue').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('haku_story_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary)
        );
    const asumaMsg = await asumaWebhook.send({
        content: "Venturing on your first S-rank? I'll tag along. Just to be safe. Let me tell you about Haku...",
        components: [storyRow]
    });
    
    const storyChoice = await new Promise(resolve => {
        const storyCollector = asumaMsg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && (btn.customId === 'haku_story_continue' || btn.customId === 'haku_story_skip'),
            time: 60000
        });
        storyCollector.on('collect', btn => {
            btn.deferUpdate();
            resolve(btn.customId);
            storyCollector.stop();
        });
        storyCollector.on('end', (_, reason) => {
            if (reason === 'time') resolve('haku_story_skip');
        });
    });
    
    skipStory = (storyChoice === 'haku_story_skip');

    if (skipStory) {
        await asumaWebhook.send({ content: "You skip the story and head straight into battle with Haku." });
        const fightRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('haku_story_fight1').setLabel('Fight').setStyle(ButtonStyle.Danger)
        );
        const fightMsg = await asumaWebhook.send({ content: "Look. That's Haku, ready?", components: [fightRow] });
        await new Promise(resolve => {
            const c = fightMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'haku_story_fight1',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
    } else {
        // Story sequence
        for (const loreLine of srankBosses.haku.lore) {
            await asumaWebhook.send({ content: loreLine });
            await new Promise(res => setTimeout(res, 2500));
        }
        
        // Ready prompt
        const fightRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('haku_story_ready').setLabel('Ready').setStyle(ButtonStyle.Primary)
        );
        const readyMsg = await asumaWebhook.send({ content: "Look. That's Haku, ready?", components: [fightRow] });
        await new Promise(resolve => {
            const c = readyMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'haku_story_ready',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
        
        // Haku dialogue
        await hakuWebhook.send({ content: "Nobody hurts Zabuza!" });
        await new Promise(res => setTimeout(res, 2500));
        await hakuWebhook.send({ content: "Another Shinobi attempting to kill Zabuza? I will kill you instead!" });
        await new Promise(res => setTimeout(res, 2500));
        
        // Fight button
        const fightRow2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('haku_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
        );
        const fightMsg = await hakuWebhook.send({ content: "Prepare yourself!", components: [fightRow2] });
        await new Promise(resolve => {
            const c = fightMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'haku_story_fight',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
    }
    
    // Phase 1 Battle
    let phase1Result = await runSrankBattle(
        interaction, users, userId, players, jutsuList, 
        srankBosses.haku, HAKU_BG, HAKU_AVATAR, "Haku"
    );
    
    if (phase1Result === "win") {
        // Death & corruption sequence
        await hakuWebhook.send({ content: "*coughs up blood* I...*cough*" });
        await new Promise(res => setTimeout(res, 2500));
        await asumaWebhook.send({ content: `<@${userId}> I feel a very strange power heading towards us, we should leave immediately.` });
        await new Promise(res => setTimeout(res, 2500));
        
        // Corrupt BG
        await interaction.channel.send({ content: "Suddenly, the area turns into a hellish place..." });
        
        // Kagami appears
        await kagamiWebhook.send({ content: "Oh? Look at this weakling being defeated by a mere Shinobi." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "You think you can change fate? How amusing. My puppets will always rise again." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "*extends a hand towards Haku, purplish energy swirls*" });
        await new Promise(res => setTimeout(res, 2500));
        await hakuCorruptWebhook.send({ content: "Master...Revenge." });
        await new Promise(res => setTimeout(res, 2500));
        
        // Fight button for corrupted Haku
        const fightRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('haku_story_fight2').setLabel('Fight').setStyle(ButtonStyle.Danger)
        );
        const fightMsg = await hakuCorruptWebhook.send({ content: "You will not leave alive.", components: [fightRow] });
        await new Promise(resolve => {
            const c = fightMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'haku_story_fight2',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
        
        // Phase 2 Battle
        const corruptHakuConfig = {
            ...srankBosses.haku,
            name: "Corrupted Haku",
            image: HAKU_CORRUPT_AVATAR,
            jutsu: ["Corrupted Needle Assault"],
            health: 3500,
            power: 1300,
            defense: 700,
            exp: 3.5,
            money: 15000
        };
        
        let phase2Result = await runSrankBattle(
            interaction, users, userId, players, jutsuList,
            corruptHakuConfig, HAKU_CORRUPT_BG, HAKU_CORRUPT_AVATAR, "Corrupted Haku"
        );
        
        if (phase2Result === "win") {
            await kagamiWebhook.send({ content: "Hmm..Not half bad. Let me go prepare my other puppet...Zabuza. Until next time then, Shinobi." });
            
            // Unlock Zabuza for this user
            if (!users[userId].unlockedSrank) users[userId].unlockedSrank = [];
            if (!users[userId].unlockedSrank.includes("zabuza")) {
                users[userId].unlockedSrank.push("zabuza");
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            }
        }
        
        return phase2Result;
    }
    
    return phase1Result;
}

// Story handler for Zabuza
async function runZabuzaStory(interaction, users, userId, players, jutsuList) {
    const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
    const zabuzaWebhook = await getCharacterWebhook(interaction.channel, "Zabuza", ZABUZA_AVATAR);
    const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);

    // Zabuza is already corrupted as per the story
    for (const loreLine of srankBosses.zabuza.lore) {
        await asumaWebhook.send({ content: loreLine });
        await new Promise(res => setTimeout(res, 2500));
    }
    
    // Zabuza talks like a drunk maniac
    await kagamiWebhook.send({content: "Look who's back.. Get ready to face one of my special puppets. Come, Zabuza!"});
    await new Promise(res => setTimeout(res, 2500));
    await zabuzaWebhook.send({ content: "Hehehe... another little bug to crush..." });
    await new Promise(res => setTimeout(res, 2500));
    await zabuzaWebhook.send({ content: "You think you can defeat the Demon of the Mist? Hah!" });
    await new Promise(res => setTimeout(res, 2500));
    
    const fightRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('zabuza_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
    );
    const fightMsg = await zabuzaWebhook.send({ content: "Come on then, let's dance!", components: [fightRow] });
    await new Promise(resolve => {
        const c = fightMsg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === 'zabuza_story_fight',
            time: 60000
        });
        c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
        c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
    });
    
    // Zabuza Battle (player starts at 60% health as per story)
    let battleResult = await runSrankBattle(
        interaction, users, userId, players, jutsuList, 
        srankBosses.zabuza, ZABUZA_BG, ZABUZA_AVATAR, "Zabuza"
    );
    
    if (battleResult === "win") {
        // Zabuza death sequence
        await zabuzaWebhook.send({ content: "*gurgling blood* How... how did..." });
        await new Promise(res => setTimeout(res, 2500));
        
        // Kagami appears
        await kagamiWebhook.send({ content: "Impressive. Very impressive." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "You have potential. Why waste it serving these weak villages?" });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "Join me. Together we could reshape this world." });
        await new Promise(res => setTimeout(res, 2500));
        
        // Asuma intervenes
        await asumaWebhook.send({ content: "Don't listen to her! She's manipulating you!" });
        await new Promise(res => setTimeout(res, 2500));
        
        await kagamiWebhook.send({ content: "Oh, the monkey is still here. How... annoying." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "*flicks wrist* Let me give you something to remember me by." });
        await new Promise(res => setTimeout(res, 2500));

        await asumaWebhook.send({ content: `Argh! Poison... <@${userId}>, we need to get back to the village, now!` });
        await new Promise(res => setTimeout(res, 2500));
        
        await kagamiWebhook.send({ content: "Run along little monkey. But remember my offer." });
        
        // Unlock Orochimaru for this user
        if (!users[userId].unlockedSrank) users[userId].unlockedSrank = [];
        if (!users[userId].unlockedSrank.includes("orochimaru")) {
            users[userId].unlockedSrank.push("orochimaru");
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        }
    }
    
    return battleResult;
}

// Story handler for Orochimaru
async function runOrochimaruStory(interaction, users, userId, players, jutsuList) {
    const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
    const orochimaruWebhook = await getCharacterWebhook(interaction.channel, "Orochimaru", OROCHIMARU_AVATAR);
    const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);

    // Intro - a month has passed
    await asumaWebhook.send({ content: "It's been a month since that witch poisoned me. I think I'll be tagging along with you on S-ranks." });
    await new Promise(res => setTimeout(res, 2500));
    await asumaWebhook.send({ content: "The witch we met the other day will keep an eye on you. We need to gather intel about the Akatsuki." });
    await new Promise(res => setTimeout(res, 2500));
    
    // They find Orochimaru instead
    await orochimaruWebhook.send({ content: "Well, well... what do we have here? More Konoha insects?" });
    await new Promise(res => setTimeout(res, 2500));
    
    await asumaWebhook.send({ content: "OROCHIMARU! YOU TRAITOR!" });
    await new Promise(res => setTimeout(res, 2500));
    
    await orochimaruWebhook.send({ content: "Another monkey. Hmph! *flicks wrist*" });
    await new Promise(res => setTimeout(res, 2500));
    
    // Asuma gets poisoned again
    await asumaWebhook.send({ content: `Gah! Not again... <@${userId}>, watch out!` });
    await new Promise(res => setTimeout(res, 2500));
    
    // Player is forced to attack (no "no" option)
    const attackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('orochimaru_attack').setLabel('Attack Orochimaru').setStyle(ButtonStyle.Danger)
    );
    const attackMsg = await interaction.followUp({ content: "You have no choice but to attack!", components: [attackRow], fetchReply: true });
    
    await new Promise(resolve => {
        const c = attackMsg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === 'orochimaru_attack',
            time: 60000
        });
        c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
        c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
    });
    
    // Orochimaru one-shots the player (plot armor)
    await orochimaruWebhook.send({ content: "Foolish child. *effortlessly counters your attack*" });
    await new Promise(res => setTimeout(res, 2500));
    await interaction.followUp("**Orochimaru's power is overwhelming! You've been defeated!**");
    await new Promise(res => setTimeout(res, 2500));
    
    // Villagers rescue them
    await interaction.followUp("**You wake up in a remote village, saved by kind villagers.**");
    await new Promise(res => setTimeout(res, 4500));
    
    // Asuma's plan
    await asumaWebhook.send({ content: `<@${userId}>, listen carefully. I have a plan.` });
    await new Promise(res => setTimeout(res, 2500));
    await asumaWebhook.send({ content: "I'll launch an all-out attack to distract him. You need to land a finishing blow to his vitals." });
    await new Promise(res => setTimeout(res, 2500));
    await asumaWebhook.send({ content: "But you must wait for the right moment." });
    await new Promise(res => setTimeout(res, 2500));
    
    // Find Orochimaru again
    await interaction.followUp("**You track down Orochimaru to the same location.**");
    await new Promise(res => setTimeout(res, 2500));
    
    await orochimaruWebhook.send({ content: "Back for more? How... persistent." });
    await new Promise(res => setTimeout(res, 2500));
    
    const fightRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('orochimaru_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
    );
    const fightMsg = await orochimaruWebhook.send({ content: "Let's finish this.", components: [fightRow] });
    await new Promise(resolve => {
        const c = fightMsg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === 'orochimaru_fight',
            time: 60000
        });
        c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
        c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
    });
    
    // Special Orochimaru battle with Execute option
    let battleResult = await runOrochimaruBattle(interaction, users, userId, players, jutsuList);
    
    if (battleResult === "win") {
        // Orochimaru death sequence
        await orochimaruWebhook.send({ content: "Impossible... how could I be defeated by... *coughs up black blood*" });
        await new Promise(res => setTimeout(res, 2500));
        
        // Corruption reveal
        await interaction.followUp("**Orochimaru's body begins to show signs of corruption - the same as Haku and Zabuza!**");
        await new Promise(res => setTimeout(res, 2500));
        
        await asumaWebhook.send({ content: `No... she got to him too! <@${userId}>, we need to leave, now!` });
        await new Promise(res => setTimeout(res, 2500));
        
        // Kagami appears
        await kagamiWebhook.send({ content: "Leaving so soon? And here I was going to offer my congratulations." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "You're becoming quite the nuisance. Maybe I should pay a visit to that little redhead of yours... Kurenai, was it?" });
        await new Promise(res => setTimeout(res, 2500));
        
        await asumaWebhook.send({ content: "You stay away from her!" });
        await new Promise(res => setTimeout(res, 2500));
        
        await kagamiWebhook.send({ content: "Or what? You'll try to poison me again? *laughs* Don't worry, we'll meet again soon." });
        await new Promise(res => setTimeout(res, 2500));
        
        await asumaWebhook.send({ content: "We need to get back to the village and warn everyone. This is bigger than we thought." });
    }
    
    return battleResult;
}

// Special battle for Orochimaru with Execute option
async function runOrochimaruBattle(interaction, users, userId, players, jutsuList) {
    // Setup Orochimaru with special conditions
    let npc = {
        ...srankBosses.orochimaru,
        activeEffects: [],
        jutsu: Array.isArray(srankBosses.orochimaru.jutsu) ? 
            srankBosses.orochimaru.jutsu.map(j => jutsuList[j] ? j : 'Attack') : 
            ['Attack'],
        currentHealth: srankBosses.orochimaru.health,
        power: srankBosses.orochimaru.power,
        defense: srankBosses.orochimaru.defense,
        chakra: 999,
        accuracy: srankBosses.orochimaru.accuracy || 85,
        dodge: srankBosses.orochimaru.dodge || 15
    };
    
    let player = players.find(p => p.id === userId);
    player.maxHealth = player.maxHealth || player.health;
    player.chakra = player.chakra || 10;
    player.activeEffects = player.activeEffects || [];
    
    let roundNum = 1;
    let comboState = null;
    if (users[userId].Combo && COMBOS[users[userId].Combo]) {
        comboState = {
            combo: COMBOS[users[userId].Combo],
            usedJutsus: new Set()
        };
    }
    
    let executeAvailable = false;

    while (player.health > 0 && npc.currentHealth > 0) {
        // Calculate effective stats
        const effectivePlayer = BattleUtils.getEffectiveStats(player);
        const effectiveNpc = BattleUtils.getEffectiveStats(npc);

        // Check if Execute should be available (when Orochimaru is below 30% health)
        executeAvailable = npc.currentHealth <= npc.health * 0.3;

        // Player's turn
        const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);
        
        // Add Execute option if available
        if (executeAvailable) {
            const executeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`execute-${userId}-${roundNum}`)
                    .setLabel('EXECUTE')
                    .setStyle(ButtonStyle.Danger)
            );
            components.push(executeRow);
        }
        
        const moveMsg = await interaction.followUp({
            content: `${player.username}, it's your turn!${executeAvailable ? "\n**EXECUTE option available!**" : ""}`,
            embeds: [embed],
            components: components,
            fetchReply: true
        });

        // Generate battle image
        const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, OROCHIMARU_BG, OROCHIMARU_AVATAR));
        await interaction.followUp({ files: [battleImage] });

        // Player move
        const playerAction = await new Promise(resolve => {
            const collector = moveMsg.createMessageComponentCollector({
                filter: ii => ii.user.id === userId,
                time: 60000
            });
            
            collector.on('collect', async ii => {
                await ii.deferUpdate();
                
                if (ii.customId.startsWith('execute')) {
                    // Instant kill if Execute is used at the right time
                    if (executeAvailable) {
                        resolve({
                            damage: npc.currentHealth,
                            heal: 0,
                            description: `${player.username} executes a perfectly timed finishing blow!`,
                            specialEffects: ["FATAL STRIKE!"],
                            hit: true,
                            isExecute: true
                        });
                    } else {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${player.username} attempts an execution but misses the timing!`,
                            specialEffects: ["Poor timing!"],
                            hit: false
                        });
                    }
                } else {
                    const actionResult = await processPlayerMove(ii.customId, player, npc, effectivePlayer, effectiveNpc);
                    
                    // Track combo progress
                    if (comboState && actionResult.jutsuUsed && comboState.combo.requiredJutsus.includes(actionResult.jutsuUsed)) {
                        comboState.usedJutsus.add(actionResult.jutsuUsed);
                    }
                    
                    resolve(actionResult);
                }
                collector.stop();
            });
            
            collector.on('end', (collected, reason) => {
                if (reason === 'time') resolve({ fled: true });
            });
        });

        if (playerAction.fled) {
            await interaction.followUp(`${player.username} fled from the battle!`);
            return "loss";
        }

        // Apply player action results
        npc.currentHealth -= playerAction.damage || 0;
        if (playerAction.heal) {
            player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
        }

        // If player used Execute successfully, end battle
        if (playerAction.isExecute && playerAction.hit) {
            npc.currentHealth = 0;
        }

        // Process combos
        const processCombo = () => {
            if (!comboState) return { completed: false, damageText: "" };
            
            if (comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))) {
                npc.currentHealth -= comboState.combo.damage;
                comboState.usedJutsus.clear();
                return {
                    completed: true,
                    damageText: `\n${player.username} lands a ${comboState.combo.name}! Dealt ${comboState.combo.damage} true damage!`
                };
            }
            return { completed: false, damageText: "" };
        };

        const comboResult = processCombo();

        // NPC's turn (if still alive)
        let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
        if (npc.currentHealth > 0) {
            npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
            player.health -= npcAction.damage || 0;
            if (npcAction.heal) {
                npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
            }
        }

        // Clamp health values
        player.health = Math.max(0, player.health);
        npc.currentHealth = Math.max(0, npc.currentHealth);

        // Show round summary
        const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState);
        if (comboResult.completed) {
            summaryEmbed.setDescription(
                summaryEmbed.data.description + comboResult.damageText
            );
        }
        await interaction.followUp({ embeds: [summaryEmbed] });

        // Check for win/loss
        if (player.health <= 0) {
            users[userId].srankResult = "loss";
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await interaction.followUp(`**You have been defeated by Orochimaru! Game Over.**`);
            return "loss";
        }
        if (npc.currentHealth <= 0) {
            // Update tutorial progress for /tutorial command
            users[userId].srankResult = "win";
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await interaction.followUp(`**Orochimaru has been defeated! You win!**`);
            
            // Reward player
            const expReward = srankBosses.orochimaru.exp;
            const moneyReward = srankBosses.orochimaru.money;
            
            // Update user data
            users[userId].exp = (users[userId].exp || 0) + expReward;
            users[userId].money = (users[userId].money || 0) + moneyReward;
            users[userId].health = player.maxHealth; // Restore full health
            
            // Track boss defeats
            if (!users[userId].srankDefeats) users[userId].srankDefeats = {};
            users[userId].srankDefeats.orochimaru = (users[userId].srankDefeats.orochimaru || 0) + 1;
            
            // Save user data
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            
            // Reward embed
            const rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End! ${player.username} has won!`)
                .setDescription(
                    `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward.toLocaleString()}!`
                )
                .setColor('#006400');
                
            await interaction.followUp({ embeds: [rewardEmbed] });
            return "win";
        }

        // Passive chakra regen
        player.chakra += CHAKRA_REGEN[player.rank] || 1;
        npc.chakra += 2;

        // Update effect durations
        [player, npc].forEach(entity => {
            entity.activeEffects.forEach(effect => {
                if (effect.duration > 0) effect.duration--;
            });
            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
        });

        roundNum++;
        if (player.health > 0 && npc.currentHealth > 0) await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return "unknown";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('srank')
        .setDescription('Embark on a dangerous S-Rank mission'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
             await cleanupWebhooks(interaction);

            const userId = interaction.user.id;

            // Load user data
            if (!fs.existsSync(usersPath)) {
                return await interaction.followUp({ content: "Database not found.", ephemeral: true });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return await interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // Check cooldown
            const now = Date.now();
            const JINCHURIKI_ROLE = "1385641469507010640";
            const LEGENDARY_ROLE = "1385640798581952714";
            const DONATOR_ROLE = "1385640728130097182";
            let cooldownMs = 18 * 60 * 1000; // default 18 min

            // Check premium roles
            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 10 * 60 * 1000; // 10 min
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = Math.round(12 * 60 * 1000); // 12 min
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = Math.round(13 * 60 * 1000); // 13 min
            }

            if (users[userId].lastsrank && now - users[userId].lastsrank < cooldownMs) {
                const left = cooldownMs - (now - users[userId].lastsrank);
                return interaction.followUp({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: true });
            }
            users[userId].lastsrank = now;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            // Prepare player data
            let players = [
                { 
                    id: userId, 
                    username: interaction.user.username, 
                    ...users[userId],
                    activeEffects: [],
                    accuracy: 100,
                    dodge: 0,
                    bloodline: users[userId].bloodline,
                    jutsu: (() => {
                        if (users[userId].jutsu && typeof users[userId].jutsu === "object" && !Array.isArray(users[userId].jutsu)) {
                            return users[userId].jutsu;
                        }
                        if (Array.isArray(users[userId].jutsus)) {
                            const obj = {};
                            users[userId].jutsus.forEach((j, i) => obj[i] = j);
                            return obj;
                        }
                        return {};
                    })()
                }
            ];

            // Determine available bosses based on progression
            const availableBosses = {};
            const userDefeats = users[userId].srankDefeats || {};
            const userUnlocked = users[userId].unlockedSrank || [];
            
            for (const [bossId, boss] of Object.entries(srankBosses)) {
                const defeatCount = userDefeats[bossId] || 0;
                
                // Check if requirements are met
                if (boss.requiredDefeats <= defeatCount || userUnlocked.includes(bossId)) {
                    availableBosses[bossId] = boss;
                }
            }

            // If no bosses are available, only Haku is available
            if (Object.keys(availableBosses).length === 0) {
                availableBosses.haku = srankBosses.haku;
            }

            // Create boss selection menu
            const bossOptions = Object.entries(availableBosses).map(([bossId, boss]) => ({
                label: boss.name,
                value: bossId,
                description: `Health: ${boss.health} | Power: ${boss.power}`
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('srank_boss_selection')
                .setPlaceholder('Select an opponent')
                .addOptions(bossOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('S-Rank Mission')
                .setDescription(
                    'Select your opponent for the S-Rank mission.\n\n' +
                    bossOptions.map((boss, index) => `${index + 1}️⃣: ${boss.label}`).join('\n')
                )
                .setColor('#006400');

            const message = await interaction.followUp({
                embeds: [embed],
                components: [row]
            });

            // Handle boss selection
            const filter = i => i.user.id === userId && i.customId === 'srank_boss_selection';
            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    collector.stop();
                    await i.deferUpdate();

                    const bossId = i.values[0];
                    const boss = srankBosses[bossId];

                    // Run the appropriate story based on boss selection
                    let result;
                    switch (bossId) {
                        case "haku":
                            result = await runHakuStory(interaction, users, userId, players, jutsuList);
                            break;
                        case "zabuza":
                            result = await runZabuzaStory(interaction, users, userId, players, jutsuList);
                            break;
                        case "orochimaru":
                            result = await runOrochimaruStory(interaction, users, userId, players, jutsuList);
                            break;
                        default:
                            result = "unknown";
                    }

                    // Handle post-battle logic
                    if (result === "win") {
                        // Additional rewards or unlocks can be handled here
                    }

                } catch (error) {
                    console.error("Battle error:", error);
                    await interaction.followUp("An error occurred during the battle!");
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await interaction.followUp("You took too long to select a boss. Mission cancelled.");
                }
            });

        } catch (error) {
            console.error("Command error:", error);
            await interaction.followUp({ content: "An error occurred while executing this command." });
        }
    }
};