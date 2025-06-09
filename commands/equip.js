const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { updateRequirements } = require('./scroll');

const usersPath = path.join(__dirname, '../../menma/data/users.json');
const jutsuPath = path.join(__dirname, '../../menma/data/jutsu.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip a jutsu or combo')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type to equip: jutsu or combo')
                .setRequired(true)
                .addChoices(
                    { name: 'jutsu', value: 'jutsu' },
                    { name: 'combo', value: 'combo' }
                )
        )
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the jutsu or combo')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('Jutsu slot (required for jutsu)')
                .setRequired(true)
        ),

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
        const type = interaction.options.getString('type');
        const name = interaction.options.getString('name');
        const slot = interaction.options.getString('slot');
        const userId = interaction.user.id;

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        if (type === 'combo') {
            // Equip combo by checking jutsu.json combos array for the user
            if (!fs.existsSync(jutsuPath)) {
                return interaction.reply({ content: "Jutsu database not found.", ephemeral: true });
            }
            const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
            const userCombos = jutsuData[userId]?.combos || [];
            // Case-insensitive match
            const ownedCombo = userCombos.find(c => c.toLowerCase() === name.toLowerCase());
            if (!ownedCombo) {
                return interaction.reply({ content: `You do not own the combo "${name}".`, ephemeral: true });
            }
            users[userId].Combo = ownedCombo;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            return interaction.reply({ content: `Equipped combo: **${ownedCombo}**!`, ephemeral: false });
        }

        if (type === 'jutsu') {
            const jutsuName = name;
            const slotNumber = parseInt(slot, 10);

            // Limit to slots 1-5 only
            if (slotNumber < 1 || slotNumber > 5) {
                return interaction.reply({ content: "You can only equip jutsu in slots 1 to 5.", ephemeral: true });
            }

            const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));

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

            const equipSuccess = true;

            if (equipSuccess) {
                await updateRequirements(interaction.user.id, 'equip_jutsu');
            }

            return interaction.reply({
                content: `Successfully equipped "${jutsuName}" in slot ${slotNumber}!`,
                ephemeral: false
            });
        }

        return interaction.reply({ content: "Invalid type specified.", ephemeral: true });
    }
};