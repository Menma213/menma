const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const puppeteer = require('puppeteer');
const Canvas = require('canvas'); // ADDED

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../images');
const rankedRewardsPath = path.resolve(__dirname, '../../menma/data/rankedrewards.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

const WIN_BG = 'https://i.imgur.com/XQJKVEp.gif';
const LOSS_BG = 'https://i.imgur.com/mxqUWZJ.gif';

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

// Replace old rank names with new ones
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
    lossElo: 25
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
        // Only allow in main server
        if (!interaction.guild || interaction.guild.id !== '1381268582595297321') {
            return interaction.reply({ content: 'This command can only be used in the main server.', ephemeral: true });
        }

        const userId = interaction.user.id;
        const opt = interaction.options.getString('option');

        if (opt === 'rewards') {
            return await handleRankedRewards(interaction);
        }

        const mode = 'standard';

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

// Add a constant for the summary channel (if needed)
const SUMMARY_CHANNEL_ID = "1381601428740505660"; // <-- Replace with your summary channel ID

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

    // --- Invitation Embed ---
    const invitationEmbed = new EmbedBuilder()
        .setTitle('🏆 RANKED: STANDARD MODE')
        .setDescription(
            `Welcome to the ultimate test of strength and will!\n\n` +
            `Step into the arena and prove yourself as the strongest shinobi. ` +
            `Climb the ranks, defeat your rivals, and aim to become the next Hokage!\n\n` +
            `**Do <@${player1Id}> and <@${player2Id}> swear to fight fairly under the gaze of the Shinigami, god of death?**\n` +
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

    // Ping both users with the embed
    const invitationMsg = await channel.send({
        content: `<@${player1Id}> <@${player2Id}>`,
        embeds: [invitationEmbed],
        components: [acceptRow]
    });

    // Await both players to accept
    const accepted = new Set();
    let declined = false;

    await new Promise((resolve) => {
        const collector = invitationMsg.createMessageComponentCollector({
            filter: i => [player1Id, player2Id].includes(i.user.id),
            time: 60000 // 1 minute
        });

        collector.on('collect', async i => {
            if (i.customId === 'ranked_accept') {
                accepted.add(i.user.id);
                await i.reply({ content: `You have accepted the challenge!`, ephemeral: true });
                await channel.send(`<@${i.user.id}> has accepted.`);
                if (accepted.has(player1Id) && accepted.has(player2Id)) {
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
            // Disable buttons
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
            if (reason === 'both_accepted') {
                await channel.send('**# RANKED: STANDARD MODE**\nLet the battle begin!');
                resolve();
            } else if (declined) {
                // Already handled above
                resolve();
            } else {
                // Timeout: only one accepted
                if (accepted.size === 1) {
                    const winnerId = [...accepted][0];
                    const loserId = winnerId === player1Id ? player2Id : player1Id;
                    await channel.send(`<@${winnerId}> has accepted, but <@${loserId}> did not respond in time. <@${WinnerId}> wins by default!`);
                    // ELO update logic for default win
                    const eloUpdate = updateElo(winnerId, loserId);
                    try {
                        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                        if (logChannel) {
                            await logChannel.send(`[RANKED] ${winnerId} wins by default (opponent did not accept) +${eloUpdate.winnerChange} ELO`);
                        }
                    } catch (e) {}
                } else {
                    await channel.send('The ranked match has been cancelled due to no response.');
                }
                // Auto-delete channel after 15 seconds
                setTimeout(async () => {
                    try {
                        await channel.delete("Ranked match invitation expired (auto-cleanup)");
                    } catch (e) {}
                }, 15000);
                resolve();
            }
        });
    });

    if (declined || accepted.size !== 2) return;

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
        const effective1 = getEffectiveStats(player1);
        const effective2 = getEffectiveStats(player2);

        // --- Player 1's turn ---
        const { embed: embed1, components: components1 } = createMovesEmbedPvP(player1, roundNum);
        const moveMessage1 = await channel.send({
            content: `<@${player1.userId}>`,
            embeds: [embed1],
            components: components1,
            fetchReply: true
        });
        const battleImagePath1 = await generateBattleImage(player1, player2);
        const battleImage1 = new AttachmentBuilder(battleImagePath1);
        await channel.send({
            content: `**Battle Image:**`,
            files: [battleImage1]
        });

        const player1Action = await new Promise(resolve => {
            const collector = moveMessage1.createMessageComponentCollector({
                filter: i => i.user.id === player1.userId && i.customId.endsWith(`-${player1.userId}-${roundNum}`),
                time: 90000
            });
            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId.startsWith('move')) {
                    const jutsuName = getJutsuByButtonPvP(i.customId, player1);
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
            // Log flee
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${player1.name} (${player1.userId}) fled from the match against ${player2.name} (${player2.userId})`);
                }
            } catch (e) {}
            break;
        }

        // --- Player 2's turn ---
        const { embed: embed2, components: components2 } = createMovesEmbedPvP(player2, roundNum);
        const moveMessage2 = await channel.send({
            content: `<@${player2.userId}>`,
            embeds: [embed2],
            components: components2,
            fetchReply: true
        });
        // Remove the extra battle image after player 2's embed
        // const battleImagePath2 = await generateBattleImage(player1, player2);
        // const battleImage2 = new AttachmentBuilder(battleImagePath2);
        // await channel.send({
        //     content: `**Battle Image:**`,
        //     files: [battleImage2]
        // });

        const player2Action = await new Promise(resolve => {
            const collector = moveMessage2.createMessageComponentCollector({
                filter: i => i.user.id === player2.userId && i.customId.endsWith(`-${player2.userId}-${roundNum}`),
                time: 90000
            });
            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId.startsWith('move')) {
                    const jutsuName = getJutsuByButtonPvP(i.customId, player2);
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
            // Log flee
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${player2.name} (${player2.userId}) fled from the match against ${player1.name} (${player1.userId})`);
                }
            } catch (e) {}
            break;
        }

        // --- Apply both actions after both have chosen ---
        // Combo completion check for player 1
        let comboCompleted1 = false, comboDamageText1 = "";
        if (
            comboState1 &&
            comboState1.combo.requiredJutsus.every(jutsu => comboState1.usedJutsus.has(jutsu))
        ) {
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
        }

        // Combo completion check for player 2
        let comboCompleted2 = false, comboDamageText2 = "";
        if (
            comboState2 &&
            comboState2.combo.requiredJutsus.every(jutsu => comboState2.usedJutsus.has(jutsu))
        ) {
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
        }

        // Apply player 1's action to player 2
        player2.currentHealth -= player1Action.damage || 0;
        if (player1Action.heal) {
            player1.currentHealth = Math.min(player1.currentHealth + player1Action.heal, player1.health);
        }

        // Apply player 2's action to player 1
        player1.currentHealth -= player2Action.damage || 0;
        if (player2Action.heal) {
            player2.currentHealth = Math.min(player2.currentHealth + player2Action.heal, player2.health);
        }

        // Show round summary for both players
        let summaryEmbed1 = createBattleSummaryPvP(player1Action, player1, player2, roundNum, comboCompleted1, comboDamageText1);
        // let summaryEmbed2 = createBattleSummaryPvP(player2Action, player2, player1, roundNum, comboCompleted2, comboDamageText2);
        await channel.send({ embeds: [summaryEmbed1] });
        // await channel.send({ embeds: [summaryEmbed2] });

        // Win/loss check
        if (player1.currentHealth <= 0 || player2.currentHealth <= 0) {
            battleActive = false;
            let winner, loser;
            if (player1.currentHealth > 0 && player2.currentHealth <= 0) {
                winner = player1; loser = player2;
            } else if (player2.currentHealth > 0 && player1.currentHealth <= 0) {
                winner = player2; loser = player1;
            } else {
                // Both at 0 or below, draw
                await channel.send(`It's a draw!`);
                break;
            }

            // Handle match end with new ELO visualizations
            const eloUpdate = await handleMatchEnd(channel, winner, loser, users);

            // Log match result
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send(`[RANKED] ${winner.name} (${winner.userId}) has won against ${loser.name} (${loser.userId})`);
                }
            } catch (e) {}
            break;
        }

        // Passive chakra regen
        player1.chakra = Math.min(player1.chakra + 2, 10);
        player2.chakra = Math.min(player2.chakra + 2, 10);

        roundNum++;
    }

    // --- Auto-delete channel after 15 seconds ---
    setTimeout(async () => {
        try {
            await channel.delete("Ranked match ended (auto-cleanup)");
        } catch (e) {}
    }, 15000);
}

