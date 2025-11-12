const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shinobikick')
        .setDescription('Kicks a member from the server.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the kick')),

    async execute(interaction) {
        const userToKick = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const memberToKick = interaction.guild.members.cache.get(userToKick.id);

        if (!memberToKick) {
            return interaction.reply({ content: 'This user is not in the server!', ephemeral: true });
        }

        if (!interaction.member.permissions.has('KICK_MEMBERS')) {
            return interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
        }

        if (!memberToKick.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. They might have a role higher than mine or I lack the necessary permissions.', ephemeral: true });
        }

        try {
            await memberToKick.kick(reason);
            await interaction.reply(`Successfully kicked ${userToKick.tag} for: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while trying to kick the user.', ephemeral: true });
        }
    }
};