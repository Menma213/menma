const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

const playersPath = path.resolve(__dirname, '../data/players.json');
const jutsuJsonPath = path.resolve(__dirname, '../data/jutsu.json');
const usersPath = path.resolve(__dirname, '../data/users.json');
const christmasDailyPath = path.resolve(__dirname, '../data/christmas_daily.json');
const christmasTokensPath = path.resolve(__dirname, '../data/christmas_tokens.json');
const raidProgressPath = path.resolve(__dirname, '../data/raid_progress.json');
const korilorePath = path.resolve(__dirname, '../data/korilore.json');

// Register Fonts (same as crank.js)
try {
    registerFont(path.join(__dirname, '../fonts/ninjafont.ttf'), { family: 'NinjaFont' });
    registerFont(path.join(__dirname, '../fonts/ninjafont-bold.ttf'), { family: 'NinjaFont', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom "NinjaFont". Using "sans-serif" as fallback.');
}

// Christmas Event Constants
const CHRISTMAS_TOKEN = 'Christmas Token';
const EVENT_START = new Date('2025-12-10T00:00:00Z');
const EVENT_END = new Date('2026-30-25T23:59:59Z');

// Summon costs
const SINGLE_COST = 10;
const TEN_COST = 100;

// Drop table for Crystal Palace summon
const DROP_TABLE = [
    { name: 'Crystal Palace', type: 'jutsu', chance: 0.001, color: 0xFFD700 }, // Ultimate
    { name: 'Ice Prison', type: 'jutsu', chance: 0.03, color: 0xFF4500 },
    { name: 'Planetary Devastation', type: 'jutsu', chance: 0.03, color: 0xFF4500 },
    { name: 'Blizzard Strike', type: 'jutsu', chance: 0.05, color: 0x1E90FF },
    { name: 'Primary Lotus', type: 'jutsu', chance: 0.10, color: 0x00BFFF },
    { name: 'Twin Rising Dragons', type: 'jutsu', chance: 0.10, color: 0x00BFFF },
    { name: '1000 exp', type: 'exp', amount: 1000, chance: 0.09, color: 0x43B581 },
    { name: '500 exp', type: 'exp', amount: 500, chance: 0.10, color: 0x43B581 },
    { name: '100 exp', type: 'exp', amount: 100, chance: 0.15, color: 0x43B581 },
    { name: '50 exp', type: 'exp', amount: 50, chance: 0.15, color: 0x43B581 },
    { name: '10 exp', type: 'exp', amount: 10, chance: 0.10, color: 0x43B581 },
    { name: '50k money', type: 'money', amount: 50000, chance: 0.05, color: 0xFFD700 },
    { name: '10k money', type: 'money', amount: 10000, chance: 0.10, color: 0xFFEA00 },
    { name: '1k money', type: 'money', amount: 1000, chance: 0.15, color: 0xFFEA00 },
    { name: '15 ramen', type: 'ramen', amount: 15, chance: 0.04, color: 0xFFB347 },
    { name: '10 ramen', type: 'ramen', amount: 10, chance: 0.05, color: 0xFFB347 },
    { name: '5 ramen', type: 'ramen', amount: 5, chance: 0.10, color: 0xFFB347 }
];

// Raid NPCs (10 types)
const RAID_NPCS = [
    { name: 'Soldier', health: 1000, power: 5000, defense: 3000, dodge: 10, accuracy: 85, jutsu: ['Rasengan', 'Rasenshuriken'], image: 'https://static.wikia.nocookie.net/naruto/images/c/c2/Riichi_%28ninja%29.png/revision/latest?cb=20160115132718' },
    { name: 'Archer', health: 8000, power: 6000, defense: 2000, dodge: 15, accuracy: 95, jutsu: ['Lightning Blade'], image: 'https://static.wikia.nocookie.net/naruto/images/9/9f/Spider_War_Bow_Terrible_Split.png/revision/latest?cb=20250401165014' },
    { name: 'Berserker', health: 12000, power: 8000, defense: 2500, dodge: 5, accuracy: 80, jutsu: ['Lightning Blade: All Out'], image: 'https://i.pinimg.com/236x/02/57/ce/0257ce159722e4978901148e6eeb1e35.jpg' },
    { name: 'Mage', health: 9000, power: 7000, defense: 2800, dodge: 12, accuracy: 88, jutsu: ['Ice Prison'], image: 'https://static.wikia.nocookie.net/naruto/images/8/81/Kotetsu_Hagane.png/revision/latest?cb=20160115135316' },
    { name: 'Sentinel', health: 15000, power: 4000, defense: 5000, dodge: 8, accuracy: 82, jutsu: ['Lightning Blade: All Out', 'Ice Prison'], image: 'https://static.wikia.nocookie.net/naruto/images/b/ba/Jiga2.png/revision/latest?cb=20150626122126' },
    { name: 'Assassin', health: 7000, power: 6500, defense: 2200, dodge: 25, accuracy: 90, jutsu: ['Lightning Blade: All Out', 'Ice Prison'], image: 'https://static.wikia.nocookie.net/naruto/images/b/b5/Assassination_Technique.png/revision/latest?cb=20150605103049' },
    { name: 'Guardian', health: 11000, power: 5500, defense: 3500, dodge: 10, accuracy: 85, regen: 0.05, jutsu: ['Blizzard Strike', 'Ice Prison'], image: 'https://static.wikia.nocookie.net/naruto/images/5/53/Disloyal_Guardian_Ninja.png/revision/latest?cb=20211007170651' },
    { name: 'Warrior', health: 13000, power: 7500, defense: 3000, dodge: 8, accuracy: 83, jutsu: ['Lightning Blade: All Out', 'Ice Prison'], image: 'https://cmsapi-frontend.naruto-official.com/site/api/naruto/Image/get?path=/naruto/import/images/naruto01/101%EF%BD%9E200/162/162.jpg' },
    { name: 'Shaman', health: 9500, power: 6000, defense: 2900, dodge: 13, accuracy: 87, jutsu: ['Lightning Blade: All Out', 'Ice Prison'], image: 'https://static.wikia.nocookie.net/narutofanon/images/4/4c/Heiwashamantr3.png/revision/latest/scale-to-width-down/320?cb=20191017045117' },
    { name: 'Hidan', health: 7500, power: 5800, defense: 2400, dodge: 30, accuracy: 92, jutsu: ['Punisher Shield', 'Rasengan'], image: 'https://static.wikia.nocookie.net/naruto/images/e/e3/Hidan.png/revision/latest/scale-to-width-down/284?cb=20210911225839' }
];

// King Kori (final boss)
const KING_KORI = {
    name: 'King Kori',
    health: 5000000000000000000,
    power: 500000000000000,
    defense: 500000000000000,
    dodge: 20,
    "statsType": "fixed",
    accuracy: 95,
    immunities: ['stun', 'bleed', 'burn', 'status'],
    regen: 0.10,
    jutsu: ['Crystal Palace'],
    image: 'https://i.postimg.cc/ZRtb0ynw/image.png'
};

// Helper functions (same as before)
function loadJSON(filePath) {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getUserJutsu(userId) {
    if (!fs.existsSync(jutsuJsonPath)) return [];
    const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));
    return (jutsuData[userId] && Array.isArray(jutsuData[userId].usersjutsu)) ? jutsuData[userId].usersjutsu : [];
}

function addJutsu(userId, jutsuName) {
    let jutsuData = loadJSON(jutsuJsonPath);
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], items: {} };
    if (!jutsuData[userId].usersjutsu.includes(jutsuName)) {
        jutsuData[userId].usersjutsu.push(jutsuName);
    }
    saveJSON(jutsuJsonPath, jutsuData);
}

