const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../images');

// Load data
const loadData = (path) => fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
const jutsuList = loadData(jutsusPath);
const comboList = loadData(combosPath);

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

// Effect handlers
const effectHandlers = {
    damage: (user, target, formula, effect = {}) => {
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
            isTargetIncapacitated: target.activeEffects?.some(e => e.type === 'status' && ['stun', 'flinch'].includes(e.status)),
            max: Math.max
        };

        const finalAccuracy = effect.accuracyBonus ? 
            context.user.accuracy + effect.accuracyBonus : 
            context.user.accuracy;

        const hitChance = Math.max(0, Math.min(100, finalAccuracy - context.target.dodge));
        const hits = Math.random() * 100 <= hitChance;

        if (!hits) return { damage: 0, hit: false };

        const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
        return { damage, hit: true };
    },

    buff: (user, statsDefinition) => {
        const changes = {};
        const context = { user: { ...user } };

        if (!statsDefinition || typeof statsDefinition !== 'object') {
            return changes;
        }

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            changes[stat] = typeof formulaOrValue === 'number' ? 
                formulaOrValue : 
                Math.floor(math.evaluate(formulaOrValue, context));
        }
        return changes;
    },

    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = { target: { ...target } };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            const value = typeof formulaOrValue === 'number' ? 
                formulaOrValue : 
                math.evaluate(formulaOrValue, context);
            changes[stat] = value < 0 ? value : -Math.abs(value);
        }
        return changes;
    },

    heal: (user, formula) => {
        const context = { user: { ...user } };
        return Math.max(0, Math.floor(math.evaluate(formula, context)));
    },

    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1),
    bleed: (target) => Math.floor(target.health * 0.1),
    flinch: (chance) => Math.random() < chance
};

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

    static async generateBattleImage(player1, player2, roundNum = 1, jutsu1 = null, jutsu2 = null) {
        const width = 800, height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // --- CUSTOM BACKGROUND PATCH ---
        let bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
        // If either player has a round-based jutsu with custombackground and roundNum >= threshold, use it
        let customBg = null;
        let customBgRound = null;
        [jutsu1, jutsu2].forEach(jutsu => {
            if (jutsu && jutsu.custombackground && jutsu.custombackground.round && roundNum >= jutsu.custombackground.round) {
                customBg = jutsu.custombackground.url;
                customBgRound = jutsu.custombackground.round;
            }
        });
        if (customBg) bgUrl = customBg;

        try {
            const bgImg = await loadImage(bgUrl);
            ctx.drawImage(bgImg, 0, 0, width, height);
        } catch {
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, width, height);
        }

        // Helper for rounded rectangles
        const roundRect = (x, y, w, h, r) => {
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
        };

        // Positions
        const charW = 150, charH = 150;
        const p1X = 50, p1Y = 120;
        const p2X = width - 50 - charW, p2Y = 120;
        const nameY = 80, barY = 280;
        const nameH = 28, barH = 22;

        // Get avatars
        const getAvatarUrl = (player) => {
            return player.avatar ? 
                `https://cdn.discordapp.com/avatars/${player.userId || player.id}/${player.avatar}.png?size=256` :
                `https://cdn.discordapp.com/embed/avatars/${parseInt(player.discriminator) % 5}.png`;
        };

        // Draw avatars
        const drawAvatar = async (x, y, player) => {
            try {
                const img = await loadImage(getAvatarUrl(player));
                ctx.save();
                roundRect(x, y, charW, charH, 10);
                ctx.clip();
                ctx.drawImage(img, x, y, charW, charH);
                ctx.restore();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#6e1515";
                roundRect(x, y, charW, charH, 10);
                ctx.stroke();
            } catch (err) {
                console.error("Error loading avatar:", err);
            }
        };

        await drawAvatar(p1X, p1Y, player1);
        await drawAvatar(p2X, p2Y, player2);

        // Name tags
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const drawNameTag = (x, y, name) => {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = "#000";
            roundRect(x, y, charW, nameH, 5);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 4;
            ctx.fillText(name, x + charW / 2, y + nameH / 2);
            ctx.shadowBlur = 0;
        };

        drawNameTag(p1X, nameY, player1.name);
        drawNameTag(p2X, nameY, player2.name);

        // Health bars
        const drawHealthBar = (x, y, percent, color) => {
            ctx.save();
            ctx.fillStyle = "#333";
            roundRect(x, y, charW, barH, 5);
            ctx.fill();
            ctx.fillStyle = color;
            roundRect(x, y, charW * Math.max(0, percent), barH, 5);
            ctx.fill();
            ctx.restore();
        };

        drawHealthBar(p1X, barY, player1.currentHealth / player1.health, "#4CAF50");
        drawHealthBar(p2X, barY, player2.currentHealth / player2.health, "#ff4444");

        // VS text
        ctx.save();
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText("VS", width / 2, height / 2);
        ctx.restore();

        // Save to file
        if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true });
        const filename = `battle_${player1.userId || player1.id}_${player2.userId || player2.id}_${Date.now()}.png`;
        const fullPath = path.join(imagesPath, filename);
        
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(fullPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });
        
        return fullPath;
    }
}

