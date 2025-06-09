const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Use the same shopItems as in shop.js
const shopItems = {
    "basic combo": {
        name: "Basic Combo",
        description: "Attack + Transformation Jutsu",
        effect: "Creates an \"Empowered Attack\" that deals 100 True Damage.",
        price: 0,
        requirements: ["attack", "transformation"]
    },
    "intermediate combo": {
        name: "Intermediate Combo",
        description: "Analysis + Transformation Jutsu + Rasengan",
        effect: "Deals 100,000 damage, stuns the opponent for 1 round, and applies bleed.",
        price: 10000,
        requirements: ["analysis", "transformation", "rasengan"]
    }
    // ...future combos...
};

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

        // Check if user has enough money for paid combos
        if (combo.price > 0) {
            const usersPath = path.join(__dirname, '../data', 'users.json');
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId] || users[userId].money < combo.price) {
                return interaction.reply(`You need $${combo.price} to buy this combo!`);
            }
            users[userId].money -= combo.price;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
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
