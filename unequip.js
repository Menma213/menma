const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unequip')
        .setDescription('Remove Jutsu from your equipped list.'),

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

        if (!player.equippedJutsu || player.equippedJutsu.length === 0) {
            return interaction.reply({ content: "You don't have any Jutsu equipped.", ephemeral: true });
        }

        // Create selection buttons for unequipping Jutsu
        let buttons = player.equippedJutsu.map((jutsu, index) =>
            new ButtonBuilder()
                .setCustomId(`unequip_${index}`)
                .setLabel(jutsu.name)
                .setStyle(ButtonStyle.Danger)
        );

        // Add a "Remove All" button
        buttons.push(new ButtonBuilder()
            .setCustomId('unequip_all')
            .setLabel('Remove All')
            .setStyle(ButtonStyle.Secondary)
        );

        let row = new ActionRowBuilder().addComponents(buttons);

        let replyMessage = await interaction.reply({
            content: "Select a Jutsu to unequip.",
            components: [row],
            fetchReply: true
        });

        let collector = replyMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== userId) return;

            let customId = buttonInteraction.customId;

            if (customId === 'unequip_all') {
                player.equippedJutsu = [];
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
                return buttonInteraction.update({ content: "All Jutsu have been unequipped.", components: [] });
            }

            let selectedIndex = parseInt(customId.split('_')[1]);
            let removedJutsu = player.equippedJutsu.splice(selectedIndex, 1)[0];

            fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

            buttonInteraction.update({
                content: `${removedJutsu.name} has been unequipped.`,
                components: []
            });
        });

        collector.on('end', async () => {
            interaction.followUp("Jutsu unequip session ended.");
        });
    }
};