function addItem(userId, itemName, amount) {
    let jutsuData = loadJSON(jutsuJsonPath);
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], items: {} };
    if (!jutsuData[userId].items) jutsuData[userId].items = {};
    jutsuData[userId].items[itemName] = (jutsuData[userId].items[itemName] || 0) + amount;
    saveJSON(jutsuJsonPath, jutsuData);
}

function loadPlayer(userId) {
    let players = loadJSON(playersPath);
    if (!players[userId]) players[userId] = { ss: 0, money: 0, exp: 0, ramen: 0 };
    return players[userId];
}

function savePlayer(userId, data) {
    let players = loadJSON(playersPath);
    players[userId] = { ...players[userId], ...data };
    saveJSON(playersPath, players);
}

function loadUser(userId) {
    let users = loadJSON(usersPath);
    if (!users[userId]) users[userId] = {};
    return users[userId];
}

function saveUser(userId, data) {
    let users = loadJSON(usersPath);
    users[userId] = { ...users[userId], ...data };
    saveJSON(usersPath, users);
}

function deductSS(userId, amount) {
    let player = loadPlayer(userId);
    player.ss = (player.ss || 0) - amount;
    savePlayer(userId, player);
}

function hasEnoughSS(userId, amount) {
    let player = loadPlayer(userId);
    return (player.ss || 0) >= amount;
}

function getDrop() {
    const rand = Math.random();
    let cumulative = 0;
    for (const drop of DROP_TABLE) {
        cumulative += drop.chance;
        if (rand <= cumulative) return drop;
    }
    return DROP_TABLE[DROP_TABLE.length - 1];
}

