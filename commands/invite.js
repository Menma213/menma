const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const AKATSUKI_LEADER_ROLE_ID = '1381606426908033136';
const AKATSUKI_ROLE_ID = '1382055870229119159'; // <-- set this

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite a rogue ninja to the Akatsuki')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to invite')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID)) {
            return interaction.reply({ content: "Only the Akatsuki Leader can use this command.", ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[targetUser.id] || users[targetUser.id].occupation !== "Rogue") {
            return interaction.reply({ content: "This user is not a rogue ninja.", ephemeral: false });
        }
        users[targetUser.id].occupation = "Akatsuki";
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        // Add Akatsuki role in Discord
        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            await member.roles.add(AKATSUKI_ROLE_ID, "Joined the Akatsuki");
        } catch {}
        return interaction.reply({ content: `${targetUser.username} has joined the Akatsuki!` });
    }
};