// Battle system
class BattleSystem {
    static createMovesEmbed(player, roundNum) {
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
                const disabled = (player.chakra || 0) < (jutsu?.chakraCost || 0);
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
        
        const row2 = new ActionRowBuilder();
        if (jutsuButtons.length > 5) row2.addComponents(jutsuButtons[5]);
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

        return { embed, components: rows.slice(0, 5) };
    }

    static getJutsuByButton(buttonId, player) {
        const match = buttonId.match(/^move(\d+)-/);
        if (!match) return null;
        const idx = parseInt(match[1], 10) - 1;
        const jutsuNames = Object.entries(player.jutsu)
            .filter(([_, jutsu]) => jutsu !== 'None')
            .map(([_, jutsuName]) => jutsuName);
        return jutsuNames[idx];
    }

    static async processPlayerMove(customId, basePlayer, baseOpponent, effectivePlayer, effectiveOpponent) {
        const action = customId.split('-')[0];
        if (action === 'rest') {
            basePlayer.chakra = Math.min(basePlayer.chakra + 1, basePlayer.chakra + 5);
            return {
                damage: 0,
                heal: 0,
                description: `${basePlayer.name} gathered chakra and rested`,
                specialEffects: ["+1 Chakra"],
                hit: true,
                isRest: true
            };
        }
        if (action === 'flee') return { fled: true };
        return this.executeJutsu(basePlayer, baseOpponent, effectivePlayer, effectiveOpponent, action);
    }

