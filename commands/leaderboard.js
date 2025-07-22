const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register fonts (fallback to system if missing)
try {
    registerFont(path.join(__dirname, '../fonts/arial.ttf'), { family: 'Arial' });
    registerFont(path.join(__dirname, '../fonts/arial-bold.ttf'), { family: 'Arial', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom fonts for leaderboard. Using system fonts as fallback.', e.message);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top 10 strongest ninjas by level (excluding Level 1).'), // Updated description
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
            if (!fs.existsSync(usersPath)) {
                return interaction.editReply({ content: 'Error: User data file not found.', ephemeral: true });
            }
            const usersData = fs.readFileSync(usersPath, 'utf8');
            let users;
            try {
                users = JSON.parse(usersData);
            } catch (err) {
                console.error("Error parsing users.json:", err);
                return interaction.editReply({ content: 'Error reading user data. The user data file might be corrupted.', ephemeral: true });
            }

            // Filter and sort users by level, excluding Level 1 and ensuring valid data
            // Fetch username from Discord if not present in user data
            const allUsers = [];
            for (const id in users) {
                const user = users[id];
                // Ensure user object exists, has a valid level (number > 1), and fetch username
                if (user && typeof user.level === 'number' && !isNaN(user.level) && user.level > 1) { // Exclude Level 1
                    let username = user.username; // Try to get from saved data first
                    if (!username) {
                        try {
                            const discordUser = await interaction.client.users.fetch(id);
                            username = discordUser.username;
                        } catch (e) {
                            console.warn(`Could not fetch username for user ID ${id}. Skipping or using placeholder.`);
                            username = 'Unknown Ninja'; // Fallback if Discord user can't be fetched
                        }
                    }
                    allUsers.push({ id, username, ...user });
                }
            }

            allUsers.sort((a, b) => {
                // Primary sort by level (descending)
                if (b.level !== a.level) return b.level - a.level;
                // Secondary sort by username (alphabetical ascending)
                return a.username.localeCompare(b.username);
            });

            // Get only the top 10 users
            const topUsers = allUsers.slice(0, 10); // Changed from 15 to 10

            if (topUsers.length === 0) {
                // Improved message to clarify why no users are displayed
                return interaction.editReply({ content: 'No ninjas found on the leaderboard (level 2 or higher required to be displayed). Keep grinding!', ephemeral: true });
            }

            // Ensure the top user has an avatar URL from Discord's API if available
            let topUser = topUsers[0];
            let topUserAvatarUrl;
            try {
                const discordUser = await interaction.client.users.fetch(topUser.id);
                // Use displayAvatarURL for robustness
                topUserAvatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 256 });
                // Update username in topUser in case it was a placeholder or outdated
                topUser.username = discordUser.username;
            } catch {
                // Fallback for avatar if fetching Discord user fails
                topUserAvatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default Discord avatar
            }

            // Generate leaderboard image
            const imagePath = await generateLeaderboardImageRedesigned(topUsers, topUserAvatarUrl);
            const attachment = new AttachmentBuilder(imagePath);
            await interaction.editReply({ files: [attachment] });

            // Clean up the temporary image file
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting leaderboard image:", err);
            });

        } catch (error) {
            console.error("Error in leaderboard command:", error);
            await interaction.editReply({ content: 'An unexpected error occurred while generating the leaderboard. Please try again later.', ephemeral: true });
        }
    },
};

// Redesigned leaderboard image: portrait, only #1 avatar, "Strongest in the world"
async function generateLeaderboardImageRedesigned(leaderboardData, topUserAvatarUrl) {
    const width = 500;
    const headerHeight = 180; // Space for title and top user avatar/name
    const itemHeight = 48;
    const padding = 30;
    const rowGap = 6;

    // Calculate dynamic height based on number of top users (now max 10)
    const listHeight = leaderboardData.length * (itemHeight + rowGap);
    const calculatedHeight = headerHeight + listHeight + padding + 50; // Added extra padding for footer text if any
    const height = Math.max(400, calculatedHeight); // Minimum height to avoid squishing

    const avatarSize = 100;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#232526');
    bgGradient.addColorStop(1, '#414345');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Card background
    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = '#232526';
    roundRect(ctx, 15, 15, width - 30, height - 30, 15);
    ctx.fill();
    ctx.restore();

    // Header: "Strongest in the world" and #1 avatar
    ctx.save();
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText('Strongest in the World', width / 2, 55);
    ctx.shadowBlur = 0;

    // Draw #1 avatar
    try {
        const avatarImg = await loadImage(topUserAvatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, 120, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, width / 2 - avatarSize / 2, 70, avatarSize, avatarSize);
        ctx.restore();

        // Gold border
        ctx.save();
        ctx.strokeStyle = '#FFD700'; // Gold
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(width / 2, 120, avatarSize / 2 + 3, 0, Math.PI * 2, true);
        ctx.stroke();
        ctx.restore();
    } catch (e) {
        console.error("Failed to load top user avatar for leaderboard:", e);
        // Fallback: draw a placeholder circle or do nothing
        ctx.fillStyle = '#6e1515'; // Dark red placeholder
        ctx.beginPath();
        ctx.arc(width / 2, 120, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // #1 username and level
    // Ensure topUsers[0] exists before accessing its properties
    if (leaderboardData.length > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(`${leaderboardData[0].username}`, width / 2, 185);
        ctx.font = '18px Arial, sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`Level ${leaderboardData[0].level || '?'}`, width / 2, 210);
    }
    ctx.restore();

    // List items (Rank 1-10) - Start drawing from below the header
    let y = headerHeight + padding + 10; // Adjusted starting Y for the list items
    for (let i = 0; i < leaderboardData.length; i++) { // This loop will now only run for up to 10 items
        const user = leaderboardData[i];

        // Background for each row
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, 40, y, width - 80, itemHeight, 8);
        ctx.fill();
        ctx.restore();

        // Left border color by rank
        ctx.save();
        let borderColor = '#f8d56b'; // Default for ranks > 3
        if (i === 0) borderColor = '#FFD700'; // Gold for 1st
        else if (i === 1) borderColor = '#C0C0C0'; // Silver for 2nd
        else if (i === 2) borderColor = '#CD7F32'; // Bronze for 3rd
        ctx.fillStyle = borderColor;
        ctx.fillRect(40, y, 5, itemHeight);
        ctx.restore();

        // Rank number
        ctx.save();
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#f8d56b'; // Goldish for rank number
        ctx.textAlign = 'right';
        ctx.fillText(`${i + 1}.`, 65, y + itemHeight / 2 + 7);
        ctx.restore();

        // Username
        ctx.save();
        ctx.font = '18px Arial, sans-serif';
        ctx.fillStyle = i === 0 ? '#FFD700' : '#fff'; // Gold for 1st, white for others
        ctx.textAlign = 'left';
        let username = user.username;
        const maxUsernameLength = 16;
        if (username && username.length > maxUsernameLength) username = username.slice(0, maxUsernameLength - 2) + '…';
        ctx.fillText(username || 'N/A', 90, y + itemHeight / 2 + 7); // Fallback for username
        ctx.restore();

        // Level display
        ctx.save();
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'right';
        ctx.beginPath();
        roundRect(ctx, width - 90, y + itemHeight / 2 - 14, 50, 28, 5); // Background rect for level
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
        ctx.fillStyle = '#aaa'; // Text color for level
        ctx.fillText(`Lvl ${user.level || '?'}`, width - 60, y + itemHeight / 2 + 7);
        ctx.restore();

        y += itemHeight + rowGap;
    }

    // Save image
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
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

// Helper function for drawing rounded rectangles (provided in original)
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