const { SlashCommandBuilder, EmbedBuilder, WebhookClient, PermissionFlagsBits, Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Gatō's avatar (Naruto anime villain, business man)
const GATO_AVATAR = 'https://static.wikia.nocookie.net/near_pure_evil/images/d/d8/Gato.png/revision/latest?cb=20210922075636';
const GATO_NAME = 'Gatō';

// Thunderbird avatar and name
const THUNDERBIRD_AVATAR = 'https://i.postimg.cc/5yGPzn9R/image.png';
const THUNDERBIRD_NAME = 'Thunderbird.';

// A Map to store Thunderbird's active state per guild
// Key: guild.id, Value: { expiresAt: timestamp }
const thunderbirdEvents = new Map();

// --- CONFIGURATION FOR THUNDERBIRD SPAWN CHANCE AND DURATION ---
// Set spawn chance to 100% for testing. To revert to 0.1%, change to 0.001.
const THUNDERBIRD_SPAWN_CHANCE = 0.001;
// Set duration to 1 minute for testing. To revert to 15 minutes, change to 15 * 60 * 1000.
const THUNDERBIRD_DURATION_MS = 15 * 60 * 1000;

/**
 * Deletes all webhooks in the channel managed by the bot.
 * This is crucial to prevent the Discord API's webhook limit (15) from being reached.
 * @param {object} channel The Discord channel object.
 * @param {object} client The Discord client object.
 */
async function cleanupWebhooks(channel, client) {
    try {
        const webhooks = await channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
            // Only delete webhooks owned by the bot
            if (webhook.owner && webhook.owner.id === client.user.id) {
                await webhook.delete();
            }
        }
    } catch (error) {
        console.error("Failed to clean up webhooks:", error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade Shinobi Shards or Money with another user.'),

    // This is the function that your main bot file will call
    // in its messageCreate event handler.
    async thunderbirdListener(message) {
        // Ignore bot messages, DMs, and messages if an event is already active in this guild
        if (message.author.bot || !message.guild || thunderbirdEvents.has(message.guild.id)) {
            return;
        }

        // Roll the dice to see if Thunderbird spawns
        if (Math.random() <= THUNDERBIRD_SPAWN_CHANCE) {
            // Activate Thunderbird for this specific guild
            const expiresAt = Date.now() + THUNDERBIRD_DURATION_MS;
            thunderbirdEvents.set(message.guild.id, { expiresAt });

            // Set a timeout to remove the event from the map
            setTimeout(() => {
                thunderbirdEvents.delete(message.guild.id);
                console.log(`Thunderbird event has ended for guild ${message.guild.id}.`);
            }, THUNDERBIRD_DURATION_MS);

            // Find or create a webhook for the initial trigger message in this channel
            let webhooks = await message.channel.fetchWebhooks();
            let thunderbirdTriggerWebhook = webhooks.find(w => w.owner && w.owner.id === message.client.user.id && w.name === THUNDERBIRD_NAME);
            
            // If the webhook doesn't exist or there are too many, try to create one.
            if (!thunderbirdTriggerWebhook) {
                try {
                    thunderbirdTriggerWebhook = await message.channel.createWebhook({
                        name: THUNDERBIRD_NAME,
                        avatar: THUNDERBIRD_AVATAR,
                        reason: 'For Thunderbird NPC event trigger'
                    });
                } catch (error) {
                    console.error("Failed to create webhook for Thunderbird trigger:", error);
                    return;
                }
            }

            // Send the trigger message via the webhook
            await thunderbirdTriggerWebhook.send({
                content: "Good night everyone.",
                username: THUNDERBIRD_NAME,
                avatarURL: THUNDERBIRD_AVATAR
            });
        }
    },

    async execute(interaction) {
        // Only allow in guild text channels
        if (!interaction.guild || !interaction.channel) {
            return interaction.reply({ content: "This command can only be used in a server channel.", ephemeral: true });
        }

        // Clean up old webhooks before starting a new interaction
        await cleanupWebhooks(interaction.channel, interaction.client);

        // Load users
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userId = interaction.user.id;
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // --- COMMON WEBHOOK HELPERS ---
        // These will be used for both Gato and Thunderbird to avoid code duplication
        async function getWebhook(name, avatar) {
            try {
                let webhooks = await interaction.channel.fetchWebhooks();
                let webhook = webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id && w.name === name);
                
                if (!webhook) {
                    webhook = await interaction.channel.createWebhook({
                        name: name,
                        avatar: avatar,
                        reason: `For ${name} NPC interactions`
                    });
                }
                return webhook;
            } catch (error) {
                // Handle the case where the webhook limit is reached
                if (error.code === 30007) {
                    await interaction.followUp({ content: `There are too many webhooks in this channel. Please try again after some time or ask a moderator to clear them.`, ephemeral: true });
                    return null;
                }
                console.error(`Failed to get or create webhook for ${name}:`, error);
                return null;
            }
        }

        async function sendWebhookMessage(webhook, content, opts = {}) {
            if (!webhook) return;
            return await webhook.send({ content, username: webhook.name, avatarURL: webhook.avatarURL, ...opts });
        }

        async function sendWebhookEmbed(webhook, embed) {
            if (!webhook) return;
            return await webhook.send({ embeds: [embed], username: webhook.name, avatarURL: webhook.avatarURL });
        }

        // Check if Thunderbird is active for this guild
        const isThunderbirdActive = thunderbirdEvents.has(interaction.guild.id);

        // --- THUNDERBIRD INTERACTION LOGIC ---
        if (isThunderbirdActive) {
            await interaction.reply({ content: "You sense a new presence...", ephemeral: true });

            const thunderbirdWebhook = await getWebhook(THUNDERBIRD_NAME, THUNDERBIRD_AVATAR);
            if (!thunderbirdWebhook) return;

            // Step 1: Initial message with buttons
            const message = await sendWebhookMessage(thunderbirdWebhook, 'I NEED MONEY <:huh:1392583348374732862>', {
                components: [{
                    type: 1,
                    components: [
                        { type: 2, label: "Uhh...", style: 1, custom_id: "uhh" },
                        { type: 2, label: "Can I help?", style: 1, custom_id: "help" }
                    ]
                }]
            });
            if (!message) return;

            // Wait for button interaction
            const filter = i => i.user.id === interaction.user.id && ["uhh", "help"].includes(i.customId);
            let buttonInteraction;
            try {
                buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                await buttonInteraction.update({ components: [] }); // Disable buttons after click
            } catch {
                await sendWebhookMessage(thunderbirdWebhook, "No response. Thunderbird leaves.");
                return;
            }
            await sendWebhookMessage(thunderbirdWebhook, "I smell it. The sweet smell of Cash. Go ahead, buy these Shards <:thundierich:1399090526044557417>");

            // Step 2: Show shop embed
            const shopEmbed = new EmbedBuilder()
                .setTitle("Shinobi Shard Shop")
                .setColor("#e6b800")
                .setDescription("Amount: **1**\nPrice: **100,000**\n\nOr enter a custom amount in chat (e.g. `5` for 5 shards). Each costs 100,000 money.");
            await sendWebhookEmbed(thunderbirdWebhook, shopEmbed);

            // Wait for custom amount
            const amountFilter = m => m.author.id === interaction.user.id && /^\d+$/.test(m.content.trim());
            let amountMsg;
            let amount = 1;
            try {
                amountMsg = await interaction.channel.awaitMessages({ filter: amountFilter, max: 1, time: 60000, errors: ['time'] });
                amount = parseInt(amountMsg.first().content.trim());
            } catch {
                // Default to 1 if no input
            }
            const totalPrice = amount * 100000;
            if ((users[userId].money || 0) < totalPrice) {
                await sendWebhookMessage(thunderbirdWebhook, "You don't have enough money!");
                return;
            }

            // Deduct money and add shards
            users[userId].money -= totalPrice;
            users[userId].ss = (users[userId].ss || 0) + amount;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await sendWebhookMessage(thunderbirdWebhook, "<a:twirl:1398697654912942164> Now i buy some KitKat to feed my children! Thank you!");
            return;
        }

        // --- GATŌ'S INTERACTION (ORIGINAL LOGIC) ---
        // If Thunderbird is not active, proceed with the original Gato trade logic
        const gatoWebhook = await getWebhook(GATO_NAME, GATO_AVATAR);
        if (!gatoWebhook) return;

        // Helper to send as Gatō
        async function gatoSay(content, opts = {}) {
            return await sendWebhookMessage(gatoWebhook, content, opts);
        }

        // Helper to send an embed as Gatō
        async function gatoEmbed(embed) {
            return await sendWebhookEmbed(gatoWebhook, embed);
        }

        // Step 1: Introduction
        await interaction.reply({ content: "Summoning Gatō...", ephemeral: true });
        await gatoSay(`Greetings! I am **Gatō**, the wealthiest businessman in the Land of Waves. I'll be your host for this trade!\n\nIf you wish to continue, type **continue** in chat.`);

        // Step 2: Wait for "continue" from the command user
        const filterContinue = m => m.author.id === userId && m.content.trim().toLowerCase() === 'continue';
        let continueMsg;
        try {
            continueMsg = await interaction.channel.awaitMessages({ filter: filterContinue, max: 1, time: 60000, errors: ['time'] });
        } catch {
            await gatoSay("No response. Trade cancelled.");
            return;
        }

        // Step 3: Ask for user mention
        await gatoSay("Please ping (**@mention**) the user you want to trade with.");

        // Wait for a mention from the command user
        const filterMention = m => m.author.id === userId && m.mentions.users.size === 1 && m.mentions.users.first().id !== userId;
        let mentionMsg;
        let partnerId;
        try {
            mentionMsg = await interaction.channel.awaitMessages({ filter: filterMention, max: 1, time: 60000, errors: ['time'] });
            partnerId = mentionMsg.first().mentions.users.first().id;
        } catch {
            await gatoSay("No valid user mentioned. Trade cancelled.");
            return;
        }
        if (!users[partnerId]) {
            await gatoSay("That user is not enrolled in the game. Trade cancelled.");
            return;
        }

        // Step 4: Wait for the mentioned user to say "okay"
        await gatoSay(`<@${partnerId}>, do you accept this trade? Type **okay** to proceed.`);
        const filterOkay = m => m.author.id === partnerId && m.content.trim().toLowerCase() === 'okay';
        try {
            await interaction.channel.awaitMessages({ filter: filterOkay, max: 1, time: 60000, errors: ['time'] });
        } catch {
            await gatoSay("No response from the partner. Trade cancelled.");
            return;
        }

        // Step 5: Send trading guide
        const guideEmbed = new EmbedBuilder()
            .setTitle("Trading Guide")
            .setColor("#e6b800")
            .setDescription(
                "**To offer Shinobi Shards:**\n" +
                "> `100 SS`\n" +
                "**To offer Money:**\n" +
                "> `1000 money`\n\n" +
                "Type your offer in chat. (Only numbers and 'SS' or 'money' are accepted.)"
            )
            .setFooter({ text: "Both users must send their offer." });
        await gatoSay("So whoever is trading Shinobi Shards or Money, use the following format:");
        await gatoEmbed(guideEmbed);

        // Step 6: Wait for both users to send their offer
        let offers = {};
        const offerFilter = m => [userId, partnerId].includes(m.author.id) &&
            !offers[m.author.id] &&
            /^(\d+)\s*(ss|money)$/i.test(m.content.trim());
        let offerMsgs = [];
        try {
            while (Object.keys(offers).length < 2) {
                const collected = await interaction.channel.awaitMessages({ filter: offerFilter, max: 1, time: 120000, errors: ['time'] });
                const msg = collected.first();
                const [, amount, type] = msg.content.trim().match(/^(\d+)\s*(ss|money)$/i);
                offers[msg.author.id] = { amount: parseInt(amount), type: type.toLowerCase(), msg };
                offerMsgs.push(msg);
            }
        } catch {
            await gatoSay("Trade timed out. Both users did not send their offer.");
            return;
        }

        // Step 7: Show summary and ask for confirmation
        const user1 = interaction.user;
        const user2 = interaction.guild.members.cache.get(partnerId)?.user || { id: partnerId, username: "Partner" };
        const summaryEmbed = new EmbedBuilder()
            .setTitle("Trade Summary")
            .setColor("#00bfae")
            .addFields(
                { name: user1.username, value: `${offers[userId].amount} ${offers[userId].type === 'ss' ? 'Shinobi Shards' : 'Money'}` },
                { name: user2.username, value: `${offers[partnerId].amount} ${offers[partnerId].type === 'ss' ? 'Shinobi Shards' : 'Money'}` }
            )
            .setFooter({ text: "Both users must type Confirm to finalize the trade." });
        await gatoSay("Oh? That's a nice trade! Both must say **Confirm** to confirm.");
        await gatoEmbed(summaryEmbed);

        // Step 8: Wait for both users to say "Confirm"
        let confirmed = {};
        const confirmFilter = m => [userId, partnerId].includes(m.author.id) &&
            !confirmed[m.author.id] &&
            m.content.trim().toLowerCase() === 'confirm';
        try {
            while (Object.keys(confirmed).length < 2) {
                const collected = await interaction.channel.awaitMessages({ filter: confirmFilter, max: 1, time: 60000, errors: ['time'] });
                confirmed[collected.first().author.id] = true;
            }
        } catch {
            await gatoSay("Trade not confirmed by both parties. Cancelled.");
            return;
        }

        // Step 9: Validate and perform the trade
        let u1 = users[userId];
        let u2 = users[partnerId];
        // Shinobi Shards variable: "ss" or "SS" (case-insensitive), Money: "money"
        function getSS(user) {
            return user.ss || user.SS || 0;
        }
        function setSS(user, val) {
            if ('ss' in user) user.ss = val;
            else if ('SS' in user) user.SS = val;
            else user.ss = val;
        }
        // Validate offers
        let errors = [];
        for (const [uid, offer] of Object.entries(offers)) {
            const user = users[uid];
            if (offer.type === 'ss') {
                if (getSS(user) < offer.amount) errors.push(`<@${uid}> does not have enough Shinobi Shards.`);
            } else if (offer.type === 'money') {
                if ((user.money || 0) < offer.amount) errors.push(`<@${uid}> does not have enough money.`);
            }
        }
        if (errors.length) {
            await gatoSay("Trade failed:\n" + errors.join('\n'));
            return;
        }

        // Perform the trade
        // User1 gives their offer to user2, and vice versa
        if (offers[userId].type === 'ss') {
            setSS(u1, getSS(u1) - offers[userId].amount);
            setSS(u2, getSS(u2) + offers[userId].amount);
        } else {
            u1.money -= offers[userId].amount;
            u2.money += offers[userId].amount;
        }
        if (offers[partnerId].type === 'ss') {
            setSS(u2, getSS(u2) - offers[partnerId].amount);
            setSS(u1, getSS(u1) + offers[partnerId].amount);
        } else {
            u2.money -= offers[partnerId].amount;
            u1.money += offers[partnerId].amount;
        }
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Step 10: Final message
        await gatoSay("The trade is complete! Thank you for using Gatō's Trading Service. Come back anytime for more business!");
    }
};
