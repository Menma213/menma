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
        primary: '#6e1515', // This will be ignored for non-donators, but kept for structure
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
        )
        .addStringOption(option =>
            option.setName('page')
                .setDescription('Which profile page to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Main', value: 'main' },
                    { name: 'Ranked', value: 'ranked' }
                )
        ),
    async execute(interaction) {
        // --- Cooldown Logic Start ---
        const COOLDOWN_SECONDS = 30;
        const currentTime = Date.now();
        const commandInvokerId = interaction.user.id; // The user who ran the command

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
                } catch {}
            }
        }, 15000);
        // --- Timeout Logic End ---

        try {
            // Defer reply immediately to prevent "Interaction has already been acknowledged."
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const isSelfView = targetUser.id === commandInvokerId;
            const page = interaction.options.getString('page') || 'main';

            if (!fs.existsSync(usersPath)) {
                return await interaction.editReply({ content: "Database not found." });
            }

            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const userProfileData = usersData[targetUser.id];
            const jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
            const usersJutsu = fs.existsSync(usersJutsuPath) ? JSON.parse(fs.readFileSync(usersJutsuPath, 'utf8')) : {};
            const bloodlines = fs.existsSync(bloodlinesPath) ? JSON.parse(fs.readFileSync(bloodlinesPath, 'utf8')) : {};


            // --- Fetch custom profile color if set ---
            let customTheme = null;
            if (userProfileData && userProfileData.profileColor) {
                const color = userProfileData.profileColor;
                if (color === 'blue') customTheme = THEMES.BLUE;
                else if (color === 'cyan') customTheme = THEMES.CYAN_MIX;
                else if (color === 'donator') customTheme = THEMES.DONATOR;
                else if (color === 'legendary') customTheme = THEMES.LEGENDARY_NINJA;
                else if (color === 'jinchuriki') customTheme = THEMES.JINCHURIKI;
                else if (color === 'grey') customTheme = THEMES.GREY_BASIC;
                else if (color === 'default') customTheme = THEMES.DEFAULT;
            }
            const theme = customTheme || determineTheme(userProfileData);

            // --- Robust image generation with fallback ---
            let imageError = false;
            let imageBuffer;
            try {
                if (page === 'main') {
                    imageBuffer = await generateMainProfilePage(targetUser, userProfileData, theme, jutsuList, usersJutsu, isSelfView);
                } else {
                    imageBuffer = await generateRankedProfilePage(targetUser, userProfileData, theme, isSelfView);
                }
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
                content: `${targetUser.username}'s Ninja Card${page === 'ranked' ? ' (Ranked)' : ''}`,
                files: [new AttachmentBuilder(imageBuffer, { name: 'profile.png' })]
            });

            if (isSelfView) {
                await updateRequirements(commandInvokerId, 'profile_check');
            }

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

// Helper function to determine user's theme based on premium roles
// 'user' here is the userProfileData (the target user's data)
function determineTheme(userProfileData) {
    // Assuming userProfileData.premiumRoles is an array of objects like { roleId: '...' }
    // or just an array of role IDs. Adjust 'role.roleId' if it's just 'role'.
    const userRoles = userProfileData.premiumRoles || [];

    const hasJinchuriki = userRoles.some(role => role.roleId === GAMEPASS_IDS.JINCHURIKI);
    if (hasJinchuriki) return THEMES.JINCHURIKI;

    const hasLegendaryNinja = userRoles.some(role => role.roleId === GAMEPASS_IDS.LEGENDARY_NINJA);
    if (hasLegendaryNinja) return THEMES.LEGENDARY_NINJA;

    const hasDonator = userRoles.some(role => role.roleId === GAMEPASS_IDS.DONATOR);
    if (hasDonator) return THEMES.DONATOR;

    return THEMES.GREY_BASIC; // Default to basic grey for non-donators
}

