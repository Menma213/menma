// brank.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle, getCooldownString } = require('./combinedcommands.js');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const JINCHURIKI_ROLE = "1385641469507010640";
const LEGENDARY_ROLE = "1385640798581952714";
const DONATOR_ROLE = "1385640728130097182";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Single NPC battle'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Cooldown system
        const now = Date.now();
        let cooldownMs = 12 * 60 * 1000;
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 5.5 * 60 * 1000;
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(7 * 60 * 1000);
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(8 * 60 * 1000);
        }

        if (users[userId].lastbrank && now - users[userId].lastbrank < cooldownMs) {
            const left = cooldownMs - (now - users[userId].lastbrank);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: false });
        }

        users[userId].lastbrank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        await interaction.deferReply({ ephemeral: false });

        const npcId = "NPC_Bandit";
        await runBattle(interaction, userId, npcId, 'brank');
    }
};