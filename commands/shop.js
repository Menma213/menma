const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

// Shop database
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
    // Future combos can be added here
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the available combos in the shop'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('SHOP')
            .setDescription('Here you can learn new combos for your arsenal.')
            .setThumbnail('https://static1.cbrimages.com/wordpress/wp-content/uploads/2020/03/Konohagakure.jpg')
            .addFields(
                { 
                    name: '1) Basic Combo',
                    value: 'Attack + Transformation Jutsu\nCreates an "Empowered Attack" that deals 100 True Damage.\nCost: Free (0)',
                    inline: false 
                },
                { 
                    name: '2) Intermediate Combo',
                    value: 'Analysis + Transformation Jutsu + Rasengan\nDeals 100,000 damage, stuns the opponent for 1 round, and applies bleed.\nCost: 10,000',
                    inline: false 
                }
            )
            .setFooter({ text: 'Page 1/1' });

        await interaction.reply({ embeds: [embed] });
    }
};
