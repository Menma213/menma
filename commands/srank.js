const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');
const { createCanvas, loadImage, registerFont } = require('canvas');
const Locks = require('../utils/locks');
const userMutex = Locks.userMutex;
const jutsuMutex = Locks.jutsuMutex;
const mentorMutex = Locks.mentorMutex;
const https = require('https');

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

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '../../menma/images');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const mentorExpPath = path.resolve(__dirname, '../../menma/data/mentorexp.json');

let jutsuList = {};
let jutsuData = {};
let COMBOS = {};
if (fs.existsSync(jutsusPath)) jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
if (fs.existsSync(jutsuPath)) jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
if (fs.existsSync(combosPath)) COMBOS = JSON.parse(fs.readFileSync(combosPath, 'utf8'));

async function cleanupWebhooks(interaction) {
    try {
        const webhooks = await interaction.channel.fetchWebhooks();
        if (webhooks.size < 15) return;
        for (const webhook of webhooks.values()) {
            if (webhook.owner && webhook.owner.id === interaction.client.user.id) {
                await webhook.delete();
            }
        }
    } catch (error) {
        console.error(`[SRank Error - cleanupWebhooks]:`, error);
    }
}
const ASUMAANDKURENAI = 'https://i.postimg.cc/XvS9FdJv/image.png';
const WAITWHAT = 'https://i.postimg.cc/ydfZKWTP/image.png';
const KURENAIPANIC = 'https://i.postimg.cc/mgNWykpN/image.png';
const KURENAIRIGHT = 'https://i.postimg.cc/bN2hspX8/image.png';
const ASUMASCARED = 'https://i.postimg.cc/CxDQVx3B/image.png';
const ASUMA_AVATAR = 'https://i.pinimg.com/originals/d9/b6/1a/d9b61a4328fd5986574164a3d40e430f.png';
const HAKU_AVATAR = 'https://i.pinimg.com/736x/b3/f3/3f/b3f33f19eWJh8J6Mx9DrGXKEv3ojKmqw8Cv9pscK.jpg';
const KAGAMI_AVATAR = 'https://i.postimg.cc/Jzr9bXRx/image.png';
const HAKU_CORRUPT_AVATAR = 'https://i.postimg.cc/c1kJqHXq/image.png';
const ZABUZA_AVATAR = 'https://i.postimg.cc/6pn0FP6j/image.png';
const OROCHIMARU_AVATAR = 'https://cdn.staticneo.com/w/naruto/thumb/Orochimaru_1.jpg/250px-Orochimaru_1.jpg';
const HAKU_BG = 'https://i.pinimg.com/474x/a6/e4/b6/a6e4b61fd616f4452c7f52f814477bc0.jpg';
const HAKU_CORRUPT_BG = 'https://i.postimg.cc/SxKGdrVF/image.png';
const CORRUPTED_OROCHIMARU = 'https://i.postimg.cc/qRHPX9dV/image.png'
const ZABUZA_BG = 'https://i.postimg.cc/SxKGdrVF/image.png';
const KURENAI_MEMORY_1 = 'https://i.postimg.cc/8kqtMCvG/image.png';
const KURENAI_MEMORY_2 = 'https://i.postimg.cc/gksLdSGP/image.png';
const KURENAI_MEMORY_3 = 'https://i.postimg.cc/6pGKzqjT/image3.jpg';
const OROCHIMARU_BG = 'https://i.postimg.cc/wj29bZQG/image.png';
const KURENAI_AVATAR = 'https://static.wikia.nocookie.net/naruto/images/6/67/Kurenai_Part_I.png/revision/latest?cb=20150207094753';
const VILLAGE_BG = 'https://i.ytimg.com/vi/pRV3lo7eJkM/maxresdefault.jpg?sqp=-oaymwEmCIAKENAF8quKqQMa8AEB-AHUBoAC4AOKAgwIABABGDsgYChlMA8=&rs=AOn4CLB7pjqRrgA4Facq_yOjd_bg_X3VgQ'
const HIDEOUT_BG = 'https://i.pinimg.com/originals/90/7d/8e/907d8e2f3f4e4c6f4e4c6f4e4c6f4c6f.jpg';
const SKY_REVEAL_IMG = 'https://files.idyllic.app/files/static/3948049';
const ANCESTOR_STONE_IMG = 'https://i.pinimg.com/736x/8e/9e/8e/8e9e8e2f3f4e4c6f4e4c6f4e4c6f4c6f.jpg';

const srankBosses = {
    "haku": {
        name: "Haku",
        image: "https://static.wikia.nocookie.net/naruto/images/3/35/Haku%27s_shinobi_attire.png/revision/latest/scale-to-width-down/1200?cb=20160610212143",
        health: 250,
        power: 900,
        defense: 40,
        jutsu: ["Attack", "Needle Assault"],
        reward: "Needle Assault",
        rewardChance: 0.5,
        rewardScroll: "Needle Assault Scroll",
        accuracy: 90,
        dodge: 15,
        baseExp: 100,
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
        health: 350,
        power: 1500,
        defense: 80,
        jutsu: ["Attack", "Silent Assassination", "Hidden Mist"],
        reward: "Silent Assassination",
        rewardChance: 0.3,
        rewardScroll: "Silent Assassination Scroll",
        accuracy: 95,
        dodge: 60,
        baseExp: 250,
        money: 25000,
        lore: [
            "Zabuza Momochi, the Demon of the Hidden Mist, is a legendary swordsman feared for his ruthless tactics. He seeks power above all, and his only bond is with Haku.",
            "Defeating Zabuza will shake the criminal underworld."
        ],
        requiredDefeats: 1,
        unlocks: "orochimaru",
        corrupted: true
    },
    "orochimaru": {
        name: "Orochimaru",
        image: "https://www.pngplay.com/wp-content/uploads/12/Orochimaru-PNG-Free-File-Download.png",
        health: 500,
        power: 2000,
        defense: 120,
        jutsu: ["Attack", "Serpents Wrath", "Poison Mist"],
        reward: "Serpents Wrath",
        rewardChance: 0.3,
        rewardScroll: "Serpents Wrath Scroll",
        accuracy: 95,
        dodge: 25,
        baseExp: 600,
        money: 50000,
        lore: [
            "Orochimaru, once a Leaf Sannin, now walks a dark path in pursuit of forbidden jutsu and immortality. His experiments have left a trail of terror.",
            "Facing Orochimaru means facing the unknown."
        ],
        requiredDefeats: 2,
        unlocks: null,
        corrupted: true
    },
    "ten_tails": {
        name: "Ten Tails",
        image: "https://static.wikia.nocookie.net/naruto/images/7/7c/Ten-Tails.png/revision/latest?cb=20141009144120",
        health: 1,
        power: 1,
        defense: 1,
        jutsu: ["Attack"],
        reward: null,
        power: 1,
        defense: 1,
        jutsu: ["Attack"],
        reward: null,
        accuracy: 100,
        dodge: 0,
        baseExp: 0,
        money: 0,
        lore: ["A mysterious Ten Tails appears!"]
    },
    "corrupted_orochimaru": {
        name: "Corrupted Orochimaru",
        image: OROCHIMARU_AVATAR,
        health: 550,
        power: 2100,
        defense: 130,
        jutsu: ["Attack", "Serpents Wrath", "Poison Mist"],
        reward: null,
        accuracy: 95,
        dodge: 35,
        baseExp: 700,
        money: 75000,
        lore: ["Orochimaru corrupted by Kagami's power"]
    },
    "corrupted_kurenai": {
        name: "Corrupted Kurenai",
        image: "https://i.postimg.cc/MHXsJD7Z/image.png",
        health: 400,
        power: 1800,
        defense: 100,
        jutsu: ["Attack", "Fireball Jutsu", "Demonic Illusion", "Rasengan", "Mystic Palm"],
        reward: null,
        accuracy: 90,
        dodge: 25,
        baseExp: 0,
        money: 60000,
        lore: ["Kurenai possessed by Kagami"],
        survivalRounds: 5
    },
    "kagami": {
        name: "Kagami",
        image: KAGAMI_AVATAR,
        health: 700,
        power: 2400,
        defense: 160,
        jutsu: ["Attack", "Serpents Wrath", "Fireball Jutsu", "Demonic Illusion"],
        reward: null,
        accuracy: 98,
        dodge: 40,
        baseExp: 1100,
        money: 100000,
        lore: ["The mysterious witch Kagami"]
    },
    "bandit_group": {
        name: "Bandit Trio",
        image: "https://i.postimg.cc/8zqTwX3M/image.png",
        health: 450,
        power: 1200,
        defense: 60,
        jutsu: ["Attack", "Sword Slash"],
        baseExp: 200,
        money: 15000,
        lore: ["A group of bandits blocking the path to the hideout."]
    },
    "kabuto": {
        name: "Kabuto Yakushi",
        image: "https://i.pinimg.com/originals/10/b9/9a/10b99a69bded24c70649a5f9206bee21.jpg",
        health: 700,
        power: 2500,
        defense: 100,
        jutsu: ["Attack", "Chakra Scalpel", "Medical Jutsu"],
        baseExp: 500,
        money: 40000,
        lore: ["The expert medic and spy guarding the inner entrance."]
    },
    "mysterious_figure": {
        name: "???",
        image: "https://files.idyllic.app/files/static/3948049",
        health: 1500,
        power: 3500,
        defense: 300,
        jutsu: ["Attack", "Serpents Wrath", "Fireball Jutsu", "Demonic Illusion"],
        baseExp: 1000,
        money: 100000,
        lore: ["He who resurrected the Sky. His power is beyond measurement."]
    }
};

