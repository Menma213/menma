const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { Api } = require('@top-gg/sdk');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
require('dotenv').config();

// Get API token from .env file
const TOPGG_TOKEN = process.env.TOPGG_TOKEN;
const BOT_ID = process.env.CLIENT_ID;

// Define file paths
const PLAYERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/players.json');
const COOLDOWNS_FILE_PATH = path.resolve(__dirname, '../../menma/data/cooldowns.json');
const VOTESTREAK_FILE_PATH = path.resolve(__dirname, '../../menma/data/votestreat.json'); // NEW: Streak tracking file

// FIX: Correctly check if the token exists before creating the API object
const topggApi = TOPGG_TOKEN ? new Api(TOPGG_TOKEN) : { hasVoted: () => false };

// Register a thematic font if available
try {
    registerFont(path.join(__dirname, '../fonts/ninjafont.ttf'), { family: 'NinjaFont' });
    registerFont(path.join(__dirname, '../fonts/ninjafont-bold.ttf'), { family: 'NinjaFont', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom "NinjaFont". Using "sans-serif" as fallback.');
}

// --- CONSTANTS AND REWARDS LOGIC ---
const COOLDOWN_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const STREAK_BREAK_MS = 48 * 60 * 60 * 1000; // 48 hours for streak reset

const BASE_REWARD = { money: 25000, ramen: 25, exp: 100 };

// Streak bonuses are added ON TOP of the BASE_REWARD, making Day 1 a bonus of 75k money for a total of 100k.
const STREAK_BONUSES = [
    { day: 1, money_bonus: 75000, ramen_bonus: 0, ss_amount: 100 },
    { day: 2, money_bonus: 95000, ramen_bonus: 0, ss_amount: 100 },
    { day: 3, money_bonus: 125000, ramen_bonus: 0, ss_amount: 100 },
    { day: 4, money_bonus: 155000, ramen_bonus: 0, ss_amount: 100 },
    { day: 5, money_bonus: 175000, ramen_bonus: 25, ss_amount: 100 }, // +25 Ramen
    { day: 6, money_bonus: 195000, ramen_bonus: 0, ss_amount: 100 },
    { day: 7, money_bonus: 225000, ramen_bonus: 0, ss_amount: 100 },
    { day: 8, money_bonus: 245000, ramen_bonus: 0, ss_amount: 100 },
    { day: 9, money_bonus: 275000, ramen_bonus: 0, ss_amount: 100 },
    { day: 10, money_bonus: 325000, ramen_bonus: 25, ss_amount: 100 }, // +25 Ramen
    { day: 11, money_bonus: 345000, ramen_bonus: 0, ss_amount: 100 },
    { day: 12, money_bonus: 375000, ramen_bonus: 0, ss_amount: 100 },
    { day: 13, money_bonus: 475000, ramen_bonus: 0, ss_amount: 100 },
    { day: 14, money_bonus: 575000, ramen_bonus: 0, ss_amount: 100 },
    { day: 15, money_bonus: 625000, ramen_bonus: 25, ss_amount: 100 }, // +25 Ramen
    { day: 16, money_bonus: 675000, ramen_bonus: 0, ss_amount: 100 },
    { day: 17, money_bonus: 775000, ramen_bonus: 0, ss_amount: 100 },
    { day: 18, money_bonus: 875000, ramen_bonus: 0, ss_amount: 100 },
    { day: 19, money_bonus: 975000, ramen_bonus: 0, ss_amount: 100 },
    { day: 20, money_bonus: 1075000, ramen_bonus: 25, ss_amount: 100 }, // +25 Ramen
    { day: 21, money_bonus: 1175000, ramen_bonus: 0, ss_amount: 100 },
    { day: 22, money_bonus: 1275000, ramen_bonus: 0, ss_amount: 100 },
    { day: 23, money_bonus: 1375000, ramen_bonus: 0, ss_amount: 100 },
    { day: 24, money_bonus: 1475000, ramen_bonus: 0, ss_amount: 100 },
    { day: 25, money_bonus: 1525000, ramen_bonus: 75, ss_amount: 100 }, // +75 Ramen
    { day: 26, money_bonus: 1575000, ramen_bonus: 0, ss_amount: 100 },
    { day: 27, money_bonus: 1675000, ramen_bonus: 0, ss_amount: 100 },
    { day: 28, money_bonus: 1975000, ramen_bonus: 0, ss_amount: 100 },
    { day: 29, money_bonus: 2475000, ramen_bonus: 0, ss_amount: 100 },
    { day: 30, money_bonus: 4975000, ramen_bonus: 125, ss_amount: 100 }, // +125 Ramen
];

// Helper to get streak bonuses (loops after day 30)
function getStreakBonus(streakDay) {
    const index = (streakDay - 1) % STREAK_BONUSES.length;
    return STREAK_BONUSES[index];
}

function calculateBonusSSReward(streakDay) {
    const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = today === 0 || today === 6;
    const dropChance = isWeekend ? 0.30 : 0.10; // 30% on weekend, 10% daily

    const streakBonus = getStreakBonus(streakDay);
    const ssAmount = streakBonus.ss_amount;
    
    const isBonus = Math.random() < dropChance;

    return {
        ss: isBonus ? ssAmount : 0,
        isBonus: isBonus,
        ssChance: dropChance * 100, // percentage for display
        isWeekend: isWeekend
    };
}

// --- FILE UTILITIES ---

// Load data utility
function loadData(filePath, defaultData = {}) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error loading data from ${filePath}:`, error);
    }
    return defaultData;
}

// Save data utility
function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving data to ${filePath}:`, error);
    }
}

