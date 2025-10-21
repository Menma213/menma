const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetcd')
        .setDescription('Reset all cooldowns for a user')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to reset cooldowns for')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Only allow admins to use this command (optional: remove if not needed)
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        if (!user) {
            return interaction.reply({ content: "User not found.", ephemeral: true });
        }

        // Load users.json
        let users = {};
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        if (!users[user.id]) {
            return interaction.reply({ content: "User is not enrolled.", ephemeral: true });
        }

        // Reset cooldown fields
        users[user.id].lastdrank = null;
        users[user.id].lastbrank = null;
        users[user.id].lastsrank = null;
        users[user.id].LastTrials = null;
        users[user.id].lastDungeon = null;
        users[user.id].lastArank = null;

        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        await interaction.reply({ content: `Cooldowns reset for <@${user.id}>.`, ephemeral: false });
    }
};