function getSrankExpReward(playerLevel, baseExp) {
    return Math.floor(baseExp + (Number(playerLevel) * 2));
}

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
            const finalAccuracy = effect.accuracyBonus ?
                effectHandlers.getAccuracyBonus(effect, context.user.accuracy) :
                context.user.accuracy;
            const hitChance = Math.max(0, Math.min(100, finalAccuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            if (!hits) return { damage: 0, hit: false };
            const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
            return { damage, hit: true };
        } catch (err) {
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
            return 0;
        }
    },
    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1),
    bleed: (target) => Math.floor(target.health * 0.1),
    flinch: (chance) => Math.random() < chance,
    getAccuracyBonus: (effect, baseAccuracy) => baseAccuracy + (effect.accuracyBonus || 0)
};

const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chuunin': 2,
    'Jounin': 3
};

try {
    registerFont(path.join(__dirname, '../assets/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
    registerFont(path.join(__dirname, '../assets/Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
} catch (e) { }

function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}
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

async function getCharacterWebhook(channel, name, avatar) {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === name);
    if (!wh) {
        wh = await channel.createWebhook({ name, avatar });
    }
    return wh;
}

async function sendCharacterWebhook(channel, name, avatar, content) {
    if (!content || !content.trim()) return;
    const wh = await getCharacterWebhook(channel, name, avatar);
    return wh.send({ content }).catch(() => { });
}

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
        if (bgImg) ctx.drawImage(bgImg, 0, 0, width, height);
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
        const charW = 150, charH = 150;
        const playerX = width - 50 - charW, playerY = 120;
        const npcX = 50, npcY = 120;
        const nameY = 80, barY = 280;
        const nameH = 28, barH = 22;
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
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
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
        const npcHealthPercent = Math.max((npc.currentHealth ?? npc.health) / npc.health, 0);
        ctx.save();
        ctx.fillStyle = "#333";
        roundRect(ctx, npcX, barY, charW, barH, 5);
        ctx.fill();
        ctx.fillStyle = "#ff4444";
        roundRect(ctx, npcX, barY, charW * npcHealthPercent, barH, 5);
        ctx.fill();
        ctx.restore();
        const playerHealthPercent = Math.max(playerHealth / player.health, 0);
        ctx.save();
        ctx.fillStyle = "#333";
        roundRect(ctx, playerX, barY, charW, barH, 5);
        ctx.fill();
        ctx.fillStyle = "#4CAF50";
        roundRect(ctx, playerX, barY, charW * playerHealthPercent, barH, 5);
        ctx.fill();
        ctx.restore();
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

async function sendWebhookWithContinue(webhook, options, userId) {
    const buttonId = 'continue_' + Date.now() + Math.floor(Math.random() * 1000);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(buttonId).setLabel('Continue').setStyle(ButtonStyle.Secondary)
    );
    const msg = await webhook.send({ ...options, components: [row] });
    return new Promise(resolve => {
        const c = msg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === buttonId,
            time: 600000,
            max: 1
        });
        c.on('collect', async btn => {
            try { await btn.update({ components: [] }); } catch (e) { }
            resolve();
            c.stop();
        });
        c.on('end', async (_, reason) => {
            if (reason === 'time') {
                try { await msg.edit({ components: [] }).catch(() => { }); } catch (e) { }
            }
            resolve();
        });
    });
}

async function sendMsgWithContinue(interaction, options, userId) {
    const buttonId = 'continue_msg_' + Date.now() + Math.floor(Math.random() * 1000);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(buttonId).setLabel('Continue').setStyle(ButtonStyle.Secondary)
    );
    const msg = await interaction.followUp({ ...options, components: [row], fetchReply: true });
    return new Promise(resolve => {
        const c = msg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === buttonId,
            time: 600000,
            max: 1
        });
        c.on('collect', async btn => {
            try { await btn.update({ components: [] }); } catch (e) { }
            resolve();
            c.stop();
        });
        c.on('end', async (_, reason) => {
            if (reason === 'time') {
                try { await msg.edit({ components: [] }).catch(() => { }); } catch (e) { }
            }
            resolve();
        });
    });
}

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
}

function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) {
    const jutsu = jutsuList[jutsuName];
    if (!jutsu) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.username} attempted unknown jutsu: ${jutsuName}`,
            specialEffects: ["Jutsu failed!"],
            hit: false,
            image_url: null
        };
    }
    const result = {
        damage: 0,
        heal: 0,
        description: jutsu.description || `${baseUser.username} used ${jutsu.name}`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuName,
        image_url: jutsu.image_url || null
    };
    if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.username} failed to perform ${jutsu.name} (not enough chakra)`,
            specialEffects: ["Chakra exhausted!"],
            hit: false,
            image_url: jutsu.image_url || null
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
            result.specialEffects.push(`Error applying ${effect.type} effect`);
        }
    });
    return result;
}

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
            isRest: true,
            image_url: null
        };
    }
    if (action === 'flee') return { fled: true, image_url: null };
    const idx = parseInt(action.replace('move', '')) - 1;
    const jutsuNames = Object.entries(basePlayer.jutsu)
        .filter(([_, jutsu]) => jutsu !== 'None')
        .map(([_, jutsuName]) => jutsuName);
    const jutsuName = jutsuNames[idx];
    return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, jutsuName);
}

