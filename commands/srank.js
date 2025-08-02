const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');
const { createCanvas, loadImage, registerFont } = require('canvas');

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

// Define S-rank bosses directly
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
        ]
    },
    "zabuza": {
        name: "Zabuza",
        image: "https://static.wikia.nocookie.net/villains/images/7/7d/Zabuza.png/revision/latest?cb=20181118072602",
        health: 300,
        power: 150,
        defense: 100,
        jutsu: ["Attack", "Silent Assassination"],
        reward: "Silent Assassination",
        rewardChance: 0.3,
        rewardScroll: "Silent Assassination Scroll",
        accuracy: 85,
        dodge: 40,
        exp: 3.5,
        money: 20000,
        lore: [
            "Zabuza Momochi, the Demon of the Hidden Mist, is a legendary swordsman feared for his ruthless tactics. He seeks power above all, and his only bond is with Haku.",
            "Defeating Zabuza will shake the criminal underworld."
        ]
    },
    "orochimaru": {
        name: "Orochimaru",
        image: "https://www.pngplay.com/wp-content/uploads/12/Orochimaru-PNG-Free-File-Download.png",
        health: 400,
        power: 300,
        defense: 200,
        jutsu: ["Attack", "Serpents Wrath"],
        reward: "Serpents Wrath",
        rewardChance: 0.3,
        rewardScroll: "Serpents Wrath Scroll",
        accuracy: 95,
        dodge: 20,
        exp: 5,
        money: 50000,
        lore: [
            "Orochimaru, once a Leaf Sannin, now walks a dark path in pursuit of forbidden jutsu and immortality. His experiments have left a trail of terror.",
            "Facing Orochimaru means facing the unknown."
        ]
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

// --- Story avatar and landscape URLs (edit these as needed) ---
const ASUMA_AVATAR = 'https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg';
const HAKU_AVATAR = 'https://www.giantbomb.com/a/uploads/scale_medium/9/95613/2237215-haku22.jpg';
const KAGAMI_AVATAR = 'https://i.redd.it/n75z59iot9se1.jpeg';
const HAKU_CORRUPT_AVATAR = 'https://i.postimg.cc/c1kJqHXq/image.png';
const HAKU_BG = 'https://i.pinimg.com/474x/a6/e4/b6/a6e4b61fd616f4452c7f52f814477bc0.jpg';
const HAKU_CORRUPT_BG = 'https://i.postimg.cc/SxKGdrVF/image.png';

// --- Helper to get or create a webhook for a character in the current channel ---
async function getCharacterWebhook(channel, name, avatar) {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === name);
    if (!wh) {
        wh = await channel.createWebhook({ name, avatar });
    }
    return wh;
}

// --- Helper to send a webhook message ---
async function sendCharacterWebhook(channel, name, avatar, content) {
    if (!content || !content.trim()) return; // Prevent DiscordAPIError[50006]
    const wh = await getCharacterWebhook(channel, name, avatar);
    return wh.send({ content }).catch(() => {});
}

// --- Battle helpers for S-rank (future-proof, based on brank.js) ---

/**
 * Generate the moves embed for the current player.
 * @param {object} player - The player object.
 * @param {number} roundNum - The current round number.
 * @param {string} userId - The Discord user ID.
 * @param {object} jutsuList - The jutsu list.
 * @returns {object} { embed, components }
 */
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

/**
 * Generate the battle image for the current round.
 * @param {object} interaction - The Discord interaction.
 * @param {object} player - The player object.
 * @param {number} playerHealth - The player's current health.
 * @param {object} npc - The NPC/boss object.
 * @param {string} bgUrl - Background image URL.
 * @param {string} npcImgUrl - NPC image URL.
 * @returns {Promise<Buffer>} - PNG buffer.
 */
async function generateBattleImage(interaction, player, playerHealth, npc, bgUrl, npcImgUrl) {
    const { createCanvas, loadImage } = require('canvas');
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

/**
 * Create a round summary embed (copied from brank.js createBattleSummary).
 * @param {object} player
 * @param {object} npc
 * @param {object} playerAction
 * @param {object} npcAction
 * @param {number} roundNum
 * @param {object} comboState
 * @returns {EmbedBuilder}
 */
function createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState) {
    const { EmbedBuilder } = require('discord.js');
    // Get active effect emojis
    const getEffectEmojis = (entity) => {
        const emojis = [];
        if (!entity.activeEffects) return '';
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
    const npcEffectEmojis = getEffectEmojis(npc);

    // Player description
    const playerDesc = playerAction.isRest ? playerAction.description :
        !playerAction.hit ? (
            playerAction.specialEffects?.includes("Stun active") ? "is stunned!" :
            playerAction.specialEffects?.includes("Flinch active") ? "flinched!" : "missed!"
        ) :
        (playerAction.description);

    // NPC description
    const npcDesc = !npcAction.hit ? (
        npcAction.specialEffects?.includes("Stun active") ? `${npc.name} is stunned!` :
        npcAction.specialEffects?.includes("Flinch active") ? `${npc.name} flinched!` : `${npc.name} missed!`
    ) :
    npcAction.description;

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
            `${playerEffectEmojis}@${player.username} ${playerDesc}` +
            `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
            `\n\n${npcEffectEmojis}${npcDesc}` +
            `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
            (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '') +
            comboProgressText
        )
        .addFields({
            name: 'Battle Status',
            value: `${player.username} | ${Math.round(player.health)} HP\n${npc.name} | ${Math.round(npc.currentHealth ?? npc.health)} HP\nChakra: ${player.chakra}            Chakra: ${npc.chakra}`
        });

    return embed;
}

