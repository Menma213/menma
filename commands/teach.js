const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Paths
const jutsuDataPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');

// Authorized Teachers
const authorizedTeachers = {
    "835408109899219004": "Thunder",
    "961918563382362122": "Asukky",
    "818893461881094175": "Husker"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teach')
        .setDescription('Administrative jutsu management')
        .addSubcommand(sub =>
            sub.setName('give')
                .setDescription('Grant a jutsu to a user')
                .addUserOption(option =>
                    option.setName('student')
                        .setDescription('User receiving the jutsu')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('Jutsu identifier')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a jutsu from a user')
                .addUserOption(option =>
                    option.setName('student')
                        .setDescription('User losing the jutsu')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('Jutsu identifier')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));

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
        } catch (err) {
            console.error("Autocomplete Error:", err);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            const executorId = interaction.user.id;
            const executorName = authorizedTeachers[executorId];

            if (!executorName) {
                return interaction.reply({
                    content: "You do not have permission to use this command.",
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
            const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath, 'utf8'));

            if (!jutsus[jutsuKey]) {
                return interaction.reply({
                    content: "The specified jutsu does not exist.",
                    ephemeral: true
                });
            }

            const jutsuName = jutsus[jutsuKey].name;

            if (!jutsuData[student.id]) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            const userJutsuList = jutsuData[student.id].usersjutsu;

            let actionText;
            let color;

            // GIVE LOGIC
            if (subcommand === "give") {

                if (userJutsuList.includes(jutsuKey)) {
                    return interaction.reply({
                        content: `${student.username} already possesses ${jutsuName}.`,
                        ephemeral: true
                    });
                }

                userJutsuList.push(jutsuKey);
                actionText = "Granted";
                color = 0x2ecc71;
            }

            // REMOVE LOGIC
            if (subcommand === "remove") {

                if (!userJutsuList.includes(jutsuKey)) {
                    return interaction.reply({
                        content: `${student.username} does not possess ${jutsuName}.`,
                        ephemeral: true
                    });
                }

                jutsuData[student.id].usersjutsu =
                    userJutsuList.filter(j => j !== jutsuKey);

                actionText = "Removed";
                color = 0xe74c3c;
            }

            fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));

            // Admin Confirmation Embed
            const adminEmbed = new EmbedBuilder()
                .setTitle("Jutsu Registry Update")
                .setColor(color)
                .addFields(
                    { name: "Jutsu", value: jutsuName, inline: true },
                    { name: "Student", value: student.username, inline: true },
                    { name: "Action", value: actionText, inline: true },
                    { name: "Authorized By", value: executorName }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [adminEmbed], ephemeral: true });

            // DM Notification
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle("Jutsu Update Notification")
                    .setColor(color)
                    .setDescription(
                        `Your jutsu registry has been updated.\n\n` +
                        `Jutsu: ${jutsuName}\n` +
                        `Action: ${actionText}\n` +
                        `Authorized By: ${executorName}`
                    )
                    .setTimestamp();

                await student.send({ embeds: [dmEmbed] });

            } catch {
                console.log("Unable to DM user.");
            }

        } catch (error) {
            console.error("Teach Command Error:", error);

            if (!interaction.replied) {
                return interaction.reply({
                    content: "An unexpected error occurred while processing the command.",
                    ephemeral: true
                });
            }
        }
    }
};
