const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const puppeteer = require('puppeteer');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../images');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Load combos from combos.json
let comboList = {};
if (fs.existsSync(combosPath)) {
    comboList = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
}

// ELO System Configuration (League of Legends style)
const ELO_CONFIG = {
    tiers: {
        IRON: 0,
        BRONZE: 400,
        SILVER: 800,
        GOLD: 1200,
        PLATINUM: 1600,
        DIAMOND: 2000,
        MASTER: 2400,
        GRANDMASTER: 2800,
        CHALLENGER: 3200
    },
    tierNames: {
        IRON: 'Iron',
        BRONZE: 'Bronze',
        SILVER: 'Silver',
        GOLD: 'Gold',
        PLATINUM: 'Platinum',
        DIAMOND: 'Diamond',
        MASTER: 'Master',
        GRANDMASTER: 'Grandmaster',
        CHALLENGER: 'Challenger'
    },
    divisions: ['IV', 'III', 'II', 'I'],
    winElo: 50,
    lossElo: 30,
    baseElo: 1000
};

// Ranked queue system
const rankedQueue = {
    standard: new Set(), // Set of user IDs in standard queue
    custom: new Set(),   // Set of user IDs in custom queue (for future use)
    matches: new Map(),  // Map of ongoing matches (channelId -> matchData)
    logChannel: null     // Channel ID for logging matches
};

// Effect handlers (copy from brank.js)
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

// Emoji constants (from brank.js)
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

// --- Utility functions (from brank.js) ---
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

// --- Battle image generation (from brank.js, adapted for PvP) ---
async function generateBattleImage(player1, player2) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400 });

    const player1HealthPercent = Math.max((player1.currentHealth / player1.health) * 100, 0);
    const player2HealthPercent = Math.max((player2.currentHealth / player2.health) * 100, 0);

    const imagesDir = imagesPath;
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const htmlContent = `
        <html>
        <style>
            body { margin: 0; padding: 0; }
            .battle-container {
                width: 800px; height: 400px; position: relative;
                background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat;
                background-size: cover; border-radius: 10px; overflow: hidden;
            }
            .character { position: absolute; width: 150px; height: 150px; border-radius: 10px; border: 3px solid #6e1515; object-fit: cover; }
            .player1 { left: 50px; top: 120px; }
            .player2 { right: 50px; top: 120px; }
            .name-tag { position: absolute; width: 150px; text-align: center; color: white; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-shadow: 2px 2px 4px #000; top: 80px; background: rgba(0,0,0,0.5); border-radius: 5px; padding: 2px 0; }
            .player1-name { left: 50px; }
            .player2-name { right: 50px; }
            .health-bar { position: absolute; width: 150px; height: 22px; background-color: #333; border-radius: 5px; overflow: hidden; top: 280px; }
            .health-fill { height: 100%; }
            .player1-health-fill { background-color: #4CAF50; width: ${player1HealthPercent}%; }
            .player2-health-fill { background-color: #ff4444; width: ${player2HealthPercent}%; }
            .health-text { position: absolute; width: 100%; text-align: center; color: white; font-family: Arial, sans-serif; font-size: 13px; line-height: 22px; text-shadow: 1px 1px 1px black; }
            .player1-health { left: 50px; }
            .player2-health { right: 50px; }
            .vs-text { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: white; font-family: Arial, sans-serif; font-size: 48px; font-weight: bold; text-shadow: 2px 2px 4px #000; }
        </style>
        <body>
            <div class="battle-container">
                <div class="name-tag player1-name">${player1.name}</div>
                <img class="character player1" src="${player1.avatarURL || 'https://i.imgur.com/1Q9Z1Zm.png'}">
                <div class="health-bar player1-health">
                    <div class="health-fill player1-health-fill"></div>
                    <div class="health-text">${Math.round(player1.currentHealth)}/${player1.health}</div>
                </div>
                <div class="name-tag player2-name">${player2.name}</div>
                <img class="character player2" src="${player2.avatarURL || 'https://i.imgur.com/1Q9Z1Zm.png'}">
                <div class="health-bar player2-health">
                    <div class="health-fill player2-health-fill"></div>
                    <div class="health-text">${Math.round(player2.currentHealth)}/${player2.health}</div>
                </div>
                <div class="vs-text">VS</div>
            </div>
        </body>
        </html>
    `;

    await page.setContent(htmlContent);
    const imagePath = path.join(imagesDir, `battle_${player1.userId}_${player2.userId}_${Date.now()}.png`);
    await page.screenshot({ path: imagePath });
    await browser.close();
    return imagePath;
}