function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer) {
    const stunnedEffect = baseNpc.activeEffects.find(e => e.type === 'status' && e.status === 'stun');
    if (stunnedEffect) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseNpc.name} is stunned and can't move!`,
            specialEffects: ["Stun active"],
            hit: false,
            image_url: null
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
            hit: true,
            image_url: null
        };
    }
    const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
    return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
}

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
    let statusEffects = [];
    [player, npc].forEach(entity => {
        if (!entity.activeEffects) return;
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'status') {
                switch (effect.status) {
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

    if (playerAction.image_url) embed.setImage(playerAction.image_url);
    else if (npcAction.image_url) embed.setImage(npcAction.image_url);
    return embed;
}

async function runAnbuTenTailsBattle(interaction, users, userId, players) {
    const anbuTeam = {
        name: "Anbu Black Ops Team",
        image: "https://static.wikia.nocookie.net/naruto/images/7/7c/ANBU.png/revision/latest?cb=20150123165943",
        health: 100000,
        currentHealth: 100000,
        power: 5000,
        defense: 300,
        chakra: 999,
        accuracy: 100,
        dodge: 50,
        jutsu: ["Attack"],
        activeEffects: []
    };

    const tenTails = {
        ...srankBosses.ten_tails,
        currentHealth: 1,
        chakra: 999,
        activeEffects: []
    };

    let roundNum = 1;

    while (anbuTeam.currentHealth > 0 && tenTails.currentHealth > 0) {

        const anbuDamage = Math.floor(anbuTeam.power * 0.1);
        tenTails.currentHealth -= anbuDamage;

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`Round ${roundNum} - Anbu Team vs Ten Tails`)
            .setColor('#006400')
            .setDescription(
                `**Anbu Black Ops** attack the Ten Tails for ${anbuDamage} damage!\n` +
                `**Ten Tails** tries to fight back but is overwhelmed!\n\n` +
                `**Battle Status:**\n` +
                `Anbu Team | ${anbuTeam.currentHealth.toLocaleString()} HP\n` +
                `Ten Tails | ${Math.max(0, tenTails.currentHealth)} HP`
            );

        await interaction.followUp({ embeds: [summaryEmbed] });

        if (tenTails.currentHealth <= 0) {
            await sendMsgWithContinue(interaction, { content: "**The Ten Tails has been defeated!**" }, userId);
            break;
        }

        roundNum++;
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return "win";
}
async function runSurvivalBattle(interaction, users, userId, players, jutsuList, bossConfig) {
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
    const initialChakra = player.chakra;
    try {
        player.activeEffects = player.activeEffects || [];

        let roundNum = 1;
        const survivalRounds = bossConfig.survivalRounds || 5;
        let survivedRounds = 0;

        while (player.health > 0 && survivedRounds < survivalRounds) {
            const effectivePlayer = BattleUtils.getEffectiveStats(player);
            const effectiveNpc = BattleUtils.getEffectiveStats(npc);

            const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);

            const survivalEmbed = new EmbedBuilder()
                .setTitle(`SURVIVE! Round ${survivedRounds + 1}/${survivalRounds}`)
                .setColor('#FF0000')
                .setDescription(`**OBJECTIVE: Survive ${survivalRounds} rounds!**\nDo not kill ${npc.name}!\n\n${embed.data.description}`);

            const moveMsg = await interaction.followUp({
                content: `${player.username}, survive!`,
                embeds: [survivalEmbed],
                components: components,
                fetchReply: true
            });

            const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, VILLAGE_BG, npc.image));
            await interaction.followUp({ files: [battleImage] });

            const playerAction = await new Promise(resolve => {
                const collector = moveMsg.createMessageComponentCollector({
                    filter: ii => ii.user.id === userId,
                    time: 60000
                });
                collector.on('collect', async ii => {
                    await ii.deferUpdate();
                    const actionResult = await processPlayerMove(ii.customId, player, npc, effectivePlayer, effectiveNpc);
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

            if (playerAction.damage) {
                npc.currentHealth = Math.max(1, npc.currentHealth - playerAction.damage);
            }

            if (playerAction.heal) {
                player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
            }

            let npcAction = { damage: 0, heal: 0, description: `${npc.name} attacks`, specialEffects: [], hit: false };
            if (npc.currentHealth > 0) {
                npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                player.health -= npcAction.damage || 0;
            }

            player.health = Math.max(0, player.health);

            const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, null);
            await interaction.followUp({ embeds: [summaryEmbed] });

            if (player.health <= 0) {
                await sendMsgWithContinue(interaction, { content: `**You failed to survive! Game Over.**` }, userId);
                return "loss";
            }

            survivedRounds++;

            if (survivedRounds >= survivalRounds) {
                await sendMsgWithContinue(interaction, { content: `**You survived ${survivalRounds} rounds! Objective complete!**` }, userId);
                return "win";
            }

            player.chakra += CHAKRA_REGEN[player.rank] || 1;
            npc.chakra += 2;

            [player, npc].forEach(entity => {
                entity.activeEffects.forEach(effect => {
                    if (effect.duration > 0) effect.duration--;
                });
                entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
            });

            roundNum++;
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        return "unknown";
    } finally {
        player.chakra = initialChakra;
    }
}

async function runSrankBattle(interaction, users, userId, players, jutsuList, bossConfig, bgUrl, npcImgUrl, bossName, silent = false) {
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
    const initialChakra = player.chakra;
    try {
        player.activeEffects = player.activeEffects || [];
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
            const effectivePlayer = BattleUtils.getEffectiveStats(player);
            const effectiveNpc = BattleUtils.getEffectiveStats(npc);
            const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);
            const moveMsg = await interaction.followUp({
                content: `${player.username}, it's your turn!`,
                embeds: [embed],
                components: components,
                fetchReply: true
            });

            const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, bgUrl, npcImgUrl));
            await interaction.followUp({ files: [battleImage] });
            const playerAction = await new Promise(resolve => {
                const collector = moveMsg.createMessageComponentCollector({
                    filter: ii => ii.user.id === userId,
                    time: 60000
                });
                collector.on('collect', async ii => {
                    await ii.deferUpdate();
                    const actionResult = await processPlayerMove(ii.customId, player, npc, effectivePlayer, effectiveNpc);
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
            npc.currentHealth -= playerAction.damage || 0;
            if (playerAction.heal) {
                player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
            }
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
            let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false, image_url: null };
            if (npc.currentHealth > 0) {
                npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);

                player.health -= npcAction.damage || 0;
                if (npcAction.heal) {
                    npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                }
            }
            player.health = Math.max(0, player.health);
            npc.currentHealth = Math.max(0, npc.currentHealth);
            const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState);
            if (comboResult.completed) {
                summaryEmbed.setDescription(
                    summaryEmbed.data.description + comboResult.damageText
                );
            }
            await interaction.followUp({ embeds: [summaryEmbed] });
            if (player.health <= 0) {
                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (u[userId]) {
                        u[userId].srankResult = "loss";
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }
                });
                await sendMsgWithContinue(interaction, { content: `**You have been defeated by ${bossName}! Game Over.**` }, userId);
                return "loss";
            }
            if (npc.currentHealth <= 0) {
                if (silent) return "win";
                const playerLevel = player.level || 1;
                const expReward = getSrankExpReward(playerLevel, bossConfig.baseExp);
                const moneyReward = bossConfig.money;

                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    const p = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

                    if (u[userId]) {
                        u[userId].srankResult = "win";
                        u[userId].health = player.maxHealth;
                        if (!u[userId].srankDefeats) u[userId].srankDefeats = {};
                        const bossId = bossName.toLowerCase().replace(' ', '_');
                        u[userId].srankDefeats[bossId] = (u[userId].srankDefeats[bossId] || 0) + 1;
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }

                    if (p[userId]) {
                        p[userId].exp += expReward;
                        p[userId].money += moneyReward;
                        p[userId].exp = Math.round(p[userId].exp * 10) / 10;
                        fs.writeFileSync(playersPath, JSON.stringify(p, null, 2));
                    }
                });

                await mentorMutex.runExclusive(async () => {
                    let me = {};
                    try {
                        me = JSON.parse(fs.readFileSync(mentorExpPath, 'utf8'));
                    } catch (e) { }
                    if (!me[userId]) me[userId] = { exp: 0, last_train: 0 };
                    me[userId].exp += 1;
                    fs.writeFileSync(mentorExpPath, JSON.stringify(me, null, 2));
                });

                await sendMsgWithContinue(interaction, { content: `**${bossName} has been defeated! You win!**` }, userId);
                const rewardEmbed = new EmbedBuilder()
                    .setTitle(`Battle End! ${player.username} has won!`)
                    .setDescription(
                        `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward.toLocaleString()}! (Rewards added to your account)`
                    )
                    .setColor('#006400');
                await sendMsgWithContinue(interaction, { embeds: [rewardEmbed] }, userId);

                if (bossConfig.reward && Math.random() < bossConfig.rewardChance) {
                    await jutsuMutex.runExclusive(async () => {
                        const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
                        if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [] };
                        if (!jutsuData[userId].usersjutsu.includes(bossConfig.reward)) {
                            jutsuData[userId].usersjutsu.push(bossConfig.reward);
                            await interaction.followUp(`**Special Reward!** You have obtained the ${bossConfig.reward} scroll!`);
                        }
                        fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));
                    });
                }

                return "win";
            }
            player.chakra += CHAKRA_REGEN[player.rank] || 1;
            npc.chakra += 2;
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
    } finally {
        player.chakra = initialChakra;
    }
}

