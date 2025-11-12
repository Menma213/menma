const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

// --- Configuration ---
const SERVER_NAME = "Shinobi RPG Official Server";
const WELCOME_CHANNEL = "1388552015311011911";

// Naruto Theme Colors (Konoha-style)
const THEME = {
    primary: '#F59E0B', // Konoha Orange
    secondary: '#1F2937', // Dark Gray/Black (Card Background)
    accent: '#EF4444', // Red Accent
    background: '#111827', // Deep background
};

// Assuming the bot has access to fonts like Arial as per profile.js setup
try {
    // You should ensure these fonts are registered in your main bot entry point
    // For this example, we assume Arial is available.
} catch (err) {
    console.warn('Font registration skipped in welcome.js. Ensure fonts are registered globally.');
}

/**
 * Generates the welcome card image for a new user.
 * @param {object} member The Discord GuildMember object.
 * @returns {Buffer} The generated PNG image buffer.
 */
async function generateWelcomeCard(member) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Background (Naruto-themed pattern/color)
    ctx.fillStyle = THEME.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle gradient/shadow for depth
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, THEME.secondary);
    gradient.addColorStop(0.5, THEME.background);
    gradient.addColorStop(1, THEME.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Konoha-orange border along the left edge
    ctx.fillStyle = THEME.primary;
    ctx.fillRect(0, 0, 10, canvas.height);

    // 2. Load and Draw Avatar
    const avatarSize = 128;
    const avatarX = 50;
    const avatarY = (canvas.height / 2) - (avatarSize / 2);

    let avatar;
    try {
        // Discord utility to get the user's avatar URL
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        avatar = await loadImageWithRetry(avatarUrl);
    } catch (err) {
        console.error('Error loading avatar for welcome card:', err);
        // Fallback placeholder
        ctx.fillStyle = '#333333';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        avatar = null;
    }

    // Draw the orange headband border
    ctx.strokeStyle = THEME.primary;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avatarX + (avatarSize / 2), avatarY + (avatarSize / 2), (avatarSize / 2) + 5, 0, Math.PI * 2, true);
    ctx.stroke();

    // Draw the avatar (clipped to a circle)
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + (avatarSize / 2), avatarY + (avatarSize / 2), avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    }

    // 3. Text Content

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(member.user.username, 200, 75);

    // Welcome Message
    ctx.fillStyle = '#cccccc';
    ctx.font = '24px Arial';
    ctx.fillText("has joined the Shinobi World!", 200, 120);

    // Server Call-to-Action
    ctx.fillStyle = THEME.primary;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Visit ${WELCOME_CHANNEL} to begin your Genin training!`, 200, 160);

    // Server Name Footer
    ctx.fillStyle = THEME.accent;
    ctx.font = 'italic 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(SERVER_NAME, canvas.width - 25, canvas.height - 20);

    return canvas.toBuffer('image/png');
}

// --- Utility Functions (Copied from profile.js for dependency) ---

/**
 * Utility to load an image with a retry, attempting JPG if PNG fails.
 * @param {string} url Image URL.
 * @returns {Promise<Image>} Loaded Image object.
 */
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

/**
 * Converts hex color to RGB string (mostly for internal use if needed).
 * @param {string} hex Hex color code.
 * @returns {string} RGB string (e.g., "245, 158, 11").
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
        '255, 255, 255';
}


module.exports = { generateWelcomeCard, WELCOME_CHANNEL };