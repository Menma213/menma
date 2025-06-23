const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const HOKAGE_ROLE_ID = '1381606285577031772'; // Replace with the actual Hokage role ID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('appoint')
        .setDescription('Appoint an Anbu to a specific role')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Anbu to appoint')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role to assign')
                .setRequired(true)
                .addChoices(
                    { name: 'Spy', value: 'spy' },
                    { name: 'Guard', value: 'guard' },
                    { name: 'Right Hand Man', value: 'right_hand_man' }
                )
        ),
    async execute(interaction) {
        // Check if the user has the Hokage role
        if (!interaction.member.roles.cache.has(HOKAGE_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const role = interaction.options.getString('role');
        const guild = interaction.guild;

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[targetUser.id] || users[targetUser.id].occupation !== "Anbu") {
            return interaction.reply({ content: "This user is not an Anbu.", ephemeral: true });
        }

        // Role-specific checks
        if (role === 'spy') {
            const spies = Object.values(users).filter(user => user.occupation === "Anbu" && user.role === "Spy");
            if (spies.length >= 5) {
                return interaction.reply({ content: "There can only be 5 spies.", ephemeral: true });
            }
        } else if (role === 'right_hand_man') {
            const rightHandMan = Object.values(users).find(user => user.occupation === "Anbu" && user.role === "Right Hand Man");
            if (rightHandMan) {
                return interaction.reply({ content: "There can only be one Right Hand Man.", ephemeral: true });
            }
        }

        // Assign the role in users.json
        users[targetUser.id].role = role === 'spy' ? "Spy" : role === 'guard' ? "Guard" : "Right Hand Man";
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        return interaction.reply({ content: `${targetUser.username} has been appointed as a ${users[targetUser.id].role}!`, ephemeral: false });
    }
};