// Ranked command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranked')
        .setDescription('Enter the ranked queue for competitive 1v1 battles')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Ranked mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Standard', value: 'standard' },
                    { name: 'Custom', value: 'custom' }
                )),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const mode = interaction.options.getString('mode');
        
        // Load user data
        if (!fs.existsSync(usersPath)) {
            if (!interaction.replied && !interaction.deferred)
                return interaction.reply({ content: "Database not found.", ephemeral: true });
            return;
        }
        
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            if (!interaction.replied && !interaction.deferred)
                return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
            return;
        }
        
        // Prevent double reply by using a flag
        let replied = false;
        try {
            // Check if already in queue
            if (rankedQueue[mode].has(userId)) {
                if (!interaction.replied && !interaction.deferred && !replied) {
                    replied = true;
                    return interaction.reply({ content: "You're already in the ranked queue!", ephemeral: true });
                }
                return;
            }

            // Check if already in a match
            for (const match of rankedQueue.matches.values()) {
                if (match.player1 === userId || match.player2 === userId) {
                    if (!interaction.replied && !interaction.deferred && !replied) {
                        replied = true;
                        return interaction.reply({ content: "You're already in a ranked match!", ephemeral: true });
                    }
                    return;
                }
            }

            // Add to queue
            rankedQueue[mode].add(userId);

            // Log queue entry
            try {
                const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${interaction.user.tag} (${userId}) has entered the ${mode} queue.`);
                }
            } catch (e) { /* ignore log errors */ }

            // Reply to user (only if not already replied/deferred)
            if (!interaction.replied && !interaction.deferred && !replied) {
                replied = true;
                await interaction.reply({
                    content: `You've entered the ${mode} ranked queue. Waiting for an opponent...`,
                    ephemeral: true
                });
            }

            // Check for matchmaking
            if (rankedQueue[mode].size >= 2) {
                // Get first two players in queue
                const players = Array.from(rankedQueue[mode]).slice(0, 2);
                const [player1, player2] = players;

                // Remove from queue
                rankedQueue[mode].delete(player1);
                rankedQueue[mode].delete(player2);

                // Log match found
                try {
                    const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(`[RANKED] Match found: <@${player1}> vs <@${player2}>`);
                    }
                } catch (e) { /* ignore log errors */ }

                // Start the match (do NOT reply again here)
                await startRankedBattle(interaction.client, player1, player2, mode);
            }
        } catch (err) {
            // Only reply if not already replied/deferred
            if (!interaction.replied && !interaction.deferred && !replied) {
                replied = true;
                await interaction.reply({
                    content: "⚠️ An error occurred while executing this command.",
                    ephemeral: true
                });
            } else {
                // Optionally log error somewhere else
                console.error("Ranked command error:", err);
            }
        }
    }
};

// Add your server ID here
const SERVER_ID = "1381268582595297321";

// Add your log channel ID here
const LOG_CHANNEL_ID = "1381278641144467637"; // <-- Replace with your log channel ID

