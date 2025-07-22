const { SlashCommandBuilder, EmbedBuilder, WebhookClient, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Gatō's avatar (Naruto anime villain, business man)
const GATO_AVATAR = 'https://static.wikia.nocookie.net/near_pure_evil/images/d/d8/Gato.png/revision/latest?cb=20210922075636';
const GATO_NAME = 'Gatō';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade Shinobi Shards or Money with another user.'),

    async execute(interaction) {
        // Only allow in guild text channels
        if (!interaction.guild || !interaction.channel) {
            return interaction.reply({ content: "This command can only be used in a server channel.", ephemeral: true });
        }

        // Load users
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userId = interaction.user.id;
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Create or fetch a webhook for Gatō
        let webhooks = await interaction.channel.fetchWebhooks();
        let gatoWebhook = webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id && w.name === GATO_NAME);
        if (!gatoWebhook) {
            gatoWebhook = await interaction.channel.createWebhook({
                name: GATO_NAME,
                avatar: GATO_AVATAR,
                reason: 'For interactive trading'
            });
        }

        // Helper to send as Gatō
        async function gatoSay(content, opts = {}) {
            return await gatoWebhook.send({ content, username: GATO_NAME, avatarURL: GATO_AVATAR, ...opts });
        }

        // Helper to send an embed as Gatō
        async function gatoEmbed(embed) {
            return await gatoWebhook.send({ embeds: [embed], username: GATO_NAME, avatarURL: GATO_AVATAR });
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

        // Optionally, delete the webhook after use (to avoid clutter)
        // await gatoWebhook.delete('Trade finished');
    }
};
