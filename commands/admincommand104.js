const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const ALLOWED_COLORS = ['default', 'grey', 'donator', 'legendary', 'jinchuriki', 'blue', 'cyan', 'green', 'orange', 'frost', 'akatsuki'];
const ADMIN_ROLE_ID = '1381268854776529028'; // Replace with your actual admin role ID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admincommand104')
        .setDescription('Set a user\'s profile color (admin only)')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('Target user')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Color: default, grey, donator, legendary, jinchuriki, blue, cyan, green, orange, frost')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Only allow admins (admin role)
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const user = interaction.options.getUser('user');
        const color = interaction.options.getString('color').toLowerCase();
        if (!ALLOWED_COLORS.includes(color)) {
            return interaction.reply({ content: `Invalid color. Allowed: ${ALLOWED_COLORS.join(', ')}`, ephemeral: true });
        }
        let users = {};
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
        if (!users[user.id]) {
            return interaction.reply({ content: 'User not found in database.', ephemeral: true });
        }
        users[user.id].profileColor = color;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        await interaction.reply({ content: `Set ${user.username}'s profile color to ${color}.`, ephemeral: true });
    }
};