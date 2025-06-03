const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const GUARD_ROLE_ID = 'YOUR_GUARD_ROLE_ID'; // Replace with your Guard role ID
const GUARD_IMAGE = 'https://i.imgur.com/8lQz4yT.png'; // Example image

function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guard')
        .setDescription('Safeguard the Hokage\'s office for 6 hours (Guard only)'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const guild = interaction.guild;
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user || user.role !== "Guard") {
            return interaction.reply({ content: "Only Guards can use this command.", ephemeral: true });
        }
        // Guard cooldown: 6 hours
        const now = Date.now();
        if (user.lastguard && now - user.lastguard < 6 * 60 * 60 * 1000) {
            const left = 6 * 60 * 60 * 1000 - (now - user.lastguard);
            return interaction.reply({ content: `You can use this again in ${getCooldownString(left)}.`, ephemeral: true });
        }
        user.lastguard = now;

        // Roll for CD reset
        let resetType = null;
        let resetMsg = '';
        const roll = Math.random() * 100;
        if (roll < 70) {
            user.lastdrank = null;
            resetType = 'drank';
            resetMsg = 'Your Drank cooldown has been reset!';
        } else if (roll < 95) {
            user.lastbrank = null;
            resetType = 'brank';
            resetMsg = 'Your Brank cooldown has been reset!';
        } else {
            user.lastsrank = null;
            resetType = 'srank';
            resetMsg = 'Your Srank cooldown has been reset!';
        }

        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        await interaction.reply({
            content: `You safeguarded the Hokage's office for 6 hours.\nReward: free cd reset on **${resetType}**!\n${resetMsg}`,
            files: [new AttachmentBuilder(GUARD_IMAGE)]
        });
    }
};
