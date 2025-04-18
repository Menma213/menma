const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userDataPath = path.join(__dirname, '../data/users.json');
const mentorDataPath = path.join(__dirname, '../data/mentors.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Choose a mentor by typing their name!')
        .addStringOption(option =>
            option.setName('mentor_name')
                .setDescription('The mentor you want')
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const mentorName = interaction.options.getString('mentor_name');

        // Load user data
        let users = {};
        if (fs.existsSync(userDataPath)) {
            try {
                users = JSON.parse(fs.readFileSync(userDataPath, 'utf8'));
            } catch (err) {
                return interaction.reply({
                    content: "❌ Error loading user data. Contact an admin.",
                    ephemeral: true
                });
            }
        }

        // Check enrollment
        if (!users[userId]) {
            return interaction.reply({
                content: "❌ You need to **enroll first**! Use `/enroll`.",
                ephemeral: true
            });
        }

        const player = users[userId];

        // Check if the player already has a mentor (ignoring 'None')
        const currentMentor = (player.mentor || 'None').toLowerCase();
        if (currentMentor !== 'none') {
            return interaction.reply({
                content: `❌ You already have a mentor: **${player.mentor}**!`,
                ephemeral: true
            });
        }

        // Load mentor data
        let mentors;
        if (fs.existsSync(mentorDataPath)) {
            try {
                mentors = JSON.parse(fs.readFileSync(mentorDataPath, 'utf8'));
            } catch (err) {
                return interaction.reply({
                    content: "❌ Error loading mentor data. Contact an admin.",
                    ephemeral: true
                });
            }
        } else {
            return interaction.reply({
                content: "❌ Mentor data is missing! Contact an admin.",
                ephemeral: true
            });
        }

        const playerRank = player.rank || "Genin";
        const rankMentors = mentors[playerRank];

        // Mentor exists?
        if (!rankMentors || !rankMentors[mentorName]) {
            const available = rankMentors
                ? Object.keys(rankMentors).join(', ')
                : 'No mentors available for your rank.';
            return interaction.reply({
                content: `❌ **${mentorName}** is not available for **${playerRank}s**!\nAvailable mentors: ${available}`,
                ephemeral: true
            });
        }

        const chosenMentor = rankMentors[mentorName];

        // Check clan requirement
        if (chosenMentor.clan && player.clan !== chosenMentor.clan) {
            return interaction.reply({
                content: `❌ You must be in **${chosenMentor.clan} Clan** to choose ${mentorName}!`,
                ephemeral: true
            });
        }

        // Assign mentor
        player.mentor = mentorName;
        player.mentorExp = 0;
        users[userId] = player;

        fs.writeFileSync(userDataPath, JSON.stringify(users, null, 2));

        return interaction.reply({
            content: `🎉 **You chose ${mentorName} as your mentor!**\n> Start training to earn Mentor EXP!`,
            ephemeral: true
        });
    }
};
