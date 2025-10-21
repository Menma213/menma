const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
    },
    {
        name: "Custom Jutsu",
        description: "Create your own custom jutsu! (single effect)",
        price: 500,
        // No roleId, no duration, handled in real time
    }
];

// Jutsu shop items (money)
const jutsuShopItems = [
    {
        name: "Human Boulder",
        description: "Transforms into a massive boulder and rolls over target.",
        price: 10000,
        key: "Human Boulder"
    },
    {
        name: "Puppet Kazekage",
        description: "Summons a puppet to attack target. Stays until death.",
        price: 100000,
        key: "Puppet Kazekage"
    }
];

// Event shop items (Ay tokens)
const eventShopItems = [
    {
        name: "Guillotine Drop",
        description: "Leaps high and slams down target, breaking defense.",
        price: 250,
        key: "Guillotine Drop"
    },
    {
        name: "Kirin: Lightning Storm",
        description: "Summons a lightning storm for massive damage.",
        price: 150,
        key: "Kirin: Lightning Storm"
    },
    {
        name: "Shadow Clone Jutsu: 1000 clones",
        description: "Creates 1000 clones to confuse and attack target.",
        price: 100,
        key: "Shadow Clone Jutsu: 1000 clones"
    },
    {
        name: "Explosive Paper Clone",
        description: "Tags target with an explosive tag.",
        price: 100,
        key: "Explosive Paper Clone"
    },
    {
        name: "Lightning Hound",
        description: "Summons a giant hound made of lightning.",
        price: 50,
        key: "Lightning Hound"
    },
    {
        name: "Ramen Coupon",
        description: "Redeem for 1 ramen ticket.",
        price: 5,
        key: "ramen"
    }
];

const MAIN_GUILD_ID = '1381268582595297321'; // Main server ID
const UPGRADE_CHAT_LINK = 'https://upgrade.chat/1381268582595297321/upgrades'; // Replace with your actual link

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
            .setFooter({ text: 'Page 1/3' });

        // Add Jutsu Shop embed
        const jutsuEmbed = new EmbedBuilder()
            .setColor(0x1e90ff)
            .setTitle('JUTSUS SHOP')
            .setDescription('Buy powerful jutsus for money!')
            .addFields(
                ...jutsuShopItems.map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: $${item.price}`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 2/3' });

        // Add Event Shop embed
        // Get user's Ay tokens from jutsu.json
        const jutsuDataPath = path.join(__dirname, '../menma/data/jutsu.json');
        let ayTokens = 0;
        try {
            const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath, 'utf8'));
            const userData = jutsuData[interaction.user.id];
            if (userData && userData.items && typeof userData.items["Ay Token"] === "number") {
            ayTokens = userData.items["Ay Token"];
            }
        } catch (err) {
            ayTokens = 0;
        }

        const eventEmbed = new EmbedBuilder()
            .setColor(0x00ff99)
            .setTitle('EVENT SHOP')
            .setDescription(`Spend your Ay tokens on exclusive event jutsus!\nYour Ay tokens: **${ayTokens}**`)
            .addFields(
            ...eventShopItems.map(item => ({
                name: item.name,
                value: `${item.description}\nCost: ${item.price} Ay tokens`,
                inline: false
            }))
            )
            .setFooter({ text: 'Page 3/3' });

        // Add navigation buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('main_shop')
                .setLabel('Combos')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('jutsu_shop')
                .setLabel('Jutsus')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('event_shop')
                .setLabel('Event')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('shinobi_shards')
                .setLabel('Shinobi Shards')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'main_shop') {
                await i.update({ embeds: [embed], components: [row] });
            } else if (i.customId === 'jutsu_shop') {
                await i.update({ embeds: [jutsuEmbed], components: [row] });
            } else if (i.customId === 'event_shop') {
                await i.update({ embeds: [eventEmbed], components: [row] });
            } else if (i.customId === 'shinobi_shards') {
                // Only allow in main server
                if (i.guildId !== MAIN_GUILD_ID) {
                    await i.reply({
                        content: `The Shinobi Shard shop is only available in the main server!\nJoin here: https://discord.gg/yqGDYmtkpf`,
                        ephemeral: true
                    });
                    return;
                }
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
                        },
                        {
                            name: `4) ${premiumItems[3].name}`,
                            value: `${premiumItems[3].description}\nPrice: ${premiumItems[3].price} Shinobi Shards`,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'To buy, use `/buy option: ss itemname:`' });

                // Add "Buy Shinobi Shards" link button
                const premiumRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Buy Shinobi Shards')
                        .setStyle(ButtonStyle.Link)
                        .setURL(UPGRADE_CHAT_LINK)
                );

                await i.update({ embeds: [premiumEmbed], components: [premiumRow] });
                collector.stop();
            }
        });
    }
};
