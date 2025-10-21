const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/players.json');

// Gatō's avatar (Naruto anime villain, business man)
const GATO_AVATAR = 'https://static.wikia.nocookie.net/near_pure_evil/images/d/d8/Gato.png/revision/latest?cb=20210922075636';
const GATO_NAME = 'Gatō';

// Thunderbird avatar and name
const THUNDERBIRD_AVATAR = 'https://i.postimg.cc/5yGPzn9R/image.png';
const THUNDERBIRD_NAME = 'Thunderbird.';

// A Map to store Thunderbird's active state per guild
// Key: guild.id, Value: { expiresAt: timestamp }
const thunderbirdEvents = new Map();

// Track last Thunderbird spawn time
let lastThunderbirdSpawn = 0;
const THUNDERBIRD_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// --- CONFIGURATION FOR THUNDERBIRD SPAWN ---
// Set to specific channel ID where Thunderbird should spawn
const THUNDERBIRD_CHANNEL_ID = '1381601428740505660'; // Replace with your desired channel ID
const THUNDERBIRD_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

// --- MAIN SERVER GUILD ID ---
// Replace with your actual main server guild ID
const MAIN_SERVER_GUILD_ID = '1381268582595297321';

// Button helper functions
function createContinueRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('continue')
            .setLabel('Continue')
            .setStyle(ButtonStyle.Primary)
    );
}

function createConfirmRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
    );
}

function createTradeOptionsRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('uhh')
            .setLabel('Uhh...')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('help')
            .setLabel('Can I help?')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createAmountSelectionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('amount_1')
            .setLabel('1 Shard (100k)')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('amount_5')
            .setLabel('5 Shards (500k)')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('amount_10')
            .setLabel('10 Shards (1M)')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('custom')
            .setLabel('Custom Amount')
            .setStyle(ButtonStyle.Secondary)
    );
}

// Wait for button interaction with timeout
async function waitForButton(interaction, userId, customId, timeout = 120000) {
    const filter = i => i.customId === customId && i.user.id === userId;
    try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: timeout });
        await buttonInteraction.deferUpdate();
        return buttonInteraction;
    } catch (error) {
        return false;
    }
}

