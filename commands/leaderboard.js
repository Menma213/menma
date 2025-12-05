const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register a thematic font if available (e.g., a stylized sans-serif or Asian-inspired font)
// Fallback to system fonts if not found.
try {
    registerFont(path.join(__dirname, '../fonts/ninjafont.ttf'), { family: 'NinjaFont' });
    registerFont(path.join(__dirname, '../fonts/ninjafont-bold.ttf'), { family: 'NinjaFont', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom "NinjaFont". Using "sans-serif" as fallback. Please ensure font files exist.');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays leaderboards for ninjas or clans.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to display')
                .setRequired(false)
                .addChoices(
                    { name: 'Ninja Leaderboard', value: 'ninja' },
                    { name: 'Clan Leaderboard', value: 'clan' }
                )),
    async execute(interaction) {
        await interaction.deferReply();

        const leaderboardType = interaction.options.getString('type') || 'ninja';

        if (leaderboardType === 'clan') {
            // Clan Leaderboard
            try {
                const clansPath = path.resolve(__dirname, '../data/clans.json');
                const blueprintsPath = path.resolve(__dirname, '../data/blueprints.json');

                if (!fs.existsSync(clansPath)) {
                    return interaction.editReply({ content: 'Error: Clan data file not found.', ephemeral: true });
                }

                const clansData = JSON.parse(fs.readFileSync(clansPath, 'utf8'));
                const blueprints = fs.existsSync(blueprintsPath) ? JSON.parse(fs.readFileSync(blueprintsPath, 'utf8')) : [];

                // Calculate power for each clan and filter out example clans
                const clanArray = [];
                for (const [clanId, clan] of Object.entries(clansData)) {
                    if (clanId.startsWith('_')) continue; // Skip metadata entries

                    let clanPower = 0;
                    if (clan.weapons) {
                        for (const [wName, count] of Object.entries(clan.weapons)) {
                            const bp = blueprints.find(b => b.name === wName);
                            if (bp) clanPower += bp.power * count;
                        }
                    }

                    clanArray.push({
                        id: clanId,
                        name: clan.name,
                        power: clanPower,
                        level: clan.level || 1,
                        members: clan.members?.length || 0,
                        territories: clan.controlledTerritories?.length || 0,
                        image: clan.image,
                        color: clan.color || '#0099ff'
                    });
                }

                // Sort by power
                clanArray.sort((a, b) => b.power - a.power);
                const topClans = clanArray.slice(0, 5);

                if (topClans.length === 0) {
                    return interaction.editReply({ content: 'No clans found. Create a clan to get started!', ephemeral: true });
                }

                const imagePath = await generateClanLeaderboardImage(topClans);
                const attachment = new AttachmentBuilder(imagePath);
                await interaction.editReply({ files: [attachment] });

                fs.unlink(imagePath, (err) => {
                    if (err) console.error("Error deleting clan leaderboard image:", err);
                });

            } catch (error) {
                console.error("Error in clan leaderboard:", error);
                await interaction.editReply({ content: 'An unexpected error occurred while generating the clan leaderboard.', ephemeral: true });
            }
            return;
        }

        // Ninja Leaderboard (original code)
        try {
            const usersPath = path.resolve(__dirname, '../../menma/data/players.json');
            if (!fs.existsSync(usersPath)) {
                return interaction.editReply({ content: 'Error: User data file not found.', ephemeral: true });
            }
            const usersData = fs.readFileSync(usersPath, 'utf8');
            let users;
            try {
                users = JSON.parse(usersData);
            } catch (err) {
                console.error("Error parsing users.json:", err);
                return interaction.editReply({ content: 'Error reading user data. The file might be corrupted.', ephemeral: true });
            }

            // Filter and sort users by level, excluding Level 1
            const allUsers = [];
            for (const id in users) {
                const user = users[id];
                if (user && typeof user.level === 'number' && !isNaN(user.level) && user.level > 1) {
                    let username = user.username;
                    if (!username) {
                        try {
                            const discordUser = await interaction.client.users.fetch(id);
                            username = discordUser.username;
                        } catch (e) {
                            console.warn(`Could not fetch username for user ID ${id}. Using placeholder.`);
                            username = 'Unknown Ninja';
                        }
                    }
                    allUsers.push({ id, username, ...user });
                }
            }

            allUsers.sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return a.username.localeCompare(b.username);
            });

            const topUsers = allUsers.slice(0, 10);

            if (topUsers.length === 0) {
                return interaction.editReply({ content: 'No ninjas found on the leaderboard (level 2 or higher required). Keep grinding!', ephemeral: true });
            }

            // Fetch avatar URLs for the top 3 users for the custom display
            const topUserAvatars = await Promise.all(topUsers.slice(0, 3).map(async (user) => {
                try {
                    const discordUser = await interaction.client.users.fetch(user.id);
                    return {
                        ...user,
                        avatarUrl: discordUser.displayAvatarURL({ extension: 'png', size: 128 }),
                        username: discordUser.username // Update username just in case
                    };
                } catch {
                    return {
                        ...user,
                        avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
                        username: user.username || 'Unknown Ninja'
                    };
                }
            }));

            // Pass the first 3 users with avatar info, and the full list for the rest of the table
            const imagePath = await generateNinjaLeaderboardImage(topUserAvatars, topUsers);
            const attachment = new AttachmentBuilder(imagePath);
            await interaction.editReply({ files: [attachment] });

            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting leaderboard image:", err);
            });

        } catch (error) {
            console.error("Error in leaderboard command:", error);
            await interaction.editReply({ content: 'An unexpected error occurred while generating the leaderboard.', ephemeral: true });
        }
    },
};

