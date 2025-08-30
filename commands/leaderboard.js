// leaderboard.js
// This script generates a GIF of a leaderboard with a semi-transparent GIF background.

const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gifencoder'); // Corrected library name
const gifFrames = require('gif-frames');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Adjust these variables to match your project's needs.
const WIDTH = 1080;
const HEIGHT = 1920;
const BACKGROUND_GIF_PATH = path.join(__dirname, '../../menma/data/background.gif');
const OUTPUT_GIF_PATH = path.join(__dirname, 'temp', 'leaderboard.gif');

// Sample leaderboard data
const leaderboardData = [
  { name: 'Ninja 1', score: 9999, avatar: 'https://i.pravatar.cc/150?u=1' },
  { name: 'Ninja 2', score: 9500, avatar: 'https://i.pravatar.cc/150?u=2' },
  { name: 'Ninja 3', score: 9000, avatar: 'https://i.pravatar.cc/150?u=3' },
  { name: 'Ninja 4', score: 8750, avatar: 'https://i.pravatar.cc/150?u=4' },
  { name: 'Ninja 5', score: 8500, avatar: 'https://i.pravatar.cc/150?u=5' },
  { name: 'Ninja 6', score: 8000, avatar: 'https://i.pravatar.cc/150?u=6' },
  { name: 'Ninja 7', score: 7500, avatar: 'https://i.pravatar.cc/150?u=7' },
  { name: 'Ninja 8', score: 7000, avatar: 'https://i.pravatar.cc/150?u=8' },
];

/**
 * Generates a GIF of the leaderboard with an animated background.
 * @param {Array<Object>} data The leaderboard data to display.
 */
async function generateGifLeaderboard(data) {
  try {
    // Ensure the output directory exists
    if (!fs.existsSync(path.dirname(OUTPUT_GIF_PATH))) {
      fs.mkdirSync(path.dirname(OUTPUT_GIF_PATH), { recursive: true });
    }

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Create a new GIF encoder with a 100ms delay between frames and infinite repeat
    const encoder = new GIFEncoder(WIDTH, HEIGHT);
    encoder.setDelay(100); // 100ms
    encoder.setRepeat(0); // 0 for infinite loop
    encoder.start();

    // Get frames from the background GIF
    const frameData = await gifFrames({ url: BACKGROUND_GIF_PATH, frames: 'all', outputType: 'canvas' });

    if (frameData.length === 0) {
        console.error('Error: No frames found in the background GIF.');
        return;
    }

    // Loop through each frame of the background GIF
    for (const frame of frameData) {
      // Clear the canvas for the new frame
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // --- Draw Background Frame with 50% Opacity ---
      ctx.globalAlpha = 0.5;
      const backgroundFrameImage = frame.getImage();
      ctx.drawImage(backgroundFrameImage, 0, 0, WIDTH, HEIGHT);
      
      // Reset global alpha for the rest of the drawing
      ctx.globalAlpha = 1.0;

      // --- Draw Leaderboard Content ---
      
      // Title
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 96px "Inter"';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText('Ninja Leaderboard', WIDTH / 2, 150);
      
      // Draw each entry
      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        const yPos = 300 + i * 150;
        
        // --- Draw Avatar ---
        try {
          const avatarImage = await loadImage(entry.avatar);
          ctx.save();
          ctx.beginPath();
          ctx.arc(150, yPos, 60, 0, Math.PI * 2, false);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatarImage, 90, yPos - 60, 120, 120);
          ctx.restore();
        } catch (error) {
          console.error(`Failed to load avatar for ${entry.name}:`, error.message);
        }
        
        // --- Draw Rank, Name, and Score ---
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFD700'; // Gold color for rank
        ctx.font = 'bold 72px "Inter"';
        ctx.fillText(`${i + 1}.`, 240, yPos + 25);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px "Inter"';
        ctx.fillText(entry.name, 350, yPos + 25);
        
        ctx.fillStyle = '#fff';
        ctx.font = '48px "Inter"';
        ctx.textAlign = 'right';
        ctx.fillText(entry.score.toLocaleString(), WIDTH - 50, yPos + 20);
      }

      // Add the final composite frame to the encoder
      encoder.addFrame(ctx);
    }
    
    // Finalize the GIF and save to file
    encoder.finish();
    const gifBuffer = encoder.out.data; // Corrected from .getData() to .data
    fs.writeFileSync(OUTPUT_GIF_PATH, gifBuffer);

    console.log(`Leaderboard GIF generated successfully at: ${OUTPUT_GIF_PATH}`);

  } catch (error) {
    console.error('An error occurred during GIF generation:', error);
  }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Generate a leaderboard GIF with an animated background.'),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            await generateGifLeaderboard(leaderboardData);
            const file = fs.readFileSync(OUTPUT_GIF_PATH);
            await interaction.editReply({
                content: 'Here is the leaderboard!',
                files: [{ attachment: file, name: 'leaderboard.gif' }]
            });
        } catch (error) {
            await interaction.editReply('Failed to generate leaderboard GIF.');
        }
    }
};
