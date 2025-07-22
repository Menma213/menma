const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Cooldown durations in ms
const COOLDOWNS = {
    drank: 9 * 60 * 1000,   
    brank: 12 * 60 * 1000,        
    arank: 20 * 60 * 1000,   
    srank: 18 * 60 * 1000,    
    trials: 20 * 60 * 1000   
};

function getCooldownString(ms) {
    if (ms <= 0) return "Ready";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
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
        const lastTrials = user.lastTrials || user.lastTrial || 0;

        // Calculate remaining cooldowns
        const drankCD = getCooldownString(COOLDOWNS.drank - (now - lastDrank));
        const brankCD = getCooldownString(COOLDOWNS.brank - (now - lastBrank));
        const arankCD = getCooldownString(COOLDOWNS.arank - (now - lastArank));
        const srankCD = getCooldownString(COOLDOWNS.srank - (now - lastSrank));
        const trialsCD = getCooldownString(COOLDOWNS.trials - (now - lastTrials));

        const embed = new EmbedBuilder()
            .setTitle("Cooldowns")
            .setColor("#4B0082")
            .setDescription(
                "```" +
                `Drank:  ${drankCD}\n` +
                `Brank:  ${brankCD}\n` +
                `Arank:  ${arankCD}\n` +
                `Srank:  ${srankCD}\n` +
                `Trials: ${trialsCD}\n` +
                "```"
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
