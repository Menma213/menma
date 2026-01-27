const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, WebhookClient, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Constants
const ADMIN_ID = "961918563382362122";
const MYSTERIOUS_VOICE_AVATAR = 'https://wallpapers.com/images/hd/yellow-anime-9vqufy3pbpjpvcmy.jpg';
const ZORO_AVATAR = 'https://i.postimg.cc/PxqbJmXH/image.png';
const IMAGE_OF_FOUR_HEROES = 'https://i.postimg.cc/132mtsMC/image.png';

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const jutsusPath = path.join(dataPath, 'jutsu.json');
const dungeonsPath = path.join(dataPath, 'dungeons.json');
const cooldownsPath = path.join(dataPath, 'cooldowns.json');
const giftPath = path.join(dataPath, 'gift.json');

// Helper functions
const loadData = (filePath) => {
    try {
        return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
    } catch (err) {
        console.error(`Error loading ${filePath}:`, err);
        return {};
    }
};

const saveData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err);
    }
};

const delay = ms => new Promise(res => setTimeout(res, ms));

// Check and create cooldowns.json if it doesn't exist
if (!fs.existsSync(cooldownsPath)) {
    saveData(cooldownsPath, {});
}

// Webhook Cache to prevent hitting Discord API limits
const webhookCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Deletes all webhooks in the channel managed by the bot.
 * This is crucial to prevent the Discord API's webhook limit (15) from being reached.
 * @param {object} interaction The Discord interaction object.
 */
async function cleanupWebhooks(interaction) {
    try {
        const channelId = interaction.channel.id;
        const webhooks = await interaction.channel.fetchWebhooks();
        const botWebhooks = webhooks.filter(webhook => webhook.owner && webhook.owner.id === interaction.client.user.id);

        if (botWebhooks.size > 0) {
            console.log(`Cleaning up ${botWebhooks.size} bot-owned webhooks in channel ${channelId}...`);
            await Promise.all(botWebhooks.map(w => w.delete().catch(e => console.error(`Failed to delete webhook ${w.id}:`, e))));
            console.log("Cleaned up webhooks successfully.");
        }

        // Clear cache for this channel
        webhookCache.delete(channelId);
    } catch (error) {
        console.error("Failed to clean up webhooks:", error);
    }
}

/**
 * Gets or creates a new webhook for an NPC or user.
 * @param {object} interaction The Discord interaction object.
 * @param {string} name The name of the webhook.
 * @param {string} avatar The avatar URL for the webhook.
 * @returns {Promise<Webhook>} The webhook object.
 */
async function getWebhook(interaction, name, avatar) {
    const channel = interaction.channel;
    const channelId = channel.id;
    const now = Date.now();

    try {
        let cache = webhookCache.get(channelId);

        // Fetch webhooks if cache is stale
        if (!cache || (now - cache.lastFetched > CACHE_TTL)) {
            const fetched = await channel.fetchWebhooks().catch(() => new Map());
            cache = { webhooks: fetched, lastFetched: now };
            webhookCache.set(channelId, cache);
        }

        // 1. Find ANY webhook owned by this bot in this channel to use as Worker
        let worker = cache.webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id);
        if (worker) return worker;

        // 2. If no worker exists, check if we can create one
        if (cache.webhooks.size >= 15) {
            console.log(`[Worker Webhook] Channel ${channelId} full. Cleaning up bot ones...`);
            const botWebhooks = cache.webhooks.filter(w => w.owner && w.owner.id === interaction.client.user.id);
            if (botWebhooks.size > 0) {
                // Parallel delete is faster
                await Promise.all(botWebhooks.map(w => w.delete().catch(() => { })));
            } else {
                // If the channel is full of webhooks NOT owned by us, we must use fallback
                console.warn(`[Worker Webhook] Channel ${channelId} full of external webhooks.`);
                return createFallbackWebhook(interaction, name, avatar);
            }
            // Refresh cache after cleanup
            const refreshed = await channel.fetchWebhooks().catch(() => new Map());
            cache = { webhooks: refreshed, lastFetched: Date.now() };
            webhookCache.set(channelId, cache);
        }

        // 3. Create the worker webhook (identity handled via overrides in send)
        const newWorker = await channel.createWebhook({
            name: 'Menma Worker',
            avatar: interaction.client.user.displayAvatarURL(),
            reason: 'Worker for dynamic NPC dialogue'
        });
        cache.webhooks.set(newWorker.id, newWorker);
        return newWorker;

    } catch (error) {
        console.error("Worker Webhook Error:", error);
        return createFallbackWebhook(interaction, name, avatar);
    }
}

/**
 * Creates a dummy webhook object that falls back to regular channel messages.
 * This prevents the bot from crashing if webhook creation fails.
 */
function createFallbackWebhook(interaction, name, avatar) {
    return {
        name,
        avatar,
        send: async (options) => {
            const content = typeof options === 'string' ? options : options.content;
            const msgContent = `**${options.username || name}**: ${content || ""}`;
            const sendOptions = {
                content: msgContent,
                embeds: options.embeds,
                components: options.components,
                files: options.files
            };
            return interaction.channel.send(sendOptions);
        },
        editMessage: async (id, options) => {
            try {
                const msg = await interaction.channel.messages.fetch(id);
                if (msg) return await msg.edit(options);
            } catch (e) {
                console.error("Fallback editMessage failed:", e);
            }
        }
    };
}

