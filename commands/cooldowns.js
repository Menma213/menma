const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Default cooldown durations in ms
const DEFAULT_COOLDOWNS = {
    drank: 9 * 60 * 1000,
    brank: 12 * 60 * 1000,
    arank: 20 * 60 * 1000,
    srank: 18 * 60 * 1000,
    trials: 25 * 60 * 1000
};

// Premium role IDs (must match your server)
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";

// Premium cooldowns (match logic in brank/arank/srank/trials)
const PREMIUM_COOLDOWNS = {
    drank: {
        [JINCHURIKI_ROLE]: 5 * 60 * 1000,
        [LEGENDARY_ROLE]: 7 * 60 * 1000,
        [DONATOR_ROLE]: 8 * 60 * 1000
    },
    brank: {
        [JINCHURIKI_ROLE]: 5.5 * 60 * 1000,
        [LEGENDARY_ROLE]: 8 * 60 * 1000,
        [DONATOR_ROLE]: 9 * 60 * 1000
    },
    arank: {
        [JINCHURIKI_ROLE]: 12 * 60 * 1000,
        [LEGENDARY_ROLE]: 15 * 60 * 1000,
        [DONATOR_ROLE]: 17 * 60 * 1000
    },
    srank: {
        [JINCHURIKI_ROLE]: 10 * 60 * 1000,
        [LEGENDARY_ROLE]: 12 * 60 * 1000,
        [DONATOR_ROLE]: 13 * 60 * 1000
    },
    trials: {
        [JINCHURIKI_ROLE]: 13 * 60 * 1000,
        [LEGENDARY_ROLE]: 16 * 60 * 1000,
        [DONATOR_ROLE]: 18 * 60 * 1000
    }
};

/**
 * Formats a given number of milliseconds into a human-readable string.
 * @param {number} ms - The number of milliseconds.
 * @returns {string} The formatted cooldown string.
 */
function getCooldownString(ms) {
    if (ms <= 0) return "Ready";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours ? hours + "h " : ""}${minutes ? minutes + "m " : ""}${seconds}s`;
}

/**
 * Generates the cooldowns image with a dynamic, unique style.
 * @param {Object} cooldowns - The cooldowns object.
 * @returns {Buffer} The image buffer.
 */
async function generateCooldownsImage(cooldowns) {
    // New portrait dimensions for a profile card style
    const width = 400, height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Solid dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw a subtle background layer for depth with glowing lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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

    // Main card shape
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

    // Draw the main card with a gradient border
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(1, '#ff00ff');
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

    // Draw the main title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Roboto", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('C O O L D O W N S', width / 2, 90);

    // Draw a stylized divider line below the title
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.25, 120);
    ctx.lineTo(width * 0.75, 120);
    ctx.stroke();

    // Draw cooldowns
    const labels = [
        { label: "Drank", value: cooldowns.drank },
        { label: "Brank", value: cooldowns.brank },
        { label: "Arank", value: cooldowns.arank },
        { label: "Srank", value: cooldowns.srank },
        { label: "Trials", value: cooldowns.trials }
    ];
    let y = 180;
    const labelX = width * 0.22; // Adjusted for more space
    const valueX = width * 0.78; // Adjusted for more space

    for (const { label, value } of labels) {
        // Draw the label
        ctx.font = '22px "Roboto", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#b3e6b3';
        ctx.fillText(`${label}:`, labelX, y);

        // Draw the value
        ctx.font = 'bold 22px "Roboto", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = value === "Ready" ? "#4CAF50" : "#fff";
        ctx.fillText(value, valueX, y);

        // Draw a small decorative line for visual separation
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(labelX, y + 25);
        ctx.lineTo(valueX, y + 25);
        ctx.stroke();

        y += 65; // Increased vertical spacing
    }
    
    // Add decorative corner elements
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    const cornerSize = 20;
    ctx.beginPath();
    ctx.moveTo(cardPadding + 5, cardPadding + 5 + cornerSize);
    ctx.lineTo(cardPadding + 5, cardPadding + 5);
    ctx.lineTo(cardPadding + 5 + cornerSize, cardPadding + 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width - cardPadding - 5 - cornerSize, cardPadding + 5);
    ctx.lineTo(width - cardPadding - 5, cardPadding + 5);
    ctx.lineTo(width - cardPadding - 5, cardPadding + 5 + cornerSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cardPadding + 5, height - cardPadding - 5 - cornerSize);
    ctx.lineTo(cardPadding + 5, height - cardPadding - 5);
    ctx.lineTo(cardPadding + 5 + cornerSize, height - cardPadding - 5);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(width - cardPadding - 5 - cornerSize, height - cardPadding - 5);
    ctx.lineTo(width - cardPadding - 5, height - cardPadding - 5);
    ctx.lineTo(width - cardPadding - 5, height - cardPadding - 5 - cornerSize);
    ctx.stroke();

    return canvas.toBuffer();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('View your cooldowns for drank, brank, arank, srank, and trials'),

    async execute(interaction) {
        const userId = interaction.user.id;
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }
        const now = Date.now();

        // Get last times (default to 0 if missing)
        const lastDrank = user.lastdrank || 0;
        const lastBrank = user.lastbrank || 0;
        const lastArank = user.lastArank || 0;
        const lastSrank = user.lastsrank || 0;
        // Trials: check all possible keys for compatibility
        const lastTrials = user.LastTrials || user.lastTrials || user.lastTrial || 0;

        // Determine premium role for cooldowns
        let memberRoles = [];
        if (interaction.member && interaction.member.roles && interaction.member.roles.cache) {
            memberRoles = Array.from(interaction.member.roles.cache.keys());
        }
        let roleId = null;
        if (memberRoles.includes(JINCHURIKI_ROLE)) roleId = JINCHURIKI_ROLE;
        else if (memberRoles.includes(LEGENDARY_ROLE)) roleId = LEGENDARY_ROLE;
        else if (memberRoles.includes(DONATOR_ROLE)) roleId = DONATOR_ROLE;

        // Pick correct cooldowns for user
        function getUserCooldown(type) {
            if (roleId && PREMIUM_COOLDOWNS[type] && PREMIUM_COOLDOWNS[type][roleId]) {
                return PREMIUM_COOLDOWNS[type][roleId];
            }
            return DEFAULT_COOLDOWNS[type];
        }

        // Calculate remaining cooldowns
        const drankCD = getCooldownString(getUserCooldown('drank') - (now - lastDrank));
        const brankCD = getCooldownString(getUserCooldown('brank') - (now - lastBrank));
        const arankCD = getCooldownString(getUserCooldown('arank') - (now - lastArank));
        const srankCD = getCooldownString(getUserCooldown('srank') - (now - lastSrank));
        const trialsCD = getCooldownString(getUserCooldown('trials') - (now - lastTrials));

        const cooldowns = {
            drank: drankCD,
            brank: brankCD,
            arank: arankCD,
            srank: srankCD,
            trials: trialsCD
        };

        await interaction.deferReply();
        const imgBuffer = await generateCooldownsImage(cooldowns);
        const attachment = new AttachmentBuilder(imgBuffer, { name: 'cooldowns.png' });
        await interaction.editReply({
            content: "",
            files: [attachment]
        });
    }
};