async function waitForParry(interaction, userId) {
    const buttonId = 'parry_' + Date.now();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buttonId)
            .setLabel('PARRY!')
            .setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.followUp({
        content: "⚠️ **QUICK! PARRY KABUTO'S ATTACK!** (Click within 2 seconds!)",
        components: [row]
    });

    return new Promise(resolve => {
        const c = msg.createMessageComponentCollector({
            filter: btn => btn.user.id === userId && btn.customId === buttonId,
            time: 2000,
            max: 1
        });
        c.on('collect', async btn => {
            await btn.update({ content: "✅ **SUCCESSFUL PARRY!**", components: [] });
            resolve(true);
        });
        c.on('end', async (collected) => {
            if (collected.size === 0) {
                await msg.edit({ content: "❌ **FAILED TO PARRY!**", components: [] }).catch(() => { });
                resolve(false);
            }
        });
    });
}

async function runKagamisHideoutStory(interaction, users, userId, players, jutsuList) {
    try {
        const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
        const userWebhook = await getCharacterWebhook(interaction.channel, interaction.user.username, interaction.user.displayAvatarURL());
        const kabutoWebhook = await getCharacterWebhook(interaction.channel, "Kabuto", "https://static.wikia.nocookie.net/non-aliencreatures/images/a/a1/Kabuto.png/revision/latest?cb=20131030035514");
        const mysteriousWebhook = await getCharacterWebhook(interaction.channel, "???", "https://files.idyllic.app/files/static/3948049");

        // Stage 1: Asuma's Gift
        await sendWebhookWithContinue(asumaWebhook, {
            content: "We're nearing Kagami's hideout. Take this stone. It's an heirloom from a very old ancestor for protection. Grasp it tightly when you truly need it.",
            embeds: [new EmbedBuilder().setTitle("Ancestor's Stone").setImage(ANCESTOR_STONE_IMG).setColor('#FFD700')]
        }, userId);

        // Stage 2: Bandit Ambush
        await interaction.followUp({ content: "**On the way to the hideout, a group of bandits ambushes you!**" });
        let banditResult = await runSrankBattle(interaction, users, userId, players, jutsuList, srankBosses.bandit_group, VILLAGE_BG, srankBosses.bandit_group.image, "Bandit Trio", true);
        if (banditResult !== "win") return "loss";

        await sendWebhookWithContinue(asumaWebhook, { content: "Those were just small fry. The hideout is just ahead. I can feel the dark chakra from here." }, userId);

        // Stage 3: Kabuto's Guard
        await interaction.followUp({ content: "**You enter the hideout and see Kabuto guarding the inner entrance.**" });
        await sendWebhookWithContinue(kabutoWebhook, { content: "You shouldn't have come here. My master's experiments are not for your eyes." }, userId);

        let lives = 2;
        let kabutoFights = 3;

        for (let i = 1; i <= kabutoFights; i++) {
            await interaction.followUp({ content: `**Fight ${i}/${kabutoFights}: Engaging Kabuto!**` });
            let result = await runSrankBattle(interaction, users, userId, players, jutsuList, srankBosses.kabuto, OROCHIMARU_BG, srankBosses.kabuto.image, "Kabuto Yakushi", true);
            if (result !== "win") return "loss";

            if (i < 3) {
                // Parry Phase
                let success = await waitForParry(interaction, userId);
                if (!success) {
                    lives--;
                    await interaction.followUp({ content: `⚠️ **You took a hit! Remaining Lives: ${lives}**` });
                    if (lives <= 0) {
                        await interaction.followUp({ content: "❌ **You were overwhelmed by Kabuto's precise strikes! Retreating...**" });
                        return "loss";
                    }
                }
            } else {
                // Final Quiz
                const quizEmbed = new EmbedBuilder()
                    .setTitle("TACTICAL ANALYSIS")
                    .setDescription("Kabuto is preparing a lethal Chakra Scalpel strike to your vitals! What is the best defense method?")
                    .setColor('#00FFFF');

                const quizRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('quiz_a').setLabel('Raw Defense').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('quiz_b').setLabel('Chakra Counter').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('quiz_c').setLabel('Medical Dispersion').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('quiz_d').setLabel('Evasion').setStyle(ButtonStyle.Primary)
                );

                const quizMsg = await interaction.followUp({ embeds: [quizEmbed], components: [quizRow], fetchReply: true });

                const choice = await new Promise(resolve => {
                    const collector = quizMsg.createMessageComponentCollector({ filter: ii => ii.user.id === userId, time: 30000, max: 1 });
                    collector.on('collect', async ii => {
                        await ii.deferUpdate();
                        resolve(ii.customId);
                    });
                    collector.on('end', (collected, reason) => { if (reason === 'time') resolve(null); });
                });

                if (choice === 'quiz_c') {
                    await interaction.followUp({ content: "✅ **Correct! You dispersed his chakra before it could sever your nerves!**" });
                    await interaction.followUp({ content: "**You land a CRITICAL FINAL BLOW on Kabuto!**", embeds: [new EmbedBuilder().setImage(srankBosses.kabuto.image)] });
                } else {
                    lives--;
                    await interaction.followUp({ content: `❌ **Incorrect! Kabuto's strike partially severs your chakra network! Remaining Lives: ${lives}**` });
                    if (lives <= 0) {
                        await interaction.followUp({ content: "❌ **You were overwhelmed by Kabuto's precision! Retreating...**" });
                        return "loss";
                    }
                    await interaction.followUp({ content: "**You managed to land a finishing blow despite the injury!**" });
                }
            }
        }

        // Stage 4: The Cure
        await sendMsgWithContinue(interaction, { content: "**Kabuto retreats, dropping a small vial...**" }, userId);
        await sendWebhookWithContinue(asumaWebhook, { content: "This... this is the cure to the corruption! Kurenai needs this. I must head back to the village immediately." }, userId);
        await sendWebhookWithContinue(userWebhook, { content: "Go, Asuma. I'll stay back and investigate why Kagami is doing this." }, userId);
        await sendWebhookWithContinue(asumaWebhook, { content: "Be careful. That power... it's not and then..." }, userId);

        // Stage 5: The Reveal
        await sendMsgWithContinue(interaction, { content: "**Suddenly, a blinding beam of light shoots down from above!**" }, userId);
        await sendMsgWithContinue(interaction, {
            embeds: [new EmbedBuilder()
                .setDescription("**In a moment of overwhelming energy, you clench the Ancestor's Stone with all your might. The ancient relic cannot withstand the pressure and SHATTERS into a thousand pieces!**")
                .setImage(SKY_REVEAL_IMG)
                .setColor('#FFFFFF')]
        }, userId);

        await sendWebhookWithContinue(mysteriousWebhook, { content: "I thank you for resurrecting... THE SKY." }, userId);
        await sendMsgWithContinue(interaction, { content: "**The mysterious figure, known only as ???, vanishes back into the clouds, leaving a massive crater where you once stood.**" }, userId);

        // Grant reward
        const playerLevel = players[0].level || 1;
        const expReward = getSrankExpReward(playerLevel, 2000);
        const moneyReward = 150000;

        await userMutex.runExclusive(async () => {
            const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const p = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

            if (u[userId]) {
                u[userId].srankResult = "win";
                u[userId].srankDefeats = u[userId].srankDefeats || {};
                u[userId].srankDefeats.kagamis_hideout = (u[userId].srankDefeats.kagamis_hideout || 0) + 1;
                fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
            }

            if (p[userId]) {
                p[userId].exp += expReward;
                p[userId].money += moneyReward;
                fs.writeFileSync(playersPath, JSON.stringify(p, null, 2));
            }
        });

        await sendMsgWithContinue(interaction, {
            embeds: [new EmbedBuilder()
                .setTitle("MISSION COMPLETE: KAGAMI'S HIDEOUT")
                .setDescription(`You uncovered the truth behind the corruption and survived the arrival of the Sky dweller.\n\n**Rewards:**\n+${expReward} EXP\n$${moneyReward.toLocaleString()} Money`)
                .setColor('#00FF00')
            ]
        }, userId);

        return "win";

    } catch (error) {
        console.error(`[SRank Error - runKagamisHideoutStory]:`, error);
        throw error;
    }
}

