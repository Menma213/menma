const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const HOKAGE_ROLE_ID = '1349245807995387915'; // Use your Hokage role ID

const DEFENSE_LEVELS = [
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

// Provide your background image link here
const BG_IMAGE_URL = 'https://cdnb.artstation.com/p/assets/images/images/000/285/577/large/Final_1.jpg?1415408493';

function getVillage() {
    if (!fs.existsSync(villagePath)) {
        const obj = { iron: 0, wood: 0, rope: 0, defense: 0, turrets: {} };
        for (let i = 1; i <= 10; i++) obj.turrets[i] = { hp: 0, max: DEFENSE_LEVELS[i-1].cost };
        fs.writeFileSync(villagePath, JSON.stringify(obj, null, 2));
        return obj;
    }
    const v = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
    if (!v.turrets) {
        v.turrets = {};
        for (let i = 1; i <= 10; i++) v.turrets[i] = { hp: 0, max: DEFENSE_LEVELS[i-1].cost };
    }
    return v;
}

function saveVillage(village) {
    fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
}

async function generateDefenseImage(village) {
    const width = 600, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw background image with 30% opacity
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
    ctx.fillText('Village Defenses', width / 2, 50);

    // Draw turrets info
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    let y = 100;
    for (let i = 1; i <= 10; i++) {
        const t = village.turrets[i];
        let text;
        if (!t || t.hp === 0) {
            text = `Turret Level ${i}: Locked`;
        } else {
            text = `Turret Level ${i}: ${t.hp}/${t.max}`;
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(text, 60, y);
        y += 35;
    }

    // Draw materials
    ctx.font = '18px Arial';
    ctx.fillStyle = '#b3e6b3';
    ctx.fillText(`Village Resources: Iron: ${village.iron}   Wood: ${village.wood}   Rope: ${village.rope}`, 60, y + 30);

    return canvas.toBuffer();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defense')
        .setDescription('Build or view village defenses (Hokage only)')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Defense level to build/repair (1-10)')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(HOKAGE_ROLE_ID)) {
            return interaction.reply({ content: "Only the Hokage can use this command.", ephemeral: true });
        }
        const level = interaction.options.getInteger('level');
        let village = getVillage();

        if (!level) {
            // Show all turrets as a single image
            const imgBuffer = await generateDefenseImage(village);
            const attachment = new AttachmentBuilder(imgBuffer, { name: 'defenses.png' });
            return interaction.reply({
                content: "**Village Defenses:**",
                files: [attachment]
            });
        }

        // Build/repair a turret
        if (level < 1 || level > 10) {
            return interaction.reply({ content: "Defense level must be between 1 and 10.", ephemeral: true });
        }
        const cost = DEFENSE_LEVELS[level - 1].cost;
        if (village.iron < cost || village.wood < cost || village.rope < cost) {
            return interaction.reply({ content: `Not enough materials! Need ${cost} of each (iron, wood, rope).`, ephemeral: true });
        }
        village.iron -= cost;
        village.wood -= cost;
        village.rope -= cost;
        village.turrets[level] = { hp: cost, max: cost };
        village.defense = Math.max(village.defense || 0, level);
        saveVillage(village);

        // Show updated image after building
        const imgBuffer = await generateDefenseImage(village);
        const attachment = new AttachmentBuilder(imgBuffer, { name: 'defenses.png' });
        return interaction.reply({
            content: `Defense turret level ${level} built!`,
            files: [attachment]
        });
    }
};