// New and improved leaderboard image generation function
async function generateNinjaLeaderboardImage(top3Avatars, leaderboardData) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Background: Dark, mystical mountain scene ---
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0a0a'); // Very dark top
    bgGradient.addColorStop(0.5, '#1a1a2e'); // Medium-dark
    bgGradient.addColorStop(1, '#2c043e'); // Dark purple bottom
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle mountain range silhouette in the background
    ctx.save();
    ctx.fillStyle = 'rgba(25, 25, 40, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, height - 150);
    ctx.lineTo(width * 0.7, height - 250);
    ctx.lineTo(width * 0.5, height - 180);
    ctx.lineTo(width * 0.3, height - 300);
    ctx.lineTo(0, height - 200);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 50px NinjaFont, sans-serif';
    ctx.fillStyle = '#f8d56b';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText('Ninja Leaderboard', width / 2, 70);
    ctx.shadowBlur = 0;

    // --- Prominent display for the top 3 users ---
    const topPositions = [
        { x: width * 0.5, y: height * 0.35, size: 120, rank: 1, color: '#FFD700' }, // Gold for 1st
        { x: width * 0.25, y: height * 0.45, size: 100, rank: 2, color: '#C0C0C0' }, // Silver for 2nd
        { x: width * 0.75, y: height * 0.45, size: 100, rank: 3, color: '#CD7F32' }  // Bronze for 3rd
    ];

    for (let i = 0; i < top3Avatars.length && i < 3; i++) {
        const user = top3Avatars[i];
        const pos = topPositions[i];

        // Draw rank number
        ctx.font = 'bold 36px NinjaFont, sans-serif';
        ctx.fillStyle = pos.color;
        ctx.textAlign = 'center';
        ctx.fillText(`#${pos.rank}`, pos.x, pos.y - pos.size / 2 - 25);

        // Draw avatar with gradient border
        try {
            const avatarImg = await loadImage(user.avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, pos.x - pos.size / 2, pos.y - pos.size / 2, pos.size, pos.size);
            ctx.restore();

            // Custom border/aura for the top 3
            ctx.save();
            ctx.strokeStyle = pos.color;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2 + 5, 0, Math.PI * 2, true);
            ctx.stroke();
            ctx.restore();
        } catch (e) {
            console.error(`Failed to load avatar for user ${user.id}:`, e);
            // Fallback: draw a placeholder circle
            ctx.fillStyle = pos.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw username and level
        ctx.font = '22px NinjaFont, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(user.username, pos.x, pos.y + pos.size / 2 + 30);

        ctx.font = '18px NinjaFont, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Lvl ${user.level}`, pos.x, pos.y + pos.size / 2 + 55);
    }

    // --- Sleek list for ranks 4-10 ---
    let y = height * 0.65;
    const itemHeight = 45;
    const padding = 20;

    for (let i = 3; i < leaderboardData.length; i++) {
        const user = leaderboardData[i];

        // Draw a minimalist, semi-transparent row background
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#3a3a5a'; // Dark purple-blue background
        roundRect(ctx, padding, y, width - padding * 2, itemHeight, 10);
        ctx.fill();
        ctx.restore();

        // Rank number
        ctx.font = 'bold 24px NinjaFont, sans-serif';
        ctx.fillStyle = '#f8d56b';
        ctx.textAlign = 'left';
        ctx.fillText(`#${i + 1}`, padding + 20, y + itemHeight / 2 + 8);

        // Username
        ctx.font = '20px NinjaFont, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(user.username, padding + 70, y + itemHeight / 2 + 8);

        // Level
        ctx.font = 'bold 18px NinjaFont, sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'right';
        ctx.fillText(`Lvl ${user.level}`, width - padding - 20, y + itemHeight / 2 + 8);

        y += itemHeight + 10;
    }

    // Save the final image to a temporary file
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

// Helper function for drawing rounded rectangles (optimized)
function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