function addReward(userId, drop) {
    if (drop.type === 'jutsu') {
        if (!getUserJutsu(userId).includes(drop.name)) {
            addJutsu(userId, drop.name);
            return ` **${drop.name}** (Jutsu)`;
        }
        return null; // Duplicate jutsu handling? Usually convert to something else or just nothing.
    }
    if (drop.type === 'exp') {
        let player = loadPlayer(userId);
        player.exp = (player.exp || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount} EXP**`;
    }
    if (drop.type === 'money') {
        let player = loadPlayer(userId);
        player.money = (player.money || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount.toLocaleString()} Ryo**`;
    }
    if (drop.type === 'ramen') {
        let player = loadPlayer(userId);
        player.ramen = (player.ramen || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount} Ramen**`;
    }
    return null;
}

function getDropListText() {
    const jutsuDrops = DROP_TABLE.filter(d => d.type === 'jutsu').map(d => d.name);
    return jutsuDrops.join(', ');
}

function getCurrentEventDay() {
    const now = new Date();
    if (now < EVENT_START || now > EVENT_END) return null;
    const diffTime = Math.abs(now - EVENT_START);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(diffDays + 1, 15); // Cap at 15
}

// 15-Day Calendar Rewards (Simplified, No Materials)
const CALENDAR_REWARDS = [
    { day: 1, exp: 500, ryo: 5000, tokens: 10 },
    { day: 2, exp: 550, ryo: 5500, tokens: 10 },
    { day: 3, exp: 600, ryo: 6000, tokens: 15 },
    { day: 4, exp: 650, ryo: 6500, tokens: 15 },
    { day: 5, exp: 1000, ryo: 10000, tokens: 25, special: true }, // Milestone
    { day: 6, exp: 700, ryo: 7000, tokens: 20 },
    { day: 7, exp: 750, ryo: 7500, tokens: 20 },
    { day: 8, exp: 800, ryo: 8000, tokens: 25 },
    { day: 9, exp: 850, ryo: 8500, tokens: 25 },
    { day: 10, exp: 2000, ryo: 20000, tokens: 50, special: true }, // Milestone
    { day: 11, exp: 900, ryo: 9000, tokens: 30 },
    { day: 12, exp: 950, ryo: 9500, tokens: 30 },
    { day: 13, exp: 1000, ryo: 10000, tokens: 35 },
    { day: 14, exp: 1500, ryo: 15000, tokens: 40 },
    { day: 15, exp: 10000, ryo: 100000, tokens: 100, item: 'Legendary Scroll', special: true } // Grand Prize
];

function getDailyRewards(dayIndex) {
    if (dayIndex >= 15) {
        return { exp: 500, ryo: 5000, tokens: 10 };
    }
    const reward = CALENDAR_REWARDS[dayIndex];

    // Check for legendary scroll
    let materials = [];
    if (reward.item === 'Legendary Scroll') {
        materials.push({ name: 'legendary_scroll', amount: 1 });
    }

    return {
        exp: reward.exp,
        ryo: reward.ryo,
        tokens: reward.tokens,
        materials: materials,
        special: reward.special
    };
}

function getRaidNPC(floor) {
    const npcIndex = (floor - 1) % 10;
    const tier = Math.floor((floor - 1) / 10) + 1;

    // Toneri Level Scaling for higher tiers
    let multiplier = Math.pow(1.5, tier - 1);
    if (tier >= 2) multiplier *= 5; // Major jump at Tier 2
    if (tier >= 3) multiplier *= 2;
    if (tier >= 4) multiplier *= 2;
    if (tier >= 5) multiplier *= 2; // Very strong by Tier 5

    const baseNPC = { ...RAID_NPCS[npcIndex] };
    return {
        ...baseNPC,
        health: Math.floor(baseNPC.health * multiplier),
        power: Math.floor(baseNPC.power * multiplier),
        defense: Math.floor(baseNPC.defense * multiplier)
    };
}

// --- CANVAS GENERATION (Adapted from crank.js) ---
async function generateDailyImage(username, dayNum, rewards) {
    const width = 500, height = 650;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Dynamic Winter Night Sky ---
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0c1445'); // Deep indigo
    sky.addColorStop(0.5, '#1e2a6d'); // Midnight blue
    sky.addColorStop(1, '#3b4a8b'); // Faded purple/blue
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // --- Stars ---
    ctx.shadowColor = 'rgba(200, 225, 255, 0.9)';
    ctx.shadowBlur = 10;
    for (let i = 0; i < 150; i++) {
        ctx.beginPath();
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8;
        const radius = Math.random() * 1.5;
        const alpha = Math.random() * 0.8 + 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    // --- Complex Snowflake Function ---
    function drawSnowflake(x, y, size, branches, alpha, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(220, 235, 255, ${alpha})`;
        ctx.lineWidth = size / 15;

        for (let i = 0; i < branches; i++) {
            const angle = (Math.PI * 2 / branches) * i;
            // Main branch
            ctx.moveTo(0, 0);
            ctx.lineTo(0, size);
            // Sub-branches
            for (let j = 0.4; j < 1; j += 0.2) {
                ctx.moveTo(size * 0.2, size * j);
                ctx.lineTo(0, size * j);
                ctx.moveTo(-size * 0.2, size * j);
                ctx.lineTo(0, size * j);
            }
            ctx.rotate(angle);
        }
        ctx.stroke();
        ctx.restore();
    }

    // --- Draw Falling Snow ---
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 20 + 5;
        const alpha = Math.random() * 0.6 + 0.1;
        const rotation = Math.random() * Math.PI * 2;
        drawSnowflake(x, y, size, 6, alpha, rotation);
    }

    // --- Frosted Glass Card ---
    const cardPadding = 40;
    const cardX = cardPadding, cardY = cardPadding, cardWidth = width - cardPadding * 2, cardHeight = height - cardPadding * 2;

    ctx.fillStyle = 'rgba(10, 15, 40, 0.6)';
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(173, 216, 230, 1)';
    ctx.shadowBlur = 20;

    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    // --- Christmas Accents (Red/Green Glow) ---
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)'; // Red glow
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.strokeRect(cardX + 5, cardY + 5, cardWidth - 10, cardHeight - 10);
    ctx.restore();

    ctx.shadowBlur = 0;

    // --- Icicles ---
    ctx.lineWidth = 2;
    for (let i = 0; i < cardWidth / 10; i++) {
        const x = cardX + Math.random() * cardWidth;
        const length = Math.random() * 40 + 10;
        const alpha = Math.random() * 0.5 + 0.3;
        ctx.beginPath();
        ctx.moveTo(x, cardY);
        ctx.lineTo(x + (Math.random() - 0.5) * 5, cardY + length);
        ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
        ctx.stroke();
    }

    // --- Main Title ---
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "NinjaFont", sans-serif'; // Slightly smaller to fit
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText('ADVENT CALENDAR', width / 2, 110);

    // --- Day Display ---
    ctx.font = '30px "NinjaFont", sans-serif';
    ctx.fillStyle = '#b0e0e6'; // Powder Blue
    ctx.shadowColor = '#b0e0e6';
    ctx.shadowBlur = 10;
    ctx.fillText(`~ Day ${dayNum} Unlocked ~`, width / 2, 160);
    ctx.shadowBlur = 0;

    // --- Username ---
    ctx.font = '24px "Roboto", sans-serif';
    ctx.fillStyle = '#e0f7fa';
    ctx.fillText(username.toUpperCase(), width / 2, 200);

    // --- Rewards Section ---
    const rewardsList = [
        { label: 'Ryo', value: `+ ${(rewards.ryo || 0).toLocaleString()}`, color: '#87ceeb' },
        { label: 'EXP', value: `+ ${rewards.exp || 0}`, color: '#b0e0e6' },
        { label: 'Tokens', value: `+ ${rewards.tokens || 0}`, color: '#ffcc66' } // Tokens as gold/yellow
    ];

    let y = 300;
    const labelX = width * 0.18;
    const valueX = width * 0.82;

    for (const reward of rewardsList) {
        ctx.font = '22px "Roboto", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cce7ff';
        ctx.fillText(`${reward.label}:`, labelX, y);

        ctx.font = 'bold 24px "Roboto", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = reward.color;
        ctx.fillText(`${reward.value}`, valueX, y);
        y += 60;
    }

    // Legendary Scroll?
    if (rewards.materials && rewards.materials.length > 0) {
        for (const mat of rewards.materials) {
            ctx.font = '22px "Roboto", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFD700'; // Gold
            ctx.fillText(`ITEM: ${mat.name.toUpperCase().replace(/_/g, ' ')}`, width / 2, y + 20);
        }
    }

    // --- Footer Status ---
    const footerY = height - 50;
    ctx.font = 'bold 20px "Roboto", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a0eec0';
    ctx.fillText(`See you tomorrow!`, width / 2, footerY);

    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const imagePath = path.join(tempDir, `daily_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath);
    const stream = canvas.createPNGStream();

    return new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', () => resolve(imagePath));
        out.on('error', reject);
    });
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Christmas Event 2025!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily')
                .setDescription('Claim your daily Christmas rewards!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('summon')
                .setDescription('Summon from the Crystal Palace!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('raid')
                .setDescription('Challenge the Crystal Palace Raid!')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // ===== DAILY SUBCOMMAND =====
        if (subcommand === 'daily') {
            const currentDay = getCurrentEventDay();
            if (!currentDay) {
                // If before even starts, blocking. If after, maybe just let them finish?
                // Logic based on date. Safe to block.
                return interaction.reply({
                    content: 'The Christmas event is not currently active!',
                    ephemeral: true
                });
            }

            const dailyData = loadJSON(christmasDailyPath);
            if (!dailyData[userId]) {
                dailyData[userId] = { lastClaim: 0, daysCompleted: [], totalTokens: 0 };
            }

            const now = Date.now();
            const lastClaim = dailyData[userId].lastClaim || 0;
            const timeSinceLastClaim = now - lastClaim;
            const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

            if (timeSinceLastClaim < COOLDOWN) {
                const timeLeft = COOLDOWN - timeSinceLastClaim;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.reply({
                    content: `You've already claimed today's reward! Come back in ${hoursLeft}h ${minutesLeft}m.`,
                    ephemeral: true
                });
            }

            const daysClaimedCount = dailyData[userId].daysCompleted.length;
            const nextDayIndex = daysClaimedCount; // 0 for Day 1

            const rewards = getDailyRewards(nextDayIndex);

            // Add rewards
            let player = loadPlayer(userId);
            player.exp = (player.exp || 0) + rewards.exp;
            player.money = (player.money || 0) + rewards.ryo;
            savePlayer(userId, player);

            // Add Christmas Tokens
            addItem(userId, CHRISTMAS_TOKEN, rewards.tokens);

            // Add Special Item
            if (rewards.materials) {
                rewards.materials.forEach(mat => {
                    addItem(userId, mat.name, mat.amount);
                });
            }

            // Update daily data
            dailyData[userId].lastClaim = now;
            dailyData[userId].daysCompleted.push(nextDayIndex + 1);
            dailyData[userId].totalTokens = (dailyData[userId].totalTokens || 0) + rewards.tokens;
            saveJSON(christmasDailyPath, dailyData);

            // Generate Image
            await interaction.deferReply();
            try {
                const imagePath = await generateDailyImage(username, nextDayIndex + 1, rewards);
                const attachment = new AttachmentBuilder(imagePath);

                await interaction.editReply({
                    content: `**Day ${nextDayIndex + 1} Claimed!**`,
                    files: [attachment]
                });

                // Cleanup
                fs.unlinkSync(imagePath);
            } catch (err) {
                console.error("Canvas error:", err);
                await interaction.editReply({
                    content: `Day ${nextDayIndex + 1} Claimed! (Image failed to generate, but rewards were received)`
                });
            }
            return;
        }

        // ===== SUMMON SUBCOMMAND =====
        if (subcommand === 'summon') {
            // Check for intro
            const user = loadUser(userId);
            if (!user.crystalpalaceevent) {
                // Intro Logic (kept same)
                const pages = [
                    {
                        title: "The Crystal Palace",
                        description: `Deep within the frozen tundra lies a palace made entirely of ice and crystal. Legend speaks of a powerful ice user named Haku who once protected this sacred place. His techniques were said to be unmatched, combining speed, precision, and the raw power of ice itself.`,
                        color: 0x00FFFF,
                        image: 'https://i.postimg.cc/L4j6FVqJ/image.png'
                    },
                    {
                        title: "The Ice Master",
                        description: `Haku was a shinobi with a tragic past, but his mastery over Ice Release was legendary. He could create mirrors of ice, trap enemies in frozen prisons, and strike with needles as sharp as steel. His techniques were both beautiful and deadly.`,
                        color: 0x00FFFF,
                        image: 'https://i.postimg.cc/L4j6FVqJ/image.png'
                    },
                    {
                        title: "The Winter's Gift",
                        description: `This Christmas, the Crystal Palace has opened its gates. The spirits of winter offer you a chance to learn Haku's legendary techniques. Will you brave the frozen halls and claim the power of ice?`,
                        color: 0x00FFFF,
                        image: 'https://i.postimg.cc/L4j6FVqJ/image.png'
                    },
                    {
                        title: "Crystal Palace - Ultimate Jutsu",
                        description: `The ultimate technique of the Crystal Palace is a devastating attack that creates a massive structure of ice crystals, crashing down with armor-piercing force. This is an "ultimate jutsu", the rarest type. It has a unique "armor pen" mechanism which ignores enemy defenses, making it incredibly powerful in battle.\n\nGet your hands on it now!`,
                        color: 0xFFD700,
                        image: 'https://i.postimg.cc/L4j6FVqJ/image.png'
                    }
                ];

                let page = 0;
                const sendPage = async (edit = false) => {
                    const embed = new EmbedBuilder()
                        .setTitle(pages[page].title)
                        .setDescription(pages[page].description)
                        .setColor(pages[page].color)
                        .setFooter({ text: `Page ${page + 1}/4` });
                    if (pages[page].image) embed.setImage(pages[page].image);
                    let row;
                    if (page < pages.length - 1) {
                        row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('crystalpalace_next')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Primary)
                        );
                    } else {
                        row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('crystalpalace_finish')
                                .setLabel('Enter the Crystal Palace')
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    if (edit) {
                        await interaction.editReply({ embeds: [embed], components: [row] });
                    } else {
                        await interaction.reply({ embeds: [embed], components: [row] });
                    }
                };

                await sendPage();

                const collector = interaction.channel.createMessageComponentCollector({
                    filter: i => i.user.id === userId,
                    time: 120000
                });

                collector.on('collect', async i => {
                    if (i.customId === 'crystalpalace_next') {
                        page++;
                        await i.deferUpdate();
                        await sendPage(true);
                    } else if (i.customId === 'crystalpalace_finish') {
                        await i.deferUpdate();
                        collector.stop();
                        user.crystalpalaceevent = true;
                        saveUser(userId, user);
                        await interaction.editReply({
                            content: 'You have entered the Crystal Palace! Run `/event summon` again to begin summoning!',
                            embeds: [],
                            components: []
                        });
                    }
                });
                return;
            }

            // Summon interface
            const eventEmbed = new EmbedBuilder()
                .setTitle('❄️ Crystal Palace: Ice Summon Event ❄️')
                .setDescription(
                    `Obtain Haku's legendary Ice Release techniques!\n\n` +
                    `**Featured Jutsu:** Crystal Palace (Ultimate)\n` +
                    `**All Possible Drops:**\n${getDropListText()}\n\n` +
                    `**Guaranteed:** Christmas Token (used in event shop)\n\n` +
                    `**Prices:**\n• 10 SS — Single Summon\n• 100 SS — 10x Summon\n\n` +
                    `Summon for a chance to obtain rare ice jutsu, exp, ryo, ramen, and more!`
                )
                .setImage('https://i.pinimg.com/736x/66/53/73/665373d501b9350498c1cade9a0aa59a.jpg')
                .setColor(0x00FFFF)
                .setFooter({ text: 'Crystal Palace Event | Ends January 25th!' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('summon_1')
                    .setLabel('Summon')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('summon_10')
                    .setLabel('Summon x10')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('summon_tokens')
                    .setLabel('x10 (100 Christmas Tokens)')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [eventEmbed], components: [row], ephemeral: false });

            const filter = i => ['summon_1', 'summon_10', 'summon_tokens'].includes(i.customId) && i.user.id === userId;
            try {
                const btn = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                await btn.deferUpdate();

                const isTokenSummon = btn.customId === 'summon_tokens';
                const spins = (btn.customId === 'summon_10' || isTokenSummon) ? 10 : 1;
                const totalCost = spins === 10 ? TEN_COST : SINGLE_COST;

                if (isTokenSummon) {
                    // Token Check
                    const currentJutsuData = loadJSON(jutsuJsonPath);
                    const userTokens = (currentJutsuData[userId] && currentJutsuData[userId].items) ? (currentJutsuData[userId].items[CHRISTMAS_TOKEN] || 0) : 0;

                    if (userTokens < 100) {
                        await interaction.followUp({ content: `You don't have enough Christmas Tokens! You need 100. (You have ${userTokens})`, ephemeral: true });
                        return;
                    }
                    // Deduct Tokens
                    addItem(userId, CHRISTMAS_TOKEN, -100);
                } else {
                    // SS Check
                    if (!hasEnoughSS(userId, totalCost)) {
                        await interaction.followUp({ content: `You don't have enough SS! You need ${totalCost} SS.`, ephemeral: true });
                        return;
                    }
                    deductSS(userId, totalCost);
                }

                // Animation
                const animColors = [0x00FFFF, 0x0099FF, 0x0066FF, 0x00CCFF, 0xFFFFFF, 0x99FFFF];
                let animIdx = 0;
                const animEmbed = new EmbedBuilder()
                    .setTitle(`${username} is summoning...`)
                    .setDescription(`Summoning ${spins} time(s) from the Crystal Palace...!`)
                    .setImage('https://media.tenor.com/2hQhXQwQyQwAAAAd/raikage-naruto.gif')
                    .setColor(animColors[animIdx])
                    .setFooter({ text: 'Summoning...' });

                const animMsg = await interaction.followUp({ embeds: [animEmbed], fetchReply: true });

                let interval = setInterval(() => {
                    animIdx = (animIdx + 1) % animColors.length;
                    animEmbed.setColor(animColors[animIdx]);
                    animMsg.edit({ embeds: [animEmbed] });
                }, 500);

                setTimeout(async () => {
                    clearInterval(interval);

                    // Perform spins
                    let results = [];
                    let resultText = [];
                    let rarestDrop = null;
                    for (let i = 0; i < spins; i++) {
                        let drop;
                        let tries = 0;
                        do {
                            drop = getDrop();
                            tries++;
                            if (drop.type === 'jutsu' && getUserJutsu(userId).includes(drop.name)) drop = null;
                        } while (!drop && tries < 10);
                        if (!drop) drop = DROP_TABLE.find(d => d.type !== 'jutsu');
                        results.push(drop);
                        if (!rarestDrop || drop.chance < rarestDrop.chance) rarestDrop = drop;
                        let rewardStr = addReward(userId, drop);
                        if (rewardStr) resultText.push(rewardStr);
                    }

                    // Add Christmas Tokens
                    addItem(userId, CHRISTMAS_TOKEN, spins);
                    resultText.push(`**${spins} Christmas Token${spins > 1 ? 's' : ''}**`);

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`${username}'s Crystal Palace Summon Results!`)
                        .setDescription(
                            resultText.length > 0
                                ? `You received:\n${resultText.join('\n')}\n\nClaim jutsu and items from your inventory!`
                                : "No new rewards this time."
                        )
                        .setColor(rarestDrop ? rarestDrop.color : 0x00FFFF)
                        .setImage('https://i.postimg.cc/HWMc9M7j/image.png')
                        .setFooter({ text: 'Crystal Palace Event' });

                    await animMsg.edit({ embeds: [resultEmbed] });
                }, 3000);

            } catch {
                await interaction.followUp({ content: "You didn't summon in time. Run `/event summon` again!", ephemeral: true });
            }
        }

        // ===== RAID SUBCOMMAND =====
        if (subcommand === 'raid') {
            const user = loadUser(userId);

            // Check requirement from korilore.json
            let allowed = false;
            try {
                if (fs.existsSync(korilorePath)) {
                    const koriData = JSON.parse(fs.readFileSync(korilorePath, 'utf8'));
                    if (koriData.users && koriData.users.includes(userId)) {
                        allowed = true;
                    }
                }
            } catch (err) {
                console.error("Error reading korilore.json:", err);
            }

            if (!allowed) {
                return interaction.reply({
                    content: '❌ You must complete the Raid Story quest first! Go to https://shinobirpg.online to read the story.',
                    ephemeral: true
                });
            }

            const raidData = loadJSON(raidProgressPath);
            if (!raidData[userId]) {
                raidData[userId] = { currentFloor: 1, highestFloor: 1, lastAttempt: 0, defeatedKingKori: false };
            }

            const currentFloor = raidData[userId].currentFloor || 1;

            // Intro Webhooks
            // Intro Webhooks (General)
            if (currentFloor === 1 && !raidData[userId].seenIntro) {
                await interaction.reply({ content: '**The Crystal Palace Raid begins...**', ephemeral: false });

                try {
                    const webhooks = await interaction.channel.fetchWebhooks();
                    let webhook = webhooks.find(wh => wh.owner.id === interaction.client.user.id);
                    if (!webhook) {
                        webhook = await interaction.channel.createWebhook({
                            name: 'Raid Story',
                            avatar: interaction.client.user.displayAvatarURL()
                        });
                    }

                    const sendHook = async (name, avatar, text) => {
                        await webhook.send({ username: name, avatarURL: avatar, content: text });
                        await new Promise(r => setTimeout(r, 2000)); // Pace dialogue
                    };

                    await sendHook('Kakashi Hatake', 'https://i.postimg.cc/3rpy04BB/image.png', '"Listen up. Weve received intel that Sasuke has been captured by King Kori and is being held in the Crystal Palace. This is a rescue mission."');
                    await sendHook('Naruto Uzumaki', 'https://static.wikia.nocookie.net/naruto/images/8/80/A_and_B.png', '"Sasuke... We\'re coming for you! I won\'t let King Kori keep you locked up in that frozen palace!"');
                    await sendHook('Kakashi Hatake', 'https://i.postimg.cc/3rpy04BB/image.png', '"The palace has 50 floors (actually 51). At the top, King Kori awaits. Be prepared."');

                    raidData[userId].seenIntro = true;
                    saveJSON(raidProgressPath, raidData);
                } catch (e) {
                    console.error("Webhook error:", e);
                }
            }

            // --- KING KORI FIGHT (Floor 51) ---
            if (currentFloor >= 51) {
                if (raidData[userId].defeatedKingKori) {
                    return interaction.reply({ content: 'You have already defeated King Kori and saved Sasuke!', ephemeral: true });
                }

                // Kori Intro Dialogue (if not seen this session/attempt)
                // We'll run it every time for drama unless bypassed? Let's run it.
                await interaction.reply({ content: '**You arrive at the Throne Room...**', ephemeral: false });

                try {
                    const webhooks = await interaction.channel.fetchWebhooks();
                    let webhook = webhooks.find(wh => wh.owner.id === interaction.client.user.id);
                    if (!webhook) webhook = await interaction.channel.createWebhook({ name: 'Raid Story', avatar: interaction.client.user.displayAvatarURL() });

                    const sendHook = async (name, avatar, text) => {
                        await webhook.send({ username: name, avatarURL: avatar, content: text });
                        await new Promise(r => setTimeout(r, 2500));
                    };

                    // Dialogue Sequence Check
                    // To interact properly, we can just send them sequentially. 
                    const koriAvatar = KING_KORI.image;
                    const userAvatar = interaction.user.displayAvatarURL();

                    await sendHook('King Kori', koriAvatar, '"Kneel."');
                    await sendHook(interaction.user.username, userAvatar, '"Where\'s Sasuke? Free him! Now!"');
                    await sendHook('King Kori', koriAvatar, '"Dogs Bark."');
                    await sendHook(interaction.user.username, userAvatar, '"Free him NOW!"');
                    await sendHook('King Kori', koriAvatar, '"*Yap yap* go on."');

                } catch (e) { console.error("Kori Intro Webhook Error", e); }

                // Fight Button
                const fightRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('fight_kori').setLabel('FIGHT KING KORI').setStyle(ButtonStyle.Danger)
                );

                const fightMsg = await interaction.channel.send({ content: "**King Kori awaits.**", components: [fightRow] });

                try {
                    const btn = await fightMsg.awaitMessageComponent({ filter: i => i.user.id === userId && i.customId === 'fight_kori', time: 60000 });
                    await btn.deferUpdate();
                    await fightMsg.delete();

                    const { runBattle } = require('./combinedcommands.js');
                    const npcData = { ...KING_KORI };
                    // Ensure stats are massive as requested
                    npcData.health = 5000000000000000000;

                    const result = await runBattle(interaction, userId, `NPC_${npcData.name}`, 'raid', npcData, 'raid', true);

                    if (result.winner.userId === userId) {
                        // WIN DIALOGUE
                        try {
                            const webhooks = await interaction.channel.fetchWebhooks();
                            let webhook = webhooks.find(wh => wh.owner.id === interaction.client.user.id);
                            if (!webhook) webhook = await interaction.channel.createWebhook({ name: 'Raid Story', avatar: interaction.client.user.displayAvatarURL() });
                            const sendHook = async (name, avatar, text) => {
                                await webhook.send({ username: name, avatarURL: avatar, content: text });
                                await new Promise(r => setTimeout(r, 2500));
                            };
                            const koriAvatar = KING_KORI.image;
                            const userAvatar = interaction.user.displayAvatarURL();
                            const sasukeAvatar = 'https://static.wikia.nocookie.net/naruto/images/2/21/Sasuke_Part_1.png';

                            await sendHook('King Kori', koriAvatar, '"Hehehehe..."');
                            await sendHook(interaction.user.username, userAvatar, '"WHAT? Dont tell me he rises again.."');
                            await sendHook('King Kori', koriAvatar, '"Incorrect. You\'ve done a good job beating this vessel. But the gods will get their revenge..I will get my revenge, Soon."');
                            await sendHook(interaction.user.username, userAvatar, '"Sasuke! are you alright?"');
                            await sendHook('Sasuke Uchiha', sasukeAvatar, '"I\'m fine, get out of here, this castle is melting."');
                        } catch (e) { console.error("Kori Outro Webhook Error", e); }

                        // REWARDS
                        // Title: "Flames of the Heaven"
                        const users = loadJSON(usersPath);
                        if (!users[userId].unlocked_titles) users[userId].unlocked_titles = [];
                        if (!users[userId].unlocked_titles.includes("Flames of the Heaven")) {
                            users[userId].unlocked_titles.push("Flames of the Heaven");
                        }
                        users[userId].rank = "Flames of the Heaven"; // Auto Equip
                        saveJSON(usersPath, users);

                        // Items/Res
                        let player = loadPlayer(userId);
                        player.money = (player.money || 0) + 10000000; // 10M
                        player.exp = (player.exp || 0) + 50000;
                        player.ramen = (player.ramen || 0) + 100;
                        savePlayer(userId, player);

                        raidData[userId].defeatedKingKori = true;
                        raidData[userId].currentFloor = 51; // Stay here
                        saveJSON(raidProgressPath, raidData);

                        await interaction.channel.send({ content: `**MISSION COMPLETE!**\n\n **New Title Equipped:** Flames of the Heaven\n **Ryo:** +10,000,000\n **EXP:** +50,000\n **Ramen:** +100` });

                    } else {
                        // LOSS DIALOGUE
                        try {
                            const webhooks = await interaction.channel.fetchWebhooks();
                            let webhook = webhooks.find(wh => wh.owner.id === interaction.client.user.id);
                            if (!webhook) webhook = await interaction.channel.createWebhook({ name: 'Raid Story', avatar: interaction.client.user.displayAvatarURL() });
                            const sendHook = async (name, avatar, text) => {
                                await webhook.send({ username: name, avatarURL: avatar, content: text });
                                await new Promise(r => setTimeout(r, 2000));
                            };
                            await sendHook('King Kori', KING_KORI.image, '"The weak need to stay down."');
                        } catch (e) { console.error("Kori Loss Webhook Error", e); }
                    }

                } catch (e) {
                    await interaction.followUp({ content: "You took too long to start the fight!", ephemeral: true });
                }
                return;
            }

            // --- STANDARD RAID FLOOR (1-50) ---
            const npcTemplate = getRaidNPC(currentFloor);
            const { runBattle } = require('./combinedcommands.js');

            await interaction.reply({ content: `**Entering Raid Floor ${currentFloor}...** (Vs ${npcTemplate.name})`, ephemeral: false });

            const result = await runBattle(interaction, userId, `NPC_${npcTemplate.name}`, 'raid', npcTemplate, 'raid', false);

            if (result.winner.userId === userId) {
                // Determine Drops
                let drops = [];
                // Fixed EXP/Money based on floor
                const expReward = Math.floor(currentFloor * 100);
                const ryoReward = Math.floor(currentFloor * 1000);

                let player = loadPlayer(userId);
                player.exp = (player.exp || 0) + expReward;
                player.money = (player.money || 0) + ryoReward;
                savePlayer(userId, player);
                drops.push(`${expReward} EXP`);
                drops.push(`${ryoReward} Ryo`);

                // 25% chance for a token
                if (Math.random() < 0.25) {
                    addItem(userId, CHRISTMAS_TOKEN, 1);
                    drops.push('1 Christmas Token');
                }

                // Update Progress
                if (currentFloor === raidData[userId].currentFloor) {
                    raidData[userId].currentFloor++;
                    raidData[userId].highestFloor = Math.max(raidData[userId].highestFloor, raidData[userId].currentFloor);
                    saveJSON(raidProgressPath, raidData);
                }

                await interaction.channel.send({
                    content: `✅ **Floor ${currentFloor} Cleared!**\nStarting rewards:\n${drops.join('\n')}\n\n*Next Floor: ${currentFloor + 1}*`
                });
            } else {
                await interaction.channel.send({ content: `❌ **Defeated on Floor ${currentFloor}!** Try upgrading your gear or stats.` });
            }

        }
    }
};


