const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const { updateRequirements } = require('./scroll'); // Assuming this path is correct

// --- Cooldown Map ---
const cooldowns = new Map(); // Stores { userId: lastUsedTimestamp }

// Paths
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const usersJutsuPath = path.resolve(__dirname, '../../menma/data/usersjutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const bloodlinesPath = path.resolve(__dirname, '../../menma/data/bloodlines.json');

// Gamepass IDs (for theme determination)
const GAMEPASS_IDS = {
    DONATOR: '1385640728130097182',
    LEGENDARY_NINJA: '1385640798581952714',
    JINCHURIKI: '1385641469507010640'
};

// Color Themes
const THEMES = {
    DEFAULT: { // For users without premium roles
        primary: '#6e1515',
        secondary: '#302b63',
        accent: '#f8d56b',
        background: ['#0f0c29', '#302b63', '#24243e'],
        isPremium: false
    },
    GREY_BASIC: { // New theme for non-donators
        primary: '#555555', // Grey border/accents
        secondary: '#333333', // Darker grey for sections
        accent: '#AAAAAA', // Lighter grey for text
        background: ['#1a1a1a', '#2a2a2a', '#3a3a3a'], // Grey gradient
        isPremium: false
    },
    DONATOR: {
        primary: '#6e15a8', // Purple
        secondary: '#4a2b63',
        accent: '#d56bf8',
        background: ['#1f0c29', '#4a2b63', '#34243e'],
        flexText: 'DONATOR',
        isPremium: true
    },
    LEGENDARY_NINJA: {
        primary: '#d4af37', // Gold
        secondary: '#63582b',
        accent: '#f8e56b',
        background: ['#2f2c09', '#63582b', '#44423e'],
        flexText: 'LEGENDARY NINJA',
        isPremium: true
    },
    JINCHURIKI: {
        primary: '#a81515', // Red
        secondary: '#632b2b',
        accent: '#f86b6b',
        background: ['#290c0c', '#632b2b', '#3e2424'],
        flexText: 'JINCHURIKI',
        isPremium: true
    },
    BLUE: {
        primary: '#1e90ff',
        secondary: '#274472',
        accent: '#a7c7e7',
        background: ['#0a2740', '#1e90ff', '#274472'],
        isPremium: true
    },
    CYAN_MIX: {
        primary: '#00e6d3',
        secondary: '#00bfae',
        accent: '#aaffec',
        background: ['#0f3d3e', '#00e6d3', '#aaffec'],
        isPremium: true
    },
    GREEN: {
        primary: '#22c55e',
        secondary: '#166534',
        accent: '#86efac',
        background: ['#052e16', '#22c55e', '#166534'],
        isPremium: true
    },
    ORANGE: {
        primary: '#f97316',
        secondary: '#9a3412',
        accent: '#fdba74',
        background: ['#431407', '#f97316', '#9a3412'],
        isPremium: true
    },
    FROST_ROYAL: {
        primary: '#e0f2fe',
        secondary: '#0c4a6e',
        accent: '#f0f9ff',
        background: ['#082f49', '#0c4a6e', '#1e3a5f'],
        flexText: '❄❄',
        isPremium: true,
        isWinter: true
    }
};

const BLOODLINES = {
    Uchiha: { title: 'Sharingan', description: 'Unlocks the Sharinga, Uchiha clans trademark.' },
    Hyuga: { title: 'Byakugan', description: 'Has the ability to attack pressure points and drain chakra.' },
    Uzumaki: { title: 'Uzumaki Will', description: 'Plot armor bloodline.' },
    Senju: { title: 'Hyper Regeneration', description: 'Grants incredible healing effects.' },
    Nara: { title: 'Battle IQ', description: 'Nobody beats a nara when its about battle iq.' }
};

// Register fonts
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
        // --- Cooldown Logic Start ---
        const COOLDOWN_SECONDS = 3;
        const currentTime = Date.now();
        const commandInvokerId = interaction.user.id;

        if (cooldowns.has(commandInvokerId)) {
            const lastUsed = cooldowns.get(commandInvokerId);
            const timeElapsed = currentTime - lastUsed;
            const timeLeft = (COOLDOWN_SECONDS * 1000) - timeElapsed;

            if (timeLeft > 0) {
                const secondsLeft = Math.ceil(timeLeft / 1000);
                return await interaction.reply({
                    content: `You need to wait ${secondsLeft} more second(s) before using the \`/profile\` command again.`,
                    ephemeral: true
                });
            }
        }
        cooldowns.set(commandInvokerId, currentTime);
        // --- Cooldown Logic End ---

        // --- Timeout Logic Start ---
        let interactionFinished = false;
        const timeout = setTimeout(async () => {
            if (!interactionFinished) {
                interactionFinished = true;
                try {
                    await interaction.editReply({ content: "Profile request expired (took too long).", files: [], components: [] });
                } catch { }
            }
        }, 15000);
        // --- Timeout Logic End ---

        try {
            // Defer reply immediately to prevent "Interaction has already been acknowledged."
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const isSelfView = targetUser.id === commandInvokerId;

            if (!fs.existsSync(usersPath)) {
                return await interaction.editReply({ content: "Database not found." });
            }

            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            let userProfileData = usersData[targetUser.id];
            const jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
            const usersJutsu = fs.existsSync(usersJutsuPath) ? JSON.parse(fs.readFileSync(usersJutsuPath, 'utf8')) : {};
            const bloodlines = fs.existsSync(bloodlinesPath) ? JSON.parse(fs.readFileSync(bloodlinesPath, 'utf8')) : {};

            // Load players.json for level, exp, money, ramen, SS
            const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
            const playersData = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
            const playerStats = playersData[targetUser.id] || {};

            // --- ENROLL CHECK ---
            if (!userProfileData) {
                await interaction.editReply({
                    content: "Not enrolled. Please use `/enroll` to create your ninja profile.",
                    files: [],
                    components: []
                });
                if (!interactionFinished) {
                    interactionFinished = true;
                    clearTimeout(timeout);
                }
                return;
            }

            // --- Handle Jinchuriki Chakra Override ---
            // allow handler to return an updated user object (reflecting chakra change)
            const updatedUser = await handleJinchurikiChakra(targetUser.id, userProfileData);
            if (updatedUser) {
                userProfileData = updatedUser; // refresh in-memory profile for rendering
            }

            // --- Determine theme with admin command priority ---
            const theme = determineTheme(userProfileData);

            // --- Generate main profile page only ---
            let imageError = false;
            let imageBuffer;
            try {
                imageBuffer = await generateMainProfilePage(targetUser, userProfileData, playerStats, theme, jutsuList, usersJutsu, isSelfView);
            } catch (err) {
                imageError = true;
                console.error("Error generating profile image:", err);
            }

            if (imageError) {
                await interaction.editReply({
                    content: "Failed to generate profile image. Please try again later.",
                    files: [],
                    components: []
                });
                if (!interactionFinished) {
                    interactionFinished = true;
                    clearTimeout(timeout);
                }
                return;
            }

            await interaction.editReply({
                content: `${targetUser.username}'s Ninja Card`,
                files: [new AttachmentBuilder(imageBuffer, { name: 'profile.png' })]
            });

            // --- Timeout clear ---
            if (!interactionFinished) {
                interactionFinished = true;
                clearTimeout(timeout);
            }
        } catch (error) {
            console.error('Error generating profile card:', error);
            cooldowns.delete(commandInvokerId);
            await interaction.editReply({
                content: "An error occurred while generating the profile card. Please try again later.",
                files: [],
                components: []
            });
            if (!interactionFinished) {
                interactionFinished = true;
                clearTimeout(timeout);
            }
        }
    }
};

