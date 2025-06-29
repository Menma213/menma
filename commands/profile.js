const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const { URL } = require('url');
const { updateRequirements } = require('./scroll');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const usersJutsuPath = path.resolve(__dirname, '../../menma/data/usersjutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const bloodlinesPath = path.resolve(__dirname, '../../menma/data/bloodlines.json');

// Register fonts (make sure you have these font files in your project)
try {
    registerFont(path.resolve(__dirname, '../fonts/arial.ttf'), { family: 'Arial' });
    registerFont(path.resolve(__dirname, '../fonts/arial-bold.ttf'), { family: 'Arial', weight: 'bold' });
} catch (err) {
    console.warn('Could not register custom fonts, using system defaults');
}

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
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;

            if (!fs.existsSync(usersPath)) {
                return await interaction.editReply({ content: "Database not found." });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return await interaction.editReply({ content: targetUser.id === interaction.user.id ? "You need to enroll first!" : "This user has not enrolled yet!" });
            }

            const user = users[userId];
            const jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
            const usersJutsu = fs.existsSync(usersJutsuPath) ? JSON.parse(fs.readFileSync(usersJutsuPath, 'utf8')) : {};
            const bloodlines = fs.existsSync(bloodlinesPath) ? JSON.parse(fs.readFileSync(bloodlinesPath, 'utf8')) : {};

            const bloodlineInfo = user.bloodline ? bloodlines[user.bloodline] : null;
            const bloodlineName = bloodlineInfo?.name || 'None';
            const bloodlineDescription = bloodlineInfo?.description || 'No bloodline awakened';

            const equippedJutsu = Object.values(user.jutsu || {})
                .filter(jutsu => jutsu && jutsu !== 'Attack' && jutsu !== 'None')
                .map(jutsu => jutsuList[jutsu]?.name || jutsu);

            const learnedJutsu = usersJutsu[userId]?.usersjutsu || [];

            if (userId === interaction.user.id) {
                await updateRequirements(interaction.user.id, 'profile_check');
            }

            // Generate profile card with Canvas
            const generateProfileCard = async () => {
                const canvas = createCanvas(600, 900);
                const ctx = canvas.getContext('2d');

                // Background gradient
                const gradient = ctx.createLinearGradient(0, 0, 600, 900);
                gradient.addColorStop(0, '#0f0c29');
                gradient.addColorStop(0.5, '#302b63');
                gradient.addColorStop(1, '#24243e');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 600, 900);

                // Header section
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, 600, 220);
                ctx.strokeStyle = '#6e1515';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, 600, 220);

                // Load avatar using user id and Discord CDN (bypassing displayAvatarURL)
                try {
                    // Try to get the avatar hash from the user object if available
                    let avatarUrl;
                    if (targetUser.avatar) {
                        avatarUrl = `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png?size=256`;
                    } else {
                        // Default avatar
                        const defaultAvatarNumber = parseInt(targetUser.discriminator) % 5;
                        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                    }
                    let avatar;
                    try {
                        avatar = await loadImageWithRetry(avatarUrl);
                    } catch (err) {
                        // Draw placeholder avatar if all fails
                        ctx.fillStyle = '#333333';
                        ctx.beginPath();
                        ctx.arc(300, 90, 75, 0, Math.PI * 2, true);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 24px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('AVATAR', 300, 100);
                        avatar = null;
                    }
                    if (avatar) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(300, 90, 75, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatar, 225, 15, 150, 150);
                        ctx.restore();

                        // Avatar border
                        ctx.strokeStyle = '#6e1515';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(300, 90, 75, 0, Math.PI * 2, true);
                        ctx.stroke();
                    }
                } catch (err) {
                    console.error('Error loading avatar:', err);
                }

                // Username
                ctx.font = '24px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#6e1515';
                ctx.shadowBlur = 5;
                ctx.fillText(targetUser.username, 300, 190);
                ctx.shadowBlur = 0;

                // Rank
                ctx.font = '18px Arial';
                ctx.fillStyle = '#f8d56b';
                ctx.fillText(user.rank || 'Academy Student', 300, 215);

                // Bloodline
                ctx.font = '16px Arial';
                ctx.fillStyle = '#6eaff8';
                ctx.fontStyle = 'italic';
                ctx.fillText(bloodlineName, 300, 235);
                ctx.fontStyle = 'normal';

                // Bloodline section
                drawSection(ctx, 15, 250, 570, 100, '#6eaff8');
                ctx.fillStyle = '#6eaff8';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.fillText('BLOODLINE ABILITY', 30, 275);
                
                // Bloodline description
                ctx.fillStyle = '#cccccc';
                ctx.font = 'italic 14px Arial';
                wrapText(ctx, bloodlineDescription, 30, 295, 540, 24);

                // Level progression section
                drawSection(ctx, 15, 365, 570, 100, '#6e1515');
                ctx.fillStyle = '#f8d56b';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('LEVEL PROGRESSION', 30, 390);

                const xpPercentage = Math.min(100, (user.exp / (user.level * 1000 + 1000)) * 100);
                const level = user.level || 1;
                const exp = user.exp || 0;
                const nextLevelExp = level * 1000 + 1000;

                // Level and XP
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '14px Arial';
                ctx.fillText('Level:', 30, 415);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(level.toString(), 100, 415);

                ctx.fillStyle = '#aaaaaa';
                ctx.fillText('XP:', 30, 435);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${exp}/${nextLevelExp}`, 100, 435);

                // XP Bar
                ctx.fillStyle = '#333333';
                ctx.fillRect(30, 445, 540, 10);
                const xpGradient = ctx.createLinearGradient(30, 445, 570, 445);
                xpGradient.addColorStop(0, '#6e1515');
                xpGradient.addColorStop(1, '#f8d56b');
                ctx.fillStyle = xpGradient;
                ctx.fillRect(30, 445, 540 * (xpPercentage / 100), 10);

                // Battle stats section
                drawSection(ctx, 15, 480, 570, 120, '#6e1515');
                ctx.fillStyle = '#f8d56b';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('BATTLE STATS', 30, 505);

                // Stats grid
                const stats = [
                    { name: 'Health:', value: user.health || 100 },
                    { name: 'Power:', value: user.power || 10 },
                    { name: 'Defense:', value: user.defense || 10 },
                    { name: 'Chakra:', value: user.chakra || 10 }
                ];

                stats.forEach((stat, i) => {
                    const row = Math.floor(i / 2);
                    const col = i % 2;
                    const x = 30 + (col * 270);
                    const y = 530 + (row * 25);

                    ctx.fillStyle = '#aaaaaa';
                    ctx.fillText(stat.name, x, y);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(stat.value.toString(), x + 80, y);
                });

                // Battle record section
                drawSection(ctx, 15, 615, 570, 90, '#6e1515');
                ctx.fillStyle = '#f8d56b';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('BATTLE RECORD', 30, 640);

                const records = [
                    { name: 'Wins:', value: user.wins || 0 },
                    { name: 'Losses:', value: user.losses || 0 },
                    { name: 'Ranked:', value: user.rankedPoints || 0 }
                ];

                records.forEach((record, i) => {
                    const x = 30 + (i * 180);
                    const y = 665;

                    ctx.fillStyle = '#aaaaaa';
                    ctx.fillText(record.name, x, y);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(record.value.toString(), x + 60, y);
                });

                // Equipped jutsu section
                drawSection(ctx, 15, 720, 570, 80, '#6e1515');
                ctx.fillStyle = '#f8d56b';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('EQUIPPED JUTSU', 30, 745);

                // Jutsu tags
                let xPos = 30;
                let yPos = 765;
                equippedJutsu.forEach(jutsu => {
                    ctx.font = '12px Arial';
                    const jutsuWidth = ctx.measureText(jutsu).width + 20;
                    
                    if (xPos + jutsuWidth > 570) {
                        xPos = 30;
                        yPos += 30;
                    }
                    
                    // Jutsu tag background
                    ctx.fillStyle = 'rgba(110, 21, 21, 0.3)';
                    ctx.strokeStyle = '#6e1515';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(xPos, yPos - 15, jutsuWidth, 20, 10);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Jutsu text
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.fillText(jutsu, xPos + (jutsuWidth / 2), yPos - 2);
                    ctx.textAlign = 'left';
                    
                    xPos += jutsuWidth + 10;
                });

                // Inventory section
                drawSection(ctx, 15, 815, 570, 50, '#6e1515');
                ctx.fillStyle = '#f8d56b';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('INVENTORY', 30, 840);

                const inventory = [
                    { name: 'Money:', value: `${user.money || 0} Ryo` },
                    { name: 'Ramen:', value: user.ramen || 0 }
                ];

                inventory.forEach((item, i) => {
                    const x = 30 + (i * 270);
                    const y = 860;

                    ctx.fillStyle = '#aaaaaa';
                    ctx.fillText(item.name, x, y);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(item.value.toString(), x + 80, y);
                });

                // Footer
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 880, 600, 20);
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${user.clan || 'No Clan'} | Mentor: ${user.mentor || 'None'}`, 300, 895);

                // Convert to buffer and return
                return canvas.toBuffer('image/png');
            };

            const profileBuffer = await generateProfileCard();
            const attachment = new AttachmentBuilder(profileBuffer, { name: 'profile.png' });

            await interaction.editReply({
                content: `${targetUser.username}'s Ninja Card`,
                files: [attachment]
            });

        } catch (error) {
            console.error('Error generating profile card:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "An error occurred while generating the profile card. Please try again later."
                });
            } else {
                await interaction.reply({
                    content: "An error occurred while generating the profile card. Please try again later."
                });
            }
        }
    }
};