// Wait for any button from multiple users
async function waitForAnyButton(interaction, userIds, customIds, timeout = 120000) {
    const filter = i => userIds.includes(i.user.id) && customIds.includes(i.customId);
    try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: timeout });
        await buttonInteraction.deferUpdate();
        return buttonInteraction;
    } catch (error) {
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade Shinobi Shards or Money with another user.'),

    // New Thunderbird spawn system - call this from a scheduled task or manually
    async spawnThunderbird(client) {
        const now = Date.now();
        
        // Check cooldown
        if (now - lastThunderbirdSpawn < THUNDERBIRD_COOLDOWN) {
            return false;
        }

        try {
            const guild = await client.guilds.fetch(MAIN_SERVER_GUILD_ID);
            const channel = await guild.channels.fetch(THUNDERBIRD_CHANNEL_ID);
            
            if (!channel) {
                console.error('Thunderbird channel not found');
                return false;
            }

            // Activate Thunderbird for this guild
            const expiresAt = now + THUNDERBIRD_DURATION_MS;
            thunderbirdEvents.set(guild.id, { expiresAt });

            // Set timeout to remove the event
            setTimeout(() => {
                thunderbirdEvents.delete(guild.id);
                console.log(`Thunderbird event has ended for guild ${guild.id}.`);
            }, THUNDERBIRD_DURATION_MS);

            // Create webhook and send message
            let webhooks = await channel.fetchWebhooks();
            let thunderbirdWebhook = webhooks.find(w => w.owner && w.owner.id === client.user.id && w.name === THUNDERBIRD_NAME);
            
            if (!thunderbirdWebhook) {
                thunderbirdWebhook = await channel.createWebhook({
                    name: THUNDERBIRD_NAME,
                    avatar: THUNDERBIRD_AVATAR,
                    reason: 'For Thunderbird NPC event'
                });
            }

            // Send ping and message
            await thunderbirdWebhook.send({
                content: `<@&1389238943823827067> Good night everyone. <:huh:1392583348374732862>`,
                username: THUNDERBIRD_NAME,
                avatarURL: THUNDERBIRD_AVATAR
            });

            lastThunderbirdSpawn = now;
            console.log(`Thunderbird spawned in ${guild.name} at ${new Date().toISOString()}`);
            return true;

        } catch (error) {
            console.error('Failed to spawn Thunderbird:', error);
            return false;
        }
    },

    // Manual spawn command for testing
    async forceSpawnThunderbird(client) {
        return await this.spawnThunderbird(client);
    },

    // Get Thunderbird status
    getThunderbirdStatus() {
        const event = thunderbirdEvents.get(MAIN_SERVER_GUILD_ID);
        if (!event) {
            return { active: false, timeUntilNext: Math.max(0, THUNDERBIRD_COOLDOWN - (Date.now() - lastThunderbirdSpawn)) };
        }
        
        return { 
            active: true, 
            timeRemaining: Math.max(0, event.expiresAt - Date.now()),
            timeUntilNext: Math.max(0, THUNDERBIRD_COOLDOWN - (Date.now() - lastThunderbirdSpawn))
        };
    },

    async execute(interaction) {
        // Only allow in guild text channels
        if (!interaction.guild || !interaction.channel) {
            try {
                await interaction.reply({ content: "This command can only be used in a server channel.", ephemeral: true });
            } catch (err) {
                if (err.code !== 10062) console.error('Interaction reply error:', err);
            }
            return;
        }

        // Clean up old webhooks before starting a new interaction
        await cleanupWebhooks(interaction.channel, interaction.client);

        // Load users
        if (!fs.existsSync(usersPath)) {
            try {
                await interaction.reply({ content: "Database not found.", ephemeral: true });
            } catch (err) {
                if (err.code !== 10062) console.error('Interaction reply error:', err);
            }
            return;
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userId = interaction.user.id;
        if (!users[userId]) {
            try {
                await interaction.reply({ content: "You need to enroll first!", ephemeral: true });
            } catch (err) {
                if (err.code !== 10062) console.error('Interaction reply error:', err);
            }
            return;
        }

        // --- COMMON WEBHOOK HELPERS ---
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
        // Only allow Thunderbird event in the main server
        const isThunderbirdActive = thunderbirdEvents.has(interaction.guild.id) && interaction.guild.id === MAIN_SERVER_GUILD_ID;

        // --- THUNDERBIRD INTERACTION LOGIC ---
        if (isThunderbirdActive) {
            try {
                await interaction.reply({ content: "You sense a new presence...", ephemeral: true });
            } catch (err) {
                if (err.code !== 10062) console.error('Interaction reply error:', err);
            }

            const thunderbirdWebhook = await getWebhook(THUNDERBIRD_NAME, THUNDERBIRD_AVATAR);
            if (!thunderbirdWebhook) return;

            // Step 1: Initial message with buttons
            await sendWebhookMessage(thunderbirdWebhook, 'I NEED MONEY <:huh:1392583348374732862>', {
                components: [createTradeOptionsRow()]
            });

            // Wait for button interaction
            const buttonInteraction = await waitForAnyButton(interaction, [userId], ['uhh', 'help']);
            if (!buttonInteraction) {
                await sendWebhookMessage(thunderbirdWebhook, "No response. Thunderbird leaves.");
                return;
            }

            await sendWebhookMessage(thunderbirdWebhook, "I smell it. The sweet smell of Cash. Go ahead, buy these Shards <:thundierich:1399090526044557417>");

            // Step 2: Show shop embed with amount selection
            const shopEmbed = new EmbedBuilder()
                .setTitle("Shinobi Shard Shop")
                .setColor("#e6b800")
                .setDescription("Choose how many Shinobi Shards you want to buy:\n\n• **1 Shard**: 100,000 money\n• **5 Shards**: 500,000 money  \n• **10 Shards**: 1,000,000 money\n\nOr select Custom Amount for a different quantity.");
            
            const amountMessage = await sendWebhookEmbed(thunderbirdWebhook, shopEmbed, {
                components: [createAmountSelectionRow()]
            });

            // Wait for amount selection
            let amount = 1;
            let customAmount = false;
            
            const amountInteraction = await waitForAnyButton(interaction, [userId], ['amount_1', 'amount_5', 'amount_10', 'custom']);
            if (!amountInteraction) {
                await sendWebhookMessage(thunderbirdWebhook, "No selection made. Thunderbird leaves.");
                return;
            }

            if (amountInteraction.customId === 'custom') {
                customAmount = true;
                await sendWebhookMessage(thunderbirdWebhook, "Please enter the number of shards you want to buy (e.g., `3` for 3 shards). Each shard costs 100,000 money.");
                
                // Wait for custom amount input
                const amountFilter = m => m.author.id === userId && /^\d+$/.test(m.content.trim()) && parseInt(m.content.trim()) > 0;
                try {
                    const collected = await interaction.channel.awaitMessages({ 
                        filter: amountFilter, 
                        max: 1, 
                        time: 60000 
                    });
                    amount = parseInt(collected.first().content.trim());
                } catch {
                    await sendWebhookMessage(thunderbirdWebhook, "No valid amount entered. Transaction cancelled.");
                    return;
                }
            } else {
                // Parse preset amounts
                amount = parseInt(amountInteraction.customId.split('_')[1]);
            }

            const totalPrice = amount * 100000;
            
            // Check if user has enough money
            if ((users[userId].money || 0) < totalPrice) {
                await sendWebhookMessage(thunderbirdWebhook, `You don't have enough money! You need ${totalPrice.toLocaleString()} money but only have ${(users[userId].money || 0).toLocaleString()}.`);
                return;
            }

            // Confirmation step
            const confirmEmbed = new EmbedBuilder()
                .setTitle("Confirm Purchase")
                .setColor("#ff9900")
                .setDescription(`You are about to buy **${amount} Shinobi Shard${amount !== 1 ? 's' : ''}** for **${totalPrice.toLocaleString()} money**.\n\nPress Confirm to complete the transaction.`);
            
            await sendWebhookEmbed(thunderbirdWebhook, confirmEmbed, {
                components: [createConfirmRow()]
            });

            const confirmInteraction = await waitForAnyButton(interaction, [userId], ['confirm']);
            if (!confirmInteraction) {
                await sendWebhookMessage(thunderbirdWebhook, "Transaction cancelled.");
                return;
            }

            // Process transaction
            users[userId].money -= totalPrice;
            users[userId].ss = (users[userId].ss || 0) + amount;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            await sendWebhookMessage(thunderbirdWebhook, `<a:twirl:1398697654912942164> Now I buy some KitKat to feed my children! Thank you for your purchase of ${amount} Shinobi Shard${amount !== 1 ? 's' : ''}!`);
            return;
        }

        // --- GATŌ'S INTERACTION (ORIGINAL LOGIC WITH BUTTONS) ---
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
        try {
            await interaction.reply({ content: "Summoning Gatō...", ephemeral: true });
        } catch (err) {
            if (err.code !== 10062) console.error('Interaction reply error:', err);
        }
        
        await gatoSay(`Greetings! I am **Gatō**, the wealthiest businessman in the Land of Waves. I'll be your host for this trade!`, {
            components: [createContinueRow()]
        });

        // Step 2: Wait for continue button
        if (!await waitForButton(interaction, userId, 'continue')) {
            await gatoSay("No response. Trade cancelled.");
            return;
        }

        // Step 3: Ask for user mention with instructions
        await gatoSay("Please mention the user you want to trade with by using the @mention in your next message.");

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

        // Step 4: Wait for the mentioned user to accept with button
        await gatoSay(`<@${partnerId}>, do you accept this trade? Press the Accept button to proceed.`, {
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('accept_trade')
                    .setLabel('Accept Trade')
                    .setStyle(ButtonStyle.Success)
            )]
        });

        const partnerAccept = await waitForButton(interaction, partnerId, 'accept_trade');
        if (!partnerAccept) {
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
                "Both users must send their offer in chat using the format above."
            )
            .setFooter({ text: "Type your offer in chat now." });
        
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

        // Step 7: Show summary and ask for confirmation with buttons
        const user1 = interaction.user;
        const user2 = interaction.guild.members.cache.get(partnerId)?.user || { id: partnerId, username: "Partner" };
        const summaryEmbed = new EmbedBuilder()
            .setTitle("Trade Summary")
            .setColor("#00bfae")
            .addFields(
                { name: user1.username, value: `${offers[userId].amount} ${offers[userId].type === 'ss' ? 'Shinobi Shards' : 'Money'}` },
                { name: user2.username, value: `${offers[partnerId].amount} ${offers[partnerId].type === 'ss' ? 'Shinobi Shards' : 'Money'}` }
            )
            .setFooter({ text: "Both users must press Confirm to finalize the trade." });
        
        await gatoSay("Oh? That's a nice trade! Both must press Confirm to confirm.", {
            components: [createConfirmRow()]
        });
        await gatoEmbed(summaryEmbed);

        // Step 8: Wait for both users to confirm with buttons
        let confirmed = new Set();
        const confirmFilter = i => [userId, partnerId].includes(i.user.id) && i.customId === 'confirm';
        
        try {
            while (confirmed.size < 2) {
                const buttonInteraction = await interaction.channel.awaitMessageComponent({ 
                    filter: confirmFilter, 
                    time: 60000 
                });
                confirmed.add(buttonInteraction.user.id);
                await buttonInteraction.deferUpdate();
                
                // Update message to show who has confirmed
                if (confirmed.size === 1) {
                    const confirmedUser = Array.from(confirmed)[0];
                    const waitingUser = confirmedUser === userId ? partnerId : userId;
                    await gatoSay(`<@${confirmedUser}> has confirmed. Waiting for <@${waitingUser}> to confirm...`, {
                        components: [createConfirmRow()]
                    });
                }
            }
        } catch {
            await gatoSay("Trade not confirmed by both parties. Cancelled.");
            return;
        }

        // Step 9: Validate and perform the trade
        const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
        let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        let p1 = players[userId] || {};
        let p2 = players[partnerId] || {};
        
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
            const user = uid === userId ? p1 : p2;
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
        if (offers[userId].type === 'ss') {
            setSS(p1, getSS(p1) - offers[userId].amount);
            setSS(p2, getSS(p2) + offers[userId].amount);
        } else {
            p1.money = (p1.money || 0) - offers[userId].amount;
            p2.money = (p2.money || 0) + offers[userId].amount;
        }
        
        if (offers[partnerId].type === 'ss') {
            setSS(p2, getSS(p2) - offers[partnerId].amount);
            setSS(p1, getSS(p1) + offers[partnerId].amount);
        } else {
            p2.money = (p2.money || 0) - offers[partnerId].amount;
            p1.money = (p1.money || 0) + offers[partnerId].amount;
        }
        
        players[userId] = p1;
        players[partnerId] = p2;
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

        // Step 10: Final message
        await gatoSay("The trade is complete! Thank you for using Gatō's Trading Service. Come back anytime for more business!");
    }
};