function loadStreakData() {
    return loadData(VOTESTREAK_FILE_PATH, {});
}

function saveStreakData(data) {
    saveData(VOTESTREAK_FILE_PATH, data);
}

let cooldowns = loadData(COOLDOWNS_FILE_PATH);


/**
 * Generates a canvas image for vote rewards using the cyberpunk theme.
 * @param {string} username The Discord username.
 * @param {number} streakDay The current or next streak day.
 * @param {object} rewards The full rewards object {money, ramen, exp, ss}.
 * @param {object} ssInfo The SS bonus info {ss, isBonus, ssChance, isWeekend}.
 * @param {boolean} streakBroken If the streak was just broken.
 * @returns {Promise<string>} The path to the generated image file.
 */
async function generateRewardsImage(username, streakDay, rewards, ssInfo, streakBroken = false) {
    // New portrait dimensions for a profile card style
    const width = 400, height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const dayDisplay = streakDay % STREAK_BONUSES.length || STREAK_BONUSES.length;

    // Solid dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw a subtle background layer for depth with glowing lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.2)';
    ctx.shadowBlur = 5;
    for (let i = 0; i < height; i += 25) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
    }
    for (let i = 0; i < width; i += 25) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Main card shape (Oblique edges for cyberpunk look)
    const cardPadding = 25;
    const cardWidth = width - cardPadding * 2;
    const cardHeight = height - cardPadding * 2;
    const offset = 20;

    // Draw a subtle background layer for depth
    ctx.fillStyle = 'rgba(15, 15, 15, 0.8)';
    ctx.beginPath();
    ctx.moveTo(cardPadding + offset, cardPadding);
    ctx.lineTo(cardPadding + cardWidth, cardPadding);
    ctx.lineTo(cardPadding + cardWidth - offset, cardPadding + cardHeight);
    ctx.lineTo(cardPadding, cardPadding + cardHeight);
    ctx.closePath();
    ctx.fill();

    // Draw the main card border with a gradient border
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#00ffff'); // Cyan
    gradient.addColorStop(1, '#ff00ff'); // Magenta
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.7)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cardPadding, cardPadding + offset);
    ctx.lineTo(cardPadding + cardWidth - offset, cardPadding);
    ctx.lineTo(cardPadding + cardWidth, cardPadding + cardHeight - offset);
    ctx.lineTo(cardPadding + offset, cardPadding + cardHeight);
    ctx.closePath();
    ctx.stroke();

    // Reset shadow for inner fills and text
    ctx.shadowBlur = 0;

    // Main Title/Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "NinjaFont", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VOTE REWARD', width / 2, 80);

    // Streak Day Display
    ctx.fillStyle = '#00ffff';
    ctx.font = '26px "NinjaFont", sans-serif';
    ctx.fillText(`// STREAK_DAY ${dayDisplay} //`, width / 2, 120);

    // Username line
    ctx.font = '20px "Roboto", sans-serif';
    ctx.fillStyle = '#b3e6b3';
    ctx.fillText(`[USER: ${username.toUpperCase()}]`, width / 2, 155);

    // Rewards section
    const rewardsList = [
        { label: 'Ryo', value: `${rewards.money.toLocaleString()}`, color: '#ff00ff' }, // Magenta
        { label: 'Ramen', value: `${rewards.ramen}`, color: '#ff8c00' }, // Dark Orange
        { label: 'EXP', value: `${rewards.exp}`, color: '#00ffff' }, // Cyan
        { label: 'SS (Shards)', value: `${rewards.ss}`, color: ssInfo.isBonus ? '#ffcc00' : '#4a4a4a' }, // Gold for bonus, grey otherwise
    ];

    let y = 220;
    const labelX = width * 0.15;
    const valueX = width * 0.85;

    for (const reward of rewardsList) {
        // Draw the label
        ctx.font = '18px "Roboto", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`${reward.label}:`, labelX, y);

        // Draw the value
        ctx.font = 'bold 20px "Roboto", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = reward.color;
        ctx.fillText(`${reward.value}`, valueX, y);

        y += 50; // Vertical spacing
    }

    // Footer/Status Line
    ctx.fillStyle = streakBroken ? '#ff4d4d' : '#4CAF50'; // Red if broken, Green if maintained
    ctx.font = '16px "Roboto", sans-serif';
    ctx.textAlign = 'center';
    
    let footerMessage = `STREAK: +1 DAY (TOTAL: ${streakDay})`;
    if (streakBroken) {
        footerMessage = `STREAK_BROKEN: RESTARTING AT DAY 1`;
    }

    ctx.fillText(footerMessage, width / 2, 450);
    
    // SS Chance Info
    ctx.fillStyle = '#999999';
    ctx.font = '14px "Roboto", sans-serif';
    ctx.fillText(`SS Drop Chance: ${ssInfo.ssChance.toFixed(0)}%`, width / 2, 475);


    // Add decorative corner elements (kept from theme)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    const cornerSize = 20;
    // Top Left
    ctx.beginPath();
    ctx.moveTo(cardPadding + 5, cardPadding + 5 + cornerSize);
    ctx.lineTo(cardPadding + 5, cardPadding + 5);
    ctx.lineTo(cardPadding + 5 + cornerSize, cardPadding + 5);
    ctx.stroke();
    // Top Right
    ctx.beginPath();
    ctx.moveTo(width - cardPadding - 5 - cornerSize, cardPadding + 5);
    ctx.lineTo(width - cardPadding - 5, cardPadding + 5);
    ctx.lineTo(width - cardPadding - 5, cardPadding + 5 + cornerSize);
    ctx.stroke();
    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(cardPadding + 5, height - cardPadding - 5 - cornerSize);
    ctx.lineTo(cardPadding + 5, height - cardPadding - 5);
    ctx.lineTo(cardPadding + 5 + cornerSize, height - cardPadding - 5);
    ctx.stroke();
    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(width - cardPadding - 5 - cornerSize, height - cardPadding - 5);
    ctx.lineTo(width - cardPadding - 5, height - cardPadding - 5);
    ctx.lineTo(width - cardPadding - 5, height - cardPadding - 5 - cornerSize);
    ctx.stroke();


    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const imagePath = path.join(tempDir, `rewards_${Date.now()}.png`);
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
        .setName('crank')
        .setDescription('Claim your rewards for voting on Top.gg!'),
    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const now = Date.now();

        // --- LOAD ALL DATA ---
        let playersData = loadData(PLAYERS_FILE_PATH, {});
        let streakData = loadStreakData();
        
        // Ensure user player data exists
        if (!playersData[userId]) {
            playersData[userId] = { level: 1, exp: 0, money: 0, ramen: 0, ss: 0 };
        }
        const playerLevel = playersData[userId].level || 1;

        // Load streak tracker
        const trackerData = streakData[userId] || { lastVoteTime: 0, streak: 0 };
        const lastVoteTime = trackerData.lastVoteTime;
        
        // --- COOLDOWN CHECK ---
        if (cooldowns[userId] && now - cooldowns[userId] < COOLDOWN_DURATION) {
            const timeLeft = COOLDOWN_DURATION - (now - cooldowns[userId]);
            const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.editReply(`You've recently claimed your rewards! Please wait **${hoursLeft} hours and ${minutesLeft} minutes** before claiming again.`);
        }

        // --- STREAK & REWARD CALCULATION (Potential/Claimed) ---
        let currentStreak = trackerData.streak;
        let nextStreakDay = currentStreak + 1;
        let streakBroken = false;
        const timeSinceLastVote = now - lastVoteTime;

        if (currentStreak > 0 && timeSinceLastVote > STREAK_BREAK_MS) {
            nextStreakDay = 1;
            streakBroken = true;
        } else if (currentStreak === 0) {
            nextStreakDay = 1;
        }

        const rewardBonus = getStreakBonus(nextStreakDay);
        const ssRewardInfo = calculateBonusSSReward(nextStreakDay);

        // Full Rewards (Base + Streak Bonus + Level EXP)
        const fullRewards = {
            money: BASE_REWARD.money + rewardBonus.money_bonus,
            ramen: BASE_REWARD.ramen + rewardBonus.ramen_bonus,
            exp: BASE_REWARD.exp + playerLevel, 
            ss: ssRewardInfo.ss
        };
        const dayDisplay = nextStreakDay % STREAK_BONUSES.length || STREAK_BONUSES.length;

        try {
            const hasVoted = await topggApi.hasVoted(userId);

            if (hasVoted) {
                // --- APPLY REWARDS ---
                playersData[userId].exp = (playersData[userId].exp || 0) + fullRewards.exp;
                playersData[userId].money = (playersData[userId].money || 0) + fullRewards.money;
                playersData[userId].ramen = (playersData[userId].ramen || 0) + fullRewards.ramen;
                playersData[userId].ss = (playersData[userId].ss || 0) + fullRewards.ss;

                // --- UPDATE DATA FILES ---
                saveData(PLAYERS_FILE_PATH, playersData);

                // Update streak and cooldown
                streakData[userId] = {
                    lastVoteTime: now,
                    streak: nextStreakDay 
                };
                saveStreakData(streakData);
                cooldowns[userId] = now;
                saveData(COOLDOWNS_FILE_PATH, cooldowns);

                // --- GENERATE IMAGE AND SEND ---
                const imagePath = await generateRewardsImage(
                    interaction.user.username, 
                    nextStreakDay, 
                    fullRewards, 
                    ssRewardInfo,
                    streakBroken
                );
                const rewardsAttachment = new AttachmentBuilder(imagePath);

                await interaction.editReply({
                    content: `Vote successful! Rewards for **Streak Day ${dayDisplay}** have been transferred to your inventory.`,
                    files: [rewardsAttachment]
                });
                
                // Clean up the temporary file
                fs.unlinkSync(imagePath);

            } else {
                // --- SHOW PROMPT (Not Voted) ---
                const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;
                let infoMessage = streakBroken 
                    ? `Your streak of **${currentStreak}** days was broken. Vote now to start a new streak at **Day 1**!`
                    : `You are currently on a **${currentStreak}** day streak. Vote now to claim **Day ${dayDisplay}** rewards!`;

                let rewardsSummary = `**Ryo**: ${fullRewards.money.toLocaleString()} | **Ramen**: ${fullRewards.ramen} | **EXP**: ${fullRewards.exp}\n` +
                                     `**Bonus SS Chance**: ${ssRewardInfo.ssChance.toFixed(0)}%`;

                await interaction.editReply({
                    content: `You haven't voted for me yet, Ninja!\n\n${infoMessage}\n\n**Potential Rewards for Day ${dayDisplay}**:\n${rewardsSummary}\n\n[CLICK HERE TO VOTE AND CLAIM REWARDS](${voteUrl})`,
                });
            }
        } catch (error) {
            console.error('Error during Top.gg vote check or reward process:', error);
            await interaction.editReply('A critical error occurred while processing your vote. Please check bot logs.');
        }
    },
};