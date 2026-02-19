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
        .setDescription('[ADMIN] Manage user jutsu')
        .addSubcommand(sub =>
            sub.setName('give')
                .setDescription('Teach a jutsu to a user')
                .addUserOption(option => 
                    option.setName('student')
                        .setDescription('User to teach the jutsu to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('Jutsu to teach')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a jutsu from a user')
                .addUserOption(option => 
                    option.setName('student')
                        .setDescription('User to remove the jutsu from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('Jutsu to remove')
                        .setRequired(true)
                        .setAutocomplete(true))),

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
                return interaction.reply({ content: "❌ You are not authorized to use this command.", ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            // Load files
            let jutsus, jutsuData;
            try {
                jutsus = JSON.parse(fs.readFileSync(jutsusPath));
                jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath));
            } catch (err) {
                console.error('File read error:', err);
                return interaction.reply("❌ Failed to load data files.");
            }

            // Validate jutsu exists
            if (!jutsus[jutsuKey]) {
                return interaction.reply("❌ That jutsu doesn't exist in the global registry.");
            }

            const jutsuName = jutsus[jutsuKey].name;

            // Ensure student has registry
            if (!jutsuData[student.id]) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            // =========================
            // GIVE JUTSU
            // =========================
            if (subcommand === 'give') {

                if (jutsuData[student.id].usersjutsu.includes(jutsuKey)) {
                    return interaction.reply(`ℹ️ ${student.username} already knows ${jutsuName}.`);
                }

                jutsuData[student.id].usersjutsu.push(jutsuKey);

                fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));

                return interaction.reply(`✅ Successfully taught ${jutsuName} to ${student.username}!`);
            }

            // =========================
            // REMOVE JUTSU (UNTEACH)
            // =========================
            if (subcommand === 'remove') {

                if (!jutsuData[student.id].usersjutsu.includes(jutsuKey)) {
                    return interaction.reply(`ℹ️ ${student.username} does not know ${jutsuName}.`);
                }

                // Remove the jutsu
                jutsuData[student.id].usersjutsu = 
                    jutsuData[student.id].usersjutsu.filter(j => j !== jutsuKey);

                fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));

                return interaction.reply(`🗑️ Successfully removed ${jutsuName} from ${student.username}!`);
            }

        } catch (error) {
            console.error('Error in teach command:', error);
            return interaction.reply("❌ An unexpected error occurred while processing this command.");
        }
    }
};
