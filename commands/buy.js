const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// New path to the players data file
const playersPath = path.join(__dirname, '../../menma/data/players.json');
// Add usersPath so profile.js (which reads users.json) sees premiumRoles
const usersPath = path.join(__dirname, '../../menma/data/users.json');
const autofrankPath = path.join(__dirname, '../../menma/data/autofrank.json');

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
};

// Premium shop items (should match shop.js)
const premiumItems = [
    {
        name: "donator",
        display: "Donator Gamepass",
        description: "Unlocks the exclusive Donator role.",
        price: 100,
        roleId: "1385640728130097182",
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "legendary ninja",
        display: "Legendary Ninja",
        description: "Grants the Legendary Ninja role.",
        price: 200,
        roleId: "1385640798581952714",
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "jinchuriki",
        display: "Jinchuriki",
        description: "Become a Jinchuriki and receive the Jinchuriki role.",
        price: 500,
        roleId: "1385641469507010640",
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms, use 15000 for 15 seconds
        type: 'role'
    },
    {
        name: "custom jutsu",
        display: "Custom Jutsu",
        description: "Create your own custom jutsu! (3 effects)",
        price: 1000,
        type: 'custom_jutsu'
    },
    {
        name: "auto frank 3h",
        display: "Auto-Frank (3 Hours)",
        description: "Automatically run F-rank missions for 3 hours. Grants 21,600 base EXP.",
        price: 600, // Example price
        type: 'autofrank',
        durationKey: '3h'
    },
    {
        name: "auto frank 6h",
        display: "Auto-Frank (6 Hours)",
        description: "Automatically run F-rank missions for 6 hours. Grants 43,200 base EXP.",
        price: 1400, // Example price
        type: 'autofrank',
        durationKey: '6h'
    },
    {
        name: "auto frank 12h",
        display: "Auto-Frank (12 Hours)",
        description: "Automatically run F-rank missions for 12 hours. Grants 86,400 base EXP.",
        price: 2000, // Example price
        type: 'autofrank',
        durationKey: '12h'
    }
];

const eventShopItems = {
    "guillotine drop": {
        name: "Guillotine Drop",
        price: 250,
        key: "Guillotine Drop"
    },
    "kirin: lightning storm": {
        name: "Kirin: Lightning Storm",
        price: 150,
        key: "Kirin: Lightning Storm"
    },
    "shadow clone jutsu: 1000 clones": {
        name: "Shadow Clone Jutsu: 1000 clones",
        price: 100,
        key: "Shadow Clone Jutsu: 1000 clones"
    },
    "explosive paper clone": {
        name: "Explosive Paper Clone",
        price: 100,
        key: "Explosive Paper Clone"
    },
    "lightning hound": {
        name: "Lightning Hound",
        price: 50,
        key: "Lightning Hound"
    },
    "ramen coupon": {
        name: "ramen",
        price: 5,
        key: "ramen"
    }
};

const miscShopItems = {
    "stat refund": {
        name: "Stat Refund",
        price: 500, // Example price in Shinobi Shards
        key: "stat_refund"
    }
};

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
        .addStringOption(option => // ✨ ADDED MISC OPTION
            option.setName('misc')
                .setDescription('Buy miscellaneous items')
                .setRequired(false)),

    async execute(interaction) {
        const comboName = interaction.options.getString('combo');
        const ssName = interaction.options.getString('ss');
        const eventName = interaction.options.getString('event');
        const jutsuName = interaction.options.getString('jutsu');
        const miscName = interaction.options.getString('misc');

        if (!comboName && !ssName && !eventName && !jutsuName && !miscName) {
            return interaction.reply("Buy something...c'mon.");
        }

        if (ssName) {
            const premium = premiumItems.find(item => item.name === ssName.toLowerCase());
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

            if (players[userId].premiumRoles && players[userId].premiumRoles.some(r => r.roleId === premium.roleId)) {
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

            await logPurchase(interaction, `<@${userId}> purchased **${premium.display}** for ${premium.price} Shinobi Shards. Expires <t:${Math.floor(expiresAt/1000)}:R>`);

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
            const userId = interaction.user.id;

            if (!jutsuData[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            if (jutsuData[userId].combos && jutsuData[userId].combos.includes(combo.name)) {
                return interaction.reply('You already know this combo!');
            }

            if (combo.price > 0) {
                const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                if (!players[userId] || players[userId].money < combo.price) {
                    return interaction.reply(`You need $${combo.price} to buy this combo!`);
                }
                players[userId].money -= combo.price;
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
            }

            if (!jutsuData[userId].combos) {
                jutsuData[userId].combos = [];
            }
            jutsuData[userId].combos.push(combo.name);

            fs.writeFileSync(jutsusPath, JSON.stringify(jutsuData, null, 4));

            // Fixed logging emoji (replaced mojibake)
            await logPurchase(interaction, ` <@${userId}> purchased combo **${combo.name}** for $${combo.price || 0}.`);

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
        if (eventName) {
            const eventKey = eventName.toLowerCase();
            const item = eventShopItems[eventKey];
            if (!item) {
                return interaction.reply('That event item does not exist in the shop!');
            }
            
            const jutsuJsonPath = path.join(__dirname, '../data', 'jutsu.json');
            const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));
            const userId = interaction.user.id;
            
            // Check if user is enrolled (since Ay tokens are in jutsu.json)
            if (!jutsuData[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }
            
            let ayTokens = 0;
            if (jutsuData[userId].items && typeof jutsuData[userId].items["Ay Token"] === "number") {
                ayTokens = jutsuData[userId].items["Ay Token"];
            }

            if (ayTokens < item.price) {
                return interaction.reply(`You need ${item.price} Ay tokens to buy this item!`);
            }

            // Check if already learned (if it's a jutsu)
            if (item.key !== "ramen" && jutsuData[userId].usersjutsu && jutsuData[userId].usersjutsu.includes(item.key)) {
                return interaction.reply(`You already know the jutsu **${item.name}**!`);
            }

            // Deduct tokens
            if (!jutsuData[userId].items) jutsuData[userId].items = {}; // Ensure items object exists
            jutsuData[userId].items["Ay Token"] = ayTokens - item.price;

            // If buying ramen coupon, add to players.json ramen
            if (item.key === "ramen") {
                const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                if (!players[userId]) players[userId] = {};
                players[userId].ramen = (players[userId].ramen || 0) + 1;
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 4));
                fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 4));
                await logPurchase(interaction, `<@${userId}> purchased 1 ramen coupon for ${item.price} Ay tokens.`);
                return interaction.reply(`Successfully bought 1 ramen coupon!`);
            } else {
                // Add jutsu to usersjutsu
                if (!jutsuData[userId].usersjutsu) jutsuData[userId].usersjutsu = [];
                // Redundancy check added earlier, so we can just push if it wasn't a ramen coupon and we passed the check
                if (!jutsuData[userId].usersjutsu.includes(item.key)) {
                    jutsuData[userId].usersjutsu.push(item.key);
                }
                
                fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 4));
                await logPurchase(interaction, `<@${userId}> purchased event jutsu **${item.name}** for ${item.price} Ay tokens.`);
                return interaction.reply(`Successfully learned ${item.name}!`);
            }
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
                        // keep malformed entries to avoid data loss
                        remainingRoles.push(roleObj);
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
            console.log('[buy.js] Scheduled premium role expirations on startup.');
        } catch (e) {
            console.error('[buy.js] Failed to schedule premium role expirations on startup:', e);
        }
    },
};