// Placeholder for runHakuBattle function (this needs to be fully implemented)
// This function will contain the main battle loop and logic
async function runHakuBattle(interaction, users, userId, players, jutsuList, jutsuData, bossConfig, backgroundUrl, bossAvatarUrl, bossName) {
    // Initialize the boss based on the bossConfig
    const playerCount = players.length;
    let npc = {
        ...bossConfig,
        activeEffects: [],
        jutsu: bossConfig.jutsu.map(j => jutsuList[j] ? j : 'Attack'), // Ensure jutsu are valid
        currentHealth: bossConfig.health * (1 + (playerCount - 1) * 0.5),
        power: bossConfig.power * (1 + (playerCount - 1) * 0.2),
        chakra: 10, // Assuming a base chakra for boss
        accuracy: bossConfig.accuracy || 85,
        dodge: bossConfig.dodge || 15
    };

    // Initialize player's current health and chakra for the battle
    let player = players.find(p => p.id === userId);
    let currentPlayerHealth = player.health;
    let currentPlayerChakra = player.chakra;
    let playerActiveEffects = []; // Initialize player's active effects for this battle

    await interaction.channel.send({ content: `**The battle against ${bossName} begins!**` });
    
    // Main battle loop (simplified example)
    while (currentPlayerHealth > 0 && npc.currentHealth > 0) {
        // --- Player's Turn ---
        const jutsuOptions = player.jutsus.map(jutsuName => ({
            label: jutsuName,
            value: jutsuName
        })).filter(option => jutsuData[option.value] && jutsuData[option.value].chakraCost <= currentPlayerChakra); // Filter by available chakra

        if (jutsuOptions.length === 0) {
            jutsuOptions.push({ label: "No Jutsus Available (Default Attack)", value: "Attack" });
        }

        const jutsuSelect = new StringSelectMenuBuilder()
            .setCustomId('battle_jutsu_selection')
            .setPlaceholder('Choose your Jutsu')
            .addOptions(jutsuOptions);

        const attackRow = new ActionRowBuilder().addComponents(jutsuSelect);

        // Display current stats and prompt for action
        const battleEmbed = new EmbedBuilder()
            .setTitle(`Battle: ${player.username} vs ${bossName}`)
            .setDescription(
                `**${player.username} Health:** ${Math.max(0, currentPlayerHealth)}/${player.health}\n` +
                `**${player.username} Chakra:** ${Math.max(0, currentPlayerChakra)}/${player.chakra}\n` +
                `**${bossName} Health:** ${Math.max(0, npc.currentHealth)}/${bossConfig.health}\n` +
                `**${bossName} Chakra:** ${Math.max(0, npc.chakra)}\n` +
                `\n_Choose your next move_`
            )
            .setImage(backgroundUrl) // Set the background image
            .setThumbnail(bossAvatarUrl) // Set the boss avatar
            .setColor('#FF0000');

        const battleMessage = await interaction.channel.send({
            embeds: [battleEmbed],
            components: [attackRow],
            fetchReply: true
        });

        const turnInteraction = await battleMessage.awaitMessageComponent({
            filter: i => i.user.id === userId && i.customId === 'battle_jutsu_selection',
            time: 60000 // 60 seconds to choose
        }).catch(() => null);

        if (!turnInteraction) {
            await interaction.channel.send("You took too long to make a move! The battle ends.");
            return "loss"; // Player loses due to inactivity
        }

        await turnInteraction.deferUpdate();

        const selectedJutsuName = turnInteraction.values[0];
        const selectedJutsu = jutsuData[selectedJutsuName] || { name: "Attack", damage: "user.power", chakraCost: 0, type: "damage" }; // Default to basic attack

        let playerActionMessage = `${player.username} used **${selectedJutsu.name}**! `;

        // Apply Jutsu effects
        if (selectedJutsu.chakraCost) {
            currentPlayerChakra -= selectedJutsu.chakraCost;
            if (currentPlayerChakra < 0) currentPlayerChakra = 0; // Prevent negative chakra
        }

        let damageDealt = 0;
        let healingDone = 0;
        let effectsApplied = [];

        if (selectedJutsu.type === 'damage') {
            const { damage, hit } = effectHandlers.damage(player, npc, selectedJutsu.damage);
            if (hit) {
                npc.currentHealth -= damage;
                damageDealt = damage;
                playerActionMessage += `Dealt ${damage} damage.`;
            } else {
                playerActionMessage += `Missed!`;
            }
        } else if (selectedJutsu.type === 'heal') {
            const healAmount = effectHandlers.heal(player, selectedJutsu.healAmount);
            currentPlayerHealth += healAmount;
            healingDone = healAmount;
            playerActionMessage += `Healed for ${healAmount} health.`;
            if (currentPlayerHealth > player.health) currentPlayerHealth = player.health; // Cap at max health
        } else if (selectedJutsu.type === 'buff') {
            const buffs = effectHandlers.buff(player, selectedJutsu.stats);
            for (const stat in buffs) {
                player[stat] += buffs[stat]; // Apply buffs directly to player stats (for current battle instance)
                playerActionMessage += ` ${EMOJIS.buff} ${stat} increased by ${buffs[stat]}.`;
                effectsApplied.push(`${EMOJIS.buff} ${stat}`);
            }
        } else if (selectedJutsu.type === 'debuff') {
            const debuffs = effectHandlers.debuff(npc, selectedJutsu.stats);
            for (const stat in debuffs) {
                npc[stat] += debuffs[stat]; // Apply debuffs to NPC (negative values)
                playerActionMessage += ` ${EMOJIS.debuff} ${bossName}'s ${stat} decreased by ${Math.abs(debuffs[stat])}.`;
                effectsApplied.push(`${EMOJIS.debuff} ${stat}`);
            }
        }
        // Add other effect types (stun, bleed, flinch, curse, status) as needed

        await interaction.channel.send(playerActionMessage);
        await new Promise(res => setTimeout(res, 2000)); // Short pause for readability

        if (npc.currentHealth <= 0) {
            await interaction.channel.send(`**${bossName} has been defeated! You win!**`);
            return "win";
        }

        // --- Boss's Turn ---
        const bossAttackJutsuName = npc.jutsu[Math.floor(Math.random() * npc.jutsu.length)];
        const bossAttackJutsu = jutsuData[bossAttackJutsuName] || { name: "Attack", damage: "target.power", chakraCost: 0, type: "damage" };

        let bossActionMessage = `${bossName} used **${bossAttackJutsu.name}**! `;

        if (bossAttackJutsu.chakraCost) {
            npc.chakra -= bossAttackJutsu.chakraCost;
            if (npc.chakra < 0) npc.chakra = 0;
        }

        if (bossAttackJutsu.type === 'damage') {
            const { damage, hit } = effectHandlers.damage(npc, player, bossAttackJutsu.damage);
            if (hit) {
                currentPlayerHealth -= damage;
                bossActionMessage += `Dealt ${damage} damage.`;
            } else {
                bossActionMessage += `Missed!`;
            }
        }
        // Add other boss attack types

        await interaction.channel.send(bossActionMessage);
        await new Promise(res => setTimeout(res, 2000));

        // Chakra regeneration for both player and boss
        currentPlayerChakra += CHAKRA_REGEN[player.rank] || 1;
        if (currentPlayerChakra > player.chakra) currentPlayerChakra = player.chakra; // Cap at max chakra

        // Boss chakra regeneration (example, you might define this differently)
        npc.chakra += 5; 
    }

    if (currentPlayerHealth <= 0) {
        await interaction.channel.send(`**You have been defeated by ${bossName}! Game Over.**`);
        return "loss";
    }

    return "unknown"; // Should not be reached
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
                    bloodline: users[userId].bloodline, // keep bloodline for reference
                    // Ensure jutsu is an object with slots, not an array
                    jutsu: (() => {
                        // If users[userId].jutsu is already an object, use it
                        if (users[userId].jutsu && typeof users[userId].jutsu === "object" && !Array.isArray(users[userId].jutsu)) {
                            return users[userId].jutsu;
                        }
                        // If users[userId].jutsus is an array, convert to slot object
                        if (Array.isArray(users[userId].jutses)) {
                            const obj = {};
                            users[userId].jutses.forEach((j, i) => obj[i] = j);
                            return obj;
                        }
                        // fallback: empty
                        return {};
                    })()
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

            // --- Use brank.js style boss selection embed ---
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
                    collector.stop(); // Stop the boss selection collector
                    await i.deferUpdate(); // Defer the interaction for the selection

                    const bossId = i.values[0];
                    const boss = srankBosses[bossId];

                    // --- UNIFIED STORY & BATTLE HANDLER ---
                    async function runStoryAndBattle(bossId, bossConfig, phase2Config = null) {
                        let asumaWebhook, hakuWebhook, kagamiWebhook, hakuCorruptWebhook, zabuzaWebhook, orochimaruWebhook;
                        if (bossId === "haku") {
                            asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
                            hakuWebhook = await getCharacterWebhook(interaction.channel, "Haku", HAKU_AVATAR);
                            kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
                            hakuCorruptWebhook = await getCharacterWebhook(interaction.channel, "Corrupted Haku", HAKU_CORRUPT_AVATAR);
                        }
                        // Future-proof: add for Zabuza/Orochimaru
                        if (bossId === "zabuza") {
                            zabuzaWebhook = await getCharacterWebhook(interaction.channel, "Zabuza", srankBosses.zabuza.image);
                        }
                        if (bossId === "orochimaru") {
                            orochimaruWebhook = await getCharacterWebhook(interaction.channel, "Orochimaru", srankBosses.orochimaru.image);
                        }

                        let skipStory = false;
                        if (bossId === "haku") {
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
                        }

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
                        } else if (bossId === "haku") {
                            // Story sequence, all buttons on webhooks, more divisions
                            // 1. Asuma tells Haku's story
                            for (const loreLine of bossConfig.lore) {
                                await asumaWebhook.send({ content: loreLine });
                                await new Promise(res => setTimeout(res, 2500)); // Increased delay
                            }
                            // 2. Ready prompt
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
                            // 3. Haku dialogue
                            await hakuWebhook.send({ content: "Nobody hurts Zabuza!" });
                            await new Promise(res => setTimeout(res, 2500));
                            await hakuWebhook.send({ content: "Another Shinobi attempting to kill Zabuza? I will kill you instead!" });
                            await new Promise(res => setTimeout(res, 2500));
                            // 4. Fight button on Haku webhook
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
                        // --- PHASE 1 BATTLE ---
                        let phase1Result = await runSrankBattle(
                            interaction, users, userId, players, jutsuList, bossConfig, HAKU_BG, HAKU_AVATAR, bossConfig.name
                        );
                        if (bossId === "haku" && phase1Result === "win") {
                            // 5. Death & corruption sequence
                            await hakuWebhook.send({ content: "*coughs up blood* I...*cough*" });
                            await new Promise(res => setTimeout(res, 2500));
                            await asumaWebhook.send({ content: `<@${userId}> I feel a very strange power heading towards us, we should leave immediately.` });
                            await new Promise(res => setTimeout(res, 2500));
                            // Corrupt BG
                            await interaction.channel.send({ content: "Suddenly, the area turns into a hellish place...", files: [], embeds: [], components: [], allowedMentions: { parse: [] }, ephemeral: false });
                            // 6. Kagami appears, more mockery
                            await kagamiWebhook.send({ content: "Oh? Look at this weakling being defeated by a mere Shinobi." });
                            await new Promise(res => setTimeout(res, 2500));
                            await kagamiWebhook.send({ content: "You think you can change fate? How amusing. My puppets will always rise again." });
                            await new Promise(res => setTimeout(res, 2500));
                            await kagamiWebhook.send({ content: "*extends a hand towards Haku, purplish energy swirls*" });
                            await new Promise(res => setTimeout(res, 2500));
                            await hakuCorruptWebhook.send({ content: "Master...Revenge." });
                            await new Promise(res => setTimeout(res, 2500));
                            // Fight button on Corrupted Haku webhook
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
                            // --- PHASE 2 BATTLE ---
                            let phase2Result = await runSrankBattle(
                                interaction, users, userId, players, jutsuList,
                                phase2Config || {
                                    ...bossConfig,
                                    name: "Corrupted Haku",
                                    image: HAKU_CORRUPT_AVATAR,
                                    jutsu: ["Corrupted Needle Assault"],
                                    health: 350,
                                    power: 130,
                                    defense: 70,
                                    exp: 3.5,
                                    money: 15000
                                },
                                HAKU_CORRUPT_BG, HAKU_CORRUPT_AVATAR, "Corrupted Haku"
                            );
                            if (phase2Result === "win") {
                                await kagamiWebhook.send({ content: "Hmm..Not half bad. Let me go prepare my other puppet...Zabuza. Until next time then, Shinobi." });
                            }
                        }
                        // --- Future-proof: Zabuza/Orochimaru story structure ---
                        if (bossId === "zabuza") {
                            for (const loreLine of bossConfig.lore) {
                                await zabuzaWebhook.send({ content: loreLine });
                                await new Promise(res => setTimeout(res, 2500));
                            }
                            const fightRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('zabuza_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
                            );
                            const fightMsg = await zabuzaWebhook.send({ content: "Ready to face the Demon of the Mist?", components: [fightRow] });
                            await new Promise(resolve => {
                                const c = fightMsg.createMessageComponentCollector({
                                    filter: btn => btn.user.id === userId && btn.customId === 'zabuza_story_fight',
                                    time: 60000
                                });
                                c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                            });
                            await runSrankBattle(
                                interaction, users, userId, players, jutsuList, bossConfig, bossConfig.image, bossConfig.image, bossConfig.name
                            );
                        }
                        if (bossId === "orochimaru") {
                            for (const loreLine of bossConfig.lore) {
                                await orochimaruWebhook.send({ content: loreLine });
                                await new Promise(res => setTimeout(res, 2500));
                            }
                            const fightRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('orochimaru_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
                            );
                            const fightMsg = await orochimaruWebhook.send({ content: "Step forward if you dare.", components: [fightRow] });
                            await new Promise(resolve => {
                                const c = fightMsg.createMessageComponentCollector({
                                    filter: btn => btn.user.id === userId && btn.customId === 'orochimaru_story_fight',
                                    time: 60000
                                });
                                c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                            });
                            await runSrankBattle(
                                interaction, users, userId, players, jutsuList, bossConfig, bossConfig.image, bossConfig.image, bossConfig.name
                            );
                        }
                    }

                    // --- BOSS SELECTION HANDLER ---
                    if (bossId === "haku") {
                        await runStoryAndBattle("haku", boss, null);
                        return;
                    } else {
                        await interaction.followUp({ content: `Prepare to fight ${boss.name}!` });
                        const fightRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('srank_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
                        );
                        const fightMsg = await interaction.followUp({ content: "Ready?", components: [fightRow], fetchReply: true });
                        await new Promise(resolve => {
                            const c = fightMsg.createMessageComponentCollector({
                                filter: btn => btn.user.id === userId && btn.customId === 'srank_fight',
                                time: 60000
                            });
                            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                        });
                        await runSrankBattle(
                            interaction, users, userId, players, jutsuList, boss, boss.image, boss.image, boss.name
                        );
                        return;
                    }
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

// --- S-RANK BATTLE LOOP (REPLACES runHakuBattle) ---
async function runSrankBattle(interaction, users, userId, players, jutsuList, bossConfig, bgUrl, npcImgUrl, bossName) {
    // Setup boss
    let npc = {
        ...bossConfig,
        activeEffects: [],
        jutsu: Array.isArray(bossConfig.jutsu) ? bossConfig.jutsu.map(j => jutsuList[j] ? j : 'Attack') : ['Attack'],
        currentHealth: bossConfig.health,
        power: bossConfig.power,
        chakra: 10,
        accuracy: bossConfig.accuracy || 85,
        dodge: bossConfig.dodge || 15
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

    // --- ROUND-BASED JUTSU STATE ---
    let playerActiveJutsus = {};
    let npcActiveJutsus = {};
    let playerRoundBasedSummaries = [];
    let npcRoundBasedSummaries = [];

    // Add defeat counters for Haku/Corrupted Haku
    if (!users[userId].hakuDefeats) users[userId].hakuDefeats = 0;
    if (!users[userId].corruptHakuDefeats) users[userId].corruptHakuDefeats = 0;

    // --- BLOODLINE STATE ---
    const playerBloodline = player.bloodline;
    let bloodlineActive = false;
    let bloodlineRoundsLeft = 0;
    let bloodlineUsed = false;

    while (player.health > 0 && npc.currentHealth > 0) {
        // --- BLOODLINE AUTO-ACTIVATION ---
        let bloodlineEmbed = null;
        if (playerBloodline === "Nara") {
            player.chakra += 3;
            bloodlineEmbed = new EmbedBuilder()
                .setTitle("Battle IQ")
                .setDescription(`${BLOODLINE_DEPARTMENTS[playerBloodline]}\n\n<@${player.id}> activates **${BLOODLINE_NAMES[playerBloodline]}**!\nBattle IQ grants +3 chakra this round!`)
                .setImage(BLOODLINE_GIFS[playerBloodline])
                .setColor(0x8B4513);
            await interaction.followUp({ embeds: [bloodlineEmbed] });
        }
        if (playerBloodline === "Uchiha" && bloodlineActive) {
            bloodlineRoundsLeft--;
            if (bloodlineRoundsLeft <= 0) {
                bloodlineActive = false;
                player.accuracy = 100;
            }
        }
        if (!bloodlineUsed && playerBloodline && playerBloodline !== "Nara") {
            let shouldActivate = false;
            const hp = typeof player.health === "number" ? player.health : 0;
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
                        player.health = Math.min(hp + Math.floor(maxHp * 0.5), maxHp);
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
                            bloodlineUsed = true;
                        }
                        break;
                    case "Uchiha":
                        player.accuracy = 100;
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

        // --- UPDATE EFFECT DURATIONS ---
        [player, npc].forEach(entity => {
            entity.activeEffects.forEach(effect => {
                if (effect.duration > 0) effect.duration--;
            });
            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
        });

        // --- EFFECTIVE STATS ---
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

        // --- MOVES EMBED ---
        const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);
        // --- CUSTOM BACKGROUND PATCH ---
        let activeJutsu = null;
        Object.keys(playerActiveJutsus).forEach(jName => {
            const jutsu = jutsuList[jName];
            if (jutsu?.custombackground && playerActiveJutsus[jName].round >= jutsu.custombackground.round) {
                activeJutsu = jutsu;
            }
        });
        Object.keys(npcActiveJutsus).forEach(jName => {
            const jutsu = jutsuList[jName];
            if (jutsu?.custombackground && npcActiveJutsus[jName].round >= jutsu.custombackground.round) {
                activeJutsu = jutsu;
            }
        });
        let customBgUrl = bgUrl;
        if (activeJutsu && activeJutsu.custombackground && roundNum >= activeJutsu.custombackground.round) {
            customBgUrl = activeJutsu.custombackground.url;
        }

        const moveMsg = await interaction.followUp({
            content: `${player.username}, it's your turn!`,
            embeds: [embed],
            components: components,
            fetchReply: true
        });
        // --- BATTLE IMAGE ---
        const battleImage = new AttachmentBuilder(await generateBattleImage(interaction, player, player.health, npc, customBgUrl, npcImgUrl));
        await interaction.followUp({ files: [battleImage] });

        // --- PLAYER MOVE ---
        const playerAction = await new Promise(resolve => {
            const collector = moveMsg.createMessageComponentCollector({
                filter: ii => ii.user.id === userId,
                time: 60000
            });
            collector.on('collect', async ii => {
                await ii.deferUpdate();
                const action = ii.customId.split('-')[0];
                if (action === 'rest') {
                    player.chakra += 1;
                    resolve({
                        damage: 0,
                        heal: 0,
                        description: `${player.username} gathered chakra and rested`,
                        specialEffects: ["+1 Chakra"],
                        hit: true,
                        isRest: true
                    });
                } else if (action === 'flee') {
                    resolve({ fled: true });
                } else if (action.startsWith('move')) {
                    // Button index
                    const idx = parseInt(ii.customId.split('-')[0].replace('move', '')) - 1;
                    const jutsuNames = Object.entries(player.jutsu)
                        .filter(([_, jutsu]) => jutsu !== 'None')
                        .map(([_, jutsuName]) => jutsuName);
                    const jutsuName = jutsuNames[idx];
                    const jutsu = jutsuList[jutsuName];
                    // --- ROUND-BASED JUTSU ACTIVATION PATCH ---
                    if (jutsu?.roundBased) {
                        if (!playerActiveJutsus[jutsuName]) {
                            if ((player.chakra || 0) < (jutsu.chakraCost || 0)) {
                                resolve({
                                    damage: 0,
                                    heal: 0,
                                    description: `${player.username} failed to perform ${jutsu.name} (not enough chakra)`,
                                    specialEffects: ["Not enough chakra!"],
                                    hit: false,
                                    jutsuUsed: jutsuName
                                });
                                collector.stop();
                                return;
                            }
                            player.chakra -= jutsu.chakraCost || 0;
                            playerActiveJutsus[jutsuName] = { round: 1 };
                            // Show round-based summary for display
                            const roundEffect = BattleUtils.getRoundEffect(jutsu.roundEffects, 1);
                            let desc = roundEffect?.description || "";
                            desc = desc
                                .replace(/\buser\b/gi, `<@${player.id}>`)
                                .replace(/\btarget\b/gi, npc.name)
                                .replace(/\[Player\]/g, player.username)
                                .replace(/\[Enemy\]/g, npc.name);
                            playerRoundBasedSummaries.push({
                                desc: desc,
                                effects: []
                            });
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: desc,
                                specialEffects: [],
                                hit: true,
                                jutsuUsed: jutsuName,
                                isRoundBased: true,
                                roundBasedDesc: desc,
                                roundBasedEffects: []
                            });
                            collector.stop();
                            return;
                        }
                    }
                    // Track combo progress
                    if (comboState && comboState.combo.requiredJutsus.includes(jutsuName)) {
                        comboState.usedJutsus.add(jutsuName);
                    }
                    if (!jutsu) {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${player.username} attempted unknown jutsu: ${jutsuName}`,
                            specialEffects: ["Jutsu failed!"],
                            hit: false,
                            jutsuUsed: jutsuName
                        });
                    } else if ((player.chakra || 0) < (jutsu.chakraCost || 0)) {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${player.username} failed to perform ${jutsu.name} (not enough chakra)`,
                            specialEffects: ["Not enough chakra!"],
                            hit: false,
                            jutsuUsed: jutsuName
                        });
                    } else {
                        player.chakra -= jutsu.chakraCost || 0;
                        let result = { damage: 0, heal: 0, description: jutsu.description || `${player.username} used ${jutsu.name}`, specialEffects: [], hit: true, jutsuUsed: jutsuName };
                        for (const effect of (jutsu.effects || [])) {
                            if (effect.type === 'damage') {
                                const { damage, hit } = effectHandlers.damage(player, npc, effect.formula);
                                result.damage += damage;
                                result.hit = hit;
                                if (hit && damage > 0) result.specialEffects.push(`Dealt ${Math.round(damage)} damage`);
                                else if (!hit) {
                                    result.description = `${player.username} missed with ${jutsu.name}!`;
                                    result.specialEffects.push("Attack missed!");
                                }
                            }
                            if (effect.type === 'heal') {
                                const healAmount = effectHandlers.heal(player, effect.formula);
                                result.heal += healAmount;
                                if (healAmount > 0) result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                            }
                            // Add more effect types as needed
                        }
                        resolve(result);
                    }
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

        // --- COMBO COMPLETION ---
        let comboCompletedThisRound = false;
        let comboDamageText = "";
        if (
            comboState &&
            comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
        ) {
            npc.currentHealth -= comboState.combo.damage;
            comboCompletedThisRound = true;
            comboDamageText = `\n${player.username} lands a ${comboState.combo.name}! Dealt ${comboState.combo.damage} true damage!`;
            comboState.usedJutsus.clear();
        }

        npc.currentHealth -= playerAction.damage || 0;
        player.health = Math.min(player.health + (playerAction.heal || 0), player.maxHealth);

        // --- NPC MOVE ---
        const stunned = npc.activeEffects.some(e => e.type === 'status' && e.status === 'stun');
        let npcAction = { damage: 0, heal: 0, description: `${npc.name} is stunned and can't move!`, hit: false, specialEffects: ["Stun active"] };
        if (!stunned) {
            // --- ROUND-BASED JUTSU ACTIVATION PATCH FOR NPC ---
            // NPC will activate round-based jutsu if available and not already active
            let npcJutsuName = null;
            if (npc.name === "Haku" && jutsuList["Needle Assault"]) {
                npcJutsuName = "Needle Assault";
            } else if (npc.name === "Corrupted Haku" && jutsuList["Corrupted Needle Assault"]) {
                npcJutsuName = "Corrupted Needle Assault";
            } else if (Array.isArray(npc.jutsu) && npc.jutsu.length > 0) {
                npcJutsuName = npc.jutsu[0];
            } else {
                npcJutsuName = 'Attack';
            }
            const jutsu = jutsuList[npcJutsuName];
            if (jutsu?.roundBased) {
                if (!npcActiveJutsus[npcJutsuName]) {
                    if ((npc.chakra || 0) < (jutsu.chakraCost || 0)) {
                        npcAction = {
                            damage: 0,
                            heal: 0,
                            description: `${npc.name} failed to perform ${jutsu.name} (not enough chakra)`,
                            specialEffects: ["Not enough chakra!"],
                            hit: false,
                            jutsuUsed: npcJutsuName
                        };
                    } else {
                        npc.chakra -= jutsu.chakraCost || 0;
                        npcActiveJutsus[npcJutsuName] = { round: 1 };
                        const roundEffect = BattleUtils.getRoundEffect(jutsu.roundEffects, 1);
                        let desc = roundEffect?.description || "";
                        desc = desc
                            .replace(/\buser\b/gi, npc.name)
                            .replace(/\btarget\b/gi, `<@${player.id}>`)
                            .replace(/\[Player\]/g, npc.name)
                            .replace(/\[Enemy\]/g, player.username);
                        npcRoundBasedSummaries.push({
                            desc: desc,
                            effects: []
                        });
                        npcAction = {
                            damage: 0,
                            heal: 0,
                            description: desc,
                            specialEffects: [],
                            hit: true,
                            jutsuUsed: npcJutsuName,
                            isRoundBased: true,
                            roundBasedDesc: desc,
                            roundBasedEffects: []
                        };
                    }
                }
            } else {
                const npcJutsu = jutsu || { name: "Attack", damage: "target.power", chakraCost: 0, type: "damage" };
                npcAction = { damage: 0, heal: 0, description: `${npc.name} attacks!`, hit: true };
                if ((npc.chakra || 0) >= (npcJutsu.chakraCost || 0)) {
                    npc.chakra -= npcJutsu.chakraCost;
                    if (npcJutsu.type === 'damage' || (npcJutsu.effects && npcJutsu.effects.some(e => e.type === 'damage'))) {
                        const { damage, hit } = effectHandlers.damage(npc, player, npcJutsu.damage || (npcJutsu.effects && npcJutsu.effects[0].formula) || "npc.power");
                        npcAction.damage = damage;
                        npcAction.hit = hit;
                        npcAction.description = `${npc.name} used ${npcJutsu.name}${hit ? ` ` : " but missed!"}`;
                    }
                    // Add more effect types as needed
                }
            }
        }
        player.health -= npcAction.damage || 0;

        // --- ROUND SUMMARY PATCH ---
        // Add round-based summaries to the embed
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

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`Round: ${roundNum}!`)
            .setColor('#006400')
            .setDescription(
                `${player.username} ${playerAction.description}` +
                `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                (comboCompletedThisRound ? comboDamageText : "") +
                roundBasedText(playerRoundBasedSummaries) +
                `\n\n${npc.name} ${npcAction.description}` +
                `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
                roundBasedText(npcRoundBasedSummaries)
            )
            .addFields({
                name: 'Battle Status',
                value: `${player.username} | ${Math.round(player.health)} HP | ${player.chakra} Chakra\n${npc.name} | ${Math.round(npc.currentHealth ?? npc.health)} HP | ${npc.chakra} Chakra`
            });

        await interaction.followUp({ embeds: [summaryEmbed] });

        // Clear round-based summaries after displaying
        playerRoundBasedSummaries = [];
        npcRoundBasedSummaries = [];

        // Passive chakra regen
        player.chakra += CHAKRA_REGEN[player.rank] || 1;
        npc.chakra += 2;

        // --- CHECK FOR END ---
        if (player.health <= 0) {
            await interaction.followUp(`**You have been defeated by ${bossName}! Game Over.**`);
            return "loss";
        }
        if (npc.currentHealth <= 0) {
            await interaction.followUp(`**${bossName} has been defeated! You win!**`);
            // --- REWARD EMBED (brank.js style) ---
            const expReward = bossConfig.exp;
            const moneyReward = bossConfig.money;
            // --- Actually add exp/money to user and save ---
            users[userId].exp = (users[userId].exp || 0) + expReward;
            users[userId].money = (users[userId].money || 0) + moneyReward;

            // --- Haku/Corrupted Haku scroll drop logic ---
            const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
            let jutsuData = {};
            if (fs.existsSync(jutsuPath)) jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
            if (!jutsuData[userId]) jutsuData[userId] = {};
            if (!jutsuData[userId].scrolls) jutsuData[userId].scrolls = [];

            if (bossName === "Haku") {
                users[userId].hakuDefeats = (users[userId].hakuDefeats || 0) + 1;
                // On 5th win, give Needle Assault Scroll
                if (users[userId].hakuDefeats === 5 && !jutsuData[userId].scrolls.includes("Needle Assault Scroll")) {
                    jutsuData[userId].scrolls.push("Needle Assault Scroll");
                }
            }
            if (bossName === "Corrupted Haku") {
                users[userId].corruptHakuDefeats = (users[userId].corruptHakuDefeats || 0) + 1;
                // On 10th corrupt win, give Corrupted Needle Assault Scroll
                if (users[userId].corruptHakuDefeats === 10 && !jutsuData[userId].scrolls.includes("Corrupted Needle Assault Scroll")) {
                    jutsuData[userId].scrolls.push("Corrupted Needle Assault Scroll");
                }
            }
            // Save users and jutsu
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));

            const rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End! ${player.username} has won!`)
                .setDescription(
                    `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward.toLocaleString()}!`
                )
                .setColor('#006400');
            await interaction.followUp({ embeds: [rewardEmbed] });
            return "win";
        }

        roundNum++;
    }
    return "unknown";
}

// --- STORY HANDLER (future-proof, all buttons on webhook) ---
async function runStoryAndBattle(bossId, bossConfig, phase2Config = null) {
    let asumaWebhook, hakuWebhook, kagamiWebhook, hakuCorruptWebhook, zabuzaWebhook, orochimaruWebhook;
    if (bossId === "haku") {
        asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
        hakuWebhook = await getCharacterWebhook(interaction.channel, "Haku", HAKU_AVATAR);
        kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
        hakuCorruptWebhook = await getCharacterWebhook(interaction.channel, "Corrupted Haku", HAKU_CORRUPT_AVATAR);
    }
    // Future-proof: add for Zabuza/Orochimaru
    if (bossId === "zabuza") {
        zabuzaWebhook = await getCharacterWebhook(interaction.channel, "Zabuza", srankBosses.zabuza.image);
    }
    if (bossId === "orochimaru") {
        orochimaruWebhook = await getCharacterWebhook(interaction.channel, "Orochimaru", srankBosses.orochimaru.image);
    }

    let skipStory = false;
    if (bossId === "haku") {
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
    }

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
    } else if (bossId === "haku") {
        // Story sequence, all buttons on webhooks, more divisions
        // 1. Asuma tells Haku's story
        for (const loreLine of bossConfig.lore) {
            await asumaWebhook.send({ content: loreLine });
            await new Promise(res => setTimeout(res, 2500)); // Increased delay
        }
        // 2. Ready prompt
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
        // 3. Haku dialogue
        await hakuWebhook.send({ content: "Nobody hurts Zabuza!" });
        await new Promise(res => setTimeout(res, 2500));
        await hakuWebhook.send({ content: "Another Shinobi attempting to kill Zabuza? I will kill you instead!" });
        await new Promise(res => setTimeout(res, 2500));
        // 4. Fight button on Haku webhook
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
    // --- PHASE 1 BATTLE ---
    let phase1Result = await runSrankBattle(
        interaction, users, userId, players, jutsuList, bossConfig, HAKU_BG, HAKU_AVATAR, bossConfig.name
    );
    if (bossId === "haku" && phase1Result === "win") {
        // 5. Death & corruption sequence
        await hakuWebhook.send({ content: "*coughs up blood* I...*cough*" });
        await new Promise(res => setTimeout(res, 2500));
        await asumaWebhook.send({ content: `<@${userId}> I feel a very strange power heading towards us, we should leave immediately.` });
        await new Promise(res => setTimeout(res, 2500));
        // Corrupt BG
        await interaction.channel.send({ content: "Suddenly, the area turns into a hellish place...", files: [], embeds: [], components: [], allowedMentions: { parse: [] }, ephemeral: false });
        // 6. Kagami appears, more mockery
        await kagamiWebhook.send({ content: "Oh? Look at this weakling being defeated by a mere Shinobi." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "You think you can change fate? How amusing. My puppets will always rise again." });
        await new Promise(res => setTimeout(res, 2500));
        await kagamiWebhook.send({ content: "*extends a hand towards Haku, purplish energy swirls*" });
        await new Promise(res => setTimeout(res, 2500));
        await hakuCorruptWebhook.send({ content: "Master...Revenge." });
        await new Promise(res => setTimeout(res, 2500));
        // Fight button on Corrupted Haku webhook
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
        // --- PHASE 2 BATTLE ---
        let phase2Result = await runSrankBattle(
            interaction, users, userId, players, jutsuList,
            phase2Config || {
                ...bossConfig,
                name: "Corrupted Haku",
                image: HAKU_CORRUPT_AVATAR,
                jutsu: ["Corrupted Needle Assault"],
                health: 3500,
                power: 1300,
                defense: 700,
                exp: 3.5,
                money: 15000
            },
            HAKU_CORRUPT_BG, HAKU_CORRUPT_AVATAR, "Corrupted Haku"
        );
        if (phase2Result === "win") {
            await kagamiWebhook.send({ content: "Hmm..Not half bad. Let me go prepare my other puppet...Zabuza. Until next time then, Shinobi." });
        }
    }
    // --- Future-proof: Zabuza/Orochimaru story structure ---
    if (bossId === "zabuza") {
        for (const loreLine of bossConfig.lore) {
            await zabuzaWebhook.send({ content: loreLine });
            await new Promise(res => setTimeout(res, 2500));
        }
        const fightRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('zabuza_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
        );
        const fightMsg = await zabuzaWebhook.send({ content: "Ready to face the Demon of the Mist?", components: [fightRow] });
        await new Promise(resolve => {
            const c = fightMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'zabuza_story_fight',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
        await runSrankBattle(
            interaction, users, userId, players, jutsuList, bossConfig, bossConfig.image, bossConfig.image, bossConfig.name
        );
    }
    if (bossId === "orochimaru") {
        for (const loreLine of bossConfig.lore) {
            await orochimaruWebhook.send({ content: loreLine });
            await new Promise(res => setTimeout(res, 2500));
        }
        const fightRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('orochimaru_story_fight').setLabel('Fight').setStyle(ButtonStyle.Danger)
        );
        const fightMsg = await orochimaruWebhook.send({ content: "Step forward if you dare.", components: [fightRow] });
        await new Promise(resolve => {
            const c = fightMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && btn.customId === 'orochimaru_story_fight',
                time: 60000
            });
            c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
            c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
        });
        await runSrankBattle(
            interaction, users, userId, players, jutsuList, bossConfig, bossConfig.image, bossConfig.image, bossConfig.name
        );
    }
}