async function runHakuStory(interaction, users, userId, players, jutsuList) {
    try {
        const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
        const hakuWebhook = await getCharacterWebhook(interaction.channel, "Haku", HAKU_AVATAR);
        const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
        const hakuCorruptWebhook = await getCharacterWebhook(interaction.channel, "Corrupted Haku", HAKU_CORRUPT_AVATAR);
        let skipStory = false;
        const storyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('haku_story_continue').setLabel('Continue').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('haku_story_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary)
            );
        const asumaMsg = await asumaWebhook.send({
            content: "Venturing on your first S-rank? I'll tag along. Sranks arent normal missions, some of your jutsus might not work on these bosses at all! Just to be safe. Let me tell you about Haku...",
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
            for (const loreLine of srankBosses.haku.lore) {
                await sendWebhookWithContinue(asumaWebhook, { content: loreLine }, userId);
            }
            const readyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('haku_story_ready').setLabel('Ready').setStyle(ButtonStyle.Primary)
            );
            const readyMsg = await asumaWebhook.send({ content: "Look. That's Haku, ready?", components: [readyRow] });
            await new Promise(resolve => {
                const c = readyMsg.createMessageComponentCollector({
                    filter: btn => btn.user.id === userId && btn.customId === 'haku_story_ready',
                    time: 60000
                });
                c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
            });
            await sendWebhookWithContinue(hakuWebhook, { content: "Nobody hurts Zabuza!" }, userId);
            await sendWebhookWithContinue(hakuWebhook, { content: "Another Shinobi attempting to kill Zabuza? I will kill you instead!" }, userId);
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
        let phase1Result = await runSrankBattle(
            interaction, users, userId, players, jutsuList,
            srankBosses.haku, HAKU_BG, HAKU_AVATAR, "Haku"
        );
        if (phase1Result === "win") {
            await sendWebhookWithContinue(hakuWebhook, { content: "*coughs up blood* I...*cough*" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: `<@${userId}> I feel a very strange power heading towards us, we should leave immediately.` }, userId);
            await sendMsgWithContinue(interaction, { content: "Suddenly, the area turns into a hellish place..." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Oh? Look at this weakling being defeated by a mere Shinobi." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "You think you can change fate? How amusing. My puppets will always rise again." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "*extends a hand towards Haku, purplish energy swirls*" }, userId);
            await sendWebhookWithContinue(hakuCorruptWebhook, { content: "Master...Revenge." }, userId);
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
            const corruptHakuConfig = {
                ...srankBosses.haku,
                name: "Corrupted Haku",
                image: HAKU_CORRUPT_AVATAR,
                jutsu: ["Corrupted Needle Assault"],
                health: 150,
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
                if (!users[userId].unlockedSrank) users[userId].unlockedSrank = [];
                if (!users[userId].unlockedSrank.includes("zabuza")) {
                    users[userId].unlockedSrank.push("zabuza");
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }
            }
            return phase2Result;
        }
        return phase1Result;
    } catch (error) {
        console.error(`[SRank Error - runHakuStory]:`, error);
        throw error;
    }
}

async function runZabuzaStory(interaction, users, userId, players, jutsuList) {
    try {
        const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
        const zabuzaWebhook = await getCharacterWebhook(interaction.channel, "Zabuza", ZABUZA_AVATAR);
        const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
        let skipStory = false;
        const storyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('zabuza_story_continue').setLabel('Continue').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('zabuza_story_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary)
            );
        const asumaMsg = await asumaWebhook.send({
            content: "Ready for Zabuza? Let me tell you about him...",
            components: [storyRow]
        });
        const storyChoice = await new Promise(resolve => {
            const storyCollector = asumaMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && (btn.customId === 'zabuza_story_continue' || btn.customId === 'zabuza_story_skip'),
                time: 60000
            });
            storyCollector.on('collect', btn => {
                btn.deferUpdate();
                resolve(btn.customId);
                storyCollector.stop();
            });
            storyCollector.on('end', (_, reason) => {
                if (reason === 'time') resolve('zabuza_story_skip');
            });
        });
        skipStory = (storyChoice === 'zabuza_story_skip');
        if (skipStory) {
            await asumaWebhook.send({ content: "You skip the story and head straight into battle with Zabuza." });
        } else {
            for (const loreLine of srankBosses.zabuza.lore) {
                await sendWebhookWithContinue(asumaWebhook, { content: loreLine }, userId);
            }
            await sendWebhookWithContinue(kagamiWebhook, { content: "Look who's back.. Get ready to face one of my special puppets. Come, Zabuza!" }, userId);
            await sendWebhookWithContinue(zabuzaWebhook, { content: "Hehehe... another little bug to crush..." }, userId);
            await sendWebhookWithContinue(zabuzaWebhook, { content: "You think you can defeat the Demon of the Mist? Hah!" }, userId);
        }
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
        let battleResult = await runSrankBattle(
            interaction, users, userId, players, jutsuList,
            srankBosses.zabuza, ZABUZA_BG, ZABUZA_AVATAR, "Zabuza"
        );
        if (battleResult === "win") {
            await sendWebhookWithContinue(zabuzaWebhook, { content: "*gurgling blood* How... how did..." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Impressive. Very impressive." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "You have potential. Why waste it serving these weak villages?" }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Join me. Together we could reshape this world." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "Don't listen to her! She's manipulating you!" }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Oh, the monkey is still here. How... annoying." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "*flicks wrist* Let me give you something to remember me by." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: `Argh! Poison... <@${userId}>, we need to get back to the village, now!` }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Run along little monkey. But remember my offer." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "We need to get back to the village and warn everyone. This is bigger than we thought." }, userId);
        }
        return battleResult;
    } catch (error) {
        console.error(`[SRank Error - runZabuzaStory]:`, error);
        throw error;
    }
}

async function runOrochimaruStory(interaction, users, userId, players, jutsuList) {
    try {
        const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
        const orochimaruWebhook = await getCharacterWebhook(interaction.channel, "Orochimaru", OROCHIMARU_AVATAR);
        const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
        let skipStory = false;
        const storyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('orochimaru_story_continue').setLabel('Continue').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('orochimaru_story_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary)
            );
        const asumaMsg = await asumaWebhook.send({
            content: "It's time to face Orochimaru. Let me tell you about him...",
            components: [storyRow]
        });
        const storyChoice = await new Promise(resolve => {
            const storyCollector = asumaMsg.createMessageComponentCollector({
                filter: btn => btn.user.id === userId && (btn.customId === 'orochimaru_story_continue' || btn.customId === 'orochimaru_story_skip'),
                time: 60000
            });
            storyCollector.on('collect', btn => {
                btn.deferUpdate();
                resolve(btn.customId);
                storyCollector.stop();
            });
            storyCollector.on('end', (_, reason) => {
                if (reason === 'time') resolve('orochimaru_story_skip');
            });
        });
        skipStory = (storyChoice === 'orochimaru_story_skip');
        if (skipStory) {
            await asumaWebhook.send({ content: "You skip the story and head straight into battle with Orochimaru." });
        } else {
            await sendWebhookWithContinue(asumaWebhook, { content: "It's been a month since that witch poisoned me. I think I'll be tagging along with you on S-ranks." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "The witch we met the other day will keep an eye on you. We need to gather intel about the Akatsuki." }, userId);
            await sendWebhookWithContinue(orochimaruWebhook, { content: "Well, well... what do we have here? More Konoha insects?" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "OROCHIMARU! YOU TRAITOR!" }, userId);
            await sendWebhookWithContinue(orochimaruWebhook, { content: "Another monkey. Hmph! *flicks wrist*" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: `Gah! Not again... <@${userId}>, watch out!` }, userId);
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
            await sendMsgWithContinue(interaction, { content: "Foolish child. *effortlessly counters your attack*" }, userId);
            await sendMsgWithContinue(interaction, { content: "**Orochimaru's power is overwhelming! You've been defeated!**" }, userId);
            await sendMsgWithContinue(interaction, { content: "**You wake up in a remote village, saved by kind villagers.**" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: `<@${userId}>, listen carefully. I have a plan.` }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "I'll launch an all-out attack to distract him. You need to land a finishing blow to his vitals." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "But you must wait for the right moment." }, userId);
            await sendMsgWithContinue(interaction, { content: "**You track down Orochimaru to the same location.**" }, userId);
            await sendWebhookWithContinue(orochimaruWebhook, { content: "Back for more? How... persistent." }, userId);
        }
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
        let battleResult = await runSrankBattle(
            interaction, users, userId, players, jutsuList,
            srankBosses.orochimaru, OROCHIMARU_BG, OROCHIMARU_AVATAR, "Orochimaru"
        );
        if (battleResult === "win") {
            await sendWebhookWithContinue(orochimaruWebhook, { content: "Impossible... how could I be defeated by... *coughs up black blood*" }, userId);
            await sendMsgWithContinue(interaction, { content: "**Orochimaru's body begins to show signs of corruption - the same as Haku and Zabuza!**" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: `No... she got to him too! <@${userId}>, we need to leave, now!` }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Leaving so soon? And here I was going to offer my congratulations." }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "You're becoming quite the nuisance. Maybe I should pay a visit to that little redhead of yours... Kurenai, was it?" }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "You stay away from her!" }, userId);
            await sendWebhookWithContinue(kagamiWebhook, { content: "Or what? You'll try to poison me again? *laughs* Don't worry, we'll meet again soon." }, userId);
            await sendWebhookWithContinue(asumaWebhook, { content: "We need to get back to the village and warn everyone. This is bigger than we thought." }, userId);
        }
        return battleResult;
    } catch (error) {
        console.error(`[SRank Error - runOrochimaruStory]:`, error);
        throw error;
    }
}

