const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Paths
const jutsuDataPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');

// Permission Structure
const permissions = {
    fullAccess: {
        "835408109899219004": "Thunder",
        "961918563382362122": "Asukky"
    },
    removeOnly: {
        "818893461881094175": "Husker"
    }
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
                        .setAutocomplete(true)))

        .addSubcommand(sub =>
            sub.setName('troll')
                .setDescription('Send a dramatic troll notification')
                .addUserOption(option =>
                    option.setName('student')
                        .setDescription('Target user')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('Jutsu for trolling')
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
        } catch {
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            const executorId = interaction.user.id;
            const subcommand = interaction.options.getSubcommand();

            const isFullAccess = permissions.fullAccess[executorId];
            const isRemoveOnly = permissions.removeOnly[executorId];

            if (!isFullAccess && !isRemoveOnly) {
                return interaction.reply({
                    content: "You do not have permission to use this command.",
                    ephemeral: true
                });
            }

            if (isRemoveOnly && subcommand !== "remove") {
                return interaction.reply({
                    content: "You only have permission to use the remove subcommand.",
                    ephemeral: true
                });
            }

            const executorName = isFullAccess || isRemoveOnly;
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));

            if (!jutsus[jutsuKey]) {
                return interaction.reply({
                    content: "The specified jutsu does not exist.",
                    ephemeral: true
                });
            }

            const jutsuName = jutsus[jutsuKey].name;

            // =========================
            // TROLL (DM ONLY, NO DATA CHANGE)
            // =========================
            if (subcommand === "troll") {

                if (!isFullAccess) {
                    return interaction.reply({
                        content: "Only full-access administrators can use troll.",
                        ephemeral: true
                    });
                }

                try {
                    const trollEmbed = new EmbedBuilder()
                        .setTitle("Jutsu Authority Notice")
                        .setDescription(
                            `The 2 GOATS Asukky and Thunder have modified your arsenal.\n\n` +
                            `Jutsu: ${jutsuName}\n\n` +
                            `Stay alert.`
                        )
                        .setColor(0x992d22)
                        .setTimestamp();

                    await student.send({ embeds: [trollEmbed] });

                } catch {
                    return interaction.reply({
                        content: "Unable to DM the user.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content: "Troll notification sent.",
                    ephemeral: true
                });
            }

            // =========================
            // GIVE / REMOVE (NO DM)
            // =========================

            const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath, 'utf8'));

            if (!jutsuData[student.id]) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            const userJutsuList = jutsuData[student.id].usersjutsu;

            let actionText;
            let color;

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

            const adminEmbed = new EmbedBuilder()
                .setTitle("Jutsu Registry Update")
                .setColor(color)
                .setDescription(
                    `Jutsu: ${jutsuName}\n` +
                    `Student: ${student.username}\n` +
                    `Action: ${actionText}\n` +
                    `Authorized By: ${executorName}`
                )
                .setTimestamp();

            await interaction.reply({ embeds: [adminEmbed], ephemeral: true });

        } catch (error) {
            console.error("Teach Command Error:", error);

            if (!interaction.replied) {
                return interaction.reply({
                    content: "An unexpected error occurred.",
                    ephemeral: true
                });
            }
        }
    }
};