// Generate main profile page
async function generateMainProfilePage(targetUser, userProfileData, theme, jutsuList, usersJutsu, isSelfView) {
    const bloodlineName = userProfileData.bloodline || 'None';
    const bloodlineData = BLOODLINES[bloodlineName] || {};
    const bloodlineTitle = bloodlineData.title || 'No bloodline awakened';
    const bloodlineDescription = bloodlineData.description || 'No bloodline awakened';

    // Use targetUser.id for usersJutsu lookup
    const equippedJutsu = Object.values(userProfileData.jutsu || {})
        .filter(jutsu => jutsu && jutsu !== 'Attack' && jutsu !== 'None')
        .map(jutsu => jutsuList[jutsu]?.name || jutsu);

    const learnedJutsu = usersJutsu[targetUser.id]?.usersjutsu || []; // Use targetUser.id here

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

    // --- Flex Perk Background Text (keep as is, for extra effect) ---
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

    // Center avatar in header (restore old style)
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
    ctx.fillStyle = '#6eaff8';
    ctx.fontStyle = 'italic';
    ctx.fillText(bloodlineName, 300, 235);
    ctx.fontStyle = 'normal';

    // Bloodline section (Always display)
    drawSection(ctx, 15, 250, 570, 100, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('BLOODLINE ABILITY', 30, 275);

    // Bloodline description
    ctx.fillStyle = '#cccccc';
    ctx.font = 'italic 14px Arial';
    wrapText(ctx, bloodlineTitle, 30, 295, 540, 24);


    // Level progression section (Always display)
    drawSection(ctx, 15, 365, 570, 100, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('LEVEL PROGRESSION', 30, 390);

    // Use the same EXP requirement formula as in levelup.js
    function getExpRequirement(currentLevel) {
        if (currentLevel < 1) return 2;
        return Math.ceil(1.1 ** currentLevel);
    }
    const level = userProfileData.level || 1;
    const exp = userProfileData.exp || 0;
    const nextLevelExp = getExpRequirement(level);
    const xpPercentage = Math.min(1, exp / nextLevelExp);

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
    xpGradient.addColorStop(0, theme.primary);
    xpGradient.addColorStop(1, theme.accent);
    ctx.fillStyle = xpGradient;
    ctx.fillRect(30, 445, 540 * xpPercentage, 10);

    // --- Jinchuriki Chakra Override ---
    let chakra = userProfileData.chakra || 10;
    const usersDataPath = path.resolve(__dirname, '../../menma/data/users.json');
    let usersData = {};
    try {
        usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
    } catch (e) {
        // fallback: do nothing, just use memory
    }
    const hasJinchuriki = userProfileData &&
        Array.isArray(userProfileData.premiumRoles) &&
        userProfileData.premiumRoles.some(role => role.roleId === GAMEPASS_IDS.JINCHURIKI);

    if (usersData[targetUser.id]) {
        if (hasJinchuriki) {
            if (usersData[targetUser.id].chakra !== 15) {
                usersData[targetUser.id].chakra = 15;
                fs.writeFileSync(usersDataPath, JSON.stringify(usersData, null, 2));
            }
            chakra = 15;
        } else {
            if (usersData[targetUser.id].chakra !== 10) {
                usersData[targetUser.id].chakra = 10;
                fs.writeFileSync(usersDataPath, JSON.stringify(usersData, null, 2));
            }
            chakra = 10;
        }
    }

    // Battle stats section (Only for self-view)
    if (isSelfView) {
        drawSection(ctx, 15, 480, 570, 120, theme.primary);
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 18px Arial';
        ctx.fillText('BATTLE STATS', 30, 505);

        // Stats grid
        const stats = [
            { name: 'Health:', value: userProfileData.health || 100 },
            { name: 'Power:', value: userProfileData.power || 10 },
            { name: 'Defense:', value: userProfileData.defense || 10 },
            { name: 'Chakra:', value: chakra }
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

    // Battle record section (Always display)
    // Adjust Y position if Battle Stats section is hidden
    const battleRecordY = isSelfView ? 615 : 480; // If battle stats hidden, move up
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
        ctx.fillText(record.value.toString(), x + 78, y);
    });

    // --- Money, Ramen, SS section (new, after all categories) ---
    // Place after battle record, with same alignment and style
    const moneySectionY = battleRecordY + 110;
    drawSection(ctx, 15, moneySectionY, 570, 90, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('INVENTORY', 30, moneySectionY + 25);

    // Money, Ramen, SS values from userProfileData
    const money = userProfileData.money || 0;
    const ramen = userProfileData.ramen || 0;
    const ss = userProfileData.ss || 0;

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

        // Align value right after the label with a fixed padding
        const labelWidth = ctx.measureText(item.name).width;
        const valueX = x + labelWidth + 10; // 10px padding after label
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(item.value.toString(), valueX, y);
    });

    return canvas.toBuffer('image/png');
}

// Generate ranked profile page
async function generateRankedProfilePage(targetUser, userProfileData, theme, isSelfView) {
    const bloodlineName = userProfileData.bloodline || 'None';
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

    // --- Flex Perk Background Text (keep as is, for extra effect) ---
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

    // Center avatar in header (restore old style)
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

    // Rank title (centered)
    ctx.font = '18px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText('Ranked Profile', 300, 215);

    // Bloodline (centered)
    ctx.font = '16px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fontStyle = 'italic';
    ctx.fillText(bloodlineName, 300, 235);
    ctx.fontStyle = 'normal';

    // --- Division calculation (match ranked.js logic) ---
    function getTierAndDivision(elo) {
        // These should match your ranked.js config
        const ranks = [
            "Genin",
            "Chuunin",
            "Jounin",
            "Sannin",
            "Master Shinobi",
            "The Shinobi God"
        ];
        const divisionsPerRank = 5;
        const eloPerDivision = 100;
        if (!elo && elo !== 0) return { rank: "Genin", division: 5, elo: 0 };
        let totalDivisions = ranks.length * divisionsPerRank;
        let currentDivision = Math.floor(elo / eloPerDivision);
        if (currentDivision >= totalDivisions) {
            return {
                rank: "The Shinobi God",
                division: 1,
                elo: elo % eloPerDivision
            };
        }
        let rankIndex = Math.floor(currentDivision / divisionsPerRank);
        let division = 5 - (currentDivision % divisionsPerRank);
        return {
            rank: ranks[rankIndex],
            division: division,
            elo: elo % eloPerDivision
        };
    }

    // --- Use correct elo and division ---
    const elo = typeof userProfileData.elo === "number" ? userProfileData.elo : 0;
    const tierInfo = getTierAndDivision(elo);

    // Rank section (Always display)
    const rankedSectionX = 15, rankedSectionWidth = 570;
    drawSection(ctx, rankedSectionX, 250, rankedSectionWidth, 150, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('RANK INFORMATION', rankedSectionX + 15, 275);

    // Rank and division (use tierInfo)
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.fillText('Rank:', rankedSectionX + 15, 300);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tierInfo.rank, rankedSectionX + 85, 300);

    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Division:', rankedSectionX + 15, 320);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${tierInfo.division}`, rankedSectionX + 85, 320);

    // ELO bar (use correct elo)
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('ELO:', rankedSectionX + 15, 340);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(elo.toString(), rankedSectionX + 85, 340);

    ctx.fillStyle = '#333333';
    ctx.fillRect(rankedSectionX + 15, 350, rankedSectionWidth - 30, 15);
    const eloGradient = ctx.createLinearGradient(rankedSectionX + 15, 350, rankedSectionX + rankedSectionWidth - 15, 350);
    eloGradient.addColorStop(0, theme.primary);
    eloGradient.addColorStop(1, theme.accent);
    ctx.fillStyle = eloGradient;
    ctx.fillRect(rankedSectionX + 15, 350, (rankedSectionWidth - 30) * Math.min(1, (elo % 100) / 100), 15);

    // Ranked record section (Always display)
    drawSection(ctx, 15, 415, 570, 100, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('RANKED RECORD', 30, 440);

    // Use correct win/loss for win rate
    const rankedData = userProfileData.ranked || {};
    const wins = rankedData.wins || 0;
    const losses = rankedData.losses || 0;
    let winRate = '0%';
    if ((wins + losses) > 0) {
        winRate = `${Math.round((wins / (wins + losses)) * 100)}%`;
    }

    const rankedRecords = [
        { name: 'Wins:', value: wins },
        { name: 'Losses:', value: losses },
        { name: 'Win Rate:', value: winRate }
    ];

    rankedRecords.forEach((record, i) => {
        const x = 30 + (i * 180);
        const y = 465;

        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(record.name, x, y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(record.value.toString(), x + 78, y);
    });

    // Ranked Stats section (Only for self-view)
    const rankedStatsY = isSelfView ? 530 : 530;
    if (isSelfView) {
        drawSection(ctx, 15, rankedStatsY, 570, 120, theme.primary);
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 18px Arial';
        ctx.fillText('RANKED STATS', 30, rankedStatsY + 25);

        // Fix overlapping: use vertical spacing, 18px font, left-aligned
        ctx.font = '18px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Average Damage:', 30, rankedStatsY + 55);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(rankedData.avgDamage || 'N/A', 180, rankedStatsY + 55);

        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Most Used Jutsu:', 30, rankedStatsY + 85);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(rankedData.mostUsedJutsu || 'None', 180, rankedStatsY + 85);
    }

    // Footer
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 880, 600, 20);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Total ELO: ${elo}`, 300, 895);

    return canvas.toBuffer('image/png');
}

// --- Jutsu/Combo/Scroll Page (NO learned jutsu, no gamepass) ---
async function generateJutsuPage(targetUser, userProfileData, theme, jutsuList, usersJutsu) {
    const canvas = createCanvas(600, 900);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = theme.background[0];
    ctx.fillRect(0, 0, 600, 900);

    // --- Sparkling Effects (for premium themes) ---
    if (theme.isPremium) {
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

   

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 600, 120);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 600, 120);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    // --- Equipped Jutsu only ---
    // Adjusted section: more padding, better alignment, and consistent margins
    const sectionX = 40, sectionWidth = 520;
    drawSection(ctx, sectionX, 140, sectionWidth, 180, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPPED JUTSU', sectionX + 15, 165);

    const equipped = userProfileData.jutsu || {};
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    let y2 = 190;
    Object.entries(equipped).forEach(([slot, jutsuKey]) => {
        const jutsu = jutsuList[jutsuKey];
        ctx.fillText(`Slot ${slot.replace('slot_', '')}: ${jutsu ? jutsu.name : jutsuKey}`, sectionX + 25, y2);
        y2 += 22;
    });

    // Combo
    drawSection(ctx, sectionX, 340, sectionWidth, 60, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('COMBO', sectionX + 15, 365);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(userProfileData.Combo || 'None', sectionX + 25, 390);

    // Current Scroll
    drawSection(ctx, sectionX, 420, sectionWidth, 60, theme.primary);
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 18px Arial';
    ctx.fillText('CURRENT SCROLL', sectionX + 15, 445);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(userProfileData.current_scroll || 'None', sectionX + 25, 470);

    return canvas.toBuffer('image/png');

    return canvas.toBuffer('image/png');
}

// Helper functions (same as before)
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
        '110, 21, 21'; // Default to a dark red if conversion fails
}