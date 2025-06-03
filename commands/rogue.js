const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rogue')
        .setDescription('Leave the village and become a rogue ninja'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }
        if (users[userId].occupation === "Rogue") {
            return interaction.reply({ content: "You are already a rogue ninja.", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setTitle("Are you sure you want to become a Rogue Ninja?")
            .setDescription("Leaving the village means abandoning your comrades and your home. Do you really wish to leave the village and become a rogue ninja?")
            .setColor("#B71C1C");
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rogue_confirm').setLabel('Yes, become Rogue').setStyle('Danger'),
            new ButtonBuilder().setCustomId('rogue_cancel').setLabel('No, stay loyal').setStyle('Secondary')
        );
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        // Fetch the reply message after sending (do not use fetchReply in reply)
        const msg = await interaction.fetchReply();
        const filter = i => i.user.id === userId;
        try {
            const collected = await msg.awaitMessageComponent({ filter, time: 30000 });
            if (collected.customId === 'rogue_confirm') {
                users[userId].occupation = "Rogue";
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                await collected.update({ content: "You are now a rogue ninja. You have left your village behind.", embeds: [], components: [] });
            } else {
                await collected.update({ content: "You chose to stay loyal to your village.", embeds: [], components: [] });
            }
        } catch {
            // If no interaction, disable buttons
            await interaction.editReply({ content: "No response. Action cancelled.", embeds: [], components: [] });
        }
    }
};
