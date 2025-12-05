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
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "Legendary Ninja",
        description: "Grants the Legendary Ninja role.",
        price: 200,
        roleId: "1385640798581952714", // Placeholder
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "Jinchuriki",
        description: "Become a Jinchuriki and receive the Jinchuriki role.",
        price: 500,
        roleId: "1385641469507010640", // Placeholder
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "Custom Jutsu",
        description: "Create your own custom jutsu! (3 effects)",
        price: 1000,
        type: 'custom_jutsu'
        // No roleId, no duration, handled in real time
    },
    {
        name: "Auto-Frank (3 Hours)",
        description: "Automatically run F-rank missions for 3 hours. Grants 21,600 EXP.\n To buy use: auto frank 3h",
        price: 600, // Example price
        type: 'autofrank',
        durationKey: '3h'
    },
    {
        name: "Auto-Frank (6 Hours)",
        description: "Automatically run F-rank missions for 6 hours. Grants 43,200 EXP.\n To buy use: auto frank 6h",
        price: 1400, // Example price
        type: 'autofrank',
        durationKey: '6h'
    },
    {
        name: "Auto-Frank (12 Hours)",
        description: "Automatically run F-rank missions for 12 hours. Grants 86,400 EXP.\n To buy use: auto frank 12h",
        price: 2000, // Example price
        type: 'autofrank',
        durationKey: '12h'
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

const miscShopItems = [
    {
        name: "Stat Refund",
        description: "Refunds all your invested stat points, allowing you to reallocate them.",
        price: 500, // Example price in Shinobi Shards
        key: "stat_refund"
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
        // Use a reliable path to the data folder and support multiple possible key names for Ay tokens
        const jutsuDataPath = path.resolve(__dirname, '../data/jutsu.json');
        let ayTokens = 0;
        try {
            if (fs.existsSync(jutsuDataPath)) {
                const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath, 'utf8'));
                // Support two common layouts: top-level user entries or nested under "users"
                const userData = jutsuData[interaction.user.id] || (jutsuData.users ? jutsuData.users[interaction.user.id] : undefined);
                if (userData && userData.items) {
                    // Accept several possible key names to be tolerant of variations
                    const possibleKeys = ["Ay Token", "Ay Tokens", "Ay_Token", "ayTokens", "ay token", "ay_token"];
                    for (const key of possibleKeys) {
                        if (typeof userData.items[key] === "number") {
                            ayTokens = userData.items[key];
                            break;
                        }
                    }
                    // Fallback: if items itself is a number (older format)
                    if (ayTokens === 0 && typeof userData.items === "number") {
                        ayTokens = userData.items;
                    }
                }
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
            .setFooter({ text: 'Page 3/4' });

        // Add Misc Shop embed
        const miscEmbed = new EmbedBuilder()
            .setColor(0x800080) // Purple color
            .setTitle('MISC SHOP')
            .setDescription('Miscellaneous items for your ninja journey!')
            .addFields(
                ...miscShopItems.map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: ${item.price} Shinobi Shards`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 4/4' });

        // Add navigation buttons
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('main_shop')
                .setLabel('Combos')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('jutsu_shop')
                .setLabel('Jutsus')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('event_shop')
                .setLabel('Event')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('misc_shop')
                .setLabel('Misc')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('shinobi_shards')
                .setLabel('Shinobi Shards')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('akatsuki_shop')
                .setLabel('Akatsuki')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('anbu_shop')
                .setLabel('ANBU')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'main_shop') {
                await i.update({ embeds: [embed], components: [row1, row2] });
            } else if (i.customId === 'jutsu_shop') {
                await i.update({ embeds: [jutsuEmbed], components: [row1, row2] });
            } else if (i.customId === 'event_shop') {
                await i.update({ embeds: [eventEmbed], components: [row1, row2] });
            } else if (i.customId === 'misc_shop') {
                await i.update({ embeds: [miscEmbed], components: [row1, row2] });
            } else if (i.customId === 'akatsuki_shop') {
                const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
                const akatsukiData = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
                const userId = i.user.id;

                if (!akatsukiData.members || !akatsukiData.members[userId]) {
                    await i.reply({ content: 'This shop is for Akatsuki members only.', ephemeral: true });
                    return;
                }

                const dailyComboPath = path.resolve(__dirname, '../data/daily_combo.json');
                const combosPath = path.resolve(__dirname, '../data/combos.json');
                const combosData = JSON.parse(fs.readFileSync(combosPath, 'utf8'));

                const today = new Date();
                const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

                let dailyCombo;
                let dailyComboData = {};
                if (fs.existsSync(dailyComboPath)) {
                    dailyComboData = JSON.parse(fs.readFileSync(dailyComboPath, 'utf8'));
                }

                if (dailyComboData.dayOfYear === dayOfYear && dailyComboData.combo) {
                    dailyCombo = dailyComboData.combo;
                } else {
                    const availableCombos = Object.values(combosData).filter(combo => combo.name !== "Basic Combo" && combo.name !== "Intermediate Combo");
                    const comboIndex = dayOfYear % availableCombos.length;
                    dailyCombo = availableCombos[comboIndex];

                    fs.writeFileSync(dailyComboPath, JSON.stringify({ dayOfYear, combo: dailyCombo }, null, 4));
                }

                const bountyPath = path.resolve(__dirname, '../data/bounty.json');
                const bountyData = JSON.parse(fs.readFileSync(bountyPath, 'utf8'));
                const userBounty = bountyData[userId] ? bountyData[userId].bounty : 0;

                const akatsukiEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Akatsuki Black Market')
                    .setDescription('A special shop for Akatsuki members to acquire powerful and forbidden techniques.')
                    .addFields(
                        {
                            name: `Daily Combo: ${dailyCombo.name}`,
                            value: `**Required Jutsus:** ${dailyCombo.requiredJutsus.join(', ')}\n**Effect:** ${dailyCombo.effects.map(e => `${e.type}: ${e.status}`).join(', ') || 'Special combo attack.'}\n**Cost:** 1000 Bounty Points`,
                            inline: false
                        }
                    )
                    .setFooter({ text: `Your Bounty: ${userBounty}` });

                await i.update({ embeds: [akatsukiEmbed], components: [row1, row2] });
            } else if (i.customId === 'anbu_shop') {
                const anbuPath = path.resolve(__dirname, '../data/anbu.json');
                const anbuData = JSON.parse(fs.readFileSync(anbuPath, 'utf8'));
                const userId = i.user.id;

                if (!anbuData.members || !anbuData.members[userId]) {
                    await i.reply({ content: 'This shop is for ANBU members only.', ephemeral: true });
                    return;
                }

                const accessoriesPath = path.resolve(__dirname, '../data/accessories.json');
                const accessories = JSON.parse(fs.readFileSync(accessoriesPath, 'utf8'));

                const anbuShopItems = accessories.filter(acc => acc.rarity === 'Epic' || acc.rarity === 'Rare');
                const legendaryItem = accessories.find(acc => acc.rarity === 'Legendary');
                if (legendaryItem) {
                    anbuShopItems.push(legendaryItem);
                }

                const userAnbuData = anbuData.members[userId];
                const userHonor = userAnbuData && userAnbuData.honor ? userAnbuData.honor : 0;

                const anbuEmbed = new EmbedBuilder()
                    .setColor(0x808080)
                    .setTitle('ANBU Black Ops Shop')
                    .setDescription('A special shop for ANBU members to acquire powerful and exclusive equipment.')
                    .addFields(
                        ...anbuShopItems.map(item => ({
                            name: item.name,
                            value: `${item.description}\nCost: ${item.price || 1000} Honor`,
                            inline: false
                        }))
                    )
                    .setFooter({ text: `Your Honor: ${userHonor}` });

                await i.update({ embeds: [anbuEmbed], components: [row1, row2] });
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
                        ...premiumItems.map((item, index) => {
                            let value = `${item.description}\nPrice: ${item.price} Shinobi Shards`;
                            if (item.type === 'role' && item.roleId) {
                                value += `\nRole: <@&${item.roleId}>`;
                            }
                            return {
                                name: `${index + 1}) ${item.name}`,
                                value: value,
                                inline: false
                            };
                        })
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
