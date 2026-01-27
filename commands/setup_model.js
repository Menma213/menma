const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Hardcoded owner ID for safety
const OWNER_ID = '835408109899219004';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_ai')
        .setDescription('Admin: Download and setup the local AI model (Gemma 2 2b)'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
        }

        await interaction.reply({ content: 'Initializing download for **Gemma 2 2b IT (Q4_K_S)**...', ephemeral: true });

        const MODEL_URL = "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_S.gguf";
        const MODELS_DIR = path.resolve(__dirname, '../models'); // Go up from commands/filename.js
        const MODEL_FILENAME = "gemma-2-2b-it-q4_k_s.gguf";
        const MODEL_PATH = path.join(MODELS_DIR, MODEL_FILENAME);

        // Ensure models directory exists
        if (!fs.existsSync(MODELS_DIR)) {
            try {
                fs.mkdirSync(MODELS_DIR, { recursive: true });
            } catch (e) {
                return interaction.editReply(` Failed to create models directory: ${e.message}`);
            }
        }

        if (fs.existsSync(MODEL_PATH)) {
            return interaction.editReply(`Model already exists at \`${MODEL_PATH}\`.\nNo action needed.`);
        }

        const file = fs.createWriteStream(MODEL_PATH);
        await interaction.editReply(` Starting download... (Target: 1.45 GB)`);

        let lastUpdate = Date.now();

        const request = https.get(MODEL_URL, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    handleDownload(redirectResponse, file, interaction, lastUpdate, MODEL_PATH);
                });
            } else {
                handleDownload(response, file, interaction, lastUpdate, MODEL_PATH);
            }
        });

        request.on('error', (err) => {
            fs.unlink(MODEL_PATH, () => { });
            interaction.editReply(` Network error: ${err.message}`);
        });
    }
};

function handleDownload(response, fileStream, interaction, lastUpdate, modelPath) {
    if (response.statusCode !== 200) {
        fs.unlink(modelPath, () => { });
        return interaction.editReply(` Download failed with status code: ${response.statusCode}`);
    }

    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloaded = 0;

    response.pipe(fileStream);

    response.on('data', (chunk) => {
        downloaded += chunk.length;
        const now = Date.now();
        // Update Discord status every 4 seconds to avoid rate limits
        if (now - lastUpdate > 4000) {
            lastUpdate = now;
            const percent = totalSize ? ((downloaded / totalSize) * 100).toFixed(1) : 'Unknown';
            const mb = (downloaded / 1024 / 1024).toFixed(1);
            const totalMb = totalSize ? (totalSize / 1024 / 1024).toFixed(1) : '???';

            interaction.editReply(` Downloading... **${percent}%**\n(${mb} MB / ${totalMb} MB)`);
        }
    });

    fileStream.on('finish', () => {
        fileStream.close(() => {
            interaction.editReply(` **Download Complete!**\nModel saved to: \`${modelPath}\`\n\n **Please restart the bot** to enable Local AI.`);
        });
    });

    fileStream.on('error', (err) => {
        fs.unlink(modelPath, () => { });
        interaction.editReply(` File write error: ${err.message}`);
    });
}
