const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');
const { addMentorExp } = require('./mentors.js');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '/workspaces/menma/images');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Add Shuriken Throw jutsu to jutsuList if not present
if (!jutsuList["Shuriken Throw"]) {
    jutsuList["Shuriken Throw"] = {
        name: "Shuriken Throw",
        description: "A basic ranged attack with shuriken.",
        chakraCost: 0,
        effects: [
            { type: "damage", formula: "max(5, user.power * 0.5 - target.defense * 0.2)" }
        ]
    };
}

// Load combos from combos.json (future-proof, like jutsus)
let comboList = {};
if (fs.existsSync(combosPath)) {
    comboList = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
}

// Effect handlers with improved error handling
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
                // Add flags for special conditions
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => 
                    e.type === 'status' && 
                    ['stun', 'flinch'].includes(e.status)
                ),
                max: Math.max // Make max function available in formulas
            };
            
            // Apply accuracy bonus if present
            const finalAccuracy = effect.accuracyBonus ? 
                effectHandlers.getAccuracyBonus(effect, context.user.accuracy) : 
                context.user.accuracy;
            
            // Calculate hit chance (user accuracy vs target dodge)
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

    // Add handling for bleeding status
    bleed: (target) => {
        const bleedDamage = Math.floor(target.health * 0.1); // 10% health as bleed damage
        return bleedDamage;
    },

    // Add handling for flinch status
    flinch: (chance) => Math.random() < chance,

    // Add handling for accuracy bonus
    getAccuracyBonus: (effect, baseAccuracy) => {
        return baseAccuracy + (effect.accuracyBonus || 0);
    }
};

