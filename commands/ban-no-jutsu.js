const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban-no-jutsu')
        .setDescription('Ban a user with the forbidden Ban no Jutsu')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to use Ban no Jutsu.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
        }

        await member.ban({ reason: `Ban no Jutsu by ${interaction.user.tag}` });
        await interaction.reply(`BAN NO JUTSU SUCCESS`);
    }
};
