const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase a combo from the shop')
        .addStringOption(option =>
            option.setName('combo')
                .setDescription('The name of the combo to buy')
                .setRequired(true)),

    async execute(interaction) {
        const comboName = interaction.options.getString('combo').toLowerCase();
        
        // Shop database (same as in shop.js)
        const shopItems = {
            "basic combo": {
                name: "Basic Combo",
                description: "Attack + Transformation Jutsu",
                effect: "Creates an \"Empowered Attack\" that deals 100 True Damage.",
                price: 0,
                requirements: ["attack", "transformation"]
            }
        };

        if (!shopItems[comboName]) {
            return interaction.reply('That combo doesn\'t exist in the shop!');
        }

        const combo = shopItems[comboName];
        const jutsusPath = path.join(__dirname, '../data', 'jutsu.json');
        const jutsuData = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
        const userId = interaction.user.id;

        if (!jutsuData[userId]) {
            return interaction.reply('You need to be enrolled first!');
        }

        // Check if user already has the combo
        if (jutsuData[userId].combos && jutsuData[userId].combos.includes(combo.name)) {
            return interaction.reply('You already know this combo!');
        }

        // Add combo to user's profile
        if (!jutsuData[userId].combos) {
            jutsuData[userId].combos = [];
        }
        jutsuData[userId].combos.push(combo.name);

        fs.writeFileSync(jutsusPath, JSON.stringify(jutsuData, null, 4));
        await interaction.reply(`Successfully learned ${combo.name}!`);
    }
};
