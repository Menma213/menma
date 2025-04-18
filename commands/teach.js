const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path configurations
const usersPath = path.join(__dirname, '../../menma/data/users.json');
const jutsuDataPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');
const allowedTeacherIds = ["835408109899219004", "961918563382362122"];

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
                .filter(([key, jutsu]) => 
                    jutsu.name.toLowerCase().includes(focusedValue) || 
                    key.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map(([key, jutsu]) => ({
                    name: `${jutsu.name} (${key})`,
                    value: key
                }));
            
            await interaction.respond(filtered);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            // Permission check
            if (!allowedTeacherIds.includes(interaction.user.id)) {
                return interaction.reply("❌ You are not authorized to use this command.");
            }

            // Load all data files with error handling
            let jutsus, jutsuData;
            try {
                jutsus = JSON.parse(fs.readFileSync(jutsusPath));
                jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath));
            } catch (err) {
                console.error('File read error:', err);
                return interaction.reply("❌ Failed to load data files.");
            }

            // Get command options
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            // Validate jutsu exists in global storage
            if (!jutsus[jutsuKey]) {
                return interaction.reply("❌ That jutsu doesn't exist in the global registry.");
            }

            const jutsuName = jutsus[jutsuKey].name;

            // Initialize student's jutsu registry if needed
            if (!jutsuData[student.id]) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            // Check if student already knows the jutsu
            if (jutsuData[student.id].usersjutsu.includes(jutsuKey)) {
                return interaction.reply(`ℹ️ ${student.username} already knows ${jutsuName}.`);
            }

            // Add jutsu to student's registry
            jutsuData[student.id].usersjutsu.push(jutsuKey);

            // Save changes with error handling
            try {
                fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));
            } catch (err) {
                console.error('File write error:', err);
                return interaction.reply("❌ Failed to save changes to database.");
            }

            return interaction.reply(`✅ Successfully taught ${jutsuName} to ${student.username}!`);
        } catch (error) {
            console.error('Error in teach command:', error);
            return interaction.reply("❌ An unexpected error occurred while processing this command.");
        }
    }
};
