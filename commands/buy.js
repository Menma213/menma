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

// Premium shop items (should match shop.js)
const premiumItems = [
    {
        name: "donator",
        display: "Donator Gamepass",
        description: "Unlocks the exclusive Donator role.",
        price: 100,
        roleId: "1385640728130097182",
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    },
    {
        name: "legendary ninja",
        display: "Legendary Ninja",
        description: "Grants the Legendary Ninja role.",
        price: 200,
        roleId: "1385640798581952714",
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    },
    {
        name: "jinchuriki",
        display: "Jinchuriki",
        description: "Become a Jinchuriki and receive the Jinchuriki role.",
        price: 500,
        roleId: "1385641469507010640",
        duration: 30 * 24 * 60 * 60 * 1000 // 1 month in ms, use 15000 for 15 seconds
    },
    {
        name: "custom jutsu",
        display: "Custom Jutsu",
        description: "Create your own custom jutsu! (single effect)",
        price: 1000,
        roleId: "1399097723554234448"
        // No roleId, no duration, handled in real time
    }
];

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

async function scheduleRoleRemoval(guild, userId, roleId, duration, usersPath) {
    setLongTimeout(async () => {
        try {
            const member = await guild.members.fetch(userId);
            await member.roles.remove(roleId, "Premium role expired");
            // Remove from users.json
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
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
                .setRequired(false)),

    async execute(interaction) {
        const comboName = interaction.options.getString('combo');
        const ssName = interaction.options.getString('ss');

        if (!comboName && !ssName) {
            return interaction.reply("Buy something...c'mon.");
        }

        // If using SS option
        if (ssName) {
            const premium = premiumItems.find(item => item.name === ssName.toLowerCase());
            if (!premium) {
                return interaction.reply('That premium item doesn\'t exist in the shop!');
            }

            const usersPath = path.join(__dirname, '../data', 'users.json');
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const userId = interaction.user.id;

            if (!users[userId]) {
                return interaction.reply('You need to be enrolled first!');
            }

            // Custom Jutsu purchase logic
            if (premium.name === "custom jutsu") {
                if (!users[userId].ss || users[userId].ss < premium.price) {
                    return interaction.reply(`You need ${premium.price} Shinobi Shards to buy this item!`);
                }
                users[userId].ss -= premium.price;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
                // Add the role if it exists (for display and real-time)
                if (premium.roleId) {
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        await member.roles.add(premium.roleId, "Purchased Custom Jutsu");
                    } catch (e) {
                        // Ignore errors
                    }
                }
                await logPurchase(interaction, `<@${userId}> purchased **Custom Jutsu** for ${premium.price} Shinobi Shards.`);
                return interaction.reply(`<@${userId}> Successfully purchased a Custom Jutsu! Instructions on creating a custom are in <#1399109319051579422>.`);
            }

            // Check if user already has this premium role in premiumRoles
            if (users[userId].premiumRoles && users[userId].premiumRoles.some(r => r.roleId === premium.roleId)) {
                return interaction.reply('You already own this premium item!');
            }

            if (!users[userId].ss || users[userId].ss < premium.price) {
                return interaction.reply(`You need ${premium.price} Shinobi Shards to buy this item!`);
            }

            users[userId].ss -= premium.price;

            // Remove roles property if it exists (cleanup)
            if (users[userId].roles) {
                delete users[userId].roles;
            }

            // Track premium role with expiration
            if (!users[userId].premiumRoles) users[userId].premiumRoles = [];
            const expiresAt = Date.now() + premium.duration;
            users[userId].premiumRoles.push({ roleId: premium.roleId, expiresAt });

            fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));

            // Add role to user
            try {
                const member = await interaction.guild.members.fetch(userId);
                await member.roles.add(premium.roleId, "Purchased premium item");
            } catch (e) {
                // Ignore errors
            }

            // Log the purchase
            await logPurchase(interaction, ` <@${userId}> purchased **${premium.display}** for ${premium.price} Shinobi Shards. Expires <t:${Math.floor(expiresAt/1000)}:R>`);

            // Schedule role removal
            scheduleRoleRemoval(interaction.guild, userId, premium.roleId, premium.duration, usersPath);

            return interaction.reply(`<@${userId}> Successfully purchased ${premium.display} for 1 month!`);
        }

        // If using combo option
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
                const usersPath = path.join(__dirname, '../data', 'users.json');
                const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                if (!users[userId] || users[userId].money < combo.price) {
                    return interaction.reply(`You need $${combo.price} to buy this combo!`);
                }
                users[userId].money -= combo.price;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
            }

            if (!jutsuData[userId].combos) {
                jutsuData[userId].combos = [];
            }
            jutsuData[userId].combos.push(combo.name);

            fs.writeFileSync(jutsusPath, JSON.stringify(jutsuData, null, 4));

            // Log the purchase
            await logPurchase(interaction, `🟢 <@${userId}> purchased combo **${combo.name}** for $${combo.price || 0}.`);

            return interaction.reply(`Successfully learned ${combo.name}!`);
        }
    }
};