// --- 1v1 Battle Logic using brank.js features ---
async function startRankedBattle(client, player1Id, player2Id, mode) {
    // Load users and fetch Discord user objects
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const player1User = await client.users.fetch(player1Id);
    const player2User = await client.users.fetch(player2Id);

    // Fetch the correct guild by SERVER_ID
    const guild = await client.guilds.fetch(SERVER_ID);

    // Create a private channel for the match
    const channelName = `ranked-${getRandomChannelId()}`;
    const channel = await guild.channels.create({
        name: channelName,
        type: 0,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: player1Id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            {
                id: player2Id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
        ]
    });

    // Initialize player objects (adapted from brank.js)
    // Add avatarURL for battle image
    const player1Avatar = (await client.users.fetch(player1Id)).displayAvatarURL({ format: 'png', size: 256 });
    const player2Avatar = (await client.users.fetch(player2Id)).displayAvatarURL({ format: 'png', size: 256 });

    let player1 = {
        ...users[player1Id],
        userId: player1Id,
        name: player1User.username,
        activeEffects: [],
        accuracy: 100,
        dodge: 0,
        currentHealth: users[player1Id].health,
        chakra: users[player1Id].chakra || 10,
        avatarURL: player1Avatar
    };
    let player2 = {
        ...users[player2Id],
        userId: player2Id,
        name: player2User.username,
        activeEffects: [],
        accuracy: 100,
        dodge: 0,
        currentHealth: users[player2Id].health,
        chakra: users[player2Id].chakra || 10,
        avatarURL: player2Avatar
    };

    // Combo state for each player
    let comboState1 = null, comboState2 = null;
    if (player1.Combo && comboList[player1.Combo]) {
        comboState1 = { combo: comboList[player1.Combo], usedJutsus: new Set() };
    }
    if (player2.Combo && comboList[player2.Combo]) {
        comboState2 = { combo: comboList[player2.Combo], usedJutsus: new Set() };
    }

    let roundNum = 1;
    let activePlayer = player1;
    let opponent = player2;
    let activeComboState = comboState1;
    let opponentComboState = comboState2;

    // Battle loop
    let battleActive = true;
    while (battleActive) {
        // Update effect durations at start of turn for both players
        [player1, player2].forEach(entity => {
            entity.activeEffects.forEach(effect => {
                if (effect.duration > 0) effect.duration--;
            });
            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
        });

        // Calculate effective stats for both players
        const effectiveActive = getEffectiveStats(activePlayer);
        const effectiveOpponent = getEffectiveStats(opponent);

        // Moves embed (from brank.js, but for activePlayer)
        const { embed, components } = createMovesEmbedPvP(activePlayer, roundNum);
        const moveMessage = await channel.send({
            content: `<@${activePlayer.userId}>`,
            embeds: [embed],
            components: components,
            fetchReply: true
        });

        // Player move
        const playerAction = await new Promise(resolve => {
            const collector = moveMessage.createMessageComponentCollector({
                filter: i => i.user.id === activePlayer.userId && i.customId.endsWith(`-${activePlayer.userId}-${roundNum}`),
                time: 90000
            });
            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId.startsWith('move')) {
                    const jutsuName = getJutsuByButtonPvP(i.customId, activePlayer);
                    const result = executeJutsu(activePlayer, opponent, effectiveActive, effectiveOpponent, jutsuName);
                    if (activeComboState?.combo.requiredJutsus.includes(jutsuName)) {
                        activeComboState.usedJutsus.add(jutsuName);
                    }
                    result.jutsuUsed = jutsuName;
                    resolve(result);
                } else {
                    resolve(await processPlayerMove(i.customId, activePlayer, opponent, effectiveActive, effectiveOpponent));
                }
                collector.stop();
            });
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    resolve({
                        damage: 0,
                        heal: 0,
                        description: `${activePlayer.name} did not make a move.`,
                        specialEffects: ["Missed opportunity!"],
                        hit: false,
                        fled: true
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
            await channel.send(`${activePlayer.name} fled from the battle!`);
            // Log flee
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${activePlayer.name} (${activePlayer.userId}) fled from the match against ${opponent.name} (${opponent.userId})`);
                }
            } catch (e) {}
            break;
        }

        // Combo completion check for active player
        let comboCompletedThisRound = false;
        let comboDamageText = "";
        if (
            activeComboState &&
            activeComboState.combo.requiredJutsus.every(jutsu => activeComboState.usedJutsus.has(jutsu))
        ) {
            const combo = activeComboState.combo;
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
                            const healAmount = effectHandlers.heal(activePlayer, effect.formula || "0");
                            comboResult.heal += healAmount;
                            comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                            break;
                        case 'status':
                            if (!opponent.activeEffects) opponent.activeEffects = [];
                            opponent.activeEffects.push({
                                type: 'status',
                                status: effect.status,
                                duration: effect.duration || 1
                            });
                            comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                            break;
                        case 'debuff':
                            const debuffChanges = effectHandlers.debuff(opponent, effect.stats);
                            if (!opponent.activeEffects) opponent.activeEffects = [];
                            opponent.activeEffects.push({
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
            opponent.currentHealth -= comboResult.damage;
            if (comboResult.heal) {
                activePlayer.currentHealth = Math.min(activePlayer.currentHealth + comboResult.heal, activePlayer.health);
            }
            comboCompletedThisRound = true;
            comboDamageText = `\n${activePlayer.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`;
            activeComboState.usedJutsus.clear();
        }

        // Apply player action results
        opponent.currentHealth -= playerAction.damage || 0;
        if (playerAction.heal) {
            activePlayer.currentHealth = Math.min(activePlayer.currentHealth + playerAction.heal, activePlayer.health);
        }

        // Generate and send battle image before each round
        const battleImagePath = await generateBattleImage(player1, player2);
        const battleImage = new AttachmentBuilder(battleImagePath);

        await channel.send({
            content: `**Battle Image:**`,
            files: [battleImage]
        });

        // Show round summary (use brank.js summary logic, but for PvP)
        let summaryEmbed = createBattleSummaryPvP(playerAction, activePlayer, opponent, roundNum, comboCompletedThisRound, comboDamageText);
        await channel.send({ embeds: [summaryEmbed] });

        // Win/loss check
        if (opponent.currentHealth <= 0 || activePlayer.currentHealth <= 0) {
            battleActive = false;
            let winner = activePlayer.currentHealth > 0 ? activePlayer : opponent;
            let loser = activePlayer.currentHealth > 0 ? opponent : activePlayer;
            await channel.send(`🏆 **${winner.name}** wins the ranked match!`);
            // ELO update logic
            const eloUpdate = updateElo(winner.userId, loser.userId);
            // Log match result
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${winner.name} (${winner.userId}) has won against ${loser.name} (${loser.userId}) +${eloUpdate.winnerChange} ELO`);
                }
            } catch (e) {}
            break;
        }

        // Passive chakra regen
        activePlayer.chakra = Math.min(activePlayer.chakra + 2, 10);
        opponent.chakra = Math.min(opponent.chakra + 2, 10);

        // Swap turns
        [activePlayer, opponent] = [opponent, activePlayer];
        [activeComboState, opponentComboState] = [opponentComboState, activeComboState];
        roundNum++;
    }

    // Clean up: delete channel after a delay, update ELO, etc.
}