// --- Canvas-based match summary image ---
async function generateMatchSummaryCanvas(user, oldElo, newElo, isWinner, rounds, maxDamage) {
    const width = 700, height = 220;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load and draw background GIF (first frame, as Canvas can't animate)
    const bg = await Canvas.loadImage(isWinner ? WIN_BG : LOSS_BG);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bg, 0, 0, width, height);
    ctx.globalAlpha = 1;

    // Theme
    const colors = isWinner
        ? { bar: '#4ade80', bar2: '#22c55e', text: '#eaffea' }
        : { bar: '#f87171', bar2: '#dc2626', text: '#ffeaea' };

    // ELO bar
    const barX = 120, barY = 90, barW = 460, barH = 28;
    const oldRank = getTierAndDivision(oldElo);
    const newRank = getTierAndDivision(newElo);
    const nextRank = rankedRewards.find(r => r.elo > newElo);
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
    grad.addColorStop(0, colors.bar);
    grad.addColorStop(1, colors.bar2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 14);
    ctx.fill();
    ctx.restore();

    // ELO gained/lost in center
    ctx.font = 'bold 22px Segoe UI';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.fillText(`${isWinner ? '+' : ''}${newElo - oldElo} ELO`, barX + barW / 2, barY + barH / 2 + 7);

    // Current rank (left)
    ctx.font = 'bold 15px Segoe UI';
    ctx.textAlign = 'left';
    ctx.fillText(`${newRank.rank} Div. ${newRank.division}`, barX, barY - 8);
    ctx.font = '10px Segoe UI';
    ctx.fillText('Current Rank', barX, barY + barH + 16);

    // Next rank (right)
    ctx.font = 'bold 15px Segoe UI';
    ctx.textAlign = 'right';
    ctx.fillText(
        nextRank ? `${nextRank.rank} Div. ${nextRank.division}` : 'Max Rank',
        barX + barW,
        barY - 8
    );
    ctx.font = '10px Segoe UI';
    ctx.fillText('Next Rank', barX + barW, barY + barH + 16);

    // Progress text below bar
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(`${newElo % 100}/100`, barX + barW / 2, barY + barH + 16);

    return canvas.toBuffer('image/png');
}

