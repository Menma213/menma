const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');

const BOMB_LEVELS = [
    { level: 1, cost: 100 },
    { level: 2, cost: 250 },
    { level: 3, cost: 500 },
    { level: 4, cost: 1000 },
    { level: 5, cost: 2000 },
    { level: 6, cost: 3000 },
    { level: 7, cost: 4000 },
    { level: 8, cost: 6000 },
    { level: 9, cost: 8000 },
    { level: 10, cost: 10000 }
];

// Use the same style as defense.js for the background image
const BG_IMAGE_URL = 'https://pbs.twimg.com/media/E4xRw7YVEAIto89.jpg';

function getAkatsuki() {
    if (!fs.existsSync(akatsukiPath)) {
        const obj = { metal: 0, gunpowder: 0, copper: 0, bombs: {} };
        for (let i = 1; i <= 10; i++) obj.bombs[i] = { damage: 0, max: BOMB_LEVELS[i-1].cost };
        fs.writeFileSync(akatsukiPath, JSON.stringify(obj, null, 2));
        return obj;
    }
    const a = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
    if (!a.bombs) {
        a.bombs = {};
        for (let i = 1; i <= 10; i++) a.bombs[i] = { damage: 0, max: BOMB_LEVELS[i-1].cost };
    }
    return a;
}
function saveAkatsuki(a) {
    fs.writeFileSync(akatsukiPath, JSON.stringify(a, null, 2));
}

async function generateBombImageWithBg(akatsuki) {
    const width = 600, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw background image with 30% opacity (same as defense.js)
    try {
        const bg = await loadImage(BG_IMAGE_URL);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(bg, 0, 0, width, height);
        ctx.globalAlpha = 1.0;
    } catch {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
    }

    // Draw title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Nuclear Chakra Bombs', width / 2, 50);

    // Draw bombs info
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    let y = 100;
    for (let i = 1; i <= 10; i++) {
        const b = akatsuki.bombs[i];
        let text;
        if (!b || b.damage === 0) {
            text = `Bomb Level ${i}: Locked`;
        } else {
            text = `Bomb Level ${i}: ${b.damage}/${b.max}`;
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(text, 60, y);
        y += 35;
    }

    // Draw materials
    ctx.font = '18px Arial';
    ctx.fillStyle = '#b3e6b3';
    ctx.fillText(`Akatsuki Resources: Metal: ${akatsuki.metal}   Gunpowder: ${akatsuki.gunpowder}   Copper: ${akatsuki.copper}`, 60, y + 30);

    return canvas.toBuffer();
}

// Add your Akatsuki Leader's Discord role ID here
const AKATSUKI_LEADER_ROLE_ID = "1381606426908033136"; // <-- Replace with the actual role ID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blueprint')
        .setDescription('View or create bomb blueprints (Akatsuki Leader only)')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Bomb level to create (1-10)')
                .setRequired(false)
        ),
    async execute(interaction) {
        try {
            await interaction.deferReply(); // Defer immediately to avoid timeout

            // Allow by role OR user ID for backward compatibility
            if (
                !interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID) &&
                interaction.user.id !== "1381606426908033136"
            ) {
                return interaction.editReply({ content: "Only the Akatsuki Leader can use this command." });
            }
            const level = interaction.options.getInteger('level');
            let akatsuki = getAkatsuki();

            if (!level) {
                const imgBuffer = await generateBombImageWithBg(akatsuki);
                const attachment = new AttachmentBuilder(imgBuffer, { name: 'bombs.png' });
                await interaction.editReply({
                    content: "**Nuclear Chakra Bomb Blueprints:**",
                    files: [attachment]
                });
                return;
            }

            if (level < 1 || level > 10) {
                return interaction.editReply({ content: "Bomb level must be between 1 and 10." });
            }
            const cost = BOMB_LEVELS[level - 1].cost;
            if (akatsuki.metal < cost || akatsuki.gunpowder < cost || akatsuki.copper < cost) {
                return interaction.editReply({ content: `Not enough materials! Need ${cost} of each (metal, gunpowder, copper).` });
            }
            akatsuki.metal -= cost;
            akatsuki.gunpowder -= cost;
            akatsuki.copper -= cost;
            akatsuki.bombs[level] = { damage: cost, max: cost };
            saveAkatsuki(akatsuki);

            const imgBuffer = await generateBombImageWithBg(akatsuki);
            const attachment = new AttachmentBuilder(imgBuffer, { name: 'bombs.png' });
            await interaction.editReply({
                content: `Nuclear Chakra Bomb level ${level} blueprint created!`,
                files: [attachment]
            });
        } catch (error) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.editReply({ content: "An error occurred while executing the command." });
            }
            console.error('Error executing blueprint:', error);
        }
    }
};