// Helper function to draw sections
function drawSection(ctx, x, y, width, height, borderColor) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + height - 5);
    ctx.stroke();
}

// Helper function to wrap text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let testLine = '';
    let lineCount = 0;
    const maxLines = 3;

    for (let n = 0; n < words.length; n++) {
        testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
            if (lineCount < maxLines - 1) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
                lineCount++;
            } else {
                line = line.substring(0, line.length - 3) + '...';
                break;
            }
        } else {
            line = testLine;
        }
    }
    
    ctx.fillText(line, x, y);
}

// Helper to robustly download remote images to a temp file and return the local path
async function downloadImageToFile(url) {
    return new Promise((resolve, reject) => {
        try {
            const tmpDir = path.resolve(__dirname, '../images/tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            // Always use .png for Discord avatars (since we request format: 'png')
            const tmpFile = path.join(tmpDir, `img_${Date.now()}_${Math.floor(Math.random()*10000)}.png`);
            const file = fs.createWriteStream(tmpFile);
            https.get(url, res => {
                if (res.statusCode !== 200) {
                    file.close(() => {});
                    try { fs.unlinkSync(tmpFile); } catch {}
                    return reject(new Error(`Failed to download image: ${url}`));
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        fs.stat(tmpFile, (err, stats) => {
                            if (err || !stats || stats.size === 0) {
                                try { fs.unlinkSync(tmpFile); } catch {}
                                return reject(new Error(`Downloaded image is empty: ${url}`));
                            }
                            resolve(tmpFile);
                        });
                    });
                });
            }).on('error', err => {
                file.close(() => {});
                try { fs.unlinkSync(tmpFile); } catch {}
                reject(err);
            });
        } catch (e) {
            reject(e);
        }
    });
}

// Add this helper at the bottom or top of the file:
async function loadImageWithRetry(url) {
    try {
        return await loadImage(url);
    } catch (error) {
        try {
            // Try jpg fallback if png fails
            const jpgUrl = url.replace(/\.png(\?.*)?$/, '.jpg$1');
            return await loadImage(jpgUrl);
        } catch (error2) {
            throw error2;
        }
    }
}