// --- Canvas-based match summary embed handler ---
async function handleMatchEnd(channel, winner, loser, users, roundNum = 0, maxDamage = 0) {
    // Update ELO and rank
    const oldWinnerElo = users[winner.userId].ranked?.totalElo || 0;
    const oldLoserElo = users[loser.userId].ranked?.totalElo || 0;
    const eloUpdate = updateElo(winner.userId, loser.userId);

    // Update "rank" variable in users.json directly based on ELO
    const updatedUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    updatedUsers[winner.userId].rank = getTierAndDivision(updatedUsers[winner.userId].ranked.totalElo).rank;
    updatedUsers[loser.userId].rank = getTierAndDivision(updatedUsers[loser.userId].ranked.totalElo).rank;
    fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2));

    // Fetch updated user objects for summary
    const winnerUser = updatedUsers[winner.userId];
    const loserUser = updatedUsers[loser.userId];

    // Calculate stats for summary
    const winnerStats = {
        power: winnerUser.power || 0,
        defense: winnerUser.defense || 0,
        health: winnerUser.health || 0,
        chakra: winnerUser.chakra || 0,
        accuracy: winnerUser.accuracy || 0,
        dodge: winnerUser.dodge || 0,
        totalElo: winnerUser.ranked?.totalElo || 0,
        rank: winnerUser.rank || "Genin"
    };
    const loserStats = {
        power: loserUser.power || 0,
        defense: loserUser.defense || 0,
        health: loserUser.health || 0,
        chakra: loserUser.chakra || 0,
        accuracy: loserUser.accuracy || 0,
        dodge: loserUser.dodge || 0,
        totalElo: loserUser.ranked?.totalElo || 0,
        rank: loserUser.rank || "Genin"
    };

    // Calculate total damage dealt/taken (for now, just use maxDamage and rounds)
    // You can expand this with more detailed tracking if needed
    const winnerDamageDealt = maxDamage || "N/A";
    const loserDamageDealt = maxDamage || "N/A";
    const winnerDamageTaken = maxDamage || "N/A";
    const loserDamageTaken = maxDamage || "N/A";

    // Generate ELO image for winner and loser
    const winnerImagePath = await generateEloImage(
        winner, 
        oldWinnerElo, 
        winnerUser.ranked.totalElo, 
        true
    );
    const loserImagePath = await generateEloImage(
        loser, 
        oldLoserElo, 
        loserUser.ranked.totalElo, 
        false
    );

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
            `> ELO: ${winnerStats.totalElo}\n\n` +
            `**Enemy Stats:**\n` +
            `> Power: ${loserStats.power}\n` +
            `> Defense: ${loserStats.defense}\n` +
            `> Health: ${loserStats.health}\n` +
            `> Chakra: ${loserStats.chakra}\n` +
            `> Accuracy: ${loserStats.accuracy}\n` +
            `> Dodge: ${loserStats.dodge}\n` +
            `> Rank: ${loserStats.rank}\n` +
            `> ELO: ${loserStats.totalElo}`
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
            `> ELO: ${loserStats.totalElo}\n\n` +
            `**Enemy Stats:**\n` +
            `> Power: ${winnerStats.power}\n` +
            `> Defense: ${winnerStats.defense}\n` +
            `> Health: ${winnerStats.health}\n` +
            `> Chakra: ${winnerStats.chakra}\n` +
            `> Accuracy: ${winnerStats.accuracy}\n` +
            `> Dodge: ${winnerStats.dodge}\n` +
            `> Rank: ${winnerStats.rank}\n` +
            `> ELO: ${winnerStats.totalElo}`
        )
        .setImage(`attachment://loser_elo.png`)
        .setFooter({ text: "Better luck next time!" });

    // Send to summary channel or original queue channel
    let summaryChannel = channel;
    try {
        // Try to fetch the original channel if possible, else use summary channel
        if (!summaryChannel || typeof summaryChannel.send !== "function") {
            summaryChannel = await winner.client.channels.fetch(SUMMARY_CHANNEL_ID);
        }
    } catch (e) {
        // fallback to summary channel
        summaryChannel = await winner.client.channels.fetch(SUMMARY_CHANNEL_ID);
    }

    // Send winner and loser summary
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

