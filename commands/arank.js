const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Add emoji constants at the top after requires
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

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '/workspaces/menma/data/jutsus.json');

// Cooldown time in milliseconds (18 minutes)
const COOLDOWN_TIME = 18 * 60 * 1000;

// Chakra regen rates per rank
const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chunin': 2,
    'Jounin': 3
};

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Effect handlers with improved error handling
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
    status: (chance) => Math.random() < (chance || 1)
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arank')
        .setDescription('Fight multiple NPCs in an A-Rank mission'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            
            if (!users[userId]) {
                return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // Check cooldown
            const now = Date.now();
            const lastUsed = users[userId].lastArank || 0;
            const timeLeft = COOLDOWN_TIME - (now - lastUsed);

            if (timeLeft > 0) {
                const minutes = Math.ceil(timeLeft / 60000);
                return interaction.followUp({ 
                    content: `You can use this command again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
                    ephemeral: true 
                });
            }

            // Update last used time
            users[userId].lastArank = now;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            if (!fs.existsSync(usersPath)) {
                return interaction.followUp({ content: "Database not found.", ephemeral: true });
            }

            if (!users[userId]) {
                return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
            }

            // Initialize player
            const player = {
                ...users[userId],
                name: interaction.user.username,
                activeEffects: [],
                accuracy: 100,
                dodge: 0
            };

            // NPC data with unique stats and images
            const npcData = [
                {
                    name: "Jugo",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364667218570514462/image.png?ex=68170723&is=6815b5a3&hm=6fa594229de00425cef3ae3bb8a1998de9811a27e0435bd3061c0e9882704ce6&=&format=webp&quality=lossless",
                    basePower: 0.9,
                    baseDefense: 0.8,
                    baseHealth: 0.9,
                    accuracy: 85,
                    dodge: 15,
                    jutsu: ["Attack", "Substitution Jutsu", "Cursed Seal Transformation"]
                },
                {
                    name: "Temari",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364667330067562576/image.png",
                    basePower: 0.95,
                    baseDefense: 0.7,
                    baseHealth: 0.8,
                    accuracy: 90,
                    dodge: 20,
                    jutsu: ["Attack", "Substitution Jutsu", "Wind Scythe Jutsu"]
                },
                {
                    name: "Kankuro",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364667676235923506/image.png",
                    basePower: 0.85,
                    baseDefense: 0.9,
                    baseHealth: 0.85,
                    accuracy: 80,
                    dodge: 25,
                    jutsu: ["Attack", "Substitution Jutsu", "Puppet Technique"]
                },
                {
                    name: "Suigetsu",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364667843660087428/image.png",
                    basePower: 0.8,
                    baseDefense: 1.0,
                    baseHealth: 1.0,
                    accuracy: 75,
                    dodge: 30,
                    jutsu: ["Attack", "Substitution Jutsu", "Water Transformation"]
                },
                {
                    name: "Fuguki",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364667943425671248/image.png",
                    basePower: 1.0,
                    baseDefense: 0.95,
                    baseHealth: 1.1,
                    accuracy: 70,
                    dodge: 10,
                    jutsu: ["Attack", "Substitution Jutsu", "Samehada Slash"]
                },
                {
                    name: "Jinpachi",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364668009624502293/image.png",
                    basePower: 0.9,
                    baseDefense: 0.85,
                    baseHealth: 0.95,
                    accuracy: 85,
                    dodge: 20,
                    jutsu: ["Attack", "Substitution Jutsu", "Blaze Release"]
                },
                {
                    name: "Kushimaru",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364668134488932434/image.png",
                    basePower: 0.95,
                    baseDefense: 0.75,
                    baseHealth: 0.9,
                    accuracy: 95,
                    dodge: 25,
                    jutsu: ["Attack", "Substitution Jutsu", "Silent Killing"]
                },
                {
                    name: "Jhunin",
                    image: "https://media.discordapp.net/attachments/1354605859103178895/1364668218433863772/image.png",
                    basePower: 0.8,
                    baseDefense: 0.9,
                    baseHealth: 0.85,
                    accuracy: 90,
                    dodge: 15,
                    jutsu: ["Attack", "Substitution Jutsu", "Fireball Jutsu"]
                },
                {
                    name: "Baki",
                    image: "https://media.discordapp.net/attachments/1289641866597241035/1364586273133690930/image.png",
                    basePower: 1.1,
                    baseDefense: 0.9,
                    baseHealth: 1.0,
                    accuracy: 85,
                    dodge: 20,
                    jutsu: ["Attack", "Substitution Jutsu", "Wind Blade"]
                }
            ];

            // NPC images (in line with npcData order)
            const npcImages = [
                "https://media.discordapp.net/attachments/1354605859103178895/1364667218570514462/image.png?ex=680a80e3&is=68092f63&hm=186262085b1f88de745c6f83c7ff5a9c085faa25f5c3c51a497bdf865df6e4bf&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667330067562576/image.png?ex=680a80fd&is=68092f7d&hm=c5517d8549c73a1f8e40104d731a926248ba907151d6dd85af9e3262dbf8a0b8&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667676235923506/image.png?ex=680a8150&is=68092fd0&hm=f4f93d5da9a12eea2a97d7f8188207c89e6f930320333243f80c7119ead3e8b6&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667843660087428/image.png?ex=680a8178&is=68092ff8&hm=5d97ffb093ee70fff0253a5398befc4784321cc9e1b57fe2b41643fc9a90ded3&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364667943425671248/image.png?ex=680a8190&is=68093010&hm=f99928b4fd95e31ad6b69a2bff4fbb428652242d65e76de82459fba8863ecfb4&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668009624502293/image.png?ex=680a819f&is=6809301f&hm=1cc03f61f8f2839c4681a9b1bc4e2bf639b0c1096cb356b9c48ebf72c0fec1a4&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668134488932434/image.png?ex=680a81bd&is=6809303d&hm=0db75d1e5fea2e69634de70c5f8519e0897b9f10f1f21bd70a37233b569f0796&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1354605859103178895/1364668218433863772/image.png?ex=680a81d1&is=68093051&hm=376294508040f09a111aaaad5626a49c46cdfe4f055cfcf87870b3eb6dada4df&=&format=webp&quality=lossless",
                "https://media.discordapp.net/attachments/1289641866597241035/1364586273133690930/image.png?ex=680a3580&is=6808e400&hm=cbdc018af3b83d959346219ee5e4877de9d97b10cfb03c81d90f9d04c6434169&=&format=webp&quality=lossless"
            ];

            let totalEnemiesDefeated = 0;
            let currentEnemyIndex = 0;
            let roundNum = 1;
            let playerHealth = player.health;

            // Generate NPC with scaling difficulty and unique stats
            const generateNpc = () => {
                const npcTemplate = npcData[currentEnemyIndex % npcData.length];
                const scalingFactor = 1 + Math.floor(totalEnemiesDefeated / 4) * 0.5;
                
                return {
                    name: npcTemplate.name,
                    image: npcTemplate.image,
                    health: Math.floor(player.health * npcTemplate.baseHealth * scalingFactor + player.defense * 3),
                    power: Math.floor(player.power * npcTemplate.basePower * scalingFactor + player.level * 3),
                    defense: Math.floor(player.defense * npcTemplate.baseDefense * scalingFactor + player.level * 2),
                    chakra: 10,
                    jutsu: npcTemplate.jutsu,
                    activeEffects: [],
                    accuracy: npcTemplate.accuracy + Math.floor(totalEnemiesDefeated / 4) * 5,
                    dodge: npcTemplate.dodge + Math.floor(totalEnemiesDefeated / 4) * 3,
                    currentHealth: 0 // Will be set when NPC is created
                };
            };

            let currentNpc = generateNpc();
            currentNpc.currentHealth = currentNpc.health;

            // Generate battle image with improved centering, name above, HP bar below, no footer
            const generateBattleImage = async () => {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 800, height: 400 });

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
                            <img class="character enemy" src="${currentNpc.image}">
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

            // Execute a jutsu with base and effective stats
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
                                    
                                    // Add extra properties for specific status types
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

            // Create moves embed with simplified slot system
            const createMovesEmbed = () => {
                const embed = new EmbedBuilder()
                    .setTitle(`${player.name}`)
                    .setColor('#006400')
                    .setDescription(
                        `${player.name}, It is your turn!\nUse reactions to make a choice.\n\n` +
                        Object.entries(player.jutsu)
                            .filter(([_, jutsu]) => jutsu !== 'None')
                            .map(([slot, jutsu], index) => {
                                const jutsuData = jutsuList[jutsu];
                                return `${index + 1}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                            })
                            .join('\n') +
                        `\n\n[😴] to focus your chakra.\n[❌] to flee from battle.\n\nChakra: ${player.chakra}`
                    );

                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
                const rows = [];
                
                // Add jutsu buttons
                Object.entries(player.jutsu).forEach(([_, jutsuName], index) => {
                    if (jutsuName !== 'None') {
                        const jutsu = jutsuList[jutsuName];
                        const disabled = player.chakra < (jutsu?.chakraCost || 0);
                        
                        currentRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`${jutsuName}-${userId}-${roundNum}`)
                                .setLabel(`${index + 1}`)
                                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(disabled)
                        );
                        
                        buttonCount++;
                        
                        if (buttonCount === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                            buttonCount = 0;
                        }
                    }
                });

                // Add rest and flee buttons to the last row if there's space
                if (buttonCount < 3) {
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rest-${userId}-${roundNum}`)
                            .setLabel('😴')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`flee-${userId}-${roundNum}`)
                            .setLabel('❌')
                            .setStyle(ButtonStyle.Primary)
                    );
                    if (currentRow.components.length > 0) {
                        rows.push(currentRow);
                    }
                } else {
                    // If last row is almost full, push it and create a new row for utility buttons
                    if (currentRow.components.length > 0) {
                        rows.push(currentRow);
                    }
                    if (rows.length < 5) { // Discord max row limit
                        const utilityRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`rest-${userId}-${roundNum}`)
                                    .setLabel('Rest')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`flee-${userId}-${roundNum}`)
                                    .setLabel('Flee')
                                    .setStyle(ButtonStyle.Primary)
                            );
                        rows.push(utilityRow);
                    }
                }

                return { embed, components: rows.slice(0, 5) }; // Ensure we don't exceed Discord's 5-row limit
            };

            // Process player move with effective stats
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
                
                return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
            };

            // NPC chooses move with effective stats
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

                const playerEffectEmojis = getEffectEmojis(player);
                const npcEffectEmojis = getEffectEmojis(currentNpc);

                const playerDesc = playerAction.isRest ? playerAction.description :
                                  !playerAction.hit ? (playerAction.specialEffects.includes("Stun active") ? "is stunned!" :
                                                     playerAction.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") : 
                                  jutsuList[playerAction.jutsuUsed]?.description || playerAction.description;
                
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
                                    const chakraDrain = jutsu.effects[0].chakraDrain || 3;
                                    entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                                    statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                                    break;
                            }
                        }
                    });
                });

                const embed = new EmbedBuilder()
                    .setTitle(`Round: ${roundNum}!`)
                    .setColor('#006400')
                    .setDescription(
                        `${playerEffectEmojis}@${player.name} ${playerDesc}` +
                        `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                        `\n\n${npcEffectEmojis}${npcDesc}` +
                        `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}`
                        + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
                    )
                    .addFields({
                        name: 'Battle Status',
                        value: `${player.name} || ${Math.round(playerHealth)} HP\n${currentNpc.name} || ${Math.round(currentNpc.currentHealth)} HP\nChakra: ${player.chakra}            Chakra: ${currentNpc.chakra}`
                    });

                // Add jutsu image/gif if available
                const playerJutsu = jutsuList[playerAction.jutsuUsed];
                if (playerJutsu?.image_url) {
                    embed.setImage(playerJutsu.image_url);
                }

                return embed;
            };

            // Calculate rewards with bonus every 4th enemy
            const calculateRewards = () => {
                const baseExp = 300 + Math.floor(player.level * 30);
                const baseMoney = 500 + Math.floor(player.level * 20);
                
                if ((totalEnemiesDefeated + 1) % 4 === 0) {
                    if (totalEnemiesDefeated + 1 === 50) {
                        return {
                            exp: baseExp * 5,
                            money: baseMoney * 5,
                            isJackpot: true
                        };
                    }
                    return {
                        exp: baseExp * 3,
                        money: baseMoney * 3,
                        isBonus: true
                    };
                }
                return {
                    exp: baseExp,
                    money: baseMoney,
                    isNormal: true
                };
            };

            // Start battle
            try {
                const battleImage = new AttachmentBuilder(await generateBattleImage());
                await interaction.followUp({ 
                    content: "**A-Rank Mission Started!** Defeat multiple enemies in succession!",
                    files: [battleImage]
                });

                let battleActive = true;
                
                while (battleActive) {
                    // Update effect durations at start of turn
                    [player, currentNpc].forEach(entity => {
                        entity.activeEffects.forEach(effect => {
                            if (effect.duration > 0) effect.duration--;
                        });
                        entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                    });

                    // Calculate effective stats for this turn
                    const effectivePlayer = getEffectiveStats(player);
                    const effectiveNpc = getEffectiveStats(currentNpc);

                    // Player turn
                    const { embed, components } = createMovesEmbed();
                    const moveMessage = await interaction.followUp({
                        embeds: [embed],
                        components: components,
                        fetchReply: true
                    });

                    const playerAction = await new Promise(resolve => {
                        const collector = moveMessage.createMessageComponentCollector({
                            filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                            time: 60000
                        });

                        collector.on('collect', async i => {
                            await i.deferUpdate();
                            resolve(await processPlayerMove(i.customId, player, currentNpc, effectivePlayer, effectiveNpc));
                            collector.stop();
                        });

                        collector.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                resolve({
                                    damage: 0,
                                    heal: 0,
                                    description: `fled, did not make a move`,
                                    specialEffects: [],
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
                            }).catch(console.error);
                        });
                    });

                    if (playerAction.fled) {
                        battleActive = false;
                        await interaction.followUp(`${player.name} fled from the battle!`);
                        break;
                    }

                    // Apply player action results
                    currentNpc.currentHealth -= playerAction.damage || 0;
                    if (playerAction.heal) {
                        playerHealth = Math.min(playerHealth + playerAction.heal, player.health);
                    }

                    // NPC turn (if still alive)
                    let npcAction = { damage: 0, heal: 0, description: `${currentNpc.name} is defeated`, specialEffects: [], hit: false };
                    if (currentNpc.currentHealth > 0) {
                        npcAction = npcChooseMove(currentNpc, player, effectiveNpc, effectivePlayer);
                        playerHealth -= npcAction.damage || 0;
                        if (npcAction.heal) {
                            currentNpc.currentHealth = Math.min(currentNpc.currentHealth + npcAction.heal, currentNpc.health);
                        }
                    }

                    // Ensure health doesn't go below 0
                    playerHealth = Math.max(0, playerHealth);
                    currentNpc.currentHealth = Math.max(0, currentNpc.currentHealth);

                    // Generate fresh battle image
                    const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                    // Show results with fresh image
                    await interaction.followUp({
                        embeds: [createBattleSummary(playerAction, npcAction)],
                        files: [newBattleImage]
                    });

                    // Check if current enemy is defeated
                    if (currentNpc.currentHealth <= 0) {
                        totalEnemiesDefeated++;
                        const rewards = calculateRewards();
                        
                        // Update user stats
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].exp += rewards.exp;
                        users[userId].money += rewards.money;
                        users[userId].wins += 1;
                        users[userId].health = player.health;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        // Generate fresh victory image
                        const victoryImage = new AttachmentBuilder(await generateBattleImage());

                        if (rewards.isJackpot) {
                            await interaction.followUp({
                                content: `**Mission Complete!** You defeated ${currentNpc.name}!\n\n` +
                                `**JACKPOT REWARD!**\n` +
                                `**EXP Gained:** ${rewards.exp}\n` +
                                `**Money Earned:** ${rewards.money} Ryo\n\n` +
                                `You've completed 50 enemies in this mission!`,
                                files: [victoryImage]
                            });
                            battleActive = false;
                            break;
                        }
                        else if (rewards.isBonus) {
                            await interaction.followUp({
                                content: `**Mission Progress!** You defeated ${currentNpc.name}!\n\n` +
                                `**BONUS REWARD!**\n` +
                                `**EXP Gained:** ${rewards.exp}\n` +
                                `**Money Earned:** ${rewards.money} Ryo\n\n` +
                                `Enemies Defeated: ${totalEnemiesDefeated}`,
                                files: [victoryImage]
                            });
                        } else {
                            await interaction.followUp({
                                content: `**Mission Progress!** You defeated ${currentNpc.name}!\n\n` +
                                `**EXP Gained:** ${rewards.exp}\n` +
                                `**Money Earned:** ${rewards.money} Ryo\n\n` +
                                `Enemies Defeated: ${totalEnemiesDefeated}`,
                                files: [victoryImage]
                            });
                        }

                        // Check if player wants to continue
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
                            battleActive = false;
                            await interaction.followUp("Mission ended by player.");
                            break;
                        }

                        // Prepare next enemy with fresh image
                        currentEnemyIndex++;
                        currentNpc = generateNpc();
                        currentNpc.currentHealth = currentNpc.health;
                        playerHealth = player.health;
                        roundNum = 1;
                        
                        // Send fresh battle image for new enemy
                        const newEnemyImage = new AttachmentBuilder(await generateBattleImage());
                        await interaction.followUp({
                            content: `**New Enemy Appeared!** ${currentNpc.name} approaches!`,
                            files: [newEnemyImage]
                        });
                    }
                    // Check if player is defeated
                    else if (playerHealth <= 0) {
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].losses += 1;
                        users[userId].health = player.health;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        await interaction.followUp(`**Defeat!** You were defeated by ${currentNpc.name}...`);
                        battleActive = false;
                        break;
                    }

                    // Passive chakra regen
                    player.chakra += CHAKRA_REGEN[player.rank] || 1;
                    currentNpc.chakra += 2; // NPCs get standard regen

                    roundNum++;
                    
                    // Add delay between rounds if battle continues
                    if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.error("Mission error:", error);
                await interaction.followUp("An error occurred during the mission!");
            }
        } catch (error) {
            console.error("Mission error:", error);
            await interaction.followUp("An error occurred during the mission!");
        }
    }
};