async function runOrochimaruBattle(interaction, users, userId, players, jutsuList) {
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
    const initialChakra = player.chakra;
    try {
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
            const effectivePlayer = BattleUtils.getEffectiveStats(player);
            const effectiveNpc = BattleUtils.getEffectiveStats(npc);

            const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);

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

            const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, OROCHIMARU_BG, OROCHIMARU_AVATAR));
            await interaction.followUp({ files: [battleImage] });
            await interaction.followUp({ files: [battleImage] });
            const playerAction = await new Promise(resolve => {
                const collector = moveMsg.createMessageComponentCollector({
                    filter: ii => ii.user.id === userId,
                    time: 60000
                });
                collector.on('collect', async ii => {
                    await ii.deferUpdate();
                    if (ii.customId.startsWith('execute')) {

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
            npc.currentHealth -= playerAction.damage || 0;
            if (playerAction.heal) {
                player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
            }

            if (playerAction.isExecute && playerAction.hit) {
                npc.currentHealth = 0;
            }
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
            let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false, image_url: null };
            if (npc.currentHealth > 0) {
                npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                player.health -= npcAction.damage || 0;
                if (npcAction.heal) {
                    npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                }
            }
            player.health = Math.max(0, player.health);
            npc.currentHealth = Math.max(0, npc.currentHealth);
            const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState);
            if (comboResult.completed) {
                summaryEmbed.setDescription(
                    summaryEmbed.data.description + comboResult.damageText
                );
            }
            await interaction.followUp({ embeds: [summaryEmbed] });
            if (player.health <= 0) {
                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (u[userId]) {
                        u[userId].srankResult = "loss";
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }
                });
                await interaction.followUp(`**You have been defeated by Orochimaru! Game Over.**`);
                return "loss";
            }
            if (npc.currentHealth <= 0) {
                const playerLevel = player.level || 1;
                const expReward = getSrankExpReward(playerLevel, srankBosses.orochimaru.baseExp);
                const moneyReward = srankBosses.orochimaru.money;

                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    const p = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

                    if (u[userId]) {
                        u[userId].srankResult = "win";
                        u[userId].health = player.maxHealth;
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }

                    if (p[userId]) {
                        p[userId].exp += expReward;
                        p[userId].money += moneyReward;
                        p[userId].exp = Math.round(p[userId].exp * 10) / 10;
                        fs.writeFileSync(playersPath, JSON.stringify(p, null, 2));
                    }
                });

                await interaction.followUp(`**Orochimaru has been defeated! You win!**`);
                await interaction.followUp({
                    embeds: [new EmbedBuilder()
                        .setDescription(`**VICTORY!** You defeated Orochimaru.`)
                        .addFields(
                            { name: "Reward", value: `+${expReward} EXP, $${moneyReward.toLocaleString()} Money (Added to account)`, inline: true }
                        )
                        .setColor(0x00FF00)
                    ]
                });
                return "win";
            }
            player.chakra += CHAKRA_REGEN[player.rank] || 1;
            npc.chakra += 2;
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
    } finally {
        player.chakra = initialChakra;
    }
}

