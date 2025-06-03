const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const AKATSUKI_LEADER_ROLE_ID = '1371076470369288223';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrole')
        .setDescription('Set Akatsuki member role')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to set role for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role to assign')
                .setRequired(true)
                .addChoices(
                    { name: 'Co-Leader', value: 'Co-Leader' },
                    { name: 'Bruiser', value: 'Bruiser' },
                    { name: 'Scientist', value: 'Scientist' }
                )
        ),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID)) {
            return interaction.reply({ content: "Only the Akatsuki Leader can use this command.", ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const role = interaction.options.getString('role');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[targetUser.id] || users[targetUser.id].occupation !== "Akatsuki") {
            return interaction.reply({ content: "This user is not an Akatsuki member.", ephemeral: true });
        }
        // Unique role checks
        if (role === 'Co-Leader') {
            const exists = Object.values(users).find(u => u.occupation === "Akatsuki" && u.role === "Co-Leader");
            if (exists) return interaction.reply({ content: "There can only be one Co-Leader.", ephemeral: true });
        }
        users[targetUser.id].role = role;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        return interaction.reply({ content: `${targetUser.username} is now a ${role} of the Akatsuki!` });
    }
};