// --- Tutorial Logic ---
async function handleTutorial(interaction, users, userId) {
    const user = users[userId];
    user.firstusescroll = false;
    saveData(usersPath, users);

    const mysteriousVoiceWebhook = await getWebhook(interaction, 'Strange Voice', MYSTERIOUS_VOICE_AVATAR);
    const userWebhook = await getWebhook(interaction, interaction.user.username, interaction.user.displayAvatarURL());

    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "Another Young Shinobi entering the scroll shrine...", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('tut_who_are_you').setLabel('Who are you?').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('tut_what_is_place').setLabel('What is this place?').setStyle(ButtonStyle.Primary)
        );

    const msg1 = await interaction.channel.send({
        content: `What will you do, ${interaction.user.username}?`,
        components: [row1]
    });

    const filter = i => i.customId.startsWith('tut_') && i.user.id === userId;
    let res;
    try {
        res = await msg1.awaitMessageComponent({ filter, time: 60000 });
        await res.deferUpdate();
    } catch (e) {
        await msg1.edit({ content: "Tutorial timed out.", components: [] });
        return;
    }

    if (res.customId === 'tut_who_are_you') {
        await delay(2500);
        await userWebhook.send({ content: "Who are you?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
        await delay(2500);
        await mysteriousVoiceWebhook.send({ content: "I'm the voice of a legendary Shinobi that fell in a gruesome war...", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    } else if (res.customId === 'tut_what_is_place') {
        await delay(2500);
        await userWebhook.send({ content: "What is this place?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
        await delay(2500);
        await mysteriousVoiceWebhook.send({ content: "This is the Scrolls Shrine, a very sacred place known to hold many Forbidden Jutsu.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    }

    await delay(2500);
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('tut_what_do_i_do').setLabel('What do I do now..?').setStyle(ButtonStyle.Primary)
        );
    const msg2 = await interaction.channel.send({ content: "...", components: [row2] });

    try {
        const res2 = await msg2.awaitMessageComponent({ filter, time: 60000 });
        await res2.deferUpdate();
    } catch (e) {
        await msg2.edit({ content: "Tutorial timed out.", components: [] });
        return;
    }

    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "Let me tell you about scrolls and why this place is no longer safe.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "Scrolls are the books of information about a specific jutsu passed down the generations by legendary Shinobi.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });

    await delay(2500);
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('tut_info_jutsu').setLabel('Information about jutsu? what exactly?').setStyle(ButtonStyle.Primary)
        );
    const msg3 = await interaction.channel.send({ content: "...", components: [row3] });

    try {
        const res3 = await msg3.awaitMessageComponent({ filter, time: 60000 });
        await res3.deferUpdate();
    } catch (e) {
        await msg3.edit({ content: "Tutorial timed out.", components: [] });
        return;
    }

    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "You'll have to see for yourself. To obtain a scroll, you must defeat the NPC protecting the scroll.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "There's MANY scrolls that have been scattered and stolen in this world. which brings us to the topic...why this place is so dangerous.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "One day a huge group of bandits cowardly attacked the shrine guards during the night and leaked everything to the outside world. But we never thought it would do something like this...look up..that portal..is a dungeon. A portal that connects other worlds.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "I do not wish to see a young shinobi like yourself going in there...But this world needs a savior, and that could be you..", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "But first! you must prove your strength! Clear 10 dungeons and run the `/scroll mission` command and ill meet you there.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
    await delay(2500);
    await mysteriousVoiceWebhook.send({ content: "Oh, and also you'll receive a Crystalline Shard everytime you clear a dungeon which you can trade here for learning a jutsu from it's scroll using the /learnjutsu command. Goodluck, Young Shinobi.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });

    const finalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tut_complete').setLabel('Complete Tutorial').setStyle(ButtonStyle.Success)
    );
    const finalMsg = await interaction.channel.send({ content: "Click the button below to complete the tutorial.", components: [finalRow] });

    try {
        const res4 = await finalMsg.awaitMessageComponent({ filter: i => i.customId === 'tut_complete' && i.user.id === userId, time: 60000 });
        await res4.update({ content: "Tutorial complete! You can now use the `/scroll dungeon` command to begin your journey!", components: [] });
        user.firstusescroll = true;
        saveData(usersPath, users);
    } catch (e) {
        await finalMsg.edit({ content: "Tutorial timed out.", components: [] });
    }
}

// --- Mission Logic ---
async function handleMissionCommand(interaction, users, userId) {
    const user = users[userId];
    const dungeonsCompleted = user.dungeonscompleted || 0;

    if (dungeonsCompleted < 10) {
        return interaction.reply({ content: `You must clear 10 dungeons first! You have cleared ${dungeonsCompleted} so far.`, ephemeral: true });
    }

    if (user.mission_complete) {
        return interaction.reply({ content: `You have already completed this mission.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // This block handles both the initial mission start and re-opening the dialogue
    // The intro dialogue only plays once.
    if (!user.firstimemission) {
        const mysteriousVoiceWebhook = await getWebhook(interaction, 'Strange Voice', MYSTERIOUS_VOICE_AVATAR);
        await mysteriousVoiceWebhook.send({ content: "I knew i could trust you..Congratulations on beating 10 dungeons. Come along with me..there's a few people i need you to meet to save the world from dungeons.", username: 'Strange Voice', avatarURL: MYSTERIOUS_VOICE_AVATAR });
        user.firstimemission = true;
        saveData(usersPath, users);
    }

    const embed = new EmbedBuilder()
        .setTitle("The Four Men")
        .setDescription("Try talking to them:")
        .setImage(IMAGE_OF_FOUR_HEROES);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('talk_zoro').setLabel('Zoro').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('talk_naruto').setLabel('Naruto').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('talk_yuta').setLabel('Yuta').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('talk_jinwoo').setLabel('Jinwoo').setStyle(ButtonStyle.Secondary)
        );

    // FIX START: Check for Zoro's mission completion and update buttons
    if (user.zoromission) {
        row.components.forEach(button => {
            button.setStyle(ButtonStyle.Primary); // Set all to Primary (blue)
            if (button.data.custom_id === 'talk_zoro') {
                button.setDisabled(true); // Disable Zoro's button
            }
        });
    }
    // FIX END

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    // The collector handles all subsequent button interactions within this mission
    const filter = i => i.customId.startsWith('talk_') && i.user.id === userId;
    const collector = msg.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

    collector.on('collect', async i => {
        // Deferring the update immediately to prevent "Interaction Failed"
        await i.deferUpdate();
        const characterName = i.customId.split('_')[1];
        await handleCharacterInteraction(i, users, userId, characterName);
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            console.log('Mission dialogue timed out.');
            msg.edit({ components: [] });
        }
    });

    await interaction.editReply({ content: "Mission initiated! Check the channel for updates.", ephemeral: true });
}

// Handler for all character interactions
async function handleCharacterInteraction(interaction, users, userId, characterName) {
    const user = users[userId];
    const userScrolls = loadData(jutsusPath)[userId]?.scrolls || [];

    // Webhooks
    const zoroWebhook = await getWebhook(interaction, 'Zoro', ZORO_AVATAR);
    const userWebhook = await getWebhook(interaction, interaction.user.username, interaction.user.displayAvatarURL());
    const narutoWebhook = await getWebhook(interaction, 'Naruto', 'https://cdn.mos.cms.futurecdn.net/Hpq4NZjKWjHRRyH9bt3Z2e.jpg');
    const yutaWebhook = await getWebhook(interaction, 'Yuta', 'https://i.pinimg.com/736x/f8/c0/ba/f8c0ba6a76ac948a2dac799fcae89311.jpg');
    const jinwooWebhook = await getWebhook(interaction, 'Jinwoo', 'https://i.pinimg.com/originals/76/f4/54/76f4544dc9bb679320e21afd35dc1241.png');

    // Dialogue and quest state
    if (user.current_mission === 'zoro_locket' && characterName !== 'zoro' && userScrolls.includes("Zoro's Locket") === false) {
        // Block other quests until Zoro's is done
        await userWebhook.send({ content: `You try to talk to ${characterName}...` });
        await delay(1000);
        await narutoWebhook.send({ content: `"Help the Green man, he's lost!"` });
        return;
    }

    if (userScrolls.includes("Asura's Blade of Execution") === false && (characterName === 'yuta' || characterName === 'jinwoo')) {
        await userWebhook.send({ content: `You try to talk to ${characterName}...` });
        await delay(1000);
        await interaction.channel.send({ content: `You must have the Asura's Blade of Execution unlocked for my quest.` });
        return;
    }

    if (characterName === 'zoro') {
        const jutsuData = loadData(jutsusPath);
        const userItems = jutsuData[userId]?.items || {};
        const hasLocket = userItems["Zoro's Locket"] && userItems["Zoro's Locket"] > 0;

        if (hasLocket) {
            // Quest complete
            await userWebhook.send({ content: "Zoro, I found your locket!" });
            await delay(1000);
            const msg = await zoroWebhook.send({
                content: "Thank you, young shinobi! With this, I can return to my crew. My debt is now paid.",
                components:
                    [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('zoro_mission_finish').setLabel('Finish Quest').setStyle(ButtonStyle.Success)
                        )
                    ]
            });

            // Wait for the user to click the "Finish Quest" button
            const filter = i => i.customId === 'zoro_mission_finish' && i.user.id === userId;
            try {
                const res = await msg.awaitMessageComponent({ filter, time: 60000 });
                await res.deferUpdate();

                // Set the tracker and save data
                user.zoromission = true;
                user.current_mission = null;
                saveData(usersPath, users);

                // Edit the message to remove the button and confirm completion
                await zoroWebhook.editMessage(msg.id, { content: "Zoro's quest is complete!", components: [] });

            } catch (e) {
                console.error("Finish button timed out:", e);
                // The bot can't edit the webhook message, so we send a new one
                try {
                    await zoroWebhook.send({ content: "Quest finish action timed out." });
                } catch (editError) {
                    console.error("Failed to send new message on timeout:", editError);
                }
            }

            return;
        }

        if (user.current_mission === 'zoro_locket') {
            await zoroWebhook.send({ content: "Have you found it yet?" });
            await delay(1000);
            await zoroWebhook.send({ content: "GO FIND MY LOCKET! GRR!" });
            return;
        }

        await zoroWebhook.send({ content: "Argh! What do you want?", username: 'Zoro', avatarURL: ZORO_AVATAR });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('zoro_lost').setLabel('Are you lost?').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('zoro_dungeons').setLabel('How do we stop dungeons?').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('zoro_jutsus').setLabel('Will you teach me jutsus?').setStyle(ButtonStyle.Primary)
        );
        // Using a new message to prevent button spamming
        const msg = await interaction.channel.send({ content: "Choose your question:", components: [row] });

        const filter = i => i.customId.startsWith('zoro_') && i.user.id === userId;
        try {
            const res = await msg.awaitMessageComponent({ filter, time: 60000 });
            await res.deferUpdate();

            if (res.customId === 'zoro_lost') {
                await userWebhook.send({ content: "Are you lost?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);
                await zoroWebhook.send({ content: "WHAT? No. I AM DEFINITELY NOT LOST....yes. I am, lost. I walked into a portal after separating from my crew.", username: 'Zoro', avatarURL: ZORO_AVATAR });
                await delay(1000);

                const helpRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('zoro_help').setLabel('How can I help you?').setStyle(ButtonStyle.Success)
                );
                const helpMsg = await interaction.channel.send({ content: "...", components: [helpRow] });

                const res2 = await helpMsg.awaitMessageComponent({ filter: i => i.customId === 'zoro_help' && i.user.id === userId, time: 60000 });
                await res2.deferUpdate();
                await userWebhook.send({ content: "How can I help you?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);

                await zoroWebhook.send({ content: "The old man over there said 'There is a way to send you back but the locket that summons your portal has been stolen by a Blue Saibaman like creature...I am not very good with navigation so i figured im stuck here forever." });
                await delay(1000);

                const locketRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('zoro_locket_info').setLabel('I can find the locket..how does it look?').setStyle(ButtonStyle.Primary)
                );
                const locketMsg = await interaction.channel.send({ content: "...", components: [locketRow] });
                const res3 = await locketMsg.awaitMessageComponent({ filter: i => i.customId === 'zoro_locket_info' && i.user.id === userId, time: 60000 });
                await res3.deferUpdate();
                await userWebhook.send({ content: "I can find the locket..how does it look?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);

                await zoroWebhook.send({ content: "The locket is a simple silver locket with a green gem inside it. Just find the Blue thing and you'll retrieve it..the blue thing is hiding in one of the dungeons." });
                await delay(1000);

                const beginQuestRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('zoro_quest_begin').setLabel('Begin Quest').setStyle(ButtonStyle.Success)
                );
                const beginQuestMsg = await interaction.channel.send({ content: "...", components: [beginQuestRow] });
                const res4 = await beginQuestMsg.awaitMessageComponent({ filter: i => i.customId === 'zoro_quest_begin' && i.user.id === userId, time: 60000 });
                await res4.deferUpdate();

                user.current_mission = "zoro_locket";
                saveData(usersPath, users);
                await interaction.channel.send({ content: "Zoro's quest has begun! You must find and defeat the Blue Saibaman to retrieve the locket." });

            } else if (res.customId === 'zoro_dungeons') {
                await userWebhook.send({ content: "How do we stop the dungeons from appearing?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);
                await zoroWebhook.send({ content: "dungeons? what are those? I don't know just get me out of here.", username: 'Zoro', avatarURL: ZORO_AVATAR });
            } else if (res.customId === 'zoro_jutsus') {
                await userWebhook.send({ content: "Will you teach me jutsus?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);
                await zoroWebhook.send({ content: "Jutsus? is that a famous dish 'round here?. haha, funny.", username: 'Zoro', avatarURL: ZORO_AVATAR });
            }
        } catch (e) {
            console.error(e);
            await interaction.channel.send({ content: "Dialogue timed out. Please use `/scroll mission` to continue.", ephemeral: true });
        } finally {
            // Remove buttons to prevent further interaction
            try {
                await msg.edit({ components: [] });
            } catch (err) {
                console.error("Failed to edit message:", err);
            }
        }
    } else if (characterName === 'naruto') {
        const jutsuData = loadData(jutsusPath);
        if (!user.zoromission) {
            await userWebhook.send({ content: "What's up, Naruto?" });
            await delay(1000);
            await narutoWebhook.send({ content: `"Help the Green man, he's lost!"` });
            return;
        }

        if ((user.wins || 0) >= 1000) {
            // Quest complete logic
            await userWebhook.send({ content: "Naruto, I have 1,000 wins!" });
            await delay(1000);
            const msg = await narutoWebhook.send({
                content: "You've done it! You have 1,000 wins! Take this, the legendary Asura's Blade of Execution. It is yours to command!",
                components:
                    [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('naruto_claim_jutsu').setLabel('Claim Asura\'s Blade').setStyle(ButtonStyle.Success)
                        )
                    ]
            });

            // Wait for the user to click the "Claim" button
            const filter = i => i.customId === 'naruto_claim_jutsu' && i.user.id === userId;
            try {
                const res = await msg.awaitMessageComponent({ filter, time: 60000 });
                await res.deferUpdate();

                // Add JUTSU directly to jutsu.json
                let jutsuDataRaw = loadData(jutsusPath);
                if (!jutsuDataRaw[userId]) jutsuDataRaw[userId] = { usersjutsu: [] };
                if (!Array.isArray(jutsuDataRaw[userId].usersjutsu)) jutsuDataRaw[userId].usersjutsu = [];

                if (!jutsuDataRaw[userId].usersjutsu.includes("Asura's Blade of Execution")) {
                    jutsuDataRaw[userId].usersjutsu.push("Asura's Blade of Execution");
                    saveData(jutsusPath, jutsuDataRaw);
                    await narutoWebhook.send({ content: "The **Asura's Blade of Execution** has been added to your jutsu list!" });
                } else {
                    await narutoWebhook.send({ content: "You already have this jutsu." });
                }

                // Set the tracker and save data
                user.narutomission = true;
                user.current_mission = null;
                saveData(usersPath, users);

                // Edit the original message to remove the button
                await narutoWebhook.editMessage(msg.id, { content: "Naruto's quest is complete!", components: [] });

            } catch (e) {
                console.error("Naruto claim button timed out:", e);
                try {
                    await narutoWebhook.send({ content: "Claim action timed out." });
                } catch (err) { }
            }
            return;
        } else {
            await narutoWebhook.send({ content: "Hey again! Thank you for saving the lost green dude. I wanna treat you with bowls of ramen..but i have a much better offer...Asura.", username: 'Naruto', avatarURL: 'https://cdn.mos.cms.futurecdn.net/Hpq4NZjKWjHRRyH9bt3Z2e.jpg' });
            await delay(1000);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('naruto_asura').setLabel('Asura?').setStyle(ButtonStyle.Primary));
            const msg = await interaction.channel.send({ content: "...", components: [row] });
            const filter = i => i.customId === 'naruto_asura' && i.user.id === userId;
            try {
                const res = await msg.awaitMessageComponent({ filter, time: 60000 });
                await res.deferUpdate();
                await userWebhook.send({ content: "Asura?", username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL() });
                await delay(1000);
                const startQuestRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('naruto_quest_begin').setLabel('Start Quest').setStyle(ButtonStyle.Success)
                );
                const startQuestMsg = await narutoWebhook.send({ content: "Yup. THe legendary Shinobi Asura Otsutsuki. I have a plan for you and if you succeed you might learn the legendary Asura's Blade of Execution, inarguably the strongest Jutsu known to mankind. The catch is...you must win, 1000 battles! When you get A THOUSAND wins, come to me. I will then give you the scroll of the Legendary Jutsu.", components: [startQuestRow] });
                const startQuestFilter = i => i.customId === 'naruto_quest_begin' && i.user.id === userId;
                const startQuestRes = await startQuestMsg.awaitMessageComponent({ startQuestFilter, time: 60000 });
                await startQuestRes.deferUpdate();

                user.current_mission = "naruto_wins";
                saveData(usersPath, users);
                await interaction.channel.send({ content: "Naruto's quest has begun! Win 1000 battles to complete it." });

            } catch (e) {
                await msg.edit({ content: "Dialogue timed out. Please use `/scroll mission` to continue.", components: [] });
            } finally {
                try {
                    await msg.edit({ components: [] });
                } catch (err) {
                    console.error("Failed to edit message:", err);
                }
            }
        }

    } else if (characterName === 'yuta') {
        await yutaWebhook.send({ content: "You must have the Asura's Blade of Execution unlocked for my quest.", username: 'Yuta', avatarURL: 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/7/77/Yuta_Okkotsu_%28Anime%29.png' });
    } else if (characterName === 'jinwoo') {
        await jinwooWebhook.send({ content: "You must have the Asura's Blade of Execution unlocked for my quest.", username: 'Jinwoo', avatarURL: 'https://static.wikia.nocookie.net/solo-leveling/images/a/ac/Sung_Jin-Woo_anime_design.png' });
    }
}

// --- Dungeon Game Logic ---
async function handleDungeonGame(interaction, users, userId) {
    const dungeonsData = loadData(dungeonsPath);
    const user = users[userId];

    // Check for tutorial completion first
    if (user.firstusescroll === undefined || user.firstusescroll === null) {
        await interaction.deferReply({ ephemeral: true });
        await handleTutorial(interaction, users, userId);
        return interaction.editReply({ content: "Tutorial started in the channel!", ephemeral: true });
    }

    // Reset dungeon state when a new one is started
    if (user.current_dungeon) {
        user.current_dungeon = null;
        saveData(usersPath, users);
    }

    // --- Dungeon Selection using chance ---
    // Build weighted list of dungeons based on chance
    function pickDungeon(dungeons) {
        const weighted = [];
        for (const dungeon of dungeons) {
            const weight = Math.max(0, dungeon.chance || 0);
            for (let i = 0; i < Math.floor(weight * 100); i++) {
                weighted.push(dungeon);
            }
        }
        // fallback: if weighted is empty, pick random
        if (weighted.length === 0) return dungeons[Math.floor(Math.random() * dungeons.length)];
        return weighted[Math.floor(Math.random() * weighted.length)];
    }
    const dungeon = pickDungeon(dungeonsData.dungeons);
    const dungeonName = dungeon.name;
    const npcs = Object.keys(dungeon.npcs);
    const mysteriousVoiceAvatar = 'https://wallpapers.com/images/hd/yellow-anime-9vqufy3pbpjpvcmy.jpg';

    // --- Always use 1 hour cooldown ---
    const now = Date.now();
    if (!user.lastDungeon) user.lastDungeon = 0;
    const lastRun = user.lastDungeon;
    const cooldownAmount = 3600 * 1000; // 1 hour in ms
    if (lastRun && now < lastRun + cooldownAmount) {
        const timeLeft = (lastRun + cooldownAmount - now) / 1000;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = Math.floor(timeLeft % 60);
        return interaction.reply({
            content: `You are on cooldown. You can enter a dungeon again in ${minutes}m ${seconds}s.`,
            ephemeral: true
        });
    }

    await interaction.reply({ content: `Entering the dungeon: **${dungeonName}** ...`, ephemeral: false });

    // Clean up old webhooks before starting a new run
    await cleanupWebhooks(interaction);

    // Save initial dungeon state
    user.current_dungeon = { name: dungeonName, progress: { npcIndex: 0 } };
    saveData(usersPath, users);

    // Initial dungeon lore messages
    await interaction.channel.send({ content: dungeon.pre.intro });
    await delay(2500);
    const voiceWebhook = await getWebhook(interaction, 'Mysterious Voice', mysteriousVoiceAvatar);
    if (voiceWebhook) {
        await voiceWebhook.send({ content: dungeon.pre.lore, username: 'Mysterious Voice', avatarURL: mysteriousVoiceAvatar });
    }
    await delay(2500);

    async function sendNPCMessage(npc, content, options = {}) {
        if (typeof content !== 'string' || !content.trim()) {
            content = npc.dialogue || npc.success_dialogue || npc.failure_dialogue || "[No message available]";
        }
        const worker = await getWebhook(interaction, npc.name, npc.avatar);
        if (worker) {
            // No delay here for 'brute force' speed as requested
            return worker.send({
                content: content,
                username: npc.name,
                avatarURL: npc.avatar,
                ...options
            });
        }
    }

    async function dungeonSuccess() {
        const jutsuData = loadData(jutsusPath);
        const giftData = loadData(giftPath);

        // Add crystalline shard
        if (!jutsuData[userId].items) jutsuData[userId].items = {};
        const shardReward = dungeon.rewards?.success?.items?.find(i => i.name === 'Crystalline Shard');
        if (shardReward) {
            jutsuData[userId].items['Crystalline Shard'] = (jutsuData[userId].items['Crystalline Shard'] || 0) + shardReward.amount;
        }

        // Handle scroll rewards (array of scrolls)
        if (dungeon.rewards?.success?.scrolls) {
            if (!jutsuData[userId].scrolls) jutsuData[userId].scrolls = [];
            for (const scroll of dungeon.rewards.success.scrolls) {
                if (!jutsuData[userId].scrolls.includes(scroll.name)) {
                    jutsuData[userId].scrolls.push(scroll.name);
                }
            }
        }

        // Handle item rewards (array of items)
        if (dungeon.rewards?.success?.items) {
            if (!jutsuData[userId].items) jutsuData[userId].items = {};
            for (const item of dungeon.rewards.success.items) {
                // Only add non-ramen items to jutsu.json
                if (item.name !== 'Ramen Ticket') {
                    jutsuData[userId].items[item.name] = (jutsuData[userId].items[item.name] || 0) + item.amount;
                }
            }
        }

        // --- Send Ramen, Exp, Money to gift.json ---
        // Ramen Ticket
        let ramenAmount = dungeon.rewards?.success?.ramen || 0;
        const ramenItem = dungeon.rewards?.success?.items?.find(i => i.name === 'Ramen Ticket');
        if (ramenItem) ramenAmount += ramenItem.amount;
        if (ramenAmount > 0) {
            if (!giftData[userId]) giftData[userId] = [];
            giftData[userId].push({
                id: Math.floor(Math.random() * 1000000),
                type: "ramen",
                amount: ramenAmount,
                from: "dungeon",
                date: Date.now()
            });
        }
        // Exp
        let expAmount = dungeon.rewards?.success?.exp || 0;
        if (dungeon.rewards?.success?.exp_formula) {
            try {
                const playerLevel = users[userId].level || 1;
                expAmount = eval(dungeon.rewards.success.exp_formula.replace(/player\.level/g, playerLevel));
            } catch { }
        }
        if (expAmount > 0) {
            if (!giftData[userId]) giftData[userId] = [];
            giftData[userId].push({
                id: Math.floor(Math.random() * 1000000),
                type: "exp",
                amount: expAmount,
                from: "dungeon",
                date: Date.now()
            });
        }
        // Money
        let moneyAmount = dungeon.rewards?.success?.money || 0;
        if (dungeon.rewards?.success?.money_formula) {
            try {
                const playerLevel = users[userId].level || 1;
                moneyAmount = eval(dungeon.rewards.success.money_formula.replace(/player\.level/g, playerLevel));
            } catch { }
        }
        if (moneyAmount > 0) {
            if (!giftData[userId]) giftData[userId] = [];
            giftData[userId].push({
                id: Math.floor(Math.random() * 1000000),
                type: "money",
                amount: moneyAmount,
                from: "dungeon",
                date: Date.now()
            });
        }

        // Handle combo rewards (array of combos)
        if (dungeon.rewards?.success?.combos) {
            if (!user.combos) user.combos = [];
            for (const combo of dungeon.rewards.success.combos) {
                if (!user.combos.includes(combo)) {
                    user.combos.push(combo);
                }
            }
        }

        saveData(jutsusPath, jutsuData);
        saveData(giftPath, giftData);
        users[userId].current_dungeon = null;
        users[userId].lastDungeon = Date.now();
        if (users[userId].dungeonscompleted === undefined || users[userId].dungeonscompleted === null) {
            users[userId].dungeonscompleted = 1;
        } else {
            users[userId].dungeonscompleted += 1;
        }
        saveData(usersPath, users);

        // Dynamically build rewards message
        const rewardsText = [];
        if (moneyAmount > 0) rewardsText.push(`- **${moneyAmount}** Ryo`);
        if (expAmount > 0) rewardsText.push(`- **${expAmount}** Exp`);
        if (ramenAmount > 0) rewardsText.push(`- **${ramenAmount}** Ramen`);
        if (dungeon.rewards?.success?.items) {
            for (const item of dungeon.rewards.success.items) {
                if (item.name !== 'Ramen Ticket') {
                    rewardsText.push(`- **${item.amount}** ${item.name}`);
                }
            }
        }
        if (dungeon.rewards?.success?.scrolls) {
            for (const scroll of dungeon.rewards.success.scrolls) {
                rewardsText.push(`- The legendary **${scroll.name}** scroll!`);
            }
        }
        if (dungeon.rewards?.success?.combos) {
            for (const combo of dungeon.rewards.success.combos) {
                rewardsText.push(`- **${combo}** combo`);
            }
        }

        await interaction.channel.send({
            content: `**Congratulations!** You cleared the dungeon!
            **Rewards:**
            ${rewardsText.length > 0 ? rewardsText.join('\n') : 'No rewards.'}`
        });
    }

    async function dungeonFailure(reason) {
        users[userId].current_dungeon = null;
        users[userId].lastDungeon = Date.now();
        saveData(usersPath, users);
        await interaction.channel.send({ content: `Dungeon failed: ${reason || 'Better luck next time!'}` });
    }

    async function handleNextStep() {
        if (!users[userId].current_dungeon) return; // Dungeon failed, stop.

        const npcIndex = users[userId].current_dungeon.progress.npcIndex;
        // PATCH: Check if npcIndex is out of bounds (all NPCs processed)
        if (npcIndex >= npcs.length) {
            // Check if any NPC is a boss
            const hasBoss = Object.values(dungeon.npcs).some(npc => npc.type === 'boss');
            if (!hasBoss) {
                await interaction.channel.send({ content: "You're lucky. This dungeon doesn't seem to have a boss!" });
            }
            await dungeonSuccess();
            return;
        }

        const currentNpcKey = npcs[npcIndex];
        const currentNpc = dungeon.npcs[currentNpcKey];
        if (!currentNpc) {
            // Defensive: If currentNpc is undefined, just finish dungeon
            await dungeonSuccess();
            return;
        }

        // --- Minigame: Choice ---
        if (currentNpc.type === 'choice') {
            const choices = currentNpc.choices.map((choice, i) => new ButtonBuilder()
                .setCustomId(`dungeon_choice_${i}`)
                .setLabel(choice.text)
                .setStyle(ButtonStyle.Primary));

            const row = new ActionRowBuilder().addComponents(choices);

            const msg = await sendNPCMessage(currentNpc, currentNpc.dialogue, { components: [row] });
            const filter = i => i.customId.startsWith('dungeon_choice_') && i.user.id === userId;

            try {
                const res = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                const choiceIndex = parseInt(res.customId.split('_')[2]);
                const outcome = currentNpc.choices[choiceIndex].outcome;
                const userChoiceText = currentNpc.choices[choiceIndex].text;

                if (outcome === 'success') {
                    await res.update({ content: `${interaction.user.username} chose to ${userChoiceText}. The enemy is defeated!`, components: [] });
                    await sendNPCMessage(currentNpc, currentNpc.success_dialogue);
                    users[userId].current_dungeon.progress.npcIndex++;
                    saveData(usersPath, users);
                    handleNextStep();
                } else {
                    await res.update({ content: `${interaction.user.username} chose to ${userChoiceText}. It was a mistake...`, components: [] });
                    await sendNPCMessage(currentNpc, currentNpc.failure_dialogue);
                    dungeonFailure('Wrong choice.');
                }
            } catch (e) {
                console.error(e);
                dungeonFailure('Timed out.');
            } finally {
                // Ensure buttons are removed on timeout or completion
                if (msg) {
                    try {
                        await msg.edit({ components: [] });
                    } catch (err) {
                        console.error("Failed to edit message:", err);
                    }
                }
            }
        } else if (currentNpc.type === 'riddle') {
            const choices = currentNpc.choices.map((choice, i) => new ButtonBuilder()
                .setCustomId(`dungeon_riddle_${i}`)
                .setLabel(choice.text)
                .setStyle(ButtonStyle.Primary));

            const row = new ActionRowBuilder().addComponents(choices);
            await sendNPCMessage(currentNpc, currentNpc.dialogue);

            const voiceWebhook = await getWebhook(interaction, 'Strange Voice', mysteriousVoiceAvatar);
            const msg = await voiceWebhook.send({ content: currentNpc.riddle_dialogue, username: 'Strange Voice', avatarURL: mysteriousVoiceAvatar, components: [row] });
            const filter = i => i.customId.startsWith('dungeon_riddle_') && i.user.id === userId;

            try {
                const res = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                const choiceIndex = parseInt(res.customId.split('_')[2]);
                const outcome = currentNpc.choices[choiceIndex].outcome;

                if (outcome === 'success') {
                    await res.update({ content: `${interaction.user.username} stood their ground! Raditz is enraged! Prepare for the final battle!`, components: [] });
                    users[userId].current_dungeon.progress.npcIndex++;
                    saveData(usersPath, users);
                    handleNextStep();
                } else {
                    await res.update({ content: `${interaction.user.username} made the wrong choice.`, components: [] });
                    dungeonFailure('Wrong choice.');
                }
            } catch (e) {
                console.error(e);
                dungeonFailure('Timed out.');
            } finally {
                if (msg) {
                    try {
                        await msg.edit({ components: [] });
                    } catch (err) {
                        console.error("Failed to edit message:", err);
                    }
                }
            }
        } else if (currentNpc.type === 'boss') {
            const bossWebhook = await getWebhook(interaction, currentNpc.name, currentNpc.avatar);

            const totalBoxes = 10;
            const perfectParryIndex = Math.floor(Math.random() * totalBoxes);
            const boxes = '⬜'.repeat(totalBoxes).split('');
            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('parry_button')
                    .setLabel('Perform Parry!')
                    .setStyle(ButtonStyle.Success)
            );

            await sendNPCMessage(currentNpc, currentNpc.dialogue);

            const embed = new EmbedBuilder()
                .setColor('#FFFFFF')
                .setTitle('Perform a perfect parry!')
                .setDescription(boxes.join(''));

            const embedMessage = await bossWebhook.send({ embeds: [embed], components: [button] });

            let isPerfect = false;
            let timer = 0;
            const interval = setInterval(async () => {
                if (timer >= totalBoxes) {
                    clearInterval(interval);
                    await bossWebhook.editMessage(embedMessage.id, { embeds: [embed.setColor('#FF0000').setDescription('Dungeon Failed: You were too slow!')], components: [] });
                    dungeonFailure('Missed parry timing.');
                    return;
                }

                boxes[timer] = timer === perfectParryIndex ? '🟩' : '🟥';
                const updatedEmbed = new EmbedBuilder()
                    .setColor(timer === perfectParryIndex ? '#00FF00' : '#FF0000')
                    .setTitle('Perform a perfect parry!')
                    .setDescription(boxes.join(''));
                await bossWebhook.editMessage(embedMessage.id, { embeds: [updatedEmbed], components: [button] });

                if (timer === perfectParryIndex) {
                    const startTime = Date.now();
                    const filter = i => i.customId === 'parry_button' && i.user.id === userId;
                    try {
                        const res = await interaction.channel.awaitMessageComponent({ filter, time: 1000 });
                        const responseTime = (Date.now() - startTime) / 1000;
                        isPerfect = true;
                        clearInterval(interval);

                        const currentBest = users[userId].bestParryTime || 9.99;
                        let timeMsg = `Reaction: **${responseTime.toFixed(3)}s**`;

                        if (responseTime < currentBest) {
                            users[userId].bestParryTime = responseTime;
                            saveData(usersPath, users);
                            timeMsg += `\n**NEW BEST TIME!** (Previously: ${currentBest === 9.99 ? 'None' : currentBest.toFixed(3) + 's'})`;
                        } else {
                            timeMsg += `\n(Best: ${currentBest.toFixed(3)}s)`;
                        }

                        await res.update({ embeds: [updatedEmbed.setColor('#00FF00').setDescription(`Perfect Parry! You won!\n\n${timeMsg}`)], components: [] });
                        dungeonSuccess();
                    } catch (e) {
                        if (!isPerfect) {
                            clearInterval(interval);
                            await bossWebhook.editMessage(embedMessage.id, { embeds: [updatedEmbed.setColor('#FF0000').setDescription('Dungeon Failed: You missed the timing!')], components: [] });
                            dungeonFailure('Missed parry timing.');
                        }
                    }
                }
                timer++;
            }, 1000);
        }
        // --- Minigame: Puzzle ---
        else if (currentNpc.type === 'puzzle') {
            // New puzzle minigame support
            await sendNPCMessage(currentNpc, currentNpc.dialogue);
            await delay(1500);
            const puzzleWebhook = await getWebhook(interaction, currentNpc.name, currentNpc.avatar);
            const choices = currentNpc.choices.map((choice, i) =>
                new ButtonBuilder()
                    .setCustomId(`dungeon_puzzle_${i}`)
                    .setLabel(choice)
                    .setStyle(ButtonStyle.Primary)
            );
            const row = new ActionRowBuilder().addComponents(choices);
            const msg = await puzzleWebhook.send({
                content: currentNpc.puzzle_dialogue || currentNpc.question || "Choose an answer:",
                components: [row]
            });
            const filter = i => i.customId.startsWith('dungeon_puzzle_') && i.user.id === userId;
            try {
                const res = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                const choiceIndex = parseInt(res.customId.split('_')[2]);
                const selected = currentNpc.choices[choiceIndex];
                if (selected === currentNpc.correct_answer) {
                    await res.update({ content: currentNpc.success_dialogue || "Correct!", components: [] });
                    users[userId].current_dungeon.progress.npcIndex++;
                    saveData(usersPath, users);
                    handleNextStep();
                } else {
                    await res.update({ content: currentNpc.failure_dialogue || "Wrong answer.", components: [] });
                    dungeonFailure('Wrong answer.');
                }
            } catch (e) {
                dungeonFailure('Timed out.');
            } finally {
                if (msg) {
                    try { await msg.edit({ components: [] }); } catch { }
                }
            }
        }
        // --- Minigame: Dialogue ---
        else if (currentNpc.type === 'dialogue') {
            // New dialogue minigame support
            await sendNPCMessage(currentNpc, currentNpc.dialogue);
            await delay(1500);
            const dialogueWebhook = await getWebhook(interaction, currentNpc.name, currentNpc.avatar);
            const choices = currentNpc.choices.map((choice, i) =>
                new ButtonBuilder()
                    .setCustomId(`dungeon_dialogue_${i}`)
                    .setLabel(choice.text)
                    .setStyle(ButtonStyle.Primary)
            );
            const row = new ActionRowBuilder().addComponents(choices);
            const msg = await dialogueWebhook.send({
                content: currentNpc.dialogue_text || currentNpc.question || "Choose what to say:",
                components: [row]
            });
            const filter = i => i.customId.startsWith('dungeon_dialogue_') && i.user.id === userId;
            try {
                const res = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
                const choiceIndex = parseInt(res.customId.split('_')[2]);
                const outcome = currentNpc.choices[choiceIndex].outcome;
                if (outcome === 'success') {
                    await res.update({ content: currentNpc.choices[choiceIndex].success_dialogue || "Success!", components: [] });
                    users[userId].current_dungeon.progress.npcIndex++;
                    saveData(usersPath, users);
                    handleNextStep();
                } else {
                    await res.update({ content: currentNpc.choices[choiceIndex].failure_dialogue || "Failed.", components: [] });
                    dungeonFailure('Wrong choice.');
                }
            } catch (e) {
                dungeonFailure('Timed out.');
            } finally {
                if (msg) {
                    try { await msg.edit({ components: [] }); } catch { }
                }
            }
        }
    }

    handleNextStep();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scroll')
        .setDescription('Manage your ninja scrolls')
        .addSubcommand(subcommand => subcommand
            .setName('dungeon')
            .setDescription('Attempt to clear a dungeon to earn rewards and shards.'))
        .addSubcommand(subcommand => subcommand
            .setName('mission')
            .setDescription('Begin a new quest after clearing 10 dungeons.'))
        .addSubcommand(subcommand => subcommand
            .setName('info')
            .setDescription('View your current scroll and crystalline shards'))
        .addSubcommand(subcommand => subcommand
            .setName('set')
            .setDescription('Set active scroll')
            .addStringOption(option => option.setName('scrollname')
                .setDescription('Name of the scroll')
                .setRequired(true))),
    async execute(interaction) {
        const users = loadData(usersPath);
        const jutsuData = loadData(jutsusPath);
        const userId = interaction.user.id;

        if (!users[userId]) {
            return interaction.reply({ content: "You need to be a ninja first!", ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dungeon') {
            await handleDungeonGame(interaction, users, userId);
        } else if (subcommand === 'mission') {
            await handleMissionCommand(interaction, users, userId);
        } else if (subcommand === 'info') {
            const scrollName = users[userId].current_scroll;
            const shards = jutsuData[userId]?.items?.['Crystalline Shard'] || 0;

            const embed = new EmbedBuilder()
                .setColor('#FF5733')
                .setTitle('ЁЯУЬ Scroll Info')
                .setThumbnail(interaction.user.displayAvatarURL());

            if (scrollName) {
                const jutsuName = jutsuData.scrolls?.[scrollName]?.jutsu || 'None';
                embed.setDescription(`You are currently working on **${scrollName}**.
                It teaches the **${jutsuName}** jutsu.

                To learn this jutsu, you must find its shards! Use the \`/learnjutsu\` command to learn it when you have enough shards.`);
            } else {
                embed.setDescription("You don't have an active scroll. Use `/scroll set <scrollname>` to begin! You can use `/learnjutsu` to learn a jutsu if you have enough shards.");
            }

            embed.addFields({ name: 'Your Crystalline Shards', value: `${shards}`, inline: true });

            // Add user's available scrolls
            const userScrolls = jutsuData[userId]?.scrolls || [];
            embed.addFields({
                name: 'Your Scrolls',
                value: userScrolls.length > 0 ? userScrolls.join(', ') : 'None',
                inline: false
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } else if (subcommand === 'set') {
            const scrollName = interaction.options.getString('scrollname');
            const userScrolls = jutsuData[userId]?.scrolls || [];

            // Find the scroll in a case-insensitive way
            const matchedScroll = userScrolls.find(s => s.toLowerCase() === scrollName.toLowerCase());

            if (!matchedScroll) {
                return interaction.reply({
                    content: `You don't have the "${scrollName}" scroll!`,
                    ephemeral: true
                });
            }

            users[userId].current_scroll = matchedScroll;
            saveData(usersPath, users);

            const embed = new EmbedBuilder()
                .setColor('#4BB543')
                .setTitle('ЁЯУЬ Scroll Selected')
                .setDescription(`You are now working on **${matchedScroll}**!\nUse \`/scroll info\` to check progress!`)
                .setThumbnail(interaction.user.displayAvatarURL());

            return interaction.reply({ embeds: [embed] });
        }
    }
};