async function runCorruptedOrochimaruBattle(interaction, users, userId, players, jutsuList) {
    let npc = {
        ...srankBosses.corrupted_orochimaru,
        activeEffects: [],
        jutsu: Array.isArray(srankBosses.corrupted_orochimaru.jutsu) ?
            srankBosses.corrupted_orochimaru.jutsu.map(j => jutsuList[j] ? j : 'Attack') :
            ['Attack'],
        currentHealth: srankBosses.corrupted_orochimaru.health,
        power: srankBosses.corrupted_orochimaru.power,
        defense: srankBosses.corrupted_orochimaru.defense,
        chakra: 999,
        accuracy: srankBosses.corrupted_orochimaru.accuracy || 85,
        dodge: srankBosses.corrupted_orochimaru.dodge || 15
    };
    let player = players.find(p => p.id === userId);
    player.maxHealth = player.maxHealth || player.health;
    player.chakra = player.chakra || 10;
    const initialChakra = player.chakra;
    try {
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
            const effectivePlayer = BattleUtils.getEffectiveStats(player);
            const effectiveNpc = BattleUtils.getEffectiveStats(npc);

            if (npc.currentHealth / npc.health <= 0.3) {
                executeAvailable = true;
            }

            const { embed, components } = createMovesEmbed(player, roundNum, userId, jutsuList);

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

            const battleImage = new AttachmentBuilder(await BattleUtils.generateBattleImage(interaction, player, player.health, npc, VILLAGE_BG, CORRUPTED_OROCHIMARU));
            await interaction.followUp({ files: [battleImage] });
            const playerAction = await new Promise(resolve => {
                const collector = moveMsg.createMessageComponentCollector({
                    filter: ii => ii.user.id === userId,
                    time: 60000
                });
                collector.on('collect', async ii => {
                    await ii.deferUpdate();
                    if (ii.customId.startsWith('execute')) {

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
            npc.currentHealth -= playerAction.damage || 0;
            if (playerAction.heal) {
                player.health = Math.min(player.health + playerAction.heal, player.maxHealth);
            }

            if (playerAction.isExecute && playerAction.hit) {
                npc.currentHealth = 0;
            }
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
            let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false, image_url: null };
            if (npc.currentHealth > 0) {
                npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                player.health -= npcAction.damage || 0;
                if (npcAction.heal) {
                    npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                }
            }
            player.health = Math.max(0, player.health);
            npc.currentHealth = Math.max(0, npc.currentHealth);
            const summaryEmbed = createBattleSummary(player, npc, playerAction, npcAction, roundNum, comboState);
            if (comboResult.completed) {
                summaryEmbed.setDescription(
                    summaryEmbed.data.description + comboResult.damageText
                );
            }
            await interaction.followUp({ embeds: [summaryEmbed] });
            if (player.health <= 0) {
                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (u[userId]) {
                        u[userId].srankResult = "loss";
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }
                });
                await sendMsgWithContinue(interaction, { content: `**You have been defeated by Corrupted Orochimaru! Game Over.**` }, userId);
                return "loss";
            }
            if (npc.currentHealth <= 0) {
                await userMutex.runExclusive(async () => {
                    const u = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (u[userId]) {
                        u[userId].srankResult = "win";
                        fs.writeFileSync(usersPath, JSON.stringify(u, null, 2));
                    }
                });
                await sendMsgWithContinue(interaction, { content: `**Corrupted Orochimaru has been defeated! You win!**` }, userId);
                return "win";
            }
            player.chakra += CHAKRA_REGEN[player.rank] || 1;
            npc.chakra += 2;
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
    } finally {
        player.chakra = initialChakra;
    }
}

async function waitForContinue(interaction, userId, content = "\u200b") {

    const buttonId = 'story_continue_' + Date.now();
    const continueButton = new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(continueButton);

    const message = await interaction.followUp({ content, components: [row], ephemeral: false });

    return new Promise(resolve => {
        const c = message.createMessageComponentCollector({
            filter: (btn) => btn.user.id === userId && btn.customId === buttonId,
            time: 600000,
            max: 1
        });
        c.on('collect', async (btn) => { await btn.update({ components: [] }); resolve(); });
        c.on('end', async (_, reason) => { if (reason === 'time') await message.edit({ components: [] }).catch(() => { }); resolve(); });
    });
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

            if (!fs.existsSync(usersPath)) {
                return await interaction.followUp({ content: "Database not found.", ephemeral: true });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return await interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            const now = Date.now();
            const JINCHURIKI_ROLE = "1385641469507010640";
            const LEGENDARY_ROLE = "1385640798581952714";
            const DONATOR_ROLE = "1385640728130097182";
            let cooldownMs = 18 * 60 * 1000;

            const memberRoles = interaction.member.roles.cache;
            if (memberRoles.has(JINCHURIKI_ROLE)) {
                cooldownMs = 10 * 60 * 1000;
            } else if (memberRoles.has(LEGENDARY_ROLE)) {
                cooldownMs = 12 * 60 * 1000;
            } else if (memberRoles.has(DONATOR_ROLE)) {
                cooldownMs = 13 * 60 * 1000;
            }

            if (users[userId].lastsrank && now - users[userId].lastsrank < cooldownMs) {
                const left = cooldownMs - (now - users[userId].lastsrank);
                return await interaction.followUp({ content: `You can do an S-Rank mission again in ${getCooldownString(left)}.` });
            }

            await userMutex.runExclusive(async () => {
                const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                if (users[userId]) {
                    users[userId].lastsrank = now;
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }
            });

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

            const availableBosses = {};
            const userDefeats = users[userId].srankDefeats || {};
            const userUnlocked = users[userId].unlockedSrank || [];

            const isBossUnlocked = (bossId, boss) => {

                if (userUnlocked.includes(bossId)) return true;

                if (boss.requiredDefeats === 0) return true;

                for (const [otherBossId, otherBoss] of Object.entries(srankBosses)) {
                    if (otherBoss.unlocks === bossId && (userDefeats[otherBossId] > 0 || userUnlocked.includes(otherBossId))) {
                        return true;
                    }
                }

                return false;
            };

            for (const [bossId, boss] of Object.entries(srankBosses)) {
                if (isBossUnlocked(bossId, boss)) {
                    availableBosses[bossId] = boss;
                }
            }

            if (Object.keys(availableBosses).length === 0) {
                availableBosses.haku = srankBosses.haku;
            }



            // --- Add Kurenai S-Rank if Orochimaru is defeated ---
            if ((userDefeats.orochimaru > 0 || userUnlocked.includes("orochimaru")) && !availableBosses.kurenai) {
                availableBosses.kurenai = {
                    name: "Kurenai",
                    health: 4000,
                    power: 1800,
                    defense: 1000,
                    jutsu: ["Attack", "Fireball Jutsu", "Summon Ninken", "Infused Chakra"],
                    description: "Back at the village..",
                };
            }

            // --- Add Kagami's Hideout only if Kagami is defeated (Back at the village completed) ---
            if (userDefeats.kagami > 0 || userUnlocked.includes("kagamis_hideout")) {
                availableBosses.kagamis_hideout = {
                    name: "Kagami's Hideout",
                    health: 0,
                    power: 0,
                    description: "Investigate the mysterious hideout of Kagami."
                };
            }

            const bossOptions = Object.entries(availableBosses)
                .filter(([bossId]) => !['bandit_group', 'kabuto', 'mysterious_figure'].includes(bossId))
                .map(([bossId, boss]) => ({
                    label: boss.name,
                    value: bossId,
                    description: boss.description || `Health: ${boss.health} | Power: ${boss.power}`
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

            const filter = i => i.user.id === userId && i.customId === 'srank_boss_selection';
            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    collector.stop();
                    await i.deferUpdate();

                    const bossId = i.values[0];

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
                        case "kagamis_hideout":
                            result = await runKagamisHideoutStory(interaction, users, userId, players, jutsuList);
                            break;
                        case "kurenai":
                            await sendMsgWithContinue(interaction, {
                                embeds: [new EmbedBuilder()
                                    .setTitle("Back at the village:")
                                    .setDescription("The Village is on high alert, expecting Kagami's arrival.")
                                    .setColor('#FF0000')
                                    .setImage(VILLAGE_BG)
                                ]
                            }, userId);

                            await sendMsgWithContinue(interaction, {
                                embeds: [new EmbedBuilder().setDescription("**hours pass by and nothing happens**").setColor('#FF0000')]
                            }, userId);

                            const asumaWebhook = await getCharacterWebhook(interaction.channel, "Asuma", ASUMA_AVATAR);
                            await sendWebhookWithContinue(asumaWebhook, {
                                content: `Asuma and Kurenai`,
                                embeds: [new EmbedBuilder().setImage(ASUMAANDKURENAI).setColor('#FF0000')]
                            }, userId);

                            const userWebhook = await getCharacterWebhook(interaction.channel, interaction.user.username, interaction.user.displayAvatarURL());
                            await sendWebhookWithContinue(userWebhook, {
                                content: "Dont jinx it, you fool!"
                            }, userId);

                            const kurenaiWebhook = await getCharacterWebhook(interaction.channel, "Kurenai", KURENAI_AVATAR);

                            await sendMsgWithContinue(interaction, {
                                embeds: [new EmbedBuilder().setDescription("**Suddenly there's a HUGE Growl**").setColor('#FF0000')]
                            }, userId);

                            await sendMsgWithContinue(interaction, {
                                embeds: [new EmbedBuilder().setDescription("**Everyone in the area gasps**").setColor('#FF0000')]
                            }, userId);

                            await sendWebhookWithContinue(asumaWebhook, {
                                content: "The Anbu Report that the Ten Tails has appeared out of nowhere!",
                                embeds: [new EmbedBuilder().setImage(WAITWHAT).setColor('#FF0000')]
                            }, userId);

                            await sendWebhookWithContinue(userWebhook, {
                                content: "That is impossible! How did anyone manage to get all the Jinchuriki?"
                            }, userId);

                            await sendWebhookWithContinue(kurenaiWebhook, {
                                content: `<@${userId}>`,
                                embeds: [new EmbedBuilder().setImage(KURENAIPANIC).setColor('#FF0000')]
                            }, userId);

                            const distractRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('distract_ten_tails')
                                    .setLabel('DISTRACT')
                                    .setStyle(ButtonStyle.Danger)
                            );
                            const distractMsg = await interaction.followUp({
                                content: "**Anbu Black Ops engage the Ten Tails!**",
                                components: [distractRow]
                            });
                            await new Promise(resolve => {
                                const c = distractMsg.createMessageComponentCollector({
                                    filter: btn => btn.user.id === userId && btn.customId === 'distract_ten_tails',
                                    time: 60000
                                });
                                c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                            });

                            await runAnbuTenTailsBattle(interaction, users, userId, players);

                            await sendWebhookWithContinue(userWebhook, {
                                content: "That's..Strange."
                            }, userId);

                            await sendWebhookWithContinue(kurenaiWebhook, {
                                content: `<@${userId}>`,
                                embeds: [new EmbedBuilder().setImage(KURENAIRIGHT).setColor('#FF0000')]
                            }, userId);

                            await sendWebhookWithContinue(asumaWebhook, {
                                content: "Anbu! Find out",
                                embeds: [new EmbedBuilder().setImage(ASUMASCARED).setColor('#FF0000')]
                            }, userId);

                            await sendMsgWithContinue(interaction, {
                                embeds: [new EmbedBuilder().setDescription("**The anbu report that one of the walls got breached while this was happening, number of intruders is unknown.**").setColor('#FF0000')]
                            }, userId);

                            const kagamiWebhook = await getCharacterWebhook(interaction.channel, "Kagami", KAGAMI_AVATAR);
                            await sendWebhookWithContinue(kagamiWebhook, {
                                content: "Well, Well."
                            }, userId);

                            await sendWebhookWithContinue(asumaWebhook, {
                                content: "You witch!"
                            }, userId);

                            await sendWebhookWithContinue(kurenaiWebhook, {
                                content: "You must be the one they have been fearing."
                            }, userId);

                            await sendWebhookWithContinue(kagamiWebhook, {
                                content: "My back hurts from the traveling I've done to get here. Let's wrap it up. Go Orochimaru!"
                            }, userId);

                            const orochimaruFightRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('fight_orochimaru')
                                    .setLabel('FIGHT OROCHIMARU')
                                    .setStyle(ButtonStyle.Danger)
                            );
                            const orochimaruFightMsg = await interaction.followUp({
                                content: "**Corrupted Orochimaru attacks!**",
                                components: [orochimaruFightRow]
                            });
                            await new Promise(resolve => {
                                const c = orochimaruFightMsg.createMessageComponentCollector({
                                    filter: btn => btn.user.id === userId && btn.customId === 'fight_orochimaru',
                                    time: 60000
                                });
                                c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                            });

                            const orochimaruResult = await runCorruptedOrochimaruBattle(
                                interaction, users, userId, players, jutsuList
                            );

                            if (orochimaruResult === "win") {
                                await sendWebhookWithContinue(kagamiWebhook, {
                                    content: `<@${userId}> you're becoming quite the nuisance, aren't you? How about i put you to rest once and for all!`
                                }, userId);

                                await sendWebhookWithContinue(asumaWebhook, {
                                    content: "You will not lay a finger on him."
                                }, userId);

                                await sendWebhookWithContinue(kagamiWebhook, {
                                    content: "I grow tired of this mess."
                                }, userId);

                                await sendWebhookWithContinue(kagamiWebhook, {
                                    content: "Kagami uses her ultimate spell and possesses Kurenai."
                                }, userId);

                                await sendWebhookWithContinue(asumaWebhook, {
                                    content: "Kurenai! NO!"
                                }, userId);

                                await sendMsgWithContinue(interaction, {
                                    content: "**Kurenai then attacks and wounds Asuma.**"
                                }, userId);

                                const kurenaiFightRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('survive_kurenai')
                                        .setLabel('SURVIVE 5 ROUNDS')
                                        .setStyle(ButtonStyle.Danger)
                                );
                                const kurenaiFightMsg = await interaction.followUp({
                                    content: "**Fight against possessed Kurenai! Objective: Survive 5 rounds without killing her!**",
                                    components: [kurenaiFightRow]
                                });
                                await new Promise(resolve => {
                                    const c = kurenaiFightMsg.createMessageComponentCollector({
                                        filter: btn => btn.user.id === userId && btn.customId === 'survive_kurenai',
                                        time: 60000
                                    });
                                    c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                    c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                                });

                                const survivalResult = await runSurvivalBattle(
                                    interaction, users, userId, players, jutsuList,
                                    srankBosses.corrupted_kurenai
                                );

                                if (survivalResult === "win") {
                                    await sendWebhookWithContinue(asumaWebhook, {
                                        content: "Kurenai...do you remember?"
                                    }, userId);

                                    const memoryImages = [
                                        KURENAI_MEMORY_1,
                                        KURENAI_MEMORY_2,
                                        KURENAI_MEMORY_3
                                    ];
                                    let currentImageIndex = 0;
                                    let memoryMsg;

                                    const memoryEmbeds = [
                                        new EmbedBuilder().setTitle("Back when life was peaceful..").setImage(KURENAI_MEMORY_1).setColor('#FF69B4'),
                                        new EmbedBuilder().setTitle("Back when we were young..").setImage(KURENAI_MEMORY_2).setColor('#FF69B4'),
                                        new EmbedBuilder().setTitle("Back when me and you confessed to each other").setImage(KURENAI_MEMORY_3).setColor('#FF69B4')
                                    ];

                                    const createMemoryComponents = (index) => {
                                        const button = new ButtonBuilder()
                                            .setCustomId('memory_next')
                                            .setLabel(index < memoryEmbeds.length - 1 ? 'Next' : 'Continue')
                                            .setStyle(index < memoryEmbeds.length - 1 ? ButtonStyle.Primary : ButtonStyle.Success);
                                        return [new ActionRowBuilder().addComponents(button)];
                                    };

                                    memoryMsg = await interaction.followUp({
                                        embeds: [memoryEmbeds[currentImageIndex]],
                                        components: createMemoryComponents(currentImageIndex)
                                    });

                                    await new Promise(resolve => {
                                        const c = memoryMsg.createMessageComponentCollector({
                                            filter: btn => btn.user.id === userId && btn.customId === 'memory_next',
                                            time: 600000
                                        });
                                        c.on('collect', async (btn) => {
                                            currentImageIndex++;
                                            if (currentImageIndex < memoryEmbeds.length) {
                                                await btn.update({
                                                    embeds: [memoryEmbeds[currentImageIndex]],
                                                    components: createMemoryComponents(currentImageIndex)
                                                });
                                            } else {
                                                await btn.update({ components: [] });
                                                resolve();
                                                c.stop();
                                            }
                                        });
                                        c.on('end', async (_, reason) => {
                                            if (reason === 'time' || currentImageIndex >= memoryEmbeds.length) {
                                                await memoryMsg.edit({ components: [] }).catch(() => { });
                                                resolve();
                                            }
                                        });
                                    });

                                    await sendWebhookWithContinue(kurenaiWebhook, {
                                        content: "Argh. Ugh. NOOOOOOOOOO!"
                                    }, userId);

                                    await sendWebhookWithContinue(kagamiWebhook, {
                                        content: "Your words seem to have an affect on her, but dont worry, she's not breaking out of this anytime soon."
                                    }, userId);

                                    await sendWebhookWithContinue(asumaWebhook, {
                                        content: "*sees kurenai* it seems like she's about to rage!"
                                    }, userId);

                                    const finalFightRow = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('final_fight')
                                            .setLabel('KURENAI VS KAGAMI - FINAL BATTLE')
                                            .setStyle(ButtonStyle.Danger)
                                    );
                                    const finalFightMsg = await interaction.followUp({
                                        content: "**Kurenai breaks free and attacks Kagami!**",
                                        components: [finalFightRow]
                                    });
                                    await new Promise(resolve => {
                                        const c = finalFightMsg.createMessageComponentCollector({
                                            filter: btn => btn.user.id === userId && btn.customId === 'final_fight',
                                            time: 60000
                                        });
                                        c.on('collect', btn => { btn.deferUpdate(); resolve(); c.stop(); });
                                        c.on('end', (_, reason) => { if (reason === 'time') resolve(); });
                                    });

                                    const kurenaiPlayer = {
                                        ...players[0],
                                        username: "Kurenai",
                                        health: 1500,
                                        power: 300,
                                        defense: 200,
                                        image: KURENAI_AVATAR,
                                        jutsu: srankBosses.corrupted_kurenai.jutsu.reduce((acc, jutsu, index) => {
                                            acc[index] = jutsu;
                                            return acc;
                                        }, {})
                                    };

                                    const finalResult = await runSrankBattle(
                                        interaction, users, userId, [kurenaiPlayer], jutsuList,
                                        srankBosses.kagami, VILLAGE_BG, KAGAMI_AVATAR, "Kagami"
                                    );

                                    if (finalResult === "win") {
                                        await sendWebhookWithContinue(kagamiWebhook, {
                                            content: "I will not forget this humiliation. I will be back soon, and this time, not alone. Good bye."
                                        }, userId);

                                        const playerLevel = players[0].level || 1;
                                        const expReward = getSrankExpReward(playerLevel, srankBosses.kagami.baseExp);
                                        const moneyReward = srankBosses.kagami.money;

                                        await userMutex.runExclusive(async () => {
                                            const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                                            if (playersData[userId]) {
                                                playersData[userId].exp += expReward;
                                                playersData[userId].money += moneyReward;
                                                playersData[userId].exp = Math.round(playersData[userId].exp * 10) / 10;
                                            }
                                            fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
                                        });

                                        await interaction.followUp({
                                            embeds: [new EmbedBuilder()
                                                .setDescription(`**VICTORY!** You defeated Kagami.`)
                                                .addFields(
                                                    { name: "Reward", value: `+${expReward} EXP, $${moneyReward.toLocaleString()} Money (Added to account)`, inline: true }
                                                )
                                                .setColor(0x00FF00)
                                            ]
                                        });
                                    }
                                }
                            }
                            break;
                        default:
                            result = "unknown";
                    }
                } catch (error) {
                    console.error(`[SRank Error - Battle/Story Execution]:`, error);
                    await interaction.followUp("An error occurred during the battle!");
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await interaction.followUp("You took too long to select a boss. Mission cancelled.");
                }
            });

        } catch (error) {
            console.error(`[SRank Error - Main Execute]:`, error);
            await interaction.followUp({ content: "An error occurred while executing this command." });
        }
    }

};
