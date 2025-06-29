const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
// const puppeteer = require('puppeteer'); // Remove puppeteer
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register a font (optional, for better appearance)
try {
    registerFont(path.join(__dirname, '../assets/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
    registerFont(path.join(__dirname, '../assets/Roboto-Regular.ttf'), { family: 'Roboto', weight: 'regular' });
} catch (e) {
    // If font files are missing, fallback to system fonts
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top users by level as an image.'),

    async execute(interaction) {
        // ***** DEFER REPLY *****
        await interaction.deferReply();

        try {
            // --- Load users.json ---
            const usersPath = path.resolve(__dirname, '..', 'data', 'users.json'); // Corrected path assumption
            if (!fs.existsSync(usersPath)) {
                return interaction.editReply({ content: 'Error: User data file not found.', ephemeral: true });
            }
            const usersData = fs.readFileSync(usersPath, 'utf8');
            let users;
            try {
                users = JSON.parse(usersData);
            } catch (err) {
                console.error("Failed to parse users.json:", err);
                return interaction.editReply({ content: 'Error reading user data.', ephemeral: true });
            }
            // --- ---

            // --- Process and Sort Users ---
            const sortedUsers = Object.entries(users)
                .map(([id, user]) => ({ id, ...user }))
                // Filter out entries without a valid level
                .filter(user => user && typeof user.level === 'number' && !isNaN(user.level))
                // Sort by level (descending)
                .sort((a, b) => b.level - a.level);

            const topUsersCount = 30; // Number of users to display
            const topUsers = sortedUsers.slice(0, topUsersCount);
            // --- ---

            // --- Fetch Discord User Details (Username/Avatar) ---
            const fetchedUsers = await Promise.all(
                topUsers.map(async (user) => {
                    try {
                        const discordUser = await interaction.client.users.fetch(user.id);
                        // Fetch avatar URL, provide a default if needed
                        const avatarUrl = discordUser.displayAvatarURL({ format: 'png', size: 128 });
                        return { ...user, username: discordUser.username, avatarUrl };
                    } catch (error) {
                         // Handle users not found (e.g., left Discord)
                         console.warn(`Could not fetch user ${user.id}:`, error.message);
                        return { ...user, username: 'Unknown User', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' }; // Default avatar
                    }
                })
            );
            // --- ---

            // --- Generate Leaderboard Image ---
            const imagePath = await generateLeaderboardImage(fetchedUsers);
            // --- ---

            // --- Send Image ---
            const attachment = new AttachmentBuilder(imagePath);
            await interaction.editReply({ files: [attachment] });
            
            // Clean up the image file after sending
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting leaderboard image:", err);
            });
            // --- ---

        } catch (error) {
            console.error('Error executing leaderboard command:', error);
            await interaction.editReply({ content: 'An error occurred while generating the leaderboard.', ephemeral: true });
        }
    },
};

// --- Canvas Image Generation Function ---
async function generateLeaderboardImage(leaderboardData) {
    // --- Layout constants ---
    const width = 800;
    const headerHeight = 180;
    const itemHeight = 45;
    const padding = 40;
    const listStartY = headerHeight + 10;
    const rowGap = 10;
    const avatarSize = 35;
    const topAvatarSize = 100;
    const calculatedHeight = headerHeight + leaderboardData.length * (itemHeight + rowGap) + padding;
    const height = Math.max(600, calculatedHeight);

    // --- Create canvas ---
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Background gradient ---
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#232526');
    bgGradient.addColorStop(1, '#414345');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // --- Card background ---
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#232526';
    roundRect(ctx, 20, 20, width - 40, height - 40, 15);
    ctx.fill();
    ctx.restore();

    // --- Header ---
    ctx.save();
    ctx.font = 'bold 32px Roboto, Arial, sans-serif';
    ctx.fillStyle = '#f8d56b';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText('Strongest In The World', width / 2, 60);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 20px Roboto, Arial, sans-serif';
    const topUser = leaderboardData[0];
    if (topUser) {
        // Draw top avatar
        try {
            const avatarImg = await loadImage(topUser.avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(width / 2, 110, topAvatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, width / 2 - topAvatarSize / 2, 60, topAvatarSize, topAvatarSize);
            ctx.restore();

            // Gold border
            ctx.save();
            ctx.strokeStyle = '#f8d56b';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(width / 2, 110, topAvatarSize / 2 + 2, 0, Math.PI * 2, true);
            ctx.stroke();
            ctx.restore();
        } catch (e) {
            // Ignore avatar loading errors
        }

        // Username
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Roboto, Arial, sans-serif';
        ctx.fillText(`${topUser.username} (Lvl ${topUser.level || '?'})`, width / 2, 185);
    } else {
        ctx.fillStyle = '#fff';
        ctx.fillText('No users found', width / 2, 120);
    }
    ctx.restore();

    // --- List items ---
    let y = listStartY;
    for (let i = 0; i < leaderboardData.length; i++) {
        const user = leaderboardData[i];
        // List item background
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, 50, y, width - 100, itemHeight, 8);
        ctx.fill();
        ctx.restore();

        // Left border color by rank
        ctx.save();
        let borderColor = '#f8d56b';
        if (i === 0) borderColor = '#FFD700';
        else if (i === 1) borderColor = '#C0C0C0';
        else if (i === 2) borderColor = '#CD7F32';
        ctx.fillStyle = borderColor;
        ctx.fillRect(50, y, 6, itemHeight);
        ctx.restore();

        // Rank number
        ctx.save();
        ctx.font = 'bold 18px Roboto, Arial, sans-serif';
        ctx.fillStyle = '#f8d56b';
        ctx.textAlign = 'right';
        ctx.fillText(`${i + 1}.`, 80, y + itemHeight / 2 + 7);
        ctx.restore();

        // Avatar
        try {
            const avatarImg = await loadImage(user.avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(100 + avatarSize / 2, y + itemHeight / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, 100, y + (itemHeight - avatarSize) / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            // Ignore avatar loading errors
        }

        // Username
        ctx.save();
        ctx.font = '18px Roboto, Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        // Truncate username if too long
        let username = user.username;
        if (username.length > 18) username = username.slice(0, 16) + '…';
        ctx.fillText(username, 145, y + itemHeight / 2 + 7);
        ctx.restore();

        // Level
        ctx.save();
        ctx.font = 'bold 16px Roboto, Arial, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.roundRect(width - 120, y + itemHeight / 2 - 14, 60, 28, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Lvl ${user.level || '?'}`, width - 90, y + itemHeight / 2 + 7);
        ctx.restore();

        y += itemHeight + rowGap;
    }

    // --- Save image ---
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const imagePath = path.join(tempDir, `leaderboard_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath);
    const stream = canvas.createPNGStream();
    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
    });
    return imagePath;
}

// --- Helper: rounded rectangle ---
function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
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
}