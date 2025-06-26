const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Helper to get or create a webhook for Asuma in the current channel
async function getAsumaWebhook(channel) {
    // Fetch existing webhooks
    const webhooks = await channel.fetchWebhooks();
    let asumaWebhook = webhooks.find(wh => wh.name === 'Asuma');
    if (!asumaWebhook) {
        // Create a new webhook if not found
        asumaWebhook = await channel.createWebhook({
            name: 'Asuma',
            avatar: 'https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg', // Example avatar
        });
    }
    return asumaWebhook;
}

// Move verification functions inside the export object
const verifyDrank = function(userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].drankCompleted;
};
const verifyBrank = function(userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].brankWon;
};
const verifySrank = function(userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].srankResult; // "win" or "lose"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tutorial')
        .setDescription('Start the interactive tutorial with Asuma!'),
    verifyDrank,
    verifyBrank,
    verifySrank,
    async execute(interaction) {
        // Load user data
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userId = interaction.user.id;

        // If tutorial already completed, show tasks embed (placeholder)
        if (users[userId] && users[userId].tutorialStory) {
            return interaction.reply({ content: "You've completed the tutorial! (Tasks embed coming soon.)", ephemeral: true });
        }

        // Defer reply so we can use webhooks for the rest
        await interaction.deferReply({ ephemeral: true });

        // Get Asuma webhook for this channel
        const asumaWebhook = await getAsumaWebhook(interaction.channel);

        // 1. Greet the user
        await asumaWebhook.send({
            content: `Hey ${interaction.user}, I'm Asuma! I'm here to guide you through the basics of being a ninja. We'll go step by step. Ready?`,
        });
        await asumaWebhook.send({
            content: `Reply with "continue" to continue.`,
        });

        // 2. Wait for "continue" (case-insensitive)
        const filter = m => m.author.id === userId && m.content.toLowerCase() === 'continue';
        try {
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
        } catch {
            await asumaWebhook.send({ content: "You didn't reply in time. Run /tutorial again to restart!" });
            return;
        }

        // 3. Ask user to do /drank
        await asumaWebhook.send({
            content: `First, try using the /drank command! Let me know when you've completed it by replying "done".`,
        });

        // Wait for drank completion
        const drankFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && module.exports.verifyDrank(userId);
        try {
            await interaction.channel.awaitMessages({ filter: drankFilter, max: 1, time: 120000, errors: ['time'] });
        } catch {
            await asumaWebhook.send({ content: "Looks like you haven't completed /drank yet. Try again!" });
            return;
        }

        // 4. Ask user to do /brank and explain combo
        await asumaWebhook.send({
            content: `Good job, now start a brank. Brank Ninjas are fairly weak, but since you're new too, I'd recommend using the basic combo: Attack then Transform.`,
        });
        await asumaWebhook.send({
            content: `Let me know when you've won a brank by replying "done".`,
        });

        // Wait for brank win
        const brankFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && module.exports.verifyBrank(userId);
        try {
            await interaction.channel.awaitMessages({ filter: brankFilter, max: 1, time: 120000, errors: ['time'] });
        } catch {
            await asumaWebhook.send({ content: "You haven't won a brank yet. Try again!" });
            return;
        }

        // 5. S-rank challenge
        await asumaWebhook.send({
            content: `You're smarter than I thought! But time for the real test! Try defeating an S-rank! Let me know when you're done by replying "done".`,
        });

        // Wait for srank result
        const srankFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && module.exports.verifySrank(userId);
        let srankResult = null;
        try {
            await interaction.channel.awaitMessages({ filter: srankFilter, max: 1, time: 180000, errors: ['time'] });
            // Get result from users.json
            const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            srankResult = usersNow[userId].srankResult; // "win" or "lose"
        } catch {
            await asumaWebhook.send({ content: "You haven't finished an S-rank yet. Try again!" });
            return;
        }

        // 6. Handle S-rank win/loss
        if (srankResult === 'lose') {
            await asumaWebhook.send({
                content: `Ah. Nice try, but it's the expected result. S-rank Ninjas are the strongest ranks out of all ordinary ninjas. Here's a bunch of cash to help you train 10 TIMES! using the /train command. Goodluck! Use the tutorial command again to see what you need to do next and complete all tasks to receive a reward!`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('claim_tutorial_reward')
                            .setLabel('Claim')
                            .setStyle(ButtonStyle.Success)
                    )
                ]
            });

            // Wait for claim button
            const buttonFilter = i => i.customId === 'claim_tutorial_reward' && i.user.id === userId;
            try {
                const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, time: 60000 });
                // Generate random id
                const giftId = Math.floor(Math.random() * 5000) + 1;
                // Add 1 million to user's gift inventory (pseudo code, adjust as needed)
                users[userId] = users[userId] || {};
                users[userId].giftInventory = users[userId].giftInventory || [];
                users[userId].giftInventory.push({ id: giftId, amount: 1000000, type: 'money' });
                users[userId].tutorialStory = true;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                await buttonInteraction.reply({ content: `1 million money sent to your gift inventory. (Gift ID: ${giftId})`, ephemeral: true });
            } catch {
                await asumaWebhook.send({ content: "You didn't claim your reward in time. Run /tutorial again!" });
                return;
            }
        } else {
            await asumaWebhook.send({
                content: `WOAHHH! You beat em? I did not expect that. That ends my tutorial session with you, pro sir. haha, just kidding! Use the tutorial command again to see what you need to do next and complete all the tasks to receive a reward!`
            });
            // Mark tutorial as complete
            users[userId] = users[userId] || {};
            users[userId].tutorialStory = true;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        }

        // End: Next time, show tasks embed
    }
};
