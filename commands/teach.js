const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path configurations
const usersPath = path.join(__dirname, '../../menma/data/users.json');
const jutsuDataPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');
const allowedTeacherIds = ["835408109899219004", "SECOND_OWNER_ID_HERE"];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teach')
        .setDescription('[ADMIN] Teach a jutsu to a user')
        .addUserOption(option => 
            option.setName('student')
                .setDescription('User to teach the jutsu to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('jutsu')
                .setDescription('Jutsu to teach')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const jutsus = JSON.parse(fs.readFileSync(jutsusPath));
            
            const filtered = Object.entries(jutsus)
                .filter(([_, jutsu]) => 
                    jutsu.name.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map(([key, jutsu]) => ({
                    name: jutsu.name,
                    value: key
                }));
            
            await interaction.respond(filtered);
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
    },

    async execute(interaction) {
        // Defer the reply first to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        try {
            // Permission check
            if (!allowedTeacherIds.includes(interaction.user.id)) {
                return interaction.editReply({ content: "❌ Unauthorized." });
            }

            // Load all data files
            const jutsus = JSON.parse(fs.readFileSync(jutsusPath));
            const users = JSON.parse(fs.readFileSync(usersPath));
            const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath));

            // Get command options
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            // Validate student
            if (!users[student.id]) {
                return interaction.editReply({ content: "❌ Student not enrolled." });
            }

            // Validate jutsu
            if (!jutsus[jutsuKey]) {
                return interaction.editReply({ content: "❌ Invalid jutsu selected." });
            }

            const jutsuName = jutsus[jutsuKey].name;

            // Initialize arrays if they don't exist
            if (!users[student.id].jutsu) users[student.id].jutsu = [];
            if (!jutsuData[student.id]?.usersjutsu) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            // Check if already known
            if (users[student.id].jutsu.includes(jutsuName)) {
                return interaction.editReply({ 
                    content: `✅ ${student.username} already knows ${jutsuName}.` 
                });
            }

            // Update data
            users[student.id].jutsu.push(jutsuName);
            jutsuData[student.id].usersjutsu.push(jutsuKey);

            // Save changes
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));

            return interaction.editReply({
                content: `✅ Successfully taught ${jutsuName} to ${student.username}!`,
                ephemeral: false
            });
        } catch (error) {
            console.error('Error in teach command:', error);
            return interaction.editReply({ 
                content: "❌ An error occurred while processing this command." 
            });
        }
    }
};

//thunderbird likes men :DD