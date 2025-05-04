const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../../menma/data/users.json');
const jutsuPath = path.join(__dirname, '../../menma/data/jutsu.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip a jutsu to one of your battle slots')
        .addStringOption(option =>
            option.setName('jutsu')
                .setDescription('Name of the jutsu to equip')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('slot')
                .setDescription('Slot number (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)),

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        const focusedValue = interaction.options.getFocused();
        const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
        const userJutsu = jutsuData[userId]?.usersjutsu || [];
        
        const filtered = userJutsu
            .filter(jutsu => jutsu.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25)
            .map(jutsu => ({ name: jutsu, value: jutsu }));

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        const jutsuName = interaction.options.getString('jutsu');
        const slotNumber = interaction.options.getInteger('slot');

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Check if user has the jutsu in their inventory (case-insensitive)
        const userJutsu = jutsuData[userId]?.usersjutsu || [];
        const userHasJutsu = userJutsu.some(jutsu => jutsu.toLowerCase() === jutsuName.toLowerCase());
        if (!userHasJutsu) {
            return interaction.reply({ content: `You don't own the jutsu "${jutsuName}"!`, ephemeral: true });
        }

        // Ensure the "jutsu" object exists in users.json
        if (!users[userId].jutsu || typeof users[userId].jutsu !== 'object') {
            return interaction.reply({ content: "Your jutsu deck is not initialized!", ephemeral: true });
        }

        // Prevent editing slot 0 (default attack slot)
        if (slotNumber === 0) {
            return interaction.reply({ content: "Slot 0 is reserved for the default attack and cannot be changed!", ephemeral: true });
        }

        // Equip the jutsu into the specified slot
        const slotKey = `slot_${slotNumber}`;
        users[userId].jutsu[slotKey] = jutsuName;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        return interaction.reply({
            content: `Successfully equipped "${jutsuName}" in slot ${slotNumber}!`,
            ephemeral: false
        });
    }
};