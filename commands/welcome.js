// Use gif-frames and gifwrap for modern GIF manipulation
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const BASE_GIF_URL = 'https://i.imgur.com/CEr79rt.gif';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome a user with a special gif!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to welcome')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user');
        const avatarUrl = user.displayAvatarURL({ format: 'png', size: 128 });

        // Download the base gif as a buffer and save as a file, then pass the file path to gifwrap
        const https = require('https');
        const os = require('os');
        function downloadToFile(url, filePath) {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(filePath);
                https.get(url, res => {
                    res.pipe(file);
                    file.on('finish', () => file.close(resolve));
                    res.on('error', reject);
                });
            });
        }
        const tmpDir = path.join(__dirname, '../../menma/tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const gifFilePath = path.join(tmpDir, `base_${user.id}_${Date.now()}.gif`);
        await downloadToFile(BASE_GIF_URL, gifFilePath);

        // Decode GIF using gifwrap from file path
        const { GifCodec, GifFrame, BitmapImage } = require('gifwrap');
        const codec = new GifCodec();
        const gif = await codec.decodeGif(fs.readFileSync(gifFilePath));

        // Load the user's avatar
        const { createCanvas, loadImage } = require('canvas');
        const avatarImg = await loadImage(avatarUrl);

        // Prepare frames
        const frames = [];
        for (let i = 0; i < gif.frames.length; i++) {
            const frame = gif.frames[i];
            const canvas = createCanvas(frame.bitmap.width, frame.bitmap.height);
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(frame.bitmap.width, frame.bitmap.height);
            imgData.data.set(frame.bitmap.data);
            ctx.putImageData(imgData, 0, 0);

            // Overlay avatar on poke frames (adjust frame numbers as needed)
            if (i >= 7 && i <= 10) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(180, 250, 32, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImg, 148, 218, 64, 64);
                ctx.restore();
            }

            const pngBuffer = canvas.toBuffer('image/png');
            const bmp = await BitmapImage.decode(pngBuffer);
            frames.push(new GifFrame(bmp, { delayCentisecs: frame.delayCentisecs }));
        }

        // Encode new GIF
        const outGif = await codec.encodeGif(frames, { loops: 0 });
        const gifPath = path.join(tmpDir, `welcome_${user.id}_${Date.now()}.gif`);
        fs.writeFileSync(gifPath, outGif.buffer);

        const attachment = new AttachmentBuilder(gifPath, { name: 'welcome.gif' });

        await interaction.editReply({
            content: `Welcome, ${user}! Kakashi has a special greeting for you...`,
            files: [attachment]
        });

        // Clean up temp files after sending
        setTimeout(() => {
            fs.unlink(gifPath, () => {});
            fs.unlink(gifFilePath, () => {});
        }, 10000);
    }
};