    static executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, currentRound = 1, isRoundBasedActivation = false) {
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

        // Handle round-based jutsus
        if (jutsu.roundBased) {
            // Only deduct chakra on first activation
            if (isRoundBasedActivation) {
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
            }

            const roundEffect = BattleUtils.getRoundEffect(jutsu.roundEffects, currentRound);
            let desc = "";
            let effectsSummary = [];
            let damage = 0, heal = 0, hit = true;
            if (roundEffect) {
                // Replace "user" and "target" with actual names and mentions
                desc = roundEffect.description
                    .replace(/\buser\b/gi, `<@${baseUser.userId || baseUser.id}>`)
                    .replace(/\btarget\b/gi, `<@${baseTarget.userId || baseTarget.id}>`)
                    .replace(/\[Player\]/g, baseUser.name)
                    .replace(/\[Enemy\]/g, baseTarget.name);

                // Apply effects if present
                if (roundEffect.effects) {
                    roundEffect.effects.forEach(effect => {
                        let tempResult = { damage: 0, heal: 0, specialEffects: [], hit: true };
                        this.applyEffect(effect, baseUser, baseTarget, effectiveUser, effectiveTarget, tempResult);

                        // --- MISSING EFFECTS PATCH ---
                        // Bleed: apply damage, don't stack status
                        if (effect.type === 'status' && effect.status === 'bleed') {
                            const bleedDamage = Math.floor(effectiveTarget.health * (effect.damagePerTurn ? parseFloat(effect.damagePerTurn.match(/0\.\d+/)?.[0] || 0.1) : 0.1));
                            tempResult.damage += bleedDamage;
                            tempResult.specialEffects.push(`${baseTarget.name} is bleeding! (-${bleedDamage} HP)`);
                        }
                        // Drowning
                        if (effect.type === 'status' && effect.status === 'drowning') {
                            const drowningDamage = Math.floor(effectiveTarget.health * 0.1);
                            tempResult.damage += drowningDamage;
                            tempResult.specialEffects.push(`${baseTarget.name} is drowning! (-${drowningDamage} HP)`);
                        }
                        // Reaper Seal
                        if (effect.type === 'status' && effect.status === 'reaper_seal') {
                            const reaperDamage = Math.floor(effectiveTarget.health * 0.2);
                            tempResult.damage += reaperDamage;
                            tempResult.specialEffects.push(`${baseTarget.name}'s soul is being ripped by the shinigami! (-${reaperDamage} HP)`);
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

        // Regular jutsu handling
        const result = {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} used ${jutsu.name}`,
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
                hit: false
            };
        }
        
        baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
        
        (jutsu.effects || []).forEach(effect => {
            this.applyEffect(effect, baseUser, baseTarget, effectiveUser, effectiveTarget, result);
        });
        
        return result;
    }

    static applyEffect(effect, baseUser, baseTarget, effectiveUser, effectiveTarget, result) {
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
    }

    static createBattleSummary(player1Action, player2Action, player1, player2, roundNum, comboData = {}, roundBasedSummaries1 = [], roundBasedSummaries2 = []) {
        const getEffectEmojis = (entity) => {
            const emojis = [];
            (entity.activeEffects || []).forEach(effect => {
                if (effect.type === 'buff') emojis.push(EMOJIS.buff);
                if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
                if (effect.type === 'status') emojis.push(EMOJIS[effect.status] || EMOJIS.status);
            });
            return emojis.length ? `[${emojis.join('')}] ` : '';
        };
        
        const player1EffectEmojis = getEffectEmojis(player1);
        const player2EffectEmojis = getEffectEmojis(player2);

        const getActionDescription = (action, user, target) => {
            if (action.isRest) return action.description;
            if (!action.hit) {
                if (action.specialEffects?.includes("Stun active")) return "is stunned!";
                if (action.specialEffects?.includes("Flinch active")) return "flinched!";
                return "missed!";
            }
            return jutsuList[action.jutsuUsed]?.description || action.description;
        };

        const player1Desc = getActionDescription(player1Action, player1, player2);
        const player2Desc = getActionDescription(player2Action, player2, player1);

        const getComboProgress = (player) => {
            if (!player.Combo || !comboList[player.Combo]) return "";
            const combo = comboList[player.Combo];
            const usedJutsus = player.comboState?.usedJutsus || new Set();
            const filled = combo.requiredJutsus.filter(jutsu => usedJutsus.has(jutsu)).length;
            const total = combo.requiredJutsus.length;
            return `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
        };

        // Add round-based jutsu descriptions/effects to summary
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

        const embed = new EmbedBuilder()
            .setTitle(`Round: ${roundNum}!`)
            .setColor('#006400')
            .setDescription(
                `${player1EffectEmojis}${player1.name} ${player1Desc}` +
                `${player1Action.damage ? ` for ${Math.round(player1Action.damage)} damage!` : 
                 player1Action.heal ? ` for ${Math.round(player1Action.heal)} HP!` : '!'}` +
                (comboData.comboCompleted1 ? comboData.comboDamageText1 : "") +
                getComboProgress(player1) +
                roundBasedText(roundBasedSummaries1) +
                `\n\n${player2EffectEmojis}${player2.name} ${player2Desc}` +
                `${player2Action.damage ? ` for ${Math.round(player2Action.damage)} damage!` : 
                 player2Action.heal ? ` for ${Math.round(player2Action.heal)} HP!` : '!'}` +
                (comboData.comboCompleted2 ? comboData.comboDamageText2 : "") +
                getComboProgress(player2) +
                roundBasedText(roundBasedSummaries2)
            )
            .addFields({
                name: 'Battle Status',
                value: `${player1.name} | ${Math.round(player1.currentHealth)} HP | ${player1.chakra} Chakra\n` +
                       `${player2.name} | ${Math.round(player2.currentHealth)} HP | ${player2.chakra} Chakra`
            });

        const playerJutsu = jutsuList[player1Action.jutsuUsed] || jutsuList[player2Action.jutsuUsed];
        if (playerJutsu?.image_url) embed.setImage(playerJutsu.image_url);
        
        return embed;
    }
}

// Command handler
module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another user to a battle')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to challenge')
                .setRequired(true)
        ),

    async execute(interaction) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('user');

        if (challenger.id === opponent.id) {
            return interaction.reply({ content: "You can't fight yourself!", ephemeral: true });
        }

        if (opponent.bot) {
            return interaction.reply({ content: "You can't fight bots!", ephemeral: true });
        }

        // Create fight invitation
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(' Fight Invitation!')
            .setDescription(`<@${opponent.id}>, do you accept <@${challenger.id}>'s challenge?`)
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
            if (i.customId === 'accept_fight') {
                await i.update({ 
                    content: ` <@${challenger.id}> vs <@${opponent.id}> - Battle starting!`, 
                    embeds: [], 
                    components: [] 
                });
                await this.startBattle(interaction, challenger.id, opponent.id);
            } else {
                await i.update({ 
                    content: `<@${opponent.id}> declined the fight challenge from <@${challenger.id}>`, 
                    embeds: [], 
                    components: [] 
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await response.edit({ 
                    content: `<@${opponent.id}> didn't respond to the fight challenge in time`, 
                    embeds: [], 
                    components: [] 
                });
            }
        });
    },

    async startBattle(interaction, challengerId, opponentId) {
        const users = loadData(usersPath);
        
        if (!users[challengerId] || !users[opponentId]) {
            return interaction.editReply({ content: "One or both users are not enrolled in the system!" });
        }

        // Initialize players
        const initPlayer = (userData, discordUser, isChallenger) => ({
            ...userData,
            userId: discordUser.id,
            name: discordUser.username,
            avatar: discordUser.avatar,
            discriminator: discordUser.discriminator,
            activeEffects: [],
            accuracy: 100,
            dodge: 0,
            currentHealth: userData.health,
            chakra: userData.chakra || 10,
            activeJutsus: {},
            comboState: userData.Combo && comboList[userData.Combo] ? { 
                combo: comboList[userData.Combo], 
                usedJutsus: new Set() 
            } : null
        });

        const challenger = initPlayer(users[challengerId], interaction.user, true);
        const opponentUser = await interaction.client.users.fetch(opponentId);
        const opponent = initPlayer(users[opponentId], opponentUser, false);

        let roundNum = 1;
        let battleActive = true;

        while (battleActive) {
            // Process active round-based jutsus
            [challenger, opponent].forEach(player => {
                Object.entries(player.activeJutsus).forEach(([jutsuName, data]) => {
                    const jutsu = jutsuList[jutsuName];
                    if (jutsu?.roundBased) {
                        const target = player === challenger ? opponent : challenger;
                        // Get effective stats
                        const effectivePlayer = BattleUtils.getEffectiveStats(player);
                        const effectiveTarget = BattleUtils.getEffectiveStats(target);

                        // Apply round-based jutsu for this round
                        const result = BattleSystem.executeJutsu(
                            player,
                            target,
                            effectivePlayer,
                            effectiveTarget,
                            jutsuName,
                            data.round + 1
                        );

                        // --- APPLY ROUND-BASED EFFECTS PATCH ---
                        // Actually apply damage/heal from round-based jutsu result
                        if (result.damage && result.damage > 0) {
                            target.currentHealth -= result.damage;
                        }
                        if (result.heal && result.heal > 0) {
                            player.currentHealth = Math.min(player.currentHealth + result.heal, player.health);
                        }
                        // Also apply status effects to target if present in result
                        // (already handled by applyEffect, so no need to duplicate here)

                        // Store round-based summary for later display
                        if (!player.roundBasedSummaries) player.roundBasedSummaries = [];
                        player.roundBasedSummaries.push({
                            desc: result.roundBasedDesc,
                            effects: result.roundBasedEffects
                        });

                        player.activeJutsus[jutsuName].round++;

                        // Remove completed jutsu
                        const maxRound = Math.max(...Object.keys(jutsu.roundEffects).map(k => {
                            const parts = k.split('-');
                            return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                        }));

                        if (data.round >= maxRound) {
                            delete player.activeJutsus[jutsuName];
                        }
                    }
                });
            });

            // Calculate effective stats
            const effective1 = BattleUtils.getEffectiveStats(challenger);
            const effective2 = BattleUtils.getEffectiveStats(opponent);

            // Challenger's turn
            const { embed: embed1, components: components1 } = BattleSystem.createMovesEmbed(challenger, roundNum);
            const moveMessage1 = await interaction.channel.send({
                content: `<@${challenger.userId}>`,
                embeds: [embed1],
                components: components1,
                fetchReply: true
            });

            // --- CUSTOM BACKGROUND PATCH ---
            // Find active round-based jutsu for challenger/opponent
            let activeJutsu1 = null, activeJutsu2 = null;
            Object.keys(challenger.activeJutsus || {}).forEach(jName => {
                const jutsu = jutsuList[jName];
                if (jutsu?.custombackground) activeJutsu1 = jutsu;
            });
            Object.keys(opponent.activeJutsus || {}).forEach(jName => {
                const jutsu = jutsuList[jName];
                if (jutsu?.custombackground) activeJutsu2 = jutsu;
            });

            const battleImagePath1 = await BattleUtils.generateBattleImage(
                challenger, opponent, roundNum, activeJutsu1, activeJutsu2
            );
            const battleImage1 = new AttachmentBuilder(battleImagePath1);
            await interaction.channel.send({ files: [battleImage1] });

            const challengerAction = await new Promise(resolve => {
                const collector = moveMessage1.createMessageComponentCollector({
                    filter: i => i.user.id === challenger.userId && i.customId.endsWith(`-${challenger.userId}-${roundNum}`),
                    time: 90000
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    if (i.customId.startsWith('move')) {
                        const jutsuName = BattleSystem.getJutsuByButton(i.customId, challenger);
                        const jutsu = jutsuList[jutsuName];

                        // Track round-based jutsus
                        if (jutsu?.roundBased) {
                            // Only activate if not already active
                            if (!challenger.activeJutsus[jutsuName]) {
                                // Deduct chakra only on activation
                                const result = BattleSystem.executeJutsu(
                                    challenger,
                                    opponent,
                                    effective1,
                                    effective2,
                                    jutsuName,
                                    1,
                                    true // activation
                                );
                                if (!result.hit) {
                                    resolve(result);
                                    collector.stop();
                                    return;
                                }
                                challenger.activeJutsus[jutsuName] = { round: 1 };
                                // Store round-based summary for display
                                if (!challenger.roundBasedSummaries) challenger.roundBasedSummaries = [];
                                challenger.roundBasedSummaries.push({
                                    desc: result.roundBasedDesc,
                                    effects: result.roundBasedEffects
                                });
                                result.jutsuUsed = jutsuName;
                                resolve(result);
                                collector.stop();
                                return;
                            }
                        }

                        const result = BattleSystem.executeJutsu(
                            challenger,
                            opponent,
                            effective1,
                            effective2,
                            jutsuName
                        );

                        // Track combo progress
                        if (challenger.comboState?.combo.requiredJutsus.includes(jutsuName)) {
                            challenger.comboState.usedJutsus.add(jutsuName);
                        }

                        result.jutsuUsed = jutsuName;
                        resolve(result);
                    } else {
                        resolve(await BattleSystem.processPlayerMove(i.customId, challenger, opponent, effective1, effective2));
                    }
                    collector.stop();
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${challenger.name} did not make a move.`,
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

            if (challengerAction.fled) {
                battleActive = false;
                await interaction.channel.send(`${challenger.name} fled from the battle!`);
                break;
            }

            // Opponent's turn
            const { embed: embed2, components: components2 } = BattleSystem.createMovesEmbed(opponent, roundNum);
            const moveMessage2 = await interaction.channel.send({
                content: `<@${opponent.userId}>`,
                embeds: [embed2],
                components: components2,
                fetchReply: true
            });

            const opponentAction = await new Promise(resolve => {
                const collector = moveMessage2.createMessageComponentCollector({
                    filter: i => i.user.id === opponent.userId && i.customId.endsWith(`-${opponent.userId}-${roundNum}`),
                    time: 90000
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    if (i.customId.startsWith('move')) {
                        const jutsuName = BattleSystem.getJutsuByButton(i.customId, opponent);
                        const jutsu = jutsuList[jutsuName];

                        // Track round-based jutsus
                        if (jutsu?.roundBased) {
                            // Only activate if not already active
                            if (!opponent.activeJutsus[jutsuName]) {
                                // Deduct chakra only on activation
                                const result = BattleSystem.executeJutsu(
                                    opponent,
                                    challenger,
                                    effective2,
                                    effective1,
                                    jutsuName,
                                    1,
                                    true // activation
                                );
                                if (!result.hit) {
                                    resolve(result);
                                    collector.stop();
                                    return;
                                }
                                opponent.activeJutsus[jutsuName] = { round: 1 };
                                // Store round-based summary for display
                                if (!opponent.roundBasedSummaries) opponent.roundBasedSummaries = [];
                                opponent.roundBasedSummaries.push({
                                    desc: result.roundBasedDesc,
                                    effects: result.roundBasedEffects
                                });
                                result.jutsuUsed = jutsuName;
                                resolve(result);
                                collector.stop();
                                return;
                            }
                        }

                        const result = BattleSystem.executeJutsu(
                            opponent,
                            challenger,
                            effective2,
                            effective1,
                            jutsuName
                        );

                        // Track combo progress
                        if (opponent.comboState?.combo.requiredJutsus.includes(jutsuName)) {
                            opponent.comboState.usedJutsus.add(jutsuName);
                        }

                        result.jutsuUsed = jutsuName;
                        resolve(result);
                    } else {
                        resolve(await BattleSystem.processPlayerMove(i.customId, opponent, challenger, effective2, effective1));
                    }
                    collector.stop();
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        resolve({
                            damage: 0,
                            heal: 0,
                            description: `${opponent.name} did not make a move.`,
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

            if (opponentAction.fled) {
                battleActive = false;
                await interaction.channel.send(`${opponent.name} fled from the battle!`);
                break;
            }

            // Process combos
            const processCombo = (attacker, defender) => {
                if (!attacker.comboState) return { completed: false, damageText: "" };
                
                const combo = attacker.comboState.combo;
                if (combo.requiredJutsus.every(jutsu => attacker.comboState.usedJutsus.has(jutsu))) {
                    let comboResult = {
                        damage: combo.damage || 0,
                        heal: 0,
                        specialEffects: []
                    };
                    
                    (combo.effects || []).forEach(effect => {
                        BattleSystem.applyEffect(effect, attacker, defender, 
                            BattleUtils.getEffectiveStats(attacker), 
                            BattleUtils.getEffectiveStats(defender), 
                            comboResult);
                    });
                    
                    defender.currentHealth -= comboResult.damage;
                    if (comboResult.heal) {
                        attacker.currentHealth = Math.min(attacker.currentHealth + comboResult.heal, attacker.health);
                    }
                    
                    attacker.comboState.usedJutsus.clear();
                    return {
                        completed: true,
                        damageText: `\n${attacker.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`
                    };
                }
                return { completed: false, damageText: "" };
            };

            const combo1 = processCombo(challenger, opponent);
            const combo2 = processCombo(opponent, challenger);

            // Apply actions
            opponent.currentHealth -= challengerAction.damage || 0;
            if (challengerAction.heal) {
                challenger.currentHealth = Math.min(challenger.currentHealth + challengerAction.heal, challenger.health);
            }

            challenger.currentHealth -= opponentAction.damage || 0;
            if (opponentAction.heal) {
                opponent.currentHealth = Math.min(opponent.currentHealth + opponentAction.heal, opponent.health);
            }

            // --- MISSING EFFECTS PATCH ---
            // Apply round-based jutsu effects (bleed/drowning/reaper_seal) from summaries
            [challenger, opponent].forEach(player => {
                if (player.roundBasedSummaries) {
                    player.roundBasedSummaries.forEach(s => {
                        if (s.effects && s.effects.length) {
                            s.effects.forEach(eff => {
                                // Bleed
                                const bleedMatch = eff.match(/is bleeding! \(-(\d+) HP\)/);
                                if (bleedMatch) {
                                    player.currentHealth -= parseInt(bleedMatch[1]);
                                }
                                // Drowning
                                const drowningMatch = eff.match(/is drowning! \(-(\d+) HP\)/);
                                if (drowningMatch) {
                                    player.currentHealth -= parseInt(drowningMatch[1]);
                                }
                                // Reaper Seal
                                const reaperMatch = eff.match(/shinigami! \(-(\d+) HP\)/);
                                if (reaperMatch) {
                                    player.currentHealth -= parseInt(reaperMatch[1]);
                                }
                                // Healed
                                const healMatch = eff.match(/Healed (\d+) HP/);
                                if (healMatch) {
                                    player.currentHealth = Math.min(player.currentHealth + parseInt(healMatch[1]), player.health);
                                }
                            });
                        }
                    });
                }
            });

            // Show round summary
            const summaryEmbed = BattleSystem.createBattleSummary(
                challengerAction,
                opponentAction,
                challenger,
                opponent,
                roundNum,
                {
                    comboCompleted1: combo1.completed,
                    comboDamageText1: combo1.damageText,
                    comboCompleted2: combo2.completed,
                    comboDamageText2: combo2.damageText
                },
                // Pass round-based summaries for display
                challenger.roundBasedSummaries,
                opponent.roundBasedSummaries
            );
            await interaction.channel.send({ embeds: [summaryEmbed] });

            // Clear round-based summaries after displaying
            challenger.roundBasedSummaries = [];
            opponent.roundBasedSummaries = [];

            // Check for win/loss
            if (challenger.currentHealth <= 0 || opponent.currentHealth <= 0) {
                battleActive = false;
                
                if (challenger.currentHealth > 0 && opponent.currentHealth <= 0) {
                    await interaction.channel.send(`**${challenger.name}** has defeated **${opponent.name}**!`);
                } else if (opponent.currentHealth > 0 && challenger.currentHealth <= 0) {
                    await interaction.channel.send(`**${opponent.name}** has defeated **${challenger.name}**!`);
                } else {
                    await interaction.channel.send(`It's a draw!`);
                }
                break;
            }

            // Passive chakra regen
            challenger.chakra = Math.min(challenger.chakra + 2, challenger.chakra + 5);
            opponent.chakra = Math.min(opponent.chakra + 2, opponent.chakra + 5);

            // Update effect durations
            [challenger, opponent].forEach(player => {
                player.activeEffects.forEach(effect => {
                    if (effect.duration > 0) effect.duration--;
                });
                player.activeEffects = player.activeEffects.filter(e => e.duration > 0);
            });

            roundNum++;
        }
    }
};