// --- Helper functions for PvP ---
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

// ELO update logic: +50 on win, -30 on loss, always keep >= 0
function updateElo(winnerId, loserId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    
    // Initialize ranked data if not exists
    if (!users[winnerId].ranked) users[winnerId].ranked = { totalElo: 0 };
    if (!users[loserId].ranked) users[loserId].ranked = { totalElo: 0 };

    // Update ELO
    users[winnerId].ranked.totalElo += RANK_CONFIG.winElo;
    users[loserId].ranked.totalElo = Math.max(0, users[loserId].ranked.totalElo - RANK_CONFIG.lossElo);

    // Calculate new ranks
    const winnerRank = getTierAndDivision(users[winnerId].ranked.totalElo);
    const loserRank = getTierAndDivision(users[loserId].ranked.totalElo);

    // Update full rank info
    users[winnerId].ranked = {
        ...users[winnerId].ranked,
        ...winnerRank
    };
    
    users[loserId].ranked = {
        ...users[loserId].ranked,
        ...loserRank
    };

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    return {
        winnerChange: RANK_CONFIG.winElo,
        loserChange: RANK_CONFIG.lossElo,
        winnerNew: winnerRank,
        loserNew: loserRank
    };
}

// Load ranked ladder rewards
let rankedRewards = [];
if (fs.existsSync(rankedRewardsPath)) {
    rankedRewards = JSON.parse(fs.readFileSync(rankedRewardsPath, 'utf8'));
}

// Load or initialize gift inventory
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

// --- Ranked Ladder Rewards Handler ---
async function handleRankedRewards(interaction) {
    const userId = interaction.user.id;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const user = users[userId];
    if (!user || !user.ranked) {
        return interaction.reply({ content: "You haven't played ranked yet!" });
    }
    const userElo = user.ranked.totalElo || 0;
    const userRankObj = getTierAndDivision(userElo);
    const userRank = userRankObj.rank;
    const userDiv = userRankObj.division;

    // Find claimable and next reward
    let claimable = null, nextReward = null;
    for (const reward of rankedRewards) {
        if (userElo >= reward.elo && !user.ranked.claimedRewards?.includes(reward.elo)) {
            claimable = reward;
            break;
        }
    }
    if (!claimable) {
        nextReward = rankedRewards.find(r => r.elo > userElo);
    }

    // Generate the ranked rewards image using Puppeteer
    const imagePath = await generateRankedRewardsImage(user, userElo, userRank, userDiv, claimable, nextReward);

    const row = claimable
        ? new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ranked_claim')
                .setLabel('Claim')
                .setStyle(ButtonStyle.Success)
        )
        : null;

    // Use deferReply/followUp to avoid "Unknown interaction" error if Puppeteer takes time
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
            // Add reward to gift inventory with random id 1-5000
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

            // Mark reward as claimed
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId].ranked.claimedRewards) users[userId].ranked.claimedRewards = [];
            users[userId].ranked.claimedRewards.push(claimable.elo);
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await i.reply({ content: `Reward sent to your gift inventory! Use /gift inventory to claim it.` });
        });
    }
}

