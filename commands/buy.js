const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// New path to the players data file
const playersPath = path.join(__dirname, '../../menma/data/players.json');
// Add usersPath so profile.js (which reads users.json) sees premiumRoles
const usersPath = path.join(__dirname, '../../menma/data/users.json');
const autofrankPath = path.join(__dirname, '../../menma/data/autofrank.json');

const { shopItems, premiumItems, jutsuShopItems, eventShopItems, miscShopItems } = require('../data/shopConfig.js');

// Replace with your log channel ID
const LOG_CHANNEL_ID = '1381278641144467637';

async function logPurchase(interaction, message) {
    try {
        const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send(message);
        }
    } catch (e) {
        // Logging failed, ignore
    }
}

// Helper to support long timeouts (over 24.8 days)
function setLongTimeout(callback, ms, ...args) {
    const MAX_TIMEOUT = 2147483647; // ~24.8 days in ms
    if (ms > MAX_TIMEOUT) {
        return setTimeout(() => setLongTimeout(callback, ms - MAX_TIMEOUT, ...args), MAX_TIMEOUT);
    }
    return setTimeout(callback, ms, ...args);
}

async function scheduleRoleRemoval(guild, userId, roleId, duration, playersPath) {
    setLongTimeout(async () => {
        try {
            const member = await guild.members.fetch(userId);
            await member.roles.remove(roleId, "Premium role expired");
            // remove from players.json
            const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
            if (players[userId] && players[userId].premiumRoles) {
                players[userId].premiumRoles = players[userId].premiumRoles.filter(r => r.roleId !== roleId);
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
            }
            // also remove from users.json so profile sees removal immediately
            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
            if (users[userId] && users[userId].premiumRoles) {
                users[userId].premiumRoles = users[userId].premiumRoles.filter(r => r.roleId !== roleId);
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
            }
        } catch (e) {
            // Ignore errors
        }
    }, duration);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase a combo or premium item from the shop')
        .addStringOption(option =>
            option.setName('combo')
                .setDescription('The name of the combo to buy')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('ss')
                .setDescription('Buy various stuff using Shinobi Shards')
                .setRequired(false))
        .addStringOption(option => // ✨ ADDED JUTSU OPTION
            option.setName('jutsu')
                .setDescription('Buy a jutsu for money')
                .setRequired(false))
        .addStringOption(option => // ✨ ADDED EVENT OPTION
            option.setName('event')
                .setDescription('Buy an event item using Ay Tokens')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('misc')
                .setDescription('Buy miscellaneous items')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('akatsuki')
                .setDescription('Buy the daily Akatsuki combo')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('anbu')
                .setDescription('Buy an item from the ANBU shop')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('accessory')
                .setDescription('Buy an accessory for money')
                .setRequired(false)),

    async execute(interaction) {
        const comboName = interaction.options.getString('combo');
        const ssName = interaction.options.getString('ss');
        const eventName = interaction.options.getString('event');
        const jutsuName = interaction.options.getString('jutsu');
        const miscName = interaction.options.getString('misc');
        const akatsukiItem = interaction.options.getString('akatsuki');
        const anbuItem = interaction.options.getString('anbu');
        const accessoryName = interaction.options.getString('accessory');

        if (!comboName && !ssName && !eventName && !jutsuName && !miscName && !akatsukiItem && !anbuItem && !accessoryName) {
            return interaction.reply("Buy something...c'mon.");
        }

        if (anbuItem) {
            const anbuPath = path.resolve(__dirname, '../data/anbu.json');
            let anbuData = JSON.parse(fs.readFileSync(anbuPath, 'utf8'));
            const userId = interaction.user.id;

            if (!anbuData.members || !anbuData.members[userId]) {
                return interaction.reply({ content: 'This shop is for ANBU members only.', ephemeral: true });
            }

            const accessoriesPath = path.resolve(__dirname, '../data/accessories.json');
            const accessories = JSON.parse(fs.readFileSync(accessoriesPath, 'utf8'));
            const itemToBuy = accessories.find(acc => acc.name.toLowerCase() === anbuItem.toLowerCase());

            if (!itemToBuy) {
                return interaction.reply({ content: 'That item does not exist in the ANBU shop.', ephemeral: true });
            }

            const userAnbuData = anbuData.members[userId];
            const itemPrice = itemToBuy.price || 1000;
            const userHonor = (userAnbuData && userAnbuData.honor) ? userAnbuData.honor : 0;

            if (userHonor < itemPrice) {
                return interaction.reply(`You need ${itemPrice} honor to buy this item. You only have ${userHonor}.`);
            }

            // Read and update userAccessory.json
            const userAccessoryPath = path.join(__dirname, '../data/userAccessory.json');
            let userAccessoryData = fs.existsSync(userAccessoryPath) ? JSON.parse(fs.readFileSync(userAccessoryPath, 'utf8')) : {};

            if (!userAccessoryData[userId]) {
                userAccessoryData[userId] = { inventory: [], equipped: null, bonusStats: {} };
            }

            if (userAccessoryData[userId].inventory.includes(itemToBuy.name)) {
                return interaction.reply('You already have this item in your inventory.');
            }

            // Update honor in anbu.json
            anbuData.members[userId].honor = (anbuData.members[userId].honor || 0) - itemPrice;
            fs.writeFileSync(anbuPath, JSON.stringify(anbuData, null, 4));

            // Update inventory in userAccessory.json
            userAccessoryData[userId].inventory.push(itemToBuy.name);
            fs.writeFileSync(userAccessoryPath, JSON.stringify(userAccessoryData, null, 4));

            await logPurchase(interaction, ` <@${userId}> purchased **${itemToBuy.name}** for ${itemPrice} honor.`);
            return interaction.reply(`Successfully purchased ${itemToBuy.name}!`);
        }

        if (akatsukiItem) {
            const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
            const akatsukiData = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
            const userId = interaction.user.id;

            if (!akatsukiData.members || !akatsukiData.members[userId]) {
                return interaction.reply({ content: 'This shop is for Akatsuki members only.', ephemeral: true });
            }

            const combosPath = path.resolve(__dirname, '../data/combos.json');
            const combosData = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
            // Find combo case-insensitive
            const targetComboName = akatsukiItem.toLowerCase();
            const comboEntry = Object.values(combosData).find(c => c.name.toLowerCase() === targetComboName);

            if (!comboEntry) {
                return interaction.reply(`That combo does not exist in the Akatsuki records.`);
            }

            const bountyPath = path.resolve(__dirname, '../data/bounty.json');
            const bountyData = JSON.parse(fs.readFileSync(bountyPath, 'utf8'));
            const userBounty = bountyData[userId] ? bountyData[userId].bounty : 0;

            const comboPrice = 1000;

            if (userBounty < comboPrice) {
                return interaction.reply(`You need ${comboPrice} bounty to buy this combo. You only have ${userBounty}.`);
            }

            const usersPath = path.join(__dirname, '../data', 'users.json');
            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

            if (!usersData[userId]) {
                usersData[userId] = {};
            }

            if (usersData[userId].Combo === comboEntry.name) {
                return interaction.reply('You already have this combo equipped!');
            }

            // Deduct Bounty
            bountyData[userId].bounty -= comboPrice;
            fs.writeFileSync(bountyPath, JSON.stringify(bountyData, null, 4));

            // Equip Combo
            usersData[userId].Combo = comboEntry.name;
            fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 4));

            await logPurchase(interaction, ` <@${userId}> purchased and equipped combo **${comboEntry.name}** for ${comboPrice} bounty.`);
            return interaction.reply(`Successfully equipped ${comboEntry.name}!`);
        }

        if (ssName) {
            const premium = premiumItems.find(item => item.id === ssName.toLowerCase());
            if (!premium) {
                return interaction.reply('That premium item doesn\'t exist in the shop!');
            }

            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            const userId = interaction.user.id;

            if (!players[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            // --- Auto-Frank purchase handling ---
            if (premium.type === 'autofrank') {
                if (!players[userId].ss || players[userId].ss < premium.price) {
                    return interaction.reply(`You need ${premium.price} Shinobi Shards to buy this item!`);
                }
                players[userId].ss -= premium.price;
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

                // Update autofrank.json with consumable count
                try {
                    let autofrankData = {};
                    if (fs.existsSync(autofrankPath)) {
                        autofrankData = JSON.parse(fs.readFileSync(autofrankPath, 'utf8')) || {};
                    }
                    if (!autofrankData[userId]) {
                        autofrankData[userId] = { activeSession: null, features: {} };
                    }
                    if (!autofrankData[userId].features[premium.durationKey]) {
                        autofrankData[userId].features[premium.durationKey] = 0;
                    }
                    autofrankData[userId].features[premium.durationKey]++;
                    fs.writeFileSync(autofrankPath, JSON.stringify(autofrankData, null, 4));
                } catch (e) {
                    console.error('[buy.js] Failed to update autofrank file:', e);
                    return interaction.reply('Failed to process auto-frank purchase due to a file error.');
                }

                await logPurchase(interaction, `<@${userId}> purchased **${premium.display}** for ${premium.price} Shinobi Shards. Added 1 ${premium.durationKey} auto-frank session.`);
                return interaction.reply(`<@${userId}> Successfully purchased ${premium.display}! You now have 1 more ${premium.durationKey} auto-frank session.`);
            }

            // --- Custom Jutsu handling (allow multiple) ---
            if (premium.type === 'custom_jutsu') {
                if (!players[userId].ss || players[userId].ss < premium.price) {
                    return interaction.reply(`You need ${premium.price} Shinobi Shards to buy this item!`);
                }
                players[userId].ss -= premium.price;
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

                await logPurchase(interaction, `<@${userId}> purchased a **Custom Jutsu** for ${premium.price} Shinobi Shards.`);
                return interaction.reply(`<@${userId}> Successfully purchased a **Custom Jutsu**!`);
            }

            if (players[userId].premiumRoles && players[userId].premiumRoles.some(r => r && r.roleId === premium.roleId)) {
                return interaction.reply('You already own this premium item!');
            }

            if (!players[userId].ss || players[userId].ss < premium.price) {
                return interaction.reply(`You need ${premium.price} Shinobi Shards to buy this item!`);
            }

            players[userId].ss -= premium.price;

            if (players[userId].roles) {
                delete players[userId].roles;
            }

            if (!players[userId].premiumRoles) players[userId].premiumRoles = [];
            const expiresAt = Date.now() + premium.duration;
            players[userId].premiumRoles.push({ roleId: premium.roleId, expiresAt });

            fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

            // Also mirror the premium role into users.json so profile.js sees it immediately
            try {
                const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                if (!users[userId]) users[userId] = {};
                if (!Array.isArray(users[userId].premiumRoles)) users[userId].premiumRoles = [];
                users[userId].premiumRoles = users[userId].premiumRoles.filter(r => r && r.roleId); // normalize
                // avoid duplicates
                if (!users[userId].premiumRoles.some(r => r.roleId === premium.roleId)) {
                    users[userId].premiumRoles.push({ roleId: premium.roleId, expiresAt });
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
                }
            } catch (e) {
                console.error('[buy.js] Failed to update users.json with premiumRoles:', e);
            }

            try {
                const member = await interaction.guild.members.fetch(userId);
                await member.roles.add(premium.roleId, "Purchased premium item");
            } catch (e) {
                // Ignore errors
            }

            await logPurchase(interaction, `<@${userId}> purchased **${premium.display}** for ${premium.price} Shinobi Shards. Expires <t:${Math.floor(expiresAt / 1000)}:R>`);

            scheduleRoleRemoval(interaction.guild, userId, premium.roleId, premium.duration, playersPath);

            return interaction.reply(`<@${userId}> Successfully purchased ${premium.display} for 1 month!`);
        }

        if (comboName) {
            const comboKey = comboName.toLowerCase();
            if (!shopItems[comboKey]) {
                return interaction.reply('That combo doesn\'t exist in the shop!');
            }

            const combo = shopItems[comboKey];
            const jutsusPath = path.join(__dirname, '../data', 'jutsu.json');
            const jutsuData = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            const userId = interaction.user.id;

            if (!jutsuData[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            if (jutsuData[userId].combos && jutsuData[userId].combos.includes(combo.name)) {
                return interaction.reply('You already know this combo!');
            }

            // Handle Dual Currency
            const currency = combo.currency || 'money';
            const price = combo.price || 0;

            if (price > 0) {
                if (!players[userId]) return interaction.reply('Profile not found.');

                if (currency === 'ss') {
                    if ((players[userId].ss || 0) < price) {
                        return interaction.reply(`You need ${price} Shinobi Shards (SS) to buy this combo!`);
                    }
                    players[userId].ss -= price;
                } else {
                    if ((players[userId].money || 0) < price) {
                        return interaction.reply(`You need $${price.toLocaleString()} to buy this combo!`);
                    }
                    players[userId].money -= price;
                }
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
            }

            if (!jutsuData[userId].combos) {
                jutsuData[userId].combos = [];
            }
            jutsuData[userId].combos.push(combo.name);

            fs.writeFileSync(jutsusPath, JSON.stringify(jutsuData, null, 4));

            const currencyLabel = currency === 'ss' ? 'SS' : '$';
            await logPurchase(interaction, ` <@${userId}> purchased combo **${combo.name}** for ${currencyLabel}${price.toLocaleString()}.`);

            return interaction.reply(`Successfully learned ${combo.name}!`);
        }

        // --- BUY JUTSU SHOP ---
        if (jutsuName) {
            const jutsuKey = jutsuName.toLowerCase();
            const item = jutsuShopItems[jutsuKey];
            if (!item) {
                return interaction.reply('That jutsu does not exist in the shop!');
            }
            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            const userId = interaction.user.id;
            if (!players[userId] || players[userId].money < item.price) {
                return interaction.reply(`You need $${item.price} to buy this jutsu!`);
            }

            // Check if user already has the jutsu
            const jutsuJsonPath = path.join(__dirname, '../data', 'jutsu.json');
            const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));

            // The code provided doesn't explicitly check if the user already has the jutsu before purchasing
            // but the add logic inside the block is checking it.
            // I'll add an explicit check here for a better user experience.
            if (jutsuData[userId] && jutsuData[userId].usersjutsu && jutsuData[userId].usersjutsu.includes(item.key)) {
                return interaction.reply(`You already know the jutsu **${item.name}**!`);
            }

            players[userId].money -= item.price;
            fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

            // Add jutsu to jutsu.json usersjutsu
            if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [] };
            if (!jutsuData[userId].usersjutsu) jutsuData[userId].usersjutsu = []; // Ensure array exists

            // Check again for redundancy (though logic above handles it, this is for safety)
            if (!jutsuData[userId].usersjutsu.includes(item.key)) {
                jutsuData[userId].usersjutsu.push(item.key);
                fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 4));
            }
            await logPurchase(interaction, `<@${userId}> purchased jutsu **${item.name}** for $${item.price}.`);
            return interaction.reply(`Successfully learned ${item.name}!`);
        }

        // --- BUY EVENT SHOP ---
        // --- BUY EVENT SHOP (Christmas) ---
        if (eventName) {
            const eventKey = eventName.toLowerCase();
            const item = eventShopItems[eventKey];
            if (!item) {
                return interaction.reply('That event item does not exist in the shop!');
            }

            const jutsuJsonPath = path.join(__dirname, '../data', 'jutsu.json');
            const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));
            const userId = interaction.user.id;
            const usersJsonPath = path.join(__dirname, '../data', 'users.json'); // For themes

            // Check if user is enrolled
            if (!jutsuData[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            let christmasTokens = 0;
            if (jutsuData[userId].items && typeof jutsuData[userId].items["Christmas Token"] === "number") {
                christmasTokens = jutsuData[userId].items["Christmas Token"];
            }

            if (christmasTokens < item.price) {
                return interaction.reply(`You need ${item.price} Christmas Tokens to buy this item!`);
            }

            // Handle specific item types
            if (item.type === 'jutsu') {
                if (jutsuData[userId].usersjutsu && jutsuData[userId].usersjutsu.includes(item.key)) {
                    return interaction.reply(`You already know the jutsu **${item.name}**!`);
                }
                // Add Jutsu
                if (!jutsuData[userId].usersjutsu) jutsuData[userId].usersjutsu = [];
                jutsuData[userId].usersjutsu.push(item.key);

            } else if (item.type === 'item') {
                // Add Item
                if (!jutsuData[userId].items) jutsuData[userId].items = {};
                // Allow multiple? Scroll of Truth seems unique. Let's act like unique for now or just stack.
                // Actually story items should be unique mostly, but stacking is safer code.
                jutsuData[userId].items[item.key] = (jutsuData[userId].items[item.key] || 0) + 1;

            } else if (item.type === 'theme') {
                // Load Users Data for theme
                const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
                if (!usersData[userId]) usersData[userId] = {};

                // Check already owned
                if (usersData[userId].themes && usersData[userId].themes.includes(item.key)) {
                    return interaction.reply('You already own this profile theme!');
                }

                if (!usersData[userId].themes) usersData[userId].themes = [];
                usersData[userId].themes.push(item.key);
                usersData[userId].profileTheme = item.key; // Auto-equip

                fs.writeFileSync(usersJsonPath, JSON.stringify(usersData, null, 4));

            } else if (item.type === 'ramen') {
                const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                if (!players[userId]) players[userId] = {};
                players[userId].ramen = (players[userId].ramen || 0) + 1;
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
            }

            // Deduct tokens
            if (!jutsuData[userId].items) jutsuData[userId].items = {};
            jutsuData[userId].items["Christmas Token"] = christmasTokens - item.price;

            fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 4));
            await logPurchase(interaction, `<@${userId}> purchased event item **${item.name}** for ${item.price} Christmas Tokens.`);
            return interaction.reply(`Successfully purchased **${item.name}**!`);
        }

        // --- BUY MISC SHOP ---
        if (miscName) {
            const miscKey = miscName.toLowerCase();
            const item = miscShopItems[miscKey];
            if (!item) {
                return interaction.reply('That miscellaneous item does not exist in the shop!');
            }

            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            const userId = interaction.user.id;

            if (!players[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            if (!players[userId].ss || players[userId].ss < item.price) {
                return interaction.reply(`You need ${item.price} Shinobi Shards to buy this item!`);
            }

            if (item.key === 'stat_refund') {
                // Load autofrank data to update stat refund count
                let autofrankData = {};
                if (fs.existsSync(autofrankPath)) {
                    autofrankData = JSON.parse(fs.readFileSync(autofrankPath, 'utf8')) || {};
                }
                if (!autofrankData[userId]) {
                    autofrankData[userId] = { activeSession: null, features: {} };
                }
                if (!autofrankData[userId].features['stat_refund']) {
                    autofrankData[userId].features['stat_refund'] = 0;
                }
                if (autofrankData[userId].features['stat_refund'] >= 1) {
                    return interaction.reply('You already own a Stat Refund! Use it before buying another.');
                }
                autofrankData[userId].features['stat_refund']++;
                fs.writeFileSync(autofrankPath, JSON.stringify(autofrankData, null, 4));
            } else {
                return interaction.reply('Unknown miscellaneous item.');
            }

            players[userId].ss -= item.price;
            fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

            await logPurchase(interaction, `<@${userId}> purchased **${item.name}** for ${item.price} Shinobi Shards.`);
            return interaction.reply(`Successfully purchased ${item.name}!
You now have 1 Stat Refund available. Use the /refund command to access it.`);
        }

        // --- BUY ACCESSORY SHOP ---
        if (accessoryName) {
            const itemKey = accessoryName.toLowerCase();
            const accessoriesPath = path.resolve(__dirname, '../data/accessories.json');
            const accessories = JSON.parse(fs.readFileSync(accessoriesPath, 'utf8'));
            const item = accessories.find(acc => acc.name.toLowerCase() === itemKey);

            if (!item) {
                return interaction.reply('That accessory does not exist in the shop!');
            }

            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            const userId = interaction.user.id;

            if (!players[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            if (players[userId].money < item.price) {
                return interaction.reply(`You need $${item.price} to buy this accessory!`);
            }

            // Read and update userAccessory.json
            const userAccessoryPath = path.join(__dirname, '../data/userAccessory.json');
            let userAccessoryData = fs.existsSync(userAccessoryPath) ? JSON.parse(fs.readFileSync(userAccessoryPath, 'utf8')) : {};

            if (!userAccessoryData[userId]) {
                userAccessoryData[userId] = { inventory: [], equipped: null, bonusStats: {} };
            }

            if (userAccessoryData[userId].inventory.includes(item.name)) {
                return interaction.reply('You already have this accessory in your inventory.');
            }

            // Deduct money
            players[userId].money -= item.price;
            fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));

            // Update inventory in userAccessory.json
            userAccessoryData[userId].inventory.push(item.name);
            fs.writeFileSync(userAccessoryPath, JSON.stringify(userAccessoryData, null, 4));

            await logPurchase(interaction, `<@${userId}> purchased accessory **${item.name}** for $${item.price}.`);
            return interaction.reply(`Successfully purchased ${item.name}! Use \`/accessory\` to equip it.`);
        }
    },

    // --- Persisted premium-role cleanup / scheduler on startup ---
    // This function will be called by the bot main file after commands are loaded:
    // e.g. command.setup(client, userPromptCounts) or command.setup(client)
    setup: (client) => {
        try {
            if (!fs.existsSync(playersPath)) return;
            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            let modified = false;
            for (const [userId, pdata] of Object.entries(players)) {
                if (!pdata || !Array.isArray(pdata.premiumRoles)) continue;

                // Filter roles: remove expired now, schedule future removals
                const remainingRoles = [];
                for (const roleObj of pdata.premiumRoles) {
                    if (!roleObj || !roleObj.roleId || !roleObj.expiresAt) {
                        // skip malformed entries
                        modified = true;
                        continue;
                    }
                    const msLeft = roleObj.expiresAt - Date.now();
                    if (msLeft <= 0) {
                        // expired already -> attempt immediate removal across guilds
                        client.guilds.cache.forEach(async (guild) => {
                            try {
                                const member = await guild.members.fetch(userId).catch(() => null);
                                if (member && member.roles.cache.has(roleObj.roleId)) {
                                    await member.roles.remove(roleObj.roleId, 'Premium role expired (startup cleanup)');
                                }
                            } catch (e) {
                                // ignore per-guild errors
                            }
                        });
                        // also remove from users.json immediately
                        try {
                            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                            if (users[userId] && Array.isArray(users[userId].premiumRoles)) {
                                const before = users[userId].premiumRoles.length;
                                users[userId].premiumRoles = users[userId].premiumRoles.filter(r => r && r.roleId !== roleObj.roleId);
                                if (users[userId].premiumRoles.length !== before) {
                                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
                                }
                            }
                        } catch (e) {
                            console.error('[buy.js] Failed to remove expired premium role from users.json on startup:', e);
                        }
                        modified = true;
                        // do not push to remainingRoles (removing entry)
                    } else {
                        // schedule future removal for each guild (will ignore guilds where user is not present)
                        client.guilds.cache.forEach((guild) => {
                            scheduleRoleRemoval(guild, userId, roleObj.roleId, msLeft, playersPath);
                        });
                        remainingRoles.push(roleObj);
                    }
                }

                // update if changed
                if (remainingRoles.length !== pdata.premiumRoles.length) {
                    players[userId].premiumRoles = remainingRoles;
                }
            }

            if (modified) {
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
            }

            // --- Separate cleanup for users.json malformed entries ---
            try {
                if (fs.existsSync(usersPath)) {
                    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    let usersModified = false;
                    for (const udata of Object.values(users)) {
                        if (udata && Array.isArray(udata.premiumRoles)) {
                            const beforeLen = udata.premiumRoles.length;
                            udata.premiumRoles = udata.premiumRoles.filter(r => r && r.roleId && r.expiresAt);
                            if (udata.premiumRoles.length !== beforeLen) {
                                usersModified = true;
                            }
                        }
                    }
                    if (usersModified) {
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
                    }
                }
            } catch (e) {
                console.error('[buy.js] Failed to clean up users.json on startup:', e);
            }

            console.log('[buy.js] Scheduled premium role expirations on startup.');
        } catch (e) {
            console.error('[buy.js] Failed to schedule premium role expirations on startup:', e);
        }
    },
};