// Handle Jinchuriki chakra override
async function handleJinchurikiChakra(userId, userProfileData) {
    const usersDataPath = path.resolve(__dirname, '../../menma/data/users.json');
    let usersData = {};
    try {
        usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
    } catch (e) {
        console.error('Error reading users data:', e);
        return null;
    }

    if (!usersData[userId]) return null;

    const hasJinchuriki = userProfileData &&
        Array.isArray(userProfileData.premiumRoles) &&
        userProfileData.premiumRoles.some(role => role.roleId === GAMEPASS_IDS.JINCHURIKI);

    let needsUpdate = false;

    if (hasJinchuriki) {
        if (usersData[userId].chakra !== 15) {
            usersData[userId].chakra = 15;
            needsUpdate = true;
        }
    } else {
        if (usersData[userId].chakra > 10) {
            usersData[userId].chakra = 10;
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        try {
            fs.writeFileSync(usersDataPath, JSON.stringify(usersData, null, 2));
            // return the updated user object so caller can refresh its in-memory copy
            return usersData[userId];
        } catch (e) {
            console.error('Error writing users data:', e);
            return null;
        }
    }

    // no changes, but return the current user object for consistency
    return usersData[userId] || null;
}

// Helper function to determine user's theme with admin command priority
function determineTheme(userProfileData) {
    // Check if admin has set a custom color (highest priority)
    if (userProfileData.profileColor) {
        const color = userProfileData.profileColor;
        if (color === 'blue') return THEMES.BLUE;
        if (color === 'cyan') return THEMES.CYAN_MIX;
        if (color === 'donator') return THEMES.DONATOR;
        if (color === 'legendary') return THEMES.LEGENDARY_NINJA;
        if (color === 'jinchuriki') return THEMES.JINCHURIKI;
        if (color === 'grey') return THEMES.GREY_BASIC;
        if (color === 'default') return THEMES.DEFAULT;
        if (color === 'green') return THEMES.GREEN;
        if (color === 'orange') return THEMES.ORANGE;
        if (color === 'frost') return THEMES.FROST_ROYAL;
    }

    // If no admin color, check gamepass roles
    const userRoles = userProfileData.premiumRoles || [];

    const hasJinchuriki = userRoles.some(role => role.roleId === GAMEPASS_IDS.JINCHURIKI);
    if (hasJinchuriki) return THEMES.JINCHURIKI;

    const hasLegendaryNinja = userRoles.some(role => role.roleId === GAMEPASS_IDS.LEGENDARY_NINJA);
    if (hasLegendaryNinja) return THEMES.LEGENDARY_NINJA;

    const hasDonator = userRoles.some(role => role.roleId === GAMEPASS_IDS.DONATOR);
    if (hasDonator) return THEMES.DONATOR;

    return THEMES.GREY_BASIC; // Default to basic grey for non-donators
}

// Generate main profile page with improved text alignment
async function generateMainProfilePage(targetUser, userProfileData, playerStats, theme, jutsuList, usersJutsu, isSelfView) {
    const bloodlineName = userProfileData.bloodline || 'None';
    const bloodlineData = BLOODLINES[bloodlineName] || {};
    const bloodlineTitle = bloodlineData.title || 'No bloodline awakened';
    const bloodlineDescription = bloodlineData.description || 'No bloodline awakened';

    // Use targetUser.id for usersJutsu lookup
    const equippedJutsu = Object.values(userProfileData.jutsu || {})
        .filter(jutsu => jutsu && jutsu !== 'Attack' && jutsu !== 'None')
        .map(jutsu => jutsuList[jutsu]?.name || jutsu);

    const learnedJutsu = usersJutsu[targetUser.id]?.usersjutsu || [];

    const canvas = createCanvas(600, 900);
    const ctx = canvas.getContext('2d');

    // Background gradient or solid grey
    if (theme.isPremium) {
        const gradient = ctx.createLinearGradient(0, 0, 600, 900);
        gradient.addColorStop(0, theme.background[0]);
        gradient.addColorStop(0.5, theme.background[1]);
        gradient.addColorStop(1, theme.background[2]);
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = theme.background[0];
    }
    ctx.fillRect(0, 0, 600, 900);

    // --- Sparkling Effects (for premium themes) ---
    if (theme.isPremium) {
        if (theme.isWinter) {
            // === WINTER FROST ROYAL EFFECTS ===
            
            // 1. Falling Snowflakes (animated look)
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 3 + 1;
                const alpha = Math.random() * 0.8 + 0.2;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.random() * Math.PI * 2);
                
                // Draw 6-armed snowflake
                for (let j = 0; j < 6; j++) {
                    ctx.rotate(Math.PI / 3);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -size * 2);
                    ctx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    
                    // Side branches
                    ctx.beginPath();
                    ctx.moveTo(0, -size);
                    ctx.lineTo(-size * 0.5, -size * 1.5);
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size * 0.5, -size * 1.5);
                    ctx.stroke();
                }
                ctx.restore();
            }
            
            // 2. Icy Diamond Crystals
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 4 + 2;
                const alpha = Math.random() * 0.4 + 0.1;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.random() * Math.PI);
                
                // Diamond crystal shape
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size * 0.6, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size * 0.6, 0);
                ctx.closePath();
                
                const crystalGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
                crystalGradient.addColorStop(0, `rgba(240, 249, 255, ${alpha * 1.5})`);
                crystalGradient.addColorStop(1, `rgba(224, 242, 254, ${alpha * 0.3})`);
                ctx.fillStyle = crystalGradient;
                ctx.fill();
                
                ctx.strokeStyle = `rgba(240, 249, 255, ${alpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.restore();
            }
            
            // 3. Frost Shimmer Effect (large glowing particles)
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 3 + 2;
                const alpha = Math.random() * 0.3 + 0.1;
                
                const shimmerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
                shimmerGradient.addColorStop(0, `rgba(224, 242, 254, ${alpha * 2})`);
                shimmerGradient.addColorStop(0.5, `rgba(224, 242, 254, ${alpha})`);
                shimmerGradient.addColorStop(1, `rgba(224, 242, 254, 0)`);
                
                ctx.fillStyle = shimmerGradient;
                ctx.beginPath();
                ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
        } else {
            // Regular sparkles for other premium themes
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 1.5 + 0.5;
                const alpha = Math.random() * 0.6 + 0.2;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2, false);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            }
        }
    }

    // --- Flex Perk Background Text ---
    if (theme.isPremium && theme.flexText) {
        ctx.save();
        ctx.font = 'bold 80px Arial';
        ctx.fillStyle = `rgba(${hexToRgb(theme.accent)}, 0.03)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 8);
        const text = theme.flexText;
        const repeatCount = 5;
        const spacing = 100;
        for (let i = -repeatCount; i <= repeatCount; i++) {
            ctx.fillText(text, 0, i * spacing);
        }
        ctx.restore();
    }

    // Header section
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 600, 220);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 600, 220);

    // Center avatar in header
    try {
        let avatarUrl;
        if (targetUser.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png?size=256`;
        } else {
            const defaultAvatarNumber = parseInt(targetUser.discriminator) % 5;
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }
        let avatar;
        try {
            avatar = await loadImageWithRetry(avatarUrl);
        } catch (err) {
            console.error('Error loading avatar:', err);
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
            ctx.strokeStyle = theme.primary;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(300, 90, 75, 0, Math.PI * 2, true);
            ctx.stroke();
        }
    } catch (err) {
        console.error('Error in avatar drawing block:', err);
    }

    // Username (centered under avatar)
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 5;
    ctx.fillText(targetUser.username, 300, 190);
    ctx.shadowBlur = 0;

    // Rank (centered)
    ctx.font = '18px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(userProfileData.rank || 'Academy Student', 300, 215);

    // Bloodline (centered)
    ctx.font = '16px Arial';
    ctx.fillStyle = '#000000ff';
    ctx.fontStyle = 'italic';
    ctx.fillText(bloodlineName, 300, 235);
    ctx.fontStyle = 'normal';

    // Bloodline section
    drawSection(ctx, 15, 250, 570, 100, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('BLOODLINE ABILITY', 30, 275);

    // Bloodline description
    ctx.fillStyle = '#cccccc';
    ctx.font = 'italic 14px Arial';
    wrapText(ctx, bloodlineTitle, 30, 295, 540, 24);

    // Level progression section
    drawSection(ctx, 15, 365, 570, 100, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('LEVEL PROGRESSION', 30, 390);

    // Function to calculate EXP requirement for the next level
    function getExpRequirement(currentLevel) {
        if (currentLevel < 1) return 2;
        if (currentLevel < 50) return (1 + currentLevel) * 2;
        if (currentLevel < 100) return (1 + currentLevel) * 3;
        if (currentLevel < 200) return (1 + currentLevel) * 4;
        return (1 + currentLevel) * 5;
    }

    const level = playerStats.level || 1;
    const exp = playerStats.exp || 0;
    const nextLevelExp = getExpRequirement(level);
    const xpPercentage = Math.min(1, exp / nextLevelExp);

    // Level and XP with improved alignment
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px Arial';
    ctx.fillText('Level:', 30, 415);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(level.toString(), 80, 415);

    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('XP:', 30, 435);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${exp}/${nextLevelExp}`, 80, 435);

    // XP Bar
    ctx.fillStyle = '#333333';
    ctx.fillRect(30, 445, 540, 10);
    const xpGradient = ctx.createLinearGradient(30, 445, 570, 445);
    xpGradient.addColorStop(0, theme.primary);
    xpGradient.addColorStop(1, theme.accent);
    ctx.fillStyle = xpGradient;
    ctx.fillRect(30, 445, 540 * xpPercentage, 10);

    // Battle stats section (Only for self-view)
    if (isSelfView) {
        drawSection(ctx, 15, 480, 570, 120, theme.primary);
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 18px Arial';
        ctx.fillText('BATTLE STATS', 30, 505);

        // Stats grid with improved alignment
        const stats = [
            { name: 'Health:', value: userProfileData.health || 100 },
            { name: 'Power:', value: userProfileData.power || 10 },
            { name: 'Defense:', value: userProfileData.defense || 10 },
            { name: 'Chakra:', value: userProfileData.chakra || 10 }
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
    }

    // Battle record section
    const battleRecordY = isSelfView ? 615 : 480;
    drawSection(ctx, 15, battleRecordY, 570, 90, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('BATTLE RECORD', 30, battleRecordY + 25);

    const records = [
        { name: 'Wins:', value: userProfileData.wins || 0 },
        { name: 'Losses:', value: userProfileData.losses || 0 },
        { name: 'Ranked:', value: userProfileData.rankedPoints || 0 }
    ];

    records.forEach((record, i) => {
        const x = 30 + (i * 180);
        const y = battleRecordY + 50;

        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(record.name, x, y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(record.value.toString(), x + 70, y);
    });

    // Money, Ramen, SS section
    const moneySectionY = battleRecordY + 110;
    drawSection(ctx, 15, moneySectionY, 570, 90, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('INVENTORY', 30, moneySectionY + 25);

    // Use playerStats for money, ramen, SS with improved alignment
    const money = playerStats.money || 0;
    const ramen = playerStats.ramen || 0;
    const ss = playerStats.ss || playerStats.SS || 0;

    const invs = [
        { name: 'Money:', value: money },
        { name: 'Ramen:', value: ramen },
        { name: 'SS:', value: ss }
    ];

    invs.forEach((item, i) => {
        const x = 30 + (i * 180);
        const y = moneySectionY + 55;
        ctx.font = '18px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'left';
        ctx.fillText(item.name, x, y);

        // Align value right after the label with consistent padding
        const labelWidth = ctx.measureText(item.name).width;
        const valueX = x + labelWidth + 10;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(item.value.toString(), valueX, y);
    });

    return canvas.toBuffer('image/png');
}

// Helper functions
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
    
    // Add crystalline effect for frost theme
    if (borderColor === '#e0f2fe') {  // Frost Royal primary color
        // Inner glow
        ctx.strokeStyle = 'rgba(240, 249, 255, 0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.stroke();
        
        // Outer glow
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.stroke();
        
        // Add small ice crystals on corners
        const corners = [
            {x: x + 15, y: y + 15},
            {x: x + width - 15, y: y + 15},
            {x: x + 15, y: y + height - 15},
            {x: x + width - 15, y: y + height - 15}
        ];
        
        corners.forEach(corner => {
            ctx.save();
            ctx.translate(corner.x, corner.y);
            ctx.rotate(Math.PI / 4);
            
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(2, 0);
            ctx.lineTo(0, 3);
            ctx.lineTo(-2, 0);
            ctx.closePath();
            
            ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(240, 249, 255, 0.8)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
        });
    }
}

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

async function loadImageWithRetry(url) {
    try {
        return await loadImage(url);
    } catch (error) {
        try {
            const jpgUrl = url.replace(/\.png(\?.*)?$/, '.jpg$1');
            return await loadImage(jpgUrl);
        } catch (error2) {
            throw error2;
        }
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
        '110, 21, 21';
}