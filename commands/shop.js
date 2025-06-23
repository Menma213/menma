const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

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

// Premium shop items
const premiumItems = [
    {
        name: "Donator",
        description: "Unlocks the exclusive Donator role.",
        price: 100, // Example price in Shinobi Shards
        roleId: "1385640728130097182", // Placeholder
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    },
    {
        name: "Legendary Ninja",
        description: "Grants the Legendary Ninja role.",
        price: 200,
        roleId: "1385640798581952714", // Placeholder
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    },
    {
        name: "Jinchuriki",
        description: "Become a Jinchuriki and receive the Jinchuriki role.",
        price: 500,
        roleId: "1385641469507010640", // Placeholder
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the available combos in the shop'),

    async execute(interaction) {
        // Main shop embed
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

        // Add Shinobi Shards button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('shinobi_shards')
                .setLabel('Shinobi Shards')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });

        // Create a collector for the button
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'shinobi_shards') {
                // Premium shop embed
                const premiumEmbed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('Shinobi Shard Corner')
                    .setDescription('Spend your Shinobi Shards on exclusive perks!')
                    .addFields(
                        {
                            name: `1) ${premiumItems[0].name}`,
                            value: `${premiumItems[0].description}\nPrice: ${premiumItems[0].price} Shinobi Shards\nRole: <@&${premiumItems[0].roleId}>`,
                            inline: false
                        },
                        {
                            name: `2) ${premiumItems[1].name}`,
                            value: `${premiumItems[1].description}\nPrice: ${premiumItems[1].price} Shinobi Shards\nRole: <@&${premiumItems[1].roleId}>`,
                            inline: false
                        },
                        {
                            name: `3) ${premiumItems[2].name}`,
                            value: `${premiumItems[2].description}\nPrice: ${premiumItems[2].price} Shinobi Shards\nRole: <@&${premiumItems[2].roleId}>`,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Premium Shop' });

                await i.update({ embeds: [premiumEmbed], components: [] });
                collector.stop();
            }
        });
    }
};
