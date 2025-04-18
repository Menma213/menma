const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../../menma/data/users.json');
const jutsuPath = path.join(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.join(__dirname, '../../menma/data/jutsus.json');

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
        const allJutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Check if user has the jutsu
        const userHasJutsu = jutsuData[userId]?.usersjutsu?.includes(jutsuName);
        if (!userHasJutsu) {
            return interaction.reply({ content: `You don't know ${jutsuName}!`, ephemeral: true });
        }

        // Initialize slots object if needed
        if (!users[userId].jutsuSlots || typeof users[userId].jutsuSlots !== 'object') {
            users[userId].jutsuSlots = {
                1: 'None',
                2: 'None',
                3: 'None',
                4: 'None',
                5: 'None'
            };
        }

        // Check if already equipped in another slot
        const equippedSlot = Object.keys(users[userId].jutsuSlots).find(
            slot => users[userId].jutsuSlots[slot] === jutsuName
        );
        if (equippedSlot && parseInt(equippedSlot) !== slotNumber) {
            return interaction.reply({
                content: `${jutsuName} is already equipped in slot ${equippedSlot}!`,
                ephemeral: true
            });
        }

        // Check if the slot is already occupied by a different jutsu
        const currentJutsuInSlot = users[userId].jutsuSlots[slotNumber];
        if (currentJutsuInSlot !== 'None' && currentJutsuInSlot !== jutsuName) {
            return interaction.reply({
                content: `Slot ${slotNumber} already has ${currentJutsuInSlot} equipped!`,
                ephemeral: true
            });
        }

        // Equip the jutsu
        users[userId].jutsuSlots[slotNumber] = jutsuName;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        return interaction.reply({
            content: `Successfully equipped ${jutsuName} in slot ${slotNumber}!`,
            ephemeral: false
        });
    }
};