const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Paths
const jutsuDataPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');

// GOATS
const allowedTeacherIds = ["835408109899219004", "961918563382362122"];
const goatNames = {
    "835408109899219004": "Thunder",
    "961918563382362122": "Asukky"
};

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
        } catch (err) {
            console.error(err);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            if (!allowedTeacherIds.includes(interaction.user.id)) {
                return interaction.reply({
                    content: "❌ You are not authorized.",
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const student = interaction.options.getUser('student');
            const jutsuKey = interaction.options.getString('jutsu');

            const jutsus = JSON.parse(fs.readFileSync(jutsusPath));
            const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath));

            if (!jutsus[jutsuKey]) {
                return interaction.reply({ content: "❌ Jutsu not found.", ephemeral: true });
            }

            const jutsuName = jutsus[jutsuKey].name;

            if (!jutsuData[student.id]) {
                jutsuData[student.id] = { usersjutsu: [] };
            }

            const isGoat = goatNames[interaction.user.id];
            let actionText;
            let color;

            // ======================
            // GIVE
            // ======================
            if (subcommand === "give") {

                if (jutsuData[student.id].usersjutsu.includes(jutsuKey)) {
                    return interaction.reply({
                        content: `ℹ️ ${student.username} already knows **${jutsuName}**.`,
                        ephemeral: true
                    });
                }

                jutsuData[student.id].usersjutsu.push(jutsuKey);
                actionText = "taught";
                color = 0x00ff88;
            }

            // ======================
            // REMOVE
            // ======================
            if (subcommand === "remove") {

                if (!jutsuData[student.id].usersjutsu.includes(jutsuKey)) {
                    return interaction.reply({
                        content: `ℹ️ ${student.username} does not know **${jutsuName}**.`,
                        ephemeral: true
                    });
                }

                jutsuData[student.id].usersjutsu =
                    jutsuData[student.id].usersjutsu.filter(j => j !== jutsuKey);

                actionText = "removed";
                color = 0xff3c3c;
            }

            fs.writeFileSync(jutsuDataPath, JSON.stringify(jutsuData, null, 2));

            // ======================
            // Admin Confirmation Embed
            // ======================
            const adminEmbed = new EmbedBuilder()
                .setTitle("🌀 Jutsu Registry Updated")
                .setDescription(`**${jutsuName}** has been ${actionText} ${actionText === "taught" ? "to" : "from"} ${student.username}.`)
                .setColor(color)
                .setFooter({ text: `Executed by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [adminEmbed], ephemeral: true });

            // ======================
            // DM SYSTEM
            // ======================
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle("📜 Your Jutsu Has Been Modified")
                    .setDescription(
                        isGoat
                            ? `👑 The 2 GOATS **Asukky** and **Thunder** have ${actionText} **${jutsuName}** ${actionText === "taught" ? "to" : "from"} your arsenal.\n\nStay sharp.`
                            : `Your jutsu **${jutsuName}** has been ${actionText}.`
                    )
                    .setColor(color)
                    .setTimestamp();

                await student.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log("Could not DM user.");
            }

        } catch (error) {
            console.error(error);
            if (!interaction.replied) {
                return interaction.reply({
                    content: "❌ Unexpected error occurred.",
                    ephemeral: true
                });
            }
        }
    }
};
