const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/users.json'); // Path to user data
const jutsuFolderPath = path.join(__dirname, '../jutsu'); // Path to jutsu folder
const allowedTeacherId = "961918563382362122"; // Only this Discord ID can teach

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teach')
        .setDescription('Teach a jutsu to a user (Admin Only).')
        .addUserOption(option => 
            option.setName('student')
                .setDescription('The user you want to teach the jutsu to')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('jutsu')
                .setDescription('The name of the jutsu to teach')
                .setRequired(true)),

    async execute(interaction) {
        const teacherId = interaction.user.id;

        // Check if the user is allowed to teach
        if (teacherId !== allowedTeacherId) {
            return interaction.reply({ content: "You are not allowed to use this command.", ephemeral: true });
        }

        const student = interaction.options.getUser('student');
        const jutsuName = interaction.options.getString('jutsu');

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[student.id]) {
            return interaction.reply({ content: `${student.username} is not enrolled. They need to use \`/enroll\` first.`, ephemeral: true });
        }

        let studentData = users[student.id];

        if (!studentData.learnedJutsu) {
            studentData.learnedJutsu = [];
        }

        // Check if the jutsu exists in the jutsu folder
        const jutsuFilePath = path.join(jutsuFolderPath, `${jutsuName}.json`);
        if (!fs.existsSync(jutsuFilePath)) {
            return interaction.reply({ content: `The jutsu **${jutsuName}** does not exist. Please provide a valid jutsu name.`, ephemeral: true });
        }

        // Check if they already know the jutsu
        if (studentData.learnedJutsu.includes(jutsuName)) {
            return interaction.reply({ content: `${student.username} has already learned **${jutsuName}**.`, ephemeral: true });
        }

        // Teach the jutsu
        studentData.learnedJutsu.push(jutsuName);
        users[student.id] = studentData;
        fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

        return interaction.reply({ content: `You have successfully taught **${jutsuName}** to ${student.username}! 🎉`, ephemeral: false });
    }
};