// Add emoji constants
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
// Add chakra regen rates
const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chunin': 2,
    'Jounin': 3
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Fight a weak NPC in a B-Rank mission'),

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
        // Fix: don't re-declare player, just assign it once
        let player = users[userId];

        // --- COOLDOWN SYSTEM ---
        const now = Date.now();
        if (player.lastbrank && now - player.lastbrank < 12 * 60 * 1000) {
            const left = 12 * 60 * 1000 - (now - player.lastbrank);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: true });
        }
        player.lastbrank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Initialize player and NPC
        player = {
            ...users[userId],
            name: interaction.user.username,
            activeEffects: [],
            accuracy: 100,
            dodge: 0
        };

        const npc = {
            name: "Bandit Leader",
            health: Math.floor(player.health * 0.5 ),
            power: Math.floor(player.power * 0.9 + player.level * 2),
            defense: Math.floor(player.defense * 0.01),
            chakra: 10,
            jutsu: ["Attack", "Serpents Wrath", "Shuriken Throw"],
            activeEffects: [],
            accuracy: 85,
            dodge: 15
        };

        let roundNum = 1;
        let playerHealth = player.health;
        let npcHealth = npc.health;

        // Combo state
        let comboState = null;
        if (player.Combo && comboList[player.Combo]) {
            comboState = {
                combo: comboList[player.Combo],
                usedJutsus: new Set()
            };
        }

        // Generate battle image with improved centering, name above, HP bar below, no footer
        const generateBattleImage = async () => {
            const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setViewport({ width: 800, height: 400 });

            // Use local currentNpc for image stats
            const currentNpc = npc;
            if (typeof currentNpc.currentHealth !== 'number') currentNpc.currentHealth = npcHealth;

            const playerHealthPercent = Math.max((playerHealth / player.health) * 100, 0);
            const npcHealthPercent = Math.max((currentNpc.currentHealth / currentNpc.health) * 100, 0);

            // Create images directory if it doesn't exist
            const imagesDir = path.resolve(__dirname, '../images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            const htmlContent = `
                <html>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .battle-container {
                        width: 800px;
                        height: 400px;
                        position: relative;
                        background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat;
                        background-size: cover;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    .character {
                        position: absolute;
                        width: 150px;
                        height: 150px;
                        border-radius: 10px;
                        border: 3px solid #6e1515;
                        object-fit: cover;
                    }
                    .player {
                        right: 50px;
                        top: 120px;
                    }
                    .enemy {
                        left: 50px;
                        top: 120px;
                    }
                    .name-tag {
                        position: absolute;
                        width: 150px;
                        text-align: center;
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 18px;
                        font-weight: bold;
                        text-shadow: 2px 2px 4px #000;
                        top: 80px;
                        background: rgba(0,0,0,0.5);
                        border-radius: 5px;
                        padding: 2px 0;
                    }
                    .player-name {
                        right: 50px;
                    }
                    .enemy-name {
                        left: 50px;
                    }
                    .health-bar {
                        position: absolute;
                        width: 150px;
                        height: 22px;
                        background-color: #333;
                        border-radius: 5px;
                        overflow: hidden;
                        top: 280px;
                    }
                    .health-fill {
                        height: 100%;
                    }
                    .npc-health-fill {
                        background-color: #ff4444;
                        width: ${npcHealthPercent}%;
                    }
                    .player-health-fill {
                        background-color: #4CAF50;
                        width: ${playerHealthPercent}%;
                    }
                    .health-text {
                        position: absolute;
                        width: 100%;
                        text-align: center;
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 13px;
                        line-height: 22px;
                        text-shadow: 1px 1px 1px black;
                    }
                    .player-health {
                        right: 50px;
                    }
                    .enemy-health {
                        left: 50px;
                    }
                    .vs-text {
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 48px;
                        font-weight: bold;
                        text-shadow: 2px 2px 4px #000;
                    }
                </style>
                <body>
                    <div class="battle-container">
                        <div class="name-tag enemy-name">${currentNpc.name}</div>
                        <img class="character enemy" src="https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg">
                        <div class="health-bar enemy-health">
                            <div class="health-fill npc-health-fill"></div>
                            <div class="health-text">${Math.round(currentNpc.currentHealth)}/${currentNpc.health}</div>
                        </div>
                        
                        <div class="name-tag player-name">${player.name}</div>
                        <img class="character player" src="${interaction.user.displayAvatarURL({ format: 'png', size: 256 })}">
                        <div class="health-bar player-health">
                            <div class="health-fill player-health-fill"></div>
                            <div class="health-text">${Math.round(playerHealth)}/${player.health}</div>
                        </div>
                        <div class="vs-text">VS</div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(htmlContent);
            const imagePath = path.join(imagesDir, `battle_${userId}_${Date.now()}.png`);
            await page.screenshot({ path: imagePath });
            await browser.close();
            return imagePath;
        };

        // Create moves embed: 1-5 jutsu buttons on first row, 6th (if any) + rest/flee on second row
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
        };

        // Map button index to jutsu
        const getJutsuByButton = (buttonId) => {
            const match = buttonId.match(/^move(\d+)-/);
            if (!match) return null;
            const idx = parseInt(match[1], 10) - 1;
            const jutsuNames = Object.entries(player.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([_, jutsuName]) => jutsuName);
            return jutsuNames[idx];
        };

        // Execute a jutsu with base and effective stats
        const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) => {
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

            // Check and deduct chakra from base user
            if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                    specialEffects: ["Chakra exhausted!"],
                    hit: false
                };
            }
            baseUser.chakra -= jutsu.chakraCost || 0;

            // Process all effects
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
                                
                                // Handle different status effects
                                switch (effect.status) {
                                    case 'bleed':
                                        const bleedDamage = effectHandlers.bleed(baseTarget);
                                        result.damage += bleedDamage;
                                        result.specialEffects.push(`Target is bleeding (${bleedDamage} damage/turn)`);
                                        break;
                                        
                                    case 'flinch':
                                        if (effectHandlers.flinch(effect.chance)) {
                                            result.specialEffects.push('Target flinched!');
                                        }
                                        break;
                                }
                                
                                baseTarget.activeEffects.push({
                                    type: 'status',
                                    status: effect.status,
                                    duration: effect.duration || 1
                                });
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

        // Process player move with effective stats
        const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
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
            
            return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
        };

        // NPC chooses move with effective stats
        const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
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
        };

        // Calculate effective stats considering active effects
        const getEffectiveStats = (entity) => {
            const stats = { ...entity };
            delete stats.activeEffects;

            // Start with base stats
            const effectiveStats = {
                power: stats.power || 10,
                defense: stats.defense || 10,
                chakra: stats.chakra || 10,
                health: stats.health || 100,
                accuracy: stats.accuracy || 100,
                dodge: stats.dodge || 0
            };

            // Apply all active effects
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

            // For NPC, use local variable for current health
            const currentNpc = npc;
            if (typeof currentNpc.currentHealth !== 'number') currentNpc.currentHealth = npcHealth;

            // Player/NPC effect emojis
            const playerEffectEmojis = getEffectEmojis(player);
            const npcEffectEmojis = getEffectEmojis(currentNpc);

            // Player description
            const playerDesc = playerAction.isRest ? playerAction.description :
                !playerAction.hit ? (
                    playerAction.specialEffects?.includes("Stun active") ? "is stunned!" :
                    playerAction.specialEffects?.includes("Flinch active") ? "flinched!" : "missed!"
                ) :
                (jutsuList[playerAction.jutsuUsed]?.description || playerAction.description);

            // NPC description
            const npcDesc = !npcAction.hit ? (
                npcAction.specialEffects?.includes("Stun active") ? `${currentNpc.name} is stunned!` :
                npcAction.specialEffects?.includes("Flinch active") ? `${currentNpc.name} flinched!` : `${currentNpc.name} missed!`
            ) :
            npcAction.description;

            // Handle active status effects (bleed/drowning)
            let statusEffects = [];
            [player, currentNpc].forEach(entity => {
                if (typeof entity.currentHealth !== 'number') entity.currentHealth = entity === player ? playerHealth : npcHealth;
                entity.activeEffects.forEach(effect => {
                    if (effect.type === 'status') {
                        switch(effect.status) {
                            case 'bleed': {
                                const bleedDamage = Math.floor(entity.health * 0.1);
                                entity.currentHealth -= bleedDamage;
                                statusEffects.push(`${entity.name} is bleeding! (-${bleedDamage} HP)`);
                                break;
                            }
                            case 'drowning': {
                                const drowningDamage = Math.floor(entity.health * 0.1);
                                entity.currentHealth -= drowningDamage;
                                const jutsu = jutsuList['Water Prison'];
                                const chakraDrain = jutsu?.effects?.[0]?.chakraDrain || 3;
                                entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                                statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                                break;
                            }
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

            const embed = new EmbedBuilder()
                .setTitle(`Round: ${roundNum}!`)
                .setColor('#006400')
                .setDescription(
                    `${playerEffectEmojis}@${player.name} ${playerDesc}` +
                    `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
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
        try {
            await interaction.reply({ content: "**B-Rank Mission Started!**" });

            let battleActive = true;
            while (battleActive) {
                // Update effect durations at start of turn
                [player, npc].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (effect.duration > 0) effect.duration--;
                    });
                    entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                });

                // Calculate effective stats for this turn
                const effectivePlayer = getEffectiveStats(player);
                const effectiveNpc = getEffectiveStats(npc);

                // Moves embed first
                const { embed, components } = createMovesEmbed();
                const moveMessage = await interaction.followUp({
                    embeds: [embed],
                    components: components,
                    fetchReply: true
                });

                // Battle image after moves embed
                const battleImage = new AttachmentBuilder(await generateBattleImage());
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
                            const result = executeJutsu(player, npc, effectivePlayer, effectiveNpc, jutsuName);
                            // Combo tracking
                            if (comboState?.combo.requiredJutsus.includes(jutsuName)) {
                                comboState.usedJutsus.add(jutsuName);
                            }
                            result.jutsuUsed = jutsuName;
                            resolve(result);
                        } else {
                            resolve(await processPlayerMove(i.customId, player, npc, effectivePlayer, effectiveNpc));
                        }
                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: '$user fled, did not make a move.',
                                specialEffects: ["Missed opportunity!"],
                                hit: false,
                                fled: true
                            });
                        }
                        // Disable all buttons
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
                    await interaction.followUp(`${player.name} fled from the battle!`);
                    // Immediately return from the execute function to prevent any further code (including reward/material drop)
                    return;
                }

                // Combo completion check and bonus damage (show in summary, reduce npc health)
                let comboCompletedThisRound = false;
                let comboDamageText = "";
                if (
                    comboState &&
                    comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
                ) {
                    // Apply combo effects like a jutsu
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
                                    if (!npc.activeEffects) npc.activeEffects = [];
                                    npc.activeEffects.push({
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1
                                    });
                                    comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                    break;
                                case 'debuff':
                                    const debuffChanges = effectHandlers.debuff(npc, effect.stats);
                                    if (!npc.activeEffects) npc.activeEffects = [];
                                    npc.activeEffects.push({
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
                    npcHealth -= comboResult.damage;
                    if (typeof npc.currentHealth === 'number') npc.currentHealth -= comboResult.damage;
                    if (comboResult.heal) {
                        playerHealth = Math.min(playerHealth + comboResult.heal, player.health);
                    }
                    comboCompletedThisRound = true;
                    comboDamageText = `\n${player.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`;
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
                    npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                    playerHealth -= npcAction.damage || 0;
                    if (npcAction.heal) {
                        npcHealth = Math.min(npcHealth + npcAction.heal, npc.health);
                        if (typeof npc.currentHealth === 'number') npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                    }
                }

                // Clamp health
                playerHealth = Math.max(0, playerHealth);
                npcHealth = Math.max(0, npcHealth);
                if (typeof npc.currentHealth === 'number') npc.currentHealth = Math.max(0, npc.currentHealth);

                // Show results (no extra image here)
                let summaryEmbed = createBattleSummary(playerAction, npcAction);
                if (comboCompletedThisRound) {
                    summaryEmbed.setDescription(
                        summaryEmbed.data.description + comboDamageText
                    );
                }
                await interaction.followUp({
                    embeds: [summaryEmbed]
                });

                // Win/loss
                if (playerHealth <= 0 || npcHealth <= 0) {
                    battleActive = false;
                    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (playerHealth > 0) {
                        const expReward = 300 + Math.floor(player.level * 30);
                        const moneyReward = 500 + Math.floor(player.level * 20);
                        users[userId].exp += expReward;
                        users[userId].money += moneyReward;
                        users[userId].wins += 1;
                        users[userId].health = player.health;
                        // Add mentorExp directly to users.json
                        users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                        // ...existing code...
                        await updateRequirements(interaction.user.id, 'b_mission');
                        // Optionally: await addMentorExp(userId, 1); // (kept for compatibility)
                    } else {
                        users[userId].losses += 1;
                        users[userId].health = player.health;
                        await interaction.followUp(`**Defeat!** You were defeated by ${npc.name}...`);
                        // Immediately return to prevent reward/material drop code
                        return;
                    }
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }

                // Passive chakra regen
                player.chakra += CHAKRA_REGEN[player.rank] || 1;
                npc.chakra += 2;

                roundNum++;
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

            // Reward embed
            const expReward = 300 + Math.floor(player.level * 30);
            const moneyReward = 500 + Math.floor(player.level * 20);
            const rewardEmbed = new EmbedBuilder()
                .setTitle(`Battle End! ${player.name} has won!`)
                .setDescription(
                    `<@${userId}> has earned ${expReward} exp!\n<@${userId}> has earned $${moneyReward}!`
                )
                .setColor('#006400');

            // Send response (village + akatsuki drop if any)
            let dropMsg = "```";
            if (player.occupation === "Akatsuki" && akatsukiDropMsg) {
                dropMsg += `\n${akatsukiDropMsg}`;
            } else if (amount > 0) {
                dropMsg += `\nYou found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
            }
            dropMsg += "```";
            await interaction.followUp({ embeds: [rewardEmbed], content: dropMsg });

            await updateRequirements(interaction.user.id, 'b_mission');
        } catch (error) {
            console.error("Battle error:", error);
            await interaction.followUp("An error occurred during the battle!");
        }
    }
};