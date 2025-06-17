const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const HOKAGE_ROLE_ID = '1381606285577031772'; // Replace with the actual Hokage role ID
const ANBU_ROLE_ID = '1382055740268744784'; // Replace with the actual Anbu role ID

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anbu')
        .setDescription('Appoint a user as an Anbu')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to appoint as Anbu')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Check if the user has the Hokage role
        if (!interaction.member.roles.cache.has(HOKAGE_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const guild = interaction.guild;

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[targetUser.id]) {
            return interaction.reply({ content: "This user is not enrolled in the system.", ephemeral: true });
        }

        // Add the Anbu role in Discord
        try {
            const member = await guild.members.fetch(targetUser.id);
            await member.roles.add(ANBU_ROLE_ID, "Appointed as Anbu by the Hokage");
        } catch (err) {
            return interaction.reply({ content: "Failed to add the Anbu role. Check bot permissions and role hierarchy.", ephemeral: true });
        }

        // Update the user's occupation in users.json
        users[targetUser.id].occupation = "Anbu";
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        return interaction.reply({ content: `${targetUser.username} has been appointed as an Anbu!`, ephemeral: false });
    }
};
