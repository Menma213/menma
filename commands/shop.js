const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { shopItems, premiumItems, jutsuShopItems, eventShopItems, miscShopItems } = require('../data/shopConfig.js');

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
                ...Object.values(jutsuShopItems).map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: $${item.price}`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 2/3' });

        // Add Event Shop embed (Christmas)
        const jutsuDataPath = path.resolve(__dirname, '../data/jutsu.json');
        let christmasTokens = 0;
        try {
            if (fs.existsSync(jutsuDataPath)) {
                const jutsuData = JSON.parse(fs.readFileSync(jutsuDataPath, 'utf8'));
                // Check items for "Christmas Token"
                const userData = jutsuData[interaction.user.id] || (jutsuData.users ? jutsuData.users[interaction.user.id] : undefined);
                if (userData && userData.items) {
                    christmasTokens = userData.items['Christmas Token'] || 0;
                }
            }
        } catch (err) {
            christmasTokens = 0;
        }

        const eventEmbed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle('❄️ WINTER EVENT SHOP ❄️')
            .setDescription(`Spend your Christmas Tokens on limited-time rewards!\nYour Tokens: **${christmasTokens}**`)
            .addFields(
                ...Object.values(eventShopItems).map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: ${item.price} Tokens`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 3/4 | Event ends Dec 25th!' });

        // Add Misc Shop embed
        const miscEmbed = new EmbedBuilder()
            .setColor(0x800080) // Purple color
            .setTitle('MISC SHOP')
            .setDescription('Miscellaneous items for your ninja journey!')
            .addFields(
                ...Object.values(miscShopItems).map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: ${item.price} Shinobi Shards`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 4/5' });

        // Add Accessory Shop embed
        const accessoriesPath = path.resolve(__dirname, '../data/accessories.json');
        const allAccessories = JSON.parse(fs.readFileSync(accessoriesPath, 'utf8'));

        const accessoryEmbed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('ACCESSORY SHOP')
            .setDescription('Buy powerful accessories for money!')
            .addFields(
                ...allAccessories.map(item => ({
                    name: item.name,
                    value: `${item.description}\nCost: $${item.price}`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Page 5/5' });

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
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('accessory_shop')
                .setLabel('Accessories')
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
            } else if (i.customId === 'accessory_shop') {
                await i.update({ embeds: [accessoryEmbed], components: [row1, row2] });
            } else if (i.customId === 'akatsuki_shop') {
                const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
                const akatsukiData = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
                const userId = i.user.id;

                if (!akatsukiData.members || !akatsukiData.members[userId]) {
                    await i.reply({ content: 'This shop is for Akatsuki members only.', ephemeral: true });
                    return;
                }

                const combosPath = path.resolve(__dirname, '../data/combos.json');
                const combosData = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
                // Filter out basic/intermediate
                const availableCombos = Object.values(combosData).filter(combo => combo.name !== "Basic Combo" && combo.name !== "Intermediate Combo");

                const bountyPath = path.resolve(__dirname, '../data/bounty.json');
                const bountyData = JSON.parse(fs.readFileSync(bountyPath, 'utf8'));
                const userBounty = bountyData[userId] ? bountyData[userId].bounty : 0;

                const akatsukiEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Akatsuki Black Market')
                    .setDescription('A special shop for Akatsuki members to acquire powerful and forbidden techniques.')
                    .addFields(
                        ...availableCombos.map(combo => ({
                            name: `Combo: ${combo.name}`,
                            value: `**Required Jutsus:** ${combo.requiredJutsus.join(', ')}\n**Effect:** ${combo.effects ? combo.effects.map(e => `${e.type}: ${e.status || e.stats}`).join(', ') : 'Special combo attack.'}\n**Cost:** 1000 Bounty Points`,
                            inline: false
                        }))
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
