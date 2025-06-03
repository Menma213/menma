const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { updateRequirements } = require('./scroll');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const usersJutsuPath = path.resolve(__dirname, '../../menma/data/usersjutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const bloodlinesPath = path.resolve(__dirname, '../../menma/data/bloodlines.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your ninja profile card')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another player\'s profile')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Remove await interaction.deferReply(); and use reply/editReply only ONCE
            // Get the target user (optional)
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;

            // Load data
            if (!fs.existsSync(usersPath)) {
                return interaction.reply({ content: "Database not found.", ephemeral: true });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return interaction.reply({ content: targetUser.id === interaction.user.id ? "You need to enroll first!" : "This user has not enrolled yet!", ephemeral: true });
            }

            const user = users[userId];
            const jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
            const usersJutsu = fs.existsSync(usersJutsuPath) ? JSON.parse(fs.readFileSync(usersJutsuPath, 'utf8')) : {};
            const bloodlines = fs.existsSync(bloodlinesPath) ? JSON.parse(fs.readFileSync(bloodlinesPath, 'utf8')) : {};

            // Get bloodline info
            const bloodlineInfo = user.bloodline ? bloodlines[user.bloodline] : null;
            const bloodlineName = bloodlineInfo?.name || 'None';
            const bloodlineDescription = bloodlineInfo?.description || 'No bloodline awakened';

            // Get equipped jutsu from user.jutsu object
            const equippedJutsu = Object.values(user.jutsu || {})
                .filter(jutsu => jutsu && jutsu !== 'Attack' && jutsu !== 'None')
                .map(jutsu => jutsuList[jutsu]?.name || jutsu);

            // Get all learned jutsu
            const learnedJutsu = usersJutsu[userId]?.usersjutsu || [];

            // Update profile check requirement (only for self)
            if (userId === interaction.user.id) {
                await updateRequirements(interaction.user.id, 'profile_check');
            }

            // Generate profile card image
            const generateProfileCard = async () => {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 600, height: 900 }); // Increased height for bloodline section

                // Create images directory if it doesn't exist
                const imagesDir = path.resolve(__dirname, '../images');
                if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                }

                const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 256 });
                const xpPercentage = Math.min(100, (user.exp / (user.level * 1000 + 1000)) * 100);

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
                                height: 900px;
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
                            .bloodline {
                                font-size: 16px;
                                color: #6eaff8;
                                margin-bottom: 5px;
                                font-style: italic;
                            }
                            .section {
                                background-color: rgba(0,0,0,0.5);
                                margin: 15px;
                                padding: 15px;
                                border-radius: 10px;
                                border-left: 3px solid #6e1515;
                            }
                            .bloodline-section {
                                background-color: rgba(0,0,0,0.5);
                                margin: 15px;
                                padding: 15px;
                                border-radius: 10px;
                                border-left: 3px solid #6eaff8;
                            }
                            .section-title {
                                font-size: 18px;
                                color: #f8d56b;
                                margin-bottom: 10px;
                                border-bottom: 1px solid #6e1515;
                                padding-bottom: 5px;
                            }
                            .bloodline-title {
                                font-size: 18px;
                                color: #6eaff8;
                                margin-bottom: 10px;
                                border-bottom: 1px solid #6eaff8;
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
                            .xp-bar {
                                height: 10px;
                                background-color: #333;
                                border-radius: 5px;
                                margin-top: 5px;
                                overflow: hidden;
                            }
                            .xp-progress {
                                height: 100%;
                                background: linear-gradient(90deg, #6e1515, #f8d56b);
                                width: ${xpPercentage}%;
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
                            .bloodline-desc {
                                font-size: 14px;
                                color: #ccc;
                                margin-top: 5px;
                                font-style: italic;
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
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="header">
                                <img src="${avatarUrl}" class="avatar">
                                <div class="username">${targetUser.username}</div>
                                <div class="rank">${user.rank || 'Academy Student'}</div>
                                <div class="bloodline">${bloodlineName}</div>
                            </div>
                            
                            <div class="bloodline-section">
                                <div class="bloodline-title">BLOODLINE ABILITY</div>
                                <div class="bloodline-desc">${bloodlineDescription}</div>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">LEVEL PROGRESSION</div>
                                <div class="stat">
                                    <span class="stat-name">Level:</span>
                                    <span class="stat-value">${user.level || 1}</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-name">XP:</span>
                                    <span class="stat-value">${user.exp || 0}/${(user.level || 1) * 1000 + 1000}</span>
                                </div>
                                <div class="xp-bar">
                                    <div class="xp-progress"></div>
                                </div>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">BATTLE STATS</div>
                                <div class="stats">
                                    <div class="stat">
                                        <span class="stat-name">Health:</span>
                                        <span class="stat-value">${user.health || 100}</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Power:</span>
                                        <span class="stat-value">${user.power || 10}</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Defense:</span>
                                        <span class="stat-value">${user.defense || 10}</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Chakra:</span>
                                        <span class="stat-value">${user.chakra || 10}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">BATTLE RECORD</div>
                                <div class="stats">
                                    <div class="stat">
                                        <span class="stat-name">Wins:</span>
                                        <span class="stat-value">${user.wins || 0}</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Losses:</span>
                                        <span class="stat-value">${user.losses || 0}</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Ranked:</span>
                                        <span class="stat-value">${user.rankedPoints || 0}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">EQUIPPED JUTSU</div>
                                <div class="jutsu-list">
                                    ${equippedJutsu.map(jutsu => `<div class="jutsu-item">${jutsu}</div>`).join('')}
                                </div>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">INVENTORY</div>
                                <div class="stats">
                                    <div class="stat">
                                        <span class="stat-name">Money:</span>
                                        <span class="stat-value">${user.money || 0} Ryo</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-name">Ramen:</span>
                                        <span class="stat-value">${user.ramen || 0}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="footer">
                                ${user.clan || 'No Clan'} | Mentor: ${user.mentor || 'None'}
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await page.setContent(htmlContent);
                const imagePath = path.join(imagesDir, `profile_${userId}_${Date.now()}.png`);
                await page.screenshot({ path: imagePath });
                await browser.close();
                return imagePath;
            };

            const profileImage = new AttachmentBuilder(await generateProfileCard());
            await interaction.reply({
                content: `${targetUser.username}'s Ninja Card`,
                files: [profileImage]
            });

        } catch (error) {
            console.error('Error generating profile card:', error);
            // Only reply if not already replied
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "An error occurred while generating the profile card. Please try again later.",
                    ephemeral: true
                });
            }
        }
    }
};