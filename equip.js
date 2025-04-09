const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const jutsuPath = path.join(__dirname, '../jutsu'); // Path to Jutsu folder
const dataPath = path.join(__dirname, '../data/users.json');
const myJutsuPath = path.join(__dirname, '../data/myjutsu.js'); // Player's personal Jutsu

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip up to 4 Jutsu from your collection for battle.'),

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

        // Load player's Jutsu from myjutsu.js
        let myJutsu = [];
        if (fs.existsSync(myJutsuPath)) {
            myJutsu = require(myJutsuPath)[userId] || [];
        }

        if (myJutsu.length === 0) {
            return interaction.reply({ content: "You don't own any Jutsu to equip.", ephemeral: true });
        }

        // Load Jutsu details from the jutsu folder
        let availableJutsu = [];
        fs.readdirSync(jutsuPath).forEach(file => {
            if (file.endsWith('.json')) {
                let jutsuData = JSON.parse(fs.readFileSync(path.join(jutsuPath, file), 'utf8'));
                if (myJutsu.includes(jutsuData.name)) {
                    availableJutsu.push({ name: jutsuData.name, effects: jutsuData.effects, file: file });
                }
            }
        });

        if (availableJutsu.length === 0) {
            return interaction.reply({ content: "Your Jutsu are not found in the system.", ephemeral: true });
        }

        // Create selection buttons
        let buttons = availableJutsu.map((jutsu, index) =>
            new ButtonBuilder()
                .setCustomId(`equip_${index}`)
                .setLabel(jutsu.name)
                .setStyle(ButtonStyle.Primary)
        );

        let rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        let replyMessage = await interaction.reply({
            content: "Select up to 4 Jutsu to equip.",
            components: rows,
            fetchReply: true
        });

        let collector = replyMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        let equippedJutsu = player.equippedJutsu || [];

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== userId) return;

            let selectedIndex = parseInt(buttonInteraction.customId.split('_')[1]);
            let selectedJutsu = availableJutsu[selectedIndex];

            if (equippedJutsu.find(j => j.name === selectedJutsu.name)) {
                return buttonInteraction.reply({ content: `${selectedJutsu.name} is already equipped.`, ephemeral: true });
            }

            if (equippedJutsu.length >= 4) {
                return buttonInteraction.reply({ content: "You can only equip up to 4 Jutsu.", ephemeral: true });
            }

            equippedJutsu.push({ name: selectedJutsu.name, effects: selectedJutsu.effects, file: selectedJutsu.file });
            users[userId].equippedJutsu = equippedJutsu;
            fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

            buttonInteraction.reply({ content: `${selectedJutsu.name} equipped.`, ephemeral: true });
        });

        collector.on('end', async () => {
            let jutsuList = equippedJutsu.map(j => `- ${j.name}`).join('\n') || "None";
            interaction.followUp(`Equipped Jutsu:\n${jutsuList}`);
        });
    }
};
