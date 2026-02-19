const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register fonts
try {
    registerFont(path.join(__dirname, '../fonts/ninjafont.ttf'), { family: 'NinjaFont' });
    registerFont(path.join(__dirname, '../fonts/ninjafont-bold.ttf'), { family: 'NinjaFont', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom fonts. Using system defaults.');
}

// Theme Configuration
const LEADERBOARD_THEMES = {
    STRONGEST: {
        name: 'STRONGEST NINJAS',
        statLabel: 'Level',
        statKey: 'level',
        background: ['#0a0a0a', '#1a1a2e', '#2c043e'],
        primary: '#f8d56b',
        secondary: '#302b63',
        accent: '#f8d56b'
    },
    RICHEST: {
        name: 'THE RICHEST IN THE WORLD',
        statLabel: 'Ryo',
        statKey: 'money',
        background: ['#0a0a0a', '#1a1a2e', '#2c043e'],
        primary: '#f8d56b',
        secondary: '#302b63',
        accent: '#f8d56b'
    },
    SHARDS: {
        name: 'SHINOBI SHARDS',
        statLabel: 'SS',
        statKey: 'ss',
        background: ['#0a0a0a', '#1a1a2e', '#2c043e'],
        primary: '#f8d56b',
        secondary: '#302b63',
        accent: '#f8d56b'
    },
    HUNGRIEST: {
        name: 'HUNGRIEST MAN ALIVE',
        statLabel: 'Ramen Consumed',
        statKey: 'ramen',
        background: ['#0a0a0a', '#1a1a2e', '#2c043e'],
        primary: '#f8d56b',
        secondary: '#302b63',
        accent: '#f8d56b'
    },
    RAGING_DEMON: {
        name: 'THE RAGING DEMON',
        statLabel: 'Wins',
        statKey: 'wins',
        background: ['#0a0a0a', '#1a1a2e', '#2c043e'],
        primary: '#f8d56b',
        secondary: '#302b63',
        accent: '#f8d56b'
    }
};

// Cooldown management
const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display various ninja leaderboards')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Select leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Strongest Ninjas', value: 'strongest' },
                    { name: 'Richest in World (Ryo)', value: 'richest' },
                    { name: 'Shinobi Shards (SS)', value: 'shards' },
                    { name: 'Hungriest Man Alive', value: 'hungriest' },
                    { name: 'Raging Demon (Wins)', value: 'raging_demon' }
                )),
    async execute(interaction) {
        // Cooldown check
        const COOLDOWN_SECONDS = 5;
        const currentTime = Date.now();
        const userId = interaction.user.id;

        if (cooldowns.has(userId)) {
            const lastUsed = cooldowns.get(userId);
            const timeElapsed = currentTime - lastUsed;
            const timeLeft = (COOLDOWN_SECONDS * 1000) - timeElapsed;

            if (timeLeft > 0) {
                const secondsLeft = Math.ceil(timeLeft / 1000);
                return await interaction.reply({
                    content: `Please wait ${secondsLeft} more second(s) before using this command again.`,
                    ephemeral: true
                });
            }
        }
        cooldowns.set(userId, currentTime);

        await interaction.deferReply();

        try {
            const leaderboardType = interaction.options.getString('type') || 'strongest';

            // Create buttons for navigation
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('strongest')
                        .setLabel('Strongest')
                        .setStyle(leaderboardType === 'strongest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('richest')
                        .setLabel('Richest')
                        .setStyle(leaderboardType === 'richest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('shards')
                        .setLabel('Shards')
                        .setStyle(leaderboardType === 'shards' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('hungriest')
                        .setLabel('Hungriest')
                        .setStyle(leaderboardType === 'hungriest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('raging_demon')
                        .setLabel('Wins')
                        .setStyle(leaderboardType === 'raging_demon' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );

            const imageBuffer = await generateLeaderboardImage(leaderboardType, interaction.client);
            const attachment = new AttachmentBuilder(imageBuffer, { name: `${leaderboardType}_leaderboard.png` });

            const message = await interaction.editReply({
                files: [attachment],
                components: [row]
            });

            // Create button interaction collector
            const collector = message.createMessageComponentCollector({
                time: 60000
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'These buttons are not for you!',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                try {
                    const newImageBuffer = await generateLeaderboardImage(i.customId, interaction.client);
                    const newAttachment = new AttachmentBuilder(newImageBuffer, {
                        name: `${i.customId}_leaderboard.png`
                    });

                    // Update buttons
                    const newRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('strongest')
                                .setLabel('Strongest')
                                .setStyle(i.customId === 'strongest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('richest')
                                .setLabel('Richest')
                                .setStyle(i.customId === 'richest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('shards')
                                .setLabel('Shards')
                                .setStyle(i.customId === 'shards' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('hungriest')
                                .setLabel('Hungriest')
                                .setStyle(i.customId === 'hungriest' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('raging_demon')
                                .setLabel('Wins')
                                .setStyle(i.customId === 'raging_demon' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        );

                    await i.editReply({
                        files: [newAttachment],
                        components: [newRow]
                    });
                } catch (error) {
                    console.error('Error updating leaderboard:', error);
                    await i.editReply({
                        content: 'Error updating leaderboard. Please try again.',
                        components: []
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({ components: [] });
                } catch (error) {
                    console.error('Error removing buttons:', error);
                }
            });

        } catch (error) {
            console.error("Error in leaderboard command:", error);
            cooldowns.delete(userId);
            await interaction.editReply({
                content: 'An unexpected error occurred while generating the leaderboard.',
                components: []
            });
        }
    },
};

// Load leaderboard data
async function loadLeaderboardData(statType) {
    const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
    const playersPath = path.resolve(__dirname, '../../menma/data/players.json');

    if (!fs.existsSync(usersPath)) return [];

    try {
        const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const playersData = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        const allUsers = [];

        for (const id in usersData) {
            const user = usersData[id];
            const player = playersData[id] || {};
            let value, displayValue;

            switch (statType) {
                case 'richest':
                    value = player.money || 0;
                    displayValue = `${value.toLocaleString()} Ryo`;
                    break;
                case 'shards':
                    value = player.ss || player.SS || 0;
                    displayValue = `${value.toLocaleString()} SS`;
                    break;
                case 'hungriest':
                    value = player.ramen || 0;
                    displayValue = `${value} 🍜`;
                    break;
                case 'raging_demon':
                    value = user.wins || 0;
                    displayValue = `${value} Wins`;
                    break;
                case 'strongest':
                default:
                    value = user.level || 1;
                    displayValue = `Lvl ${value}`;
                    break;
            }

            if (value > 0 || statType === 'strongest') {
                allUsers.push({
                    id,
                    username: user.username || 'Unknown Ninja',
                    value,
                    displayValue,
                    avatarUrl: user.avatar ?
                        `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=256` :
                        `https://cdn.discordapp.com/embed/avatars/${parseInt(id.slice(-1)) % 5}.png`
                });
            }
        }

        allUsers.sort((a, b) => b.value - a.value);
        return allUsers.slice(0, 10);
    } catch (error) {
        console.error(`Error reading ${statType} leaderboard data:`, error);
        return [];
    }
}

// Main image generation function
async function generateLeaderboardImage(type, client) {
    const theme = LEADERBOARD_THEMES[type.toUpperCase()] || LEADERBOARD_THEMES.STRONGEST;
    const statType = type;

    let leaderboardData = await loadLeaderboardData(statType);

    if (leaderboardData.length === 0) {
        return await generateEmptyLeaderboard(theme);
    }

    // Resolve avatars and usernames
    const usersWithResolvedData = await Promise.all(
        leaderboardData.map(async (user) => {
            try {
                let finalAvatarUrl = user.avatarUrl;
                let resolvedUsername = user.username;

                const discordUser = await client.users.fetch(user.id).catch(() => null);

                if (discordUser) {
                    finalAvatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 256 });
                    resolvedUsername = discordUser.username;
                }

                return {
                    ...user,
                    username: resolvedUsername,
                    avatarUrl: finalAvatarUrl
                };
            } catch {
                return user;
            }
        })
    );

    return await generateNinjaLeaderboardImage(usersWithResolvedData, theme);
}

// Image generation following oldlb.js style
async function generateNinjaLeaderboardImage(leaderboardData, theme) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, theme.background[0]);
    bgGradient.addColorStop(0.5, theme.background[1]);
    bgGradient.addColorStop(1, theme.background[2]);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Mountain silhouette
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

    // Title
    ctx.font = 'bold 50px NinjaFont, sans-serif';
    ctx.fillStyle = theme.primary;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(theme.name, width / 2, 70);
    ctx.shadowBlur = 0;

    // Top 3 positions
    const topPositions = [
        { x: width * 0.5, y: height * 0.35, size: 120, rank: 1, color: '#FFD700' },
        { x: width * 0.25, y: height * 0.45, size: 100, rank: 2, color: '#C0C0C0' },
        { x: width * 0.75, y: height * 0.45, size: 100, rank: 3, color: '#CD7F32' }
    ];

    // Draw top 3
    for (let i = 0; i < Math.min(3, leaderboardData.length); i++) {
        const user = leaderboardData[i];
        const pos = topPositions[i];

        // Rank number
        ctx.font = 'bold 36px NinjaFont, sans-serif';
        ctx.fillStyle = pos.color;
        ctx.textAlign = 'center';
        ctx.fillText(`#${pos.rank}`, pos.x, pos.y - pos.size / 2 - 25);

        // Avatar
        try {
            const avatarImg = await loadImage(user.avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, pos.x - pos.size / 2, pos.y - pos.size / 2, pos.size, pos.size);
            ctx.restore();

            // Border
            ctx.save();
            ctx.strokeStyle = pos.color;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2 + 5, 0, Math.PI * 2, true);
            ctx.stroke();
            ctx.restore();
        } catch (e) {
            console.error(`Failed to load avatar for user ${user.id}:`, e);
            ctx.fillStyle = pos.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Username and value
        ctx.font = '22px NinjaFont, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(user.username, pos.x, pos.y + pos.size / 2 + 30);

        ctx.font = '18px NinjaFont, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(user.displayValue, pos.x, pos.y + pos.size / 2 + 55);
    }

    // List for ranks 4-10
    let y = height * 0.65;
    const itemHeight = 45;
    const padding = 20;

    for (let i = 3; i < leaderboardData.length; i++) {
        const user = leaderboardData[i];

        // Row background
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#3a3a5a';
        roundRect(ctx, padding, y, width - padding * 2, itemHeight, 10);
        ctx.fill();
        ctx.restore();

        // Rank number
        ctx.font = 'bold 24px NinjaFont, sans-serif';
        ctx.fillStyle = theme.primary;
        ctx.textAlign = 'left';
        ctx.fillText(`#${i + 1}`, padding + 20, y + itemHeight / 2 + 8);

        // Username
        ctx.font = '20px NinjaFont, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(user.username, padding + 70, y + itemHeight / 2 + 8);

        // Value
        ctx.font = 'bold 18px NinjaFont, sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'right';
        ctx.fillText(user.displayValue, width - padding - 20, y + itemHeight / 2 + 8);

        y += itemHeight + 10;
    }

    return canvas.toBuffer('image/png');
}

// Empty leaderboard
async function generateEmptyLeaderboard(theme) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, theme.background[0]);
    bgGradient.addColorStop(0.5, theme.background[1]);
    bgGradient.addColorStop(1, theme.background[2]);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 50px NinjaFont, sans-serif';
    ctx.fillStyle = theme.primary;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(theme.name, width / 2, 70);
    ctx.shadowBlur = 0;

    // Empty message
    ctx.font = 'bold 36px NinjaFont, sans-serif';
    ctx.fillStyle = theme.accent;
    ctx.fillText('No warriors found...', width / 2, height / 2);

    ctx.font = '24px NinjaFont, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Be the first to claim your spot!', width / 2, height / 2 + 50);

    return canvas.toBuffer('image/png');
}

// Helper function for rounded rectangles
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