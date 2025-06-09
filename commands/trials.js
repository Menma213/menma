const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
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
        image: "",
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
        image: "https://www.pngplay.com/wp-content/uploads/12/Hashirama-Senju-No-Background.png",
        health: 80000,
        power: 3500,
        defense: 2500,
        accuracy: 98,
        dodge: 35,
        jutsu: ["Attack", "Shadow Clone Jutsu", "Rasenshuriken"],
        combos: ["Ultimate Combo"]
    }
];

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

        // Initialize player
        const player = {
            ...users[userId],
            name: interaction.user.username,
            activeEffects: [],
            accuracy: 100,
            dodge: 0
        };

        let currentTrialIndex = 0;
        let battleActive = true;

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

            // Generate battle image with improved centering, name above, HP bar below, no footer
            const generateBattleImage = async () => {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 800, height: 400 });

                const currentNpc = npc;
                if (typeof currentNpc.currentHealth !== 'number') currentNpc.currentHealth = npcHealth;

                const playerHealthPercent = Math.max((playerHealth / player.health) * 100, 0);
                const npcHealthPercent = Math.max((currentNpc.currentHealth / currentNpc.health) * 100, 0);

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
                            <img class="character enemy" src="${currentNpc.image || 'https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg'}">
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

            // ...executeJutsu, processPlayerMove, npcChooseMove, getEffectiveStats: same as brank.js...

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

                const embed = new EmbedBuilder()
                    .setTitle(`Round: ${roundNum}!`)
                    .setColor('#006400')
                    .setDescription(
                        `${playerEffectEmojis}@${player.name} ${playerDesc}` +
                        `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                        `\n\n${npcEffectEmojis}${npcDesc}` +
                        `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}`
                        + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
                        + comboProgressText
                    )
                    .addFields({
                        name: 'Battle Status',
                        value: `${player.name} || ${Math.round(player.currentHealth ?? playerHealth)} HP\n${currentNpc.name} || ${Math.round(currentNpc.currentHealth ?? npcHealth)} HP\nChakra: ${player.chakra}            Chakra: ${currentNpc.chakra}`
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

                const { embed, components } = createMovesEmbed();
                const moveMessage = await interaction.followUp({
                    embeds: [embed],
                    components: components,
                    fetchReply: true
                });

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
                        const expReward = 300 + Math.floor(player.level * 30);
                        const moneyReward = 100000;
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
                    }
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }

                // Passive chakra regen
                player.chakra += 2;
                npc.chakra += 2;

                roundNum++;
                if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
            } // Closing brace for the inner while loop
        } // Closing brace for the outer while loop
    }
};