// --- Helper functions for PvP ---
// Use/adapt createMovesEmbed, getJutsuByButton, executeJutsu, processPlayerMove, getEffectiveStats, createBattleSummary from brank.js

function getEffectiveStats(entity) {
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

function createMovesEmbedPvP(player, roundNum) {
    // Create an embed and button rows for the player's available jutsu, rest, and flee
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
            const disabled = player.chakra < (jutsu?.chakraCost || 0);
            return new ButtonBuilder()
                .setCustomId(`move${index + 1}-${player.userId}-${roundNum}`)
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
        // If 5 or fewer jutsu, put rest/flee on a new row
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

function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) {
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
    baseUser.chakra -= jutsu.chakraCost || 0;
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
    return result;
}

function createBattleSummaryPvP(playerAction, player, opponent, roundNum, comboCompleted, comboDamageText) {
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

    // Combo progress UI
    let comboProgressText = "";
    if (player.Combo && comboList[player.Combo]) {
        const combo = comboList[player.Combo];
        const usedJutsus = player.comboState?.usedJutsus || new Set();
        const filled = combo.requiredJutsus.filter(jutsu => usedJutsus.has(jutsu)).length;
        const total = combo.requiredJutsus.length;
        comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${playerEffectEmojis}@${player.name} ${playerDesc}` +
            `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
            (comboCompleted ? comboDamageText : "") +
            `\n\n${opponentEffectEmojis}${opponent.name} || ${Math.round(opponent.currentHealth)} HP` +
            comboProgressText
        )
        .addFields({
            name: 'Battle Status',
            value: `${player.name} || ${Math.round(player.currentHealth)} HP\n${opponent.name} || ${Math.round(opponent.currentHealth)} HP\nChakra: ${player.chakra}            Chakra: ${opponent.chakra}`
        });

    const playerJutsu = jutsuList[playerAction.jutsuUsed];
    if (playerJutsu?.image_url) {
        embed.setImage(playerJutsu.image_url);
    }
    return embed;
}

// Utility functions
function getRandomChannelId() {
    // Returns a random 6-digit number as a string for channel uniqueness
    return Math.floor(Math.random() * 900000 + 100000).toString();
}

function getTierAndDivision(elo) {
    let tier = 'IRON';
    let division = 'IV';
    for (const [tierName, threshold] of Object.entries(ELO_CONFIG.tiers)) {
        if (elo >= threshold) {
            tier = tierName;
        } else {
            break;
        }
    }
    const tierThreshold = ELO_CONFIG.tiers[tier];
    const nextTierThreshold = Object.values(ELO_CONFIG.tiers).find(t => t > tierThreshold) || Infinity;
    const range = nextTierThreshold - tierThreshold;
    const position = elo - tierThreshold;
    const divisionIndex = Math.min(
        ELO_CONFIG.divisions.length - 1,
        Math.floor((position / range) * ELO_CONFIG.divisions.length)
    );
    division = ELO_CONFIG.divisions[divisionIndex];
    return {
        tier: ELO_CONFIG.tierNames[tier],
        division
    };
}

// ELO update logic: +50 on win, -30 on loss, always keep >= 0
function updateElo(winnerId, loserId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    if (!users[winnerId].elo) users[winnerId].elo = ELO_CONFIG.baseElo;
    if (!users[loserId].elo) users[loserId].elo = ELO_CONFIG.baseElo;
    users[winnerId].elo += ELO_CONFIG.winElo;
    users[loserId].elo = Math.max(0, users[loserId].elo - ELO_CONFIG.lossElo);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return {
        winnerChange: ELO_CONFIG.winElo,
        loserChange: ELO_CONFIG.lossElo,
        winnerNewElo: users[winnerId].elo,
        loserNewElo: users[loserId].elo
    };
}