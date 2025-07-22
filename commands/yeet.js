const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// IDs of users allowed to use this command
const allowedUsers = ['961918563382362122', '835408109899219004']; // Replace 'user1' and 'user2' with actual user IDs

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yeet')
        .setDescription('Deletes a user profile from the database.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user whose profile you want to delete.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const executorId = interaction.user.id;

        // Check if the executor is allowed to use this command
        if (!allowedUsers.includes(executorId)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('target');
        const userId = targetUser.id;

        // Ensure the user data file exists
        if (!fs.existsSync(usersPath)) {
            fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        // Check if the user exists in the database
        if (!users[userId]) {
            return interaction.reply({
                content: `❌ Profile for <@${userId}> does not exist.`,
                ephemeral: true
            });
        }

        // Delete the user's profile
        delete users[userId];

        // Save the updated user data
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        await interaction.reply({
            content: `✅ Profile for <@${userId}> has been deleted.`,
            ephemeral: false
        });
    }
};
