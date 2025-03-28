const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/users.json'); // Path to user data
const mentorsPath = path.join(__dirname, '../data/mentors.json'); // Path to mentors.json

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Choose a mentor based on your rank.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first. Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];

        if (player.mentor) {
            return interaction.reply({ content: `You already have a mentor: **${player.mentor}**. You cannot change mentors.`, ephemeral: true });
        }

        if (!fs.existsSync(mentorsPath)) {
            return interaction.reply({ content: "Mentor data is missing. Please contact an admin.", ephemeral: true });
        }

        const mentors = JSON.parse(fs.readFileSync(mentorsPath, 'utf8'));

        let playerRank = player.rank || 'Genin';  // Default rank is Genin
        let availableMentors = mentors[playerRank];

        if (!availableMentors) {
            return interaction.reply({ content: "No mentors available for your rank.", ephemeral: true });
        }

        let selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_mentor')
            .setPlaceholder('Choose your mentor')
            .addOptions(
                Object.keys(availableMentors).map(mentor => ({
                    label: mentor,
                    value: mentor
                }))
            );

        let row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ content: "Select a mentor from the list:", components: [row], ephemeral: true });

        const filter = i => i.user.id === userId && i.customId === 'select_mentor';

        interaction.channel.awaitMessageComponent({ filter, time: 30000 })
            .then(selected => {
                let chosenMentor = selected.values[0];

                // Check if the mentor requires a clan and if the player meets the requirement
                let mentorData = availableMentors[chosenMentor];
                if (mentorData.clan && player.clan !== mentorData.clan) {
                    return selected.reply({ content: `You cannot choose **${chosenMentor}** because you are not in the **${mentorData.clan} Clan**.`, ephemeral: true });
                }

                // Assign mentor to the player
                player.mentor = chosenMentor;
                player.mentorExp = 0; // Initialize Mentor EXP
                users[userId] = player;

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                selected.reply({ content: `You have chosen **${chosenMentor}** as your mentor! Gain Mentor EXP to learn new jutsu.`, ephemeral: true });
            })
            .catch(() => interaction.followUp({ content: "Mentor selection timed out.", ephemeral: true }));
    }
};