// --- Generate random gift id (1-5000, unique per user) ---
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 5000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// --- Puppeteer image for ranked rewards ---
async function generateRankedRewardsImage(user, userElo, userRank, userDiv, claimable, nextReward) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 700, height: 500 });

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

    // HTML/CSS for rewards
    const html = `
    <html>
    <head>
    <style>
    body { margin: 0; padding: 0; background: ${theme.bg}; }
    .container {
        width: 700px; height: 500px; background: ${theme.bg}; border-radius: 18px;
        box-shadow: 0 8px 32px #000a; display: flex; flex-direction: column; align-items: center; padding: 0;
        border: 4px solid ${theme.border};
        font-family: 'Segoe UI', Arial, sans-serif;
    }
    .title {
        font-size: 36px; font-weight: bold; color: ${theme.accent}; margin: 32px 0 8px 0; letter-spacing: 2px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
    .rank-box {
        background: linear-gradient(90deg, ${theme.accent}33, transparent 80%);
        border-radius: 10px; padding: 18px 32px; margin-bottom: 18px; margin-top: 8px;
        border: 2px solid ${theme.accent}; color: ${theme.text}; font-size: 22px; font-weight: bold;
        box-shadow: 0 2px 12px #0004;
        display: flex; flex-direction: row; align-items: center; gap: 18px;
    }
    .rank-label { font-size: 18px; color: ${theme.accent}; font-weight: bold; margin-right: 8px; }
    .rank-value { font-size: 24px; color: ${theme.text}; }
    .upcoming-title {
        font-size: 22px; color: ${theme.accent}; font-weight: bold; margin: 18px 0 6px 0;
        letter-spacing: 1px;
    }
    .upcoming-box {
        background: ${theme.bg}cc; border-radius: 10px; padding: 14px 24px; margin-bottom: 10px;
        border: 2px solid ${theme.accent}; color: ${theme.text}; font-size: 18px;
        box-shadow: 0 2px 8px #0004;
    }
    .claim-title {
        font-size: 22px; color: ${theme.accent}; font-weight: bold; margin: 18px 0 6px 0;
        letter-spacing: 1px;
    }
    .claim-box {
        background: ${theme.bg}cc; border-radius: 10px; padding: 14px 24px; margin-bottom: 10px;
        border: 2px solid ${theme.accent}; color: ${theme.text}; font-size: 18px;
        box-shadow: 0 2px 8px #0004;
    }
    .footer {
        margin-top: 18px; font-size: 15px; color: ${theme.text}cc; font-style: italic; text-align: center;
        width: 90%;
    }
    .reward-choice { margin-left: 10px; }
    </style>
    </head>
    <body>
        <div class="container">
            <div class="title">Ranked Rewards</div>
            <div class="rank-box">
                <span class="rank-label">Your Rank:</span>
                <span class="rank-value">${userRank} <span style="font-size:18px;opacity:.7;">Div. ${userDiv}</span> <span style="font-size:16px;opacity:.7;">(${userElo} ELO)</span></span>
            </div>
            <div class="upcoming-title">Upcoming</div>
            <div class="upcoming-box">
                ${
                    nextReward
                        ? `<b>${nextReward.rank} Div. ${nextReward.division} (${nextReward.elo} ELO)</b><br>
                        <span>1️⃣ ${nextReward.reward1.name}: ${nextReward.reward1.desc}</span><br>
                        <span>2️⃣ ${nextReward.reward2.name}: ${nextReward.reward2.desc}</span>`
                        : `<span>No more upcoming rewards.</span>`
                }
            </div>
            <div class="claim-title">Available Claims</div>
            <div class="claim-box">
                ${
                    claimable
                        ? `<b>${claimable.rank} Div. ${claimable.division} (${claimable.elo} ELO)</b><br>
                        <span>1️⃣ ${claimable.reward1.name}: ${claimable.reward1.desc}</span><br>
                        <span>2️⃣ ${claimable.reward2.name}: ${claimable.reward2.desc}</span>`
                        : `<span>No claimable rewards at this time.</span>`
                }
            </div>
            <div class="footer">
                *All these gifts are sent to your gift inventory, check using <b>/gift inventory</b>.*
            </div>
        </div>
    </body>
    </html>
    `;

    const filename = `rewards_${user.id}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    await page.setContent(html);
    await page.screenshot({ path: fullPath });
    await browser.close();
    return fullPath;
}

// Add the new ELO image generator
async function generateEloImage(user, oldElo, newElo, isWinner) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 300 });

    // Calculate rank progression
    const oldRank = getTierAndDivision(oldElo);
    const newRank = getTierAndDivision(newElo);
    const eloChange = newElo - oldElo;
    
    // Theme colors
    const bgColor = isWinner ? '#1a3a1a' : '#3a1a1a';
    const primaryColor = isWinner ? '#4ade80' : '#ef4444';
    const secondaryColor = isWinner ? '#22c55e' : '#dc2626';
    const textColor = '#ffffff';

    const html = `
    <html>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: ${bgColor};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', Arial, sans-serif;
        }
        .elo-container {
            width: 580px;
            height: 280px;
            background: linear-gradient(145deg, ${bgColor}, #000);
            border-radius: 16px;
            border: 4px solid ${primaryColor};
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            padding: 20px;
            display: flex;
            flex-direction: column;
        }
        .header {
            font-size: 28px;
            font-weight: bold;
            color: ${primaryColor};
            text-align: center;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }
        .rank-info {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
        }
        .rank-box {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 15px;
            border: 2px solid ${secondaryColor};
            flex: 1;
            margin: 0 10px;
            text-align: center;
        }
        .rank-title {
            font-size: 18px;
            color: ${textColor};
            margin-bottom: 8px;
        }
        .rank-value {
            font-size: 24px;
            font-weight: bold;
            color: ${primaryColor};
        }
        .elo-bar-container {
            margin: 20px 0;
            height: 30px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            border: 2px solid ${secondaryColor};
            position: relative;
            overflow: hidden;
        }
        .elo-bar {
            height: 100%;
            background: linear-gradient(90deg, ${primaryColor}, ${secondaryColor});
            border-radius: 12px;
            width: ${Math.min(100, (newElo % 100) || 0)}%;
            transition: width 0.5s ease;
        }
        .elo-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 16px;
            font-weight: bold;
            color: ${textColor};
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }
        .change-info {
            display: flex;
            justify-content: center;
            margin-top: 10px;
        }
        .change-box {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 10px 20px;
            border: 2px solid ${secondaryColor};
            text-align: center;
        }
        .change-title {
            font-size: 16px;
            color: ${textColor};
        }
        .change-value {
            font-size: 24px;
            font-weight: bold;
            color: ${primaryColor};
        }
        .next-rank {
            margin-top: 10px;
            font-size: 16px;
            color: ${textColor};
            text-align: center;
            font-style: italic;
        }
    </style>
    <body>
        <div class="elo-container">
            <div class="header">${isWinner ? 'VICTORY - ELO GAINED' : 'DEFEAT - ELO LOST'}</div>
            
            <div class="rank-info">
                <div class="rank-box">
                    <div class="rank-title">Previous Rank</div>
                    <div class="rank-value">${oldRank.rank} ${oldRank.division}</div>
                </div>
                <div class="rank-box">
                    <div class="rank-title">Current Rank</div>
                    <div class="rank-value">${newRank.rank} ${newRank.division}</div>
                </div>
            </div>
            
            <div class="elo-bar-container">
                <div class="elo-bar"></div>
                <div class="elo-text">${newElo % 100}/100 ELO to next division</div>
            </div>
            
            <div class="change-info">
                <div class="change-box">
                    <div class="change-title">ELO ${isWinner ? 'Gained' : 'Lost'}</div>
                    <div class="change-value">${isWinner ? '+' : ''}${eloChange}</div>
                </div>
            </div>
            
            <div class="next-rank">
                Next rank at ${Math.ceil(newElo / 100) * 100} ELO
            </div>
        </div>
    </body>
    </html>
    `;

    const filename = `elo_${user.id}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    await page.setContent(html);
    await page.screenshot({ path: fullPath });
    await browser.close();
    return fullPath;
}

// --- Optimize battle image generation ---
// Only generate battle image at the start and at the end, not every round.
// In the battle loop, comment out or remove per-turn battle image generation:
// ...existing code...
// const battleImagePath1 = await generateBattleImage(player1, player2);
// const battleImage1 = new AttachmentBuilder(battleImagePath1);
// await channel.send({
//     content: `**Battle Image:**`,
//     files: [battleImage1]
// });
// ...existing code...

// Optionally, you can generate a single battle image at the start or end of the match only.