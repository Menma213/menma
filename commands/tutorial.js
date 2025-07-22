const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

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

        // If tutorial already completed, show tasks embed (now implemented)
        if (users[userId] && users[userId].tutorialStory) {
            // TASKS EMBED
            const scrollsDone = users[userId].tutorialScrollsComplete;
            const trialsDone = users[userId].tutorialTrialsComplete;
            const ramenDone = users[userId].tutorialRamenComplete;
            const trainingDone = users[userId].tutorialTrainingComplete;
            const embed = new EmbedBuilder()
                .setTitle("Tutorial Tasks")
                .setDescription("Complete the tasks below to receive your starter money!")
                .addFields([
                    {
                        name: "1. Introduction to Scrolls",
                        value: scrollsDone ? "✅ Completed" : "Learn about scrolls."
                    },
                    {
                        name: "2. Hokage Trials",
                        value: trialsDone ? "✅ Completed" : "Complete the Hokage Trials."
                    },
                    {
                        name: "3. Ramen",
                        value: ramenDone ? "✅ Completed" : "Visit Ichiraku Ramen and eat with Asuma."
                    },
                    {
                        name: "4. Training",
                        value: trainingDone ? "✅ Completed" : "Learn how to train and complete a training session."
                    }
                ])
                .setColor(0x00AE86);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('tutorial_continue_scrolls')
                    .setLabel('Continue')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });

            // Wait for continue button
            const buttonFilter = i => i.customId === 'tutorial_continue_scrolls' && i.user.id === userId;
            try {
                const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, time: 60000 });
                await buttonInteraction.deferUpdate();

                // Get Asuma webhook for this channel
                const asumaWebhook = await getAsumaWebhook(interaction.channel);

                // If scrolls not done, do scroll tutorial
                if (!scrollsDone) {
                    // Asuma continues
                    await asumaWebhook.send({
                        content: `Oh, shall we continue? Very well. Try using the \`/scroll info\` command to learn about scrolls. After you've finished the story, reply with "done".`
                    });

                    // Wait for user to finish scroll story (check users.json for firstusescroll)
                    const scrollStoryFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && (() => {
                        const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        return usersNow[userId] && usersNow[userId].firstusescroll;
                    })();
                    try {
                        await interaction.channel.awaitMessages({ filter: scrollStoryFilter, max: 1, time: 120000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "Looks like you haven't finished the scroll story yet. Try again!" });
                        return;
                    }

                    // Give Chakra Infused Blade Scroll as a gift (to gift.json)
                    await asumaWebhook.send({
                        content: `Great job! Here's a reward: **Chakra Infused Blade Scroll**. Click 'Claim' to add it to your gift inventory.`,
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('claim_scroll_reward')
                                    .setLabel('Claim')
                                    .setStyle(ButtonStyle.Success)
                            )
                        ]
                    });

                    // Wait for claim button
                    const claimScrollFilter = i => i.customId === 'claim_scroll_reward' && i.user.id === userId;
                    try {
                        const claimInteraction = await interaction.channel.awaitMessageComponent({ filter: claimScrollFilter, time: 60000 });
                        // Generate random id
                        const giftId = Math.floor(Math.random() * 5000) + 5001;
                        // Add scroll to user's gift inventory in gift.json
                        const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                        const now = Date.now();
                        if (!giftData[userId]) giftData[userId] = [];
                        giftData[userId].push({
                            id: giftId,
                            type: 'scroll',
                            name: 'Infused Chakra Blade Scroll',
                            from: 'asuma',
                            date: now
                        });
                        fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
                        await claimInteraction.reply({ content: `Chakra Infused Blade Scroll sent to your gift inventory. (Gift ID: ${giftId})`, ephemeral: true });
                    } catch {
                        await asumaWebhook.send({ content: "You didn't claim your scroll in time. Run /tutorial again!" });
                        return;
                    }

                    // Ask user to equip the scroll
                    await asumaWebhook.send({
                        content: `Now, equip the scroll using \`scroll set Infused Chakra Blade Scroll\`. Reply "done" when you've equipped it.`
                    });

                    // Wait for user to equip the scroll (check users.json for currentscroll)
                    const equipScrollFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && (() => {
                        const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        return usersNow[userId] && usersNow[userId].current_scroll === 'Infused Chakra Blade Scroll';
                    })();
                    try {
                        await interaction.channel.awaitMessages({ filter: equipScrollFilter, max: 1, time: 120000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You haven't equipped the scroll yet. Try again!" });
                        return;
                    }

                    // Save progress here before asking to learn jutsu
                    const usersProgress = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    usersProgress[userId] = usersProgress[userId] || {};
                    usersProgress[userId].tutorialStage = "learnjutsu";
                    fs.writeFileSync(usersPath, JSON.stringify(usersProgress, null, 2));

                    // Ask user to learn the jutsu, explain requirements and chance system
                    await asumaWebhook.send({
                        content: `Great! Now, use the \`/learnjutsu\` command to try learning **Infused Chakra Blade**. You must complete all requirements listed in \`/scroll info\` first. On your first attempt, it's free and you have a 20% chance to learn it if you meet the requirements. After that, each attempt costs 10,000 money. Reply "done" after you've tried learning the jutsu.\n This will expire in 2 hours and if you haven't learned the jutsu by then, run the tutorial command again to continue from where you left off.`
                    });

                    // Wait for user to learn the jutsu (check jutsu.json for Infused Chakra Blade)
                    const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
                    const learnJutsuFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && (() => {
                        const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
                        return jutsuData[userId] && Array.isArray(jutsuData[userId].usersjutsu) && jutsuData[userId].usersjutsu.includes('Infused Chakra Blade');
                    })();
                    try {
                        await interaction.channel.awaitMessages({ filter: learnJutsuFilter, max: 1, time: 12000000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You haven't learned Infused Chakra Blade yet. Try again after meeting all requirements and using /learnjutsu!" });
                        return;
                    }

                    // Congratulate and give 100k as a gift
                    await asumaWebhook.send({
                        content: `Congratulations! You've learned **Infused Chakra Blade**. Here's 100,000 money to help you train!`
                    });

                    // Add 100k to gift inventory
                    const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                    const now = Date.now();
                    const giftId = Math.floor(Math.random() * 5000) + 10001;
                    if (!giftData[userId]) giftData[userId] = [];
                    giftData[userId].push({
                        id: giftId,
                        amount: 100000,
                        type: 'money',
                        from: 'asuma',
                        date: now
                    });
                    fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));

                    await interaction.followUp({ content: `100,000 money sent to your gift inventory. (Gift ID: ${giftId})`, ephemeral: true });

                    // Mark scroll tutorial as complete
                    const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    usersFinal[userId] = usersFinal[userId] || {};
                    usersFinal[userId].tutorialScrollsComplete = true;
                    usersFinal[userId].tutorialStage = undefined;
                    fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
                }

                // If scrolls are done but trials not done, start trials tutorial directly
                if (users[userId].tutorialScrollsComplete && !trialsDone) {
                    // --- Hokage Trials Step ---
                    await asumaWebhook.send({
                        content: "Welcome back. I've told about your strength to the Hokage! They're interested in testing you personally. Go on, give it a try by using `/trials`."
                    });

                    // Wait for user to finish trials (win or lose)
                    // We'll check users.json for a new variable: `trialsResult` ("win" or "lose")
                    const trialsResultFilter = m => m.author.id === userId && (
                        m.content.toLowerCase() === 'done' || m.content.toLowerCase() === 'finished'
                    ) && (() => {
                        const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        return usersNow[userId] && usersNow[userId].trialsResult;
                    })();
                    try {
                        await interaction.channel.awaitMessages({ filter: trialsResultFilter, max: 1, time: 600000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You haven't finished the Hokage Trials yet. Try again after using `/trials`!" });
                        return;
                    }

                    // Check result and respond accordingly
                    const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    if (usersNow[userId].trialsResult === "win") {
                        await asumaWebhook.send({
                            content: "No words. I'm flabbergasted."
                        });
                    } else {
                        // Give 1 million with claim button
                        await asumaWebhook.send({
                            content: "Ah. That was expected, here's some money to help you train.",
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('claim_trials_reward')
                                        .setLabel('Claim')
                                        .setStyle(ButtonStyle.Success)
                                )
                            ]
                        });

                        // Wait for claim button
                        const claimTrialsFilter = i => i.customId === 'claim_trials_reward' && i.user.id === userId;
                        try {
                            const claimInteraction = await interaction.channel.awaitMessageComponent({ filter: claimTrialsFilter, time: 60000 });
                            const trialsGiftId = Math.floor(Math.random() * 5000) + 20001;
                            const giftDataNow = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                            if (!giftDataNow[userId]) giftDataNow[userId] = [];
                            giftDataNow[userId].push({
                                id: trialsGiftId,
                                amount: 1000000,
                                type: 'money',
                                from: 'asuma',
                                date: Date.now()
                            });
                            fs.writeFileSync(giftPath, JSON.stringify(giftDataNow, null, 2));
                            await claimInteraction.reply({ content: `1 million money sent to your gift inventory. (Gift ID: ${trialsGiftId})`, ephemeral: true });
                        } catch {
                            await asumaWebhook.send({ content: "You didn't claim your reward in time. Run /tutorial again!" });
                            return;
                        }
                    }

                    // Mark trials tutorial as complete
                    const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    usersFinal[userId] = usersFinal[userId] || {};
                    usersFinal[userId].tutorialTrialsComplete = true;
                    usersFinal[userId].tutorialStage = "ramen"; // Bookmark for next step
                    fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
                }

                // --- Ramen Step ---
                if (users[userId].tutorialTrialsComplete && (!users[userId].tutorialRamenComplete || users[userId].tutorialStage === "ramen")) {
                    // Prevent duplicate reward
                    if (!users[userId].tutorialRamenStarted) {
                        users[userId].tutorialRamenStarted = true;
                        users[userId].tutorialStage = "ramen";
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }

                    await asumaWebhook.send({
                        content: `MAN! I've been going around teaching you stuff, I'm hungry! Let's Goto Ichiraku ramen and grab something to eat!`
                    });
                    // Ping user in a channel (replace CHANNEL_ID with your ramen channel id)
                    const RAMEN_CHANNEL_ID = "REPLACE_WITH_CHANNEL_ID";
                    try {
                        const ramenChannel = await interaction.client.channels.fetch(RAMEN_CHANNEL_ID);
                        await ramenChannel.send(`<@${userId}> This is Teuchi, the owner of this place. Take a look at the menu using /ramen. Let me know when ur done by saying done.`);
                    } catch (e) {
                        await asumaWebhook.send({ content: `Could not ping you in the ramen channel. Just use /ramen here and reply "done" when finished.` });
                    }

                    // Wait for user to say done after /ramen
                    const ramenMenuFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done';
                    try {
                        await interaction.channel.awaitMessages({ filter: ramenMenuFilter, max: 1, time: 600000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You didn't finish looking at the menu. Try again!" });
                        return;
                    }

                    // Give 10 ramen coupons (gift)
                    if (!users[userId].tutorialRamenClaimed) {
                        const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                        if (!giftData[userId]) giftData[userId] = [];
                        const ramenGiftId = Math.floor(Math.random() * 5000) + 30001;
                        giftData[userId].push({
                            id: ramenGiftId,
                            type: 'ramen',
                            amount: 10,
                            from: 'asuma',
                            date: Date.now()
                        });
                        fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
                        users[userId].tutorialRamenClaimed = true;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }

                    await asumaWebhook.send({
                        content: `Go on eat anything you like! This is your first time so it will be my treat. Lemme know when your done eating by saying done.`
                    });

                    // Wait for user to say done after eating
                    const ramenEatFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done';
                    try {
                        await interaction.channel.awaitMessages({ filter: ramenEatFilter, max: 1, time: 600000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You didn't finish eating. Try again!" });
                        return;
                    }

                    await asumaWebhook.send({
                        content: `Nice, I'm full too. Just remember that Ramen Coupons can be obtained through various stuff like Ramen quiz, The Forest of Death, daily claims and some other unconventional methods for rogue ninjas. Very well, i shall meet you in our next expedition.`
                    });

                    // Mark ramen tutorial as complete and set next bookmark
                    const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    usersFinal[userId] = usersFinal[userId] || {};
                    usersFinal[userId].tutorialRamenComplete = true;
                    usersFinal[userId].tutorialStage = "training";
                    fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
                    return;
                }

                // --- Training Step ---
                if (users[userId].tutorialRamenComplete && (!users[userId].tutorialTrainingComplete || users[userId].tutorialStage === "training")) {
                    // Prevent duplicate reward
                    if (!users[userId].tutorialTrainingStarted) {
                        users[userId].tutorialTrainingStarted = true;
                        users[userId].tutorialStage = "training";
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }

                    await asumaWebhook.send({
                        content: `Ah you're back? Alright let me tell you the basics of training. IN this world, in order to train you must pay a sum of 100,000 to an old man that we dont even know. You can train upto 10 times at once! The old man isn't very good with calculations so he limits his cash flow to a million max. Go on now, here's a million to help you train.`
                    });

                    // Give 1 million money (gift), only once
                    if (!users[userId].tutorialTrainingClaimed) {
                        const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                        if (!giftData[userId]) giftData[userId] = [];
                        const trainGiftId = Math.floor(Math.random() * 5000) + 40001;
                        giftData[userId].push({
                            id: trainGiftId,
                            amount: 1000000,
                            type: 'money',
                            from: 'asuma',
                            date: Date.now()
                        });
                        fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
                        users[userId].tutorialTrainingClaimed = true;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }

                    await asumaWebhook.send({
                        content: `Let me know if your done by saying done.`
                    });

                    // Wait for user to say done after training (check users.json for a "trained" flag or similar)
                    const trainedFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && (() => {
                        const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        // You may want to set usersNow[userId].trained = true in your /train command after a successful train
                        return usersNow[userId] && usersNow[userId].trained;
                    })();
                    try {
                        await interaction.channel.awaitMessages({ filter: trainedFilter, max: 1, time: 600000, errors: ['time'] });
                    } catch {
                        await asumaWebhook.send({ content: "You haven't trained yet. Try again after using /train!" });
                        return;
                    }

                    await asumaWebhook.send({
                        content: `Good! Money making in this world is quite simply: MISSIONS MISSIONS AND MISSIONS. Alright then, until next time!`
                    });

                    // Mark training tutorial as complete and clear bookmark
                    const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    usersFinal[userId] = usersFinal[userId] || {};
                    usersFinal[userId].tutorialTrainingComplete = true;
                    usersFinal[userId].tutorialStage = undefined;
                    fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
                    return;
                }
            } catch {
                await interaction.followUp({ content: "You didn't continue in time. Run /tutorial again!", ephemeral: true });
            }
            return;
        }

        // Check if user is at the "learnjutsu" stage and resume if so
        if (users[userId] && users[userId].tutorialStage === "learnjutsu") {
            const asumaWebhook = await getAsumaWebhook(interaction.channel);
            await interaction.reply({ content: "Resuming your tutorial from where you left off...", ephemeral: true });
            await asumaWebhook.send({
                content: `Welcome back! Last time, you reached the step to learn **Infused Chakra Blade**. Use the \`/learnjutsu\` command to try learning it. You must complete all requirements listed in \`/scroll info\` first. On your first attempt, it's free and you have a 20% chance to learn it if you meet the requirements. After that, each attempt costs 10,000 money. Reply "done" after you've tried learning the jutsu.`
            });

            // Wait for user to learn the jutsu (check jutsu.json for Infused Chakra Blade)
            const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
            const learnJutsuFilter = m => m.author.id === userId && m.content.toLowerCase() === 'done' && (() => {
                const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
                return jutsuData[userId] && Array.isArray(jutsuData[userId].usersjutsu) && jutsuData[userId].usersjutsu.includes('Infused Chakra Blade');
            })();
            try {
                await interaction.channel.awaitMessages({ filter: learnJutsuFilter, max: 1, time: 12000000, errors: ['time'] });
            } catch {
                await asumaWebhook.send({ content: "You haven't learned Infused Chakra Blade yet. Try again after meeting all requirements and using /learnjutsu!" });
                return;
            }

            // Congratulate and give 100k as a gift
            await asumaWebhook.send({
                content: `Congratulations! You've learned **Infused Chakra Blade**. Here's 100,000 money to help you train!`
            });

            // Add 100k to gift inventory
            const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
            const now = Date.now();
            const giftId = Math.floor(Math.random() * 5000) + 10001;
            if (!giftData[userId]) giftData[userId] = [];
            giftData[userId].push({
                id: giftId,
                amount: 100000,
                type: 'money',
                from: 'asuma',
                date: now
            });
            fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));

            await interaction.followUp({ content: `100,000 money sent to your gift inventory. (Gift ID: ${giftId})`, ephemeral: true });

            // --- Hokage Trials Step ---
            await asumaWebhook.send({
                content: "Welcome back. I've told about your strength to the Hokage! They're interested in testing you personally. Go on, give it a try by using `/trials`."
            });

            // Wait for user to finish trials (win or lose)
            // We'll check users.json for a new variable: `trialsResult` ("win" or "lose")
            const trialsResultFilter = m => m.author.id === userId && (
                m.content.toLowerCase() === 'done' || m.content.toLowerCase() === 'finished'
            ) && (() => {
                const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                return usersNow[userId] && usersNow[userId].trialsResult;
            })();
            try {
                await interaction.channel.awaitMessages({ filter: trialsResultFilter, max: 1, time: 600000, errors: ['time'] });
            } catch {
                await asumaWebhook.send({ content: "You haven't finished the Hokage Trials yet. Try again after using `/trials`!" });
                return;
            }

            // Check result and respond accordingly
            const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (usersNow[userId].trialsResult === "win") {
                await asumaWebhook.send({
                    content: "No words. I'm flabbergasted."
                });
            } else {
                // Give 1 million with claim button
                await asumaWebhook.send({
                    content: "Ah. That was expected, here's some money to help you train.",
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('claim_trials_reward')
                                .setLabel('Claim')
                                .setStyle(ButtonStyle.Success)
                        )
                    ]
                });

                // Wait for claim button
                const claimTrialsFilter = i => i.customId === 'claim_trials_reward' && i.user.id === userId;
                try {
                    const claimInteraction = await interaction.channel.awaitMessageComponent({ filter: claimTrialsFilter, time: 60000 });
                    const trialsGiftId = Math.floor(Math.random() * 5000) + 20001;
                    const giftDataNow = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                    if (!giftDataNow[userId]) giftDataNow[userId] = [];
                    giftDataNow[userId].push({
                        id: trialsGiftId,
                        amount: 1000000,
                        type: 'money',
                        from: 'asuma',
                        date: Date.now()
                    });
                    fs.writeFileSync(giftPath, JSON.stringify(giftDataNow, null, 2));
                    await claimInteraction.reply({ content: `1 million money sent to your gift inventory. (Gift ID: ${trialsGiftId})`, ephemeral: true });
                } catch {
                    await asumaWebhook.send({ content: "You didn't claim your reward in time. Run /tutorial again!" });
                    return;
                }
            }

            // Mark tutorial as fully complete (optional: set a new flag)
            const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            usersFinal[userId] = usersFinal[userId] || {};
            usersFinal[userId].tutorialStoryComplete = true;
            usersFinal[userId].tutorialStage = undefined;
            fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));
            return;
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
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 6000000, errors: ['time'] });
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
            await interaction.channel.awaitMessages({ filter: drankFilter, max: 1, time: 1200000, errors: ['time'] });
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
                content: `Ah. Nice try, but it's the expected result. S-rank Ninjas are the strongest ranks out of all ordinary ninjas. Here's a bunch of cash to help you train 10 TIMES! using the /train command. Good luck! Use the tutorial command again to see what you need to do next and complete all tasks to receive a reward!`,
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
                // Add 1 million to user's gift inventory in gift.json
                const giftData = JSON.parse(fs.readFileSync(giftPath, 'utf8'));
                const now = Date.now();
                if (!giftData[userId]) giftData[userId] = [];
                giftData[userId].push({
                    id: giftId,
                    amount: 1000000,
                    type: 'money',
                    from: 'asuma',
                    date: now
                });
                fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
                // Mark tutorialStory in users.json
                users[userId] = users[userId] || {};
                users[userId].tutorialStory = true;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                await buttonInteraction.reply({ content: `1 million money sent to your gift inventory. (Gift ID: ${giftId})`, ephemeral: true });
            } catch {
                await asumaWebhook.send({ content: "You didn't claim your reward in time. Run /tutorial again!" });
                return;
            }
        } else {
            await asumaWebhook.send({
                content: `WOAHHH! You beat em? I did not expect that. That ends my tutorial session with you, pro sir. Haha, just kidding! Use the tutorial command again to see what you need to do next and complete all the tasks to receive a reward!`
            });
            // Mark tutorial as complete
            users[userId] = users[userId] || {};
            users[userId].tutorialStory = true;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        }

        // End: Next time, show tasks embed
    }
};
