const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('train')
        .setDescription('Train to level up (Costs 100,000 Ryo per level)')
        .addIntegerOption(option =>
            option.setName('levels')
                .setDescription('Number of levels to train (1-10)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const levels = interaction.options.getInteger('levels');

        if (!fs.existsSync(usersPath)) {
            return interaction.followUp("Database not found.");
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        if (!users[userId]) {
            return interaction.followUp("You need to enroll first!");
        }

        const player = users[userId];
        const costPerLevel = 100000;
        const totalCost = costPerLevel * levels;

        if (player.money < totalCost) {
            return interaction.followUp(`You don't have enough Ryo! You need ${totalCost} Ryo for ${levels} level(s) of training.`);
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
            await interaction.editReply({ 
                content: null, // Clear loading message
                files: [attachment] 
            });
            
            // Clean up the image file after sending
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting training image:", err);
            });
        } catch (error) {
            console.error("Error generating training card:", error);
            await interaction.editReply({
                content: `✅ Training complete! Gained ${levels} level(s)\n` +
                         `- Money Spent: ${totalCost} Ryo\n` +
                         `- Remaining Money: ${player.money} Ryo\n` +
                         `- Health: +${healthGain}\n` +
                         `- Power: +${powerGain}\n` +
                         `- Defense: +${defenseGain}`
            });
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