const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { updateRequirements } = require('./scroll');
const brank = require('./brank.js'); // Import for battle helpers

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('train')
        .setDescription('Train to level up or fight a training dummy')
        .addSubcommand(sub =>
            sub.setName('levels')
                .setDescription('Train to level up (Costs 100,000 Ryo per level)')
                .addIntegerOption(option =>
                    option.setName('levels')
                        .setDescription('Number of levels to train (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)
                )
        )
        .addSubcommand(sub =>
            sub.setName('dummy')
                .setDescription('Fight a training dummy (no cooldown, infinite HP)')
        ),
    
    async execute(interaction) {
        // --- TRAINING DUMMY SUBCOMMAND ---
        if (interaction.options.getSubcommand && interaction.options.getSubcommand() === 'dummy') {
            const userId = interaction.user.id;
            if (!fs.existsSync(usersPath)) {
                return interaction.reply("Database not found.");
            }
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return interaction.reply("You need to enroll first!");
            }
            let player = {
                ...users[userId],
                name: interaction.user.username,
                activeEffects: [],
                accuracy: 100,
                dodge: 0
            };
            let playerHealth = player.health;
            let dummy = {
                name: "Training Dummy",
                health: 999999999,
                power: 0,
                defense: player.defense,
                chakra: 10,
                jutsu: ["Hello"],
                activeEffects: [],
                accuracy: 100,
                dodge: 0,
                currentHealth: 999999999
            };
            let roundNum = 1;
            // Use brank's helpers for UI
            const generateBattleImage = async () => {
                return await brank.generateBattleImageForDummy(interaction, player, playerHealth, dummy);
            };
            const createMovesEmbed = () => brank.createMovesEmbedForDummy(player, roundNum, userId);
            const getJutsuByButton = (buttonId) => brank.getJutsuByButtonForDummy(buttonId, player);
            const executeJutsu = brank.executeJutsuForDummy;
            const processPlayerMove = brank.processPlayerMoveForDummy;
            const npcChooseMove = () => ({
                damage: 0,
                heal: 0,
                description: `Training Dummy teases ${player.name} by waving at them while being attacked.`,
                specialEffects: [],
                hit: true
            });
            const getEffectiveStats = brank.getEffectiveStatsForDummy;
            const createBattleSummary = brank.createBattleSummaryForDummy;

            await interaction.reply({ content: "**Training Dummy Battle Started!**" });
            let battleActive = true;
            while (battleActive) {
                // ...effect durations...
                [player, dummy].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (effect.duration > 0) effect.duration--;
                    });
                    entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                });
                const effectivePlayer = getEffectiveStats(player);
                const effectiveDummy = getEffectiveStats(dummy);
                const { embed, components } = createMovesEmbed();
                // Only send a message if there is something to send
                if ((embed && components && components.length > 0) || (embed && !components) || (!embed && components && components.length > 0)) {
                    await interaction.followUp({
                        embeds: embed ? [embed] : [],
                        components: components || [],
                        fetchReply: true
                    });
                }
                const battleImage = new AttachmentBuilder(await generateBattleImage());
                await interaction.followUp({ files: [battleImage] });
                const moveMessage = await interaction.fetchReply(); // Get the last message for collector
                const playerAction = await new Promise(resolve => {
                    const collector = moveMessage.createMessageComponentCollector({
                        filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                        time: 90000
                    });
                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        if (i.customId.startsWith('move')) {
                            const jutsuName = getJutsuByButton(i.customId);
                            const result = executeJutsu(player, dummy, effectivePlayer, effectiveDummy, jutsuName);
                            result.jutsuUsed = jutsuName;
                            resolve(result);
                        } else {
                            resolve(await processPlayerMove(i.customId, player, dummy, effectivePlayer, effectiveDummy));
                        }
                        collector.stop();
                    });
                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: '$user did not make a move.',
                                specialEffects: ["Missed opportunity!"],
                                hit: false,
                                fled: true
                            });
                        }
                        if (moveMessage && moveMessage.edit) {
                            moveMessage.edit({
                                components: components.map(row => {
                                    const disabledRow = ActionRowBuilder.from(row);
                                    disabledRow.components.forEach(c => c.setDisabled(true));
                                    return disabledRow;
                                })
                            }).catch(() => {});
                        }
                    });
                });
                if (playerAction.fled) {
                    battleActive = false;
                    await interaction.followUp(`${player.name} ended the training session!`);
                    return;
                }
                dummy.currentHealth -= playerAction.damage || 0;
                if (playerAction.heal) {
                    playerHealth = Math.min(playerHealth + playerAction.heal, player.health);
                }
                // Dummy's turn (does nothing)
                let npcAction = npcChooseMove();
                // Clamp health
                playerHealth = Math.max(0, playerHealth);
                dummy.currentHealth = Math.max(0, dummy.currentHealth);
                // Show results
                let summaryEmbed = createBattleSummary(playerAction, npcAction, player, dummy, roundNum, null, playerHealth);
                if (summaryEmbed) {
                    await interaction.followUp({
                        embeds: [summaryEmbed]
                    });
                } else {
                    await interaction.followUp({
                        content: `${player.name} attacks the dummy!`
                    });
                }
                // End if player dies (optional: revive for infinite training)
                if (playerHealth <= 0) {
                    playerHealth = player.health;
                    await interaction.followUp(`WEAKLING!`);
                }
                roundNum++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            return;
        }

        // --- LEVELS SUBCOMMAND ---
        if (interaction.options.getSubcommand && interaction.options.getSubcommand() === 'levels') {
            const userId = interaction.user.id;
            const levels = interaction.options.getInteger('levels');

            if (!fs.existsSync(usersPath)) {
                return interaction.reply("Database not found.");
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

            if (!users[userId]) {
                return interaction.reply("You need to enroll first!");
            }

            const player = users[userId];
            const costPerLevel = 100000;
            const totalCost = costPerLevel * levels;

            if (player.money < totalCost) {
                return interaction.reply(`You don't have enough Ryo! You need ${totalCost} Ryo for ${levels} level(s) of training.`);
            }

            // Deduct money
            player.money -= totalCost;

            // Store original stats for display
            const originalStats = {
                level: player.level,
                health: player.health,
                power: player.power,
                defense: player.defense
            };

            // Apply level gains with random stat increases
            let healthGain = 0;
            let powerGain = 0;
            let defenseGain = 0;

            for (let i = 0; i < levels; i++) {
                player.level += 1;
                
                // Random stat gains per level
                const currentHealthGain = Math.floor(Math.random() * 101) + 100; // 100-200
                const currentPowerGain = Math.floor(Math.random() * 2) + 2;      // 2-3
                const currentDefenseGain = Math.floor(Math.random() * 3) + 2;    // 2-4
                
                player.health += currentHealthGain;
                player.power += currentPowerGain;
                player.defense += currentDefenseGain;
                
                healthGain += currentHealthGain;
                powerGain += currentPowerGain;
                defenseGain += currentDefenseGain;
            }

            // Reset EXP to 0 since we leveled up
            player.exp = 0;

            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            // Generate visual card
            try {
                const imagePath = await this.generateTrainingCard(interaction, player, {
                    levelsGained: levels,
                    moneySpent: totalCost,
                    remainingMoney: player.money,
                    healthGain,
                    powerGain,
                    defenseGain,
                    originalStats
                });

                const attachment = new AttachmentBuilder(imagePath);

                // Try to send the image, but if the interaction is expired, send a fallback message to the channel
                try {
                    await interaction.reply({ 
                        content: null,
                        files: [attachment] 
                    });
                } catch (err) {
                    console.error("Error sending training card image:", err);
                    // Fallback: send to channel if interaction expired
                    try {
                        await interaction.channel.send({
                            content: `<@${userId}> Training complete! (Interaction expired, sending here)\n` +
                                     `Gained ${levels} level(s)\n` +
                                     `- Money Spent: ${totalCost} Ryo\n` +
                                     `- Remaining Money: ${player.money} Ryo\n` +
                                     `- Health: +${healthGain}\n` +
                                     `- Power: +${powerGain}\n` +
                                     `- Defense: +${defenseGain}`,
                        files: [attachment]
                        });
                    } catch (err2) {
                        console.error("Error sending fallback training card to channel:", err2);
                    }
                }

                // Clean up the image file after sending
                fs.unlink(imagePath, (err) => {
                    if (err) console.error("Error deleting training image:", err);
                });

                // After successful training
                await updateRequirements(userId, 'train');
            } catch (error) {
                console.error("Error generating training card:", error);
                // Try to reply, but if interaction is expired, send fallback to channel
                try {
                    await interaction.reply({
                        content: `✅ Training complete! Gained ${levels} level(s)\n` +
                                 `- Money Spent: ${totalCost} Ryo\n` +
                                 `- Remaining Money: ${player.money} Ryo\n` +
                                 `- Health: +${healthGain}\n` +
                                 `- Power: +${powerGain}\n` +
                                 `- Defense: +${defenseGain}`
                    });
                } catch (err) {
                    console.error("Error sending fallback training reply:", err);
                    try {
                        await interaction.channel.send({
                            content: `<@${userId}> Training complete! (Interaction expired, sending here)\n` +
                                     `Gained ${levels} level(s)\n` +
                                     `- Money Spent: ${totalCost} Ryo\n` +
                                     `- Remaining Money: ${player.money} Ryo\n` +
                                     `- Health: +${healthGain}\n` +
                                     `- Power: +${powerGain}\n` +
                                     `- Defense: +${defenseGain}`
                        });
                    } catch (err2) {
                        console.error("Error sending fallback training reply to channel:", err2);
                    }
                }
            }
            return;
        }
    },
    
    async generateTrainingCard(interaction, user, trainingData) {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 600, height: 800 });
        
        const equippedJutsu = Object.values(user.jutsu || {}).filter(j => j !== 'None');
        
        const htmlContent = `
            <html>
            <head>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: 'Arial', sans-serif;
                        background-color: #1a1a1a;
                        color: white;
                    }
                    .card {
                        width: 600px;
                        height: 800px;
                        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                        border-radius: 15px;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                        position: relative;
                        overflow: hidden;
                    }
                    .header {
                        background-color: rgba(0,0,0,0.7);
                        padding: 20px;
                        text-align: center;
                        border-bottom: 2px solid #6e1515;
                    }
                    .avatar {
                        width: 150px;
                        height: 150px;
                        border-radius: 50%;
                        border: 4px solid #6e1515;
                        margin: 0 auto;
                        object-fit: cover;
                    }
                    .username {
                        font-size: 24px;
                        margin: 10px 0;
                        color: #fff;
                        text-shadow: 0 0 5px #6e1515;
                    }
                    .rank {
                        font-size: 18px;
                        color: #f8d56b;
                        margin-bottom: 5px;
                    }
                    .section {
                        background-color: rgba(0,0,0,0.5);
                        margin: 15px;
                        padding: 15px;
                        border-radius: 10px;
                        border-left: 3px solid #6e1515;
                    }
                    .section-title {
                        font-size: 18px;
                        color: #f8d56b;
                        margin-bottom: 10px;
                        border-bottom: 1px solid #6e1515;
                        padding-bottom: 5px;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }
                    .stat {
                        display: flex;
                        justify-content: space-between;
                    }
                    .stat-name {
                        color: #aaa;
                    }
                    .stat-value {
                        color: #fff;
                        font-weight: bold;
                    }
                    .jutsu-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 5px;
                    }
                    .jutsu-item {
                        background-color: rgba(110,21,21,0.3);
                        padding: 5px 10px;
                        border-radius: 15px;
                        font-size: 12px;
                        border: 1px solid #6e1515;
                    }
                    .footer {
                        position: absolute;
                        bottom: 0;
                        width: 100%;
                        text-align: center;
                        padding: 10px;
                        background-color: rgba(0,0,0,0.7);
                        font-size: 12px;
                        color: #aaa;
                    }
                    .training-results {
                        background-color: rgba(110,21,21,0.3);
                        padding: 10px;
                        border-radius: 10px;
                        margin-top: 10px;
                        border: 1px solid #f8d56b;
                    }
                    .training-title {
                        color: #f8d56b;
                        font-weight: bold;
                        margin-bottom: 5px;
                        font-size: 20px;
                        text-align: center;
                    }
                    .training-stat {
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                        font-size: 14px;
                    }
                    .positive {
                        color: #4CAF50;
                    }
                    .negative {
                        color: #F44336;
                    }
                    .stat-change {
                        display: flex;
                        justify-content: space-between;
                    }
                    .old-value {
                        color: #aaa;
                        text-decoration: line-through;
                        margin-right: 10px;
                    }
                    .new-value {
                        color: #fff;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <img src="${interaction.user.displayAvatarURL({ format: 'png' })}" class="avatar">
                        <div class="username">${interaction.user.username}</div>
                        <div class="rank">${user.rank || 'Academy Student'}</div>
                    </div>
                    
                    <div class="section">
                        <div class="training-title">TRAINING COMPLETE</div>
                        <div class="training-results">
                            <div class="training-stat">
                                <span>Levels Gained:</span>
                                <span class="positive">+${trainingData.levelsGained}</span>
                            </div>
                            <div class="training-stat">
                                <span>Money Spent:</span>
                                <span class="negative">-${trainingData.moneySpent} Ryo</span>
                            </div>
                            <div class="training-stat">
                                <span>Remaining Money:</span>
                                <span>${trainingData.remainingMoney} Ryo</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">STAT IMPROVEMENTS</div>
                        <div class="stats">
                            <div class="stat">
                                <span class="stat-name">Level:</span>
                                <div class="stat-change">
                                    <span class="old-value">${trainingData.originalStats.level}</span>
                                    <span class="new-value positive">${user.level}</span>
                                </div>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Health:</span>
                                <div class="stat-change">
                                    <span class="old-value">${Math.round(trainingData.originalStats.health)}</span>
                                    <span class="new-value positive">${Math.round(user.health)} (+${trainingData.healthGain})</span>
                                </div>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Power:</span>
                                <div class="stat-change">
                                    <span class="old-value">${trainingData.originalStats.power}</span>
                                    <span class="new-value positive">${user.power} (+${trainingData.powerGain})</span>
                                </div>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Defense:</span>
                                <div class="stat-change">
                                    <span class="old-value">${trainingData.originalStats.defense}</span>
                                    <span class="new-value positive">${user.defense} (+${trainingData.defenseGain})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">CURRENT STATS</div>
                        <div class="stats">
                            <div class="stat">
                                <span class="stat-name">Level:</span>
                                <span class="stat-value">${user.level}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Health:</span>
                                <span class="stat-value">${Math.round(user.health)}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Power:</span>
                                <span class="stat-value">${user.power}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Defense:</span>
                                <span class="stat-value">${user.defense}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Chakra:</span>
                                <span class="stat-value">${user.chakra || 10}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-name">Money:</span>
                                <span class="stat-value">${user.money} Ryo</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        ${user.clan || 'No Clan'} | ${user.bloodline || 'Unknown Bloodline'} | Mentor: ${user.mentor || 'None'}
                    </div>
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        const imagePath = path.join(__dirname, `../../menma/temp/training_${interaction.user.id}_${Date.now()}.png`);
        
        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '../../menma/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        await page.screenshot({ path: imagePath });
        await browser.close();
        
        return imagePath;
    }
};