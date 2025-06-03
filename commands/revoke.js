const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const SANNIN_ROLE_ID = '1349245907467505755';
const AUTHORIZED_USERS = ['961918563382362122', '835408109899219004'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revoke_sannin')
        .setDescription('Remove Sannin status and buffs from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to demote from Sannin')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            return interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: "That user is not in the server.", ephemeral: true });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userData = users[targetUser.id];

        if (!userData || userData.role !== "Sannin") {
            return interaction.reply({ content: "This user is not a Sannin.", ephemeral: true });
        }

        // Reduce all stats including chakra
        userData.health = Math.floor(userData.health / 1000000000000000000000000000000000000000);
        userData.power = Math.floor(userData.power / 1000000000000000000000000000000000000000);
        userData.defense = Math.floor(userData.defense / 10000000000000000000000000000000000000000000);
        userData.chakra = Math.floor(userData.chakra / 10000000000000000000000000000000000000000000);
        delete userData.role;

        try {
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await member.roles.remove(SANNIN_ROLE_ID);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "Error during Sannin revocation.", ephemeral: true });
        }

        return interaction.reply({ content: `${targetUser.username} has been stripped of the Sannin title. ⚔️`, ephemeral: false });
    }
};