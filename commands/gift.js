const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');

// --- Random reward pools ---
const RANDOM_JUTSUS = ["Fireball", "Rasengan", "Analysis"];
const RANDOM_SCROLLS = ["Needle Assault Scroll"];
const RANDOM_COMBOS = ["Basic Combo", "Advanced Combo"]; // Added some random combos

// Utility to load and save gift.json
function loadGiftData() {
    if (!fs.existsSync(giftPath)) return {};
    return JSON.parse(fs.readFileSync(giftPath, 'utf8'));
}
function saveGiftData(data) {
    fs.writeFileSync(giftPath, JSON.stringify(data, null, 2));
}

// Utility to load and save users.json
function loadUserData() {
    if (!fs.existsSync(usersPath)) return {};
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
}
function saveUserData(data) {
    fs.writeFileSync(usersPath, JSON.stringify(data, null, 2));
}

// Utility to load and save jutsu.json
function loadJutsuData() {
    if (!fs.existsSync(jutsuPath)) return {};
    return JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
}
function saveJutsuData(data) {
    fs.writeFileSync(jutsuPath, JSON.stringify(data, null, 2));
}

// Utility to generate a random gift id (1-5000, unique per user)
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 5000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// Utility to open a mystery box and return the reward object
function openMysteryBox(box) {
    const rand = Math.random();
    let acc = 0;
    for (const item of box.contents) {
        acc += item.chance;
        if (rand <= acc) {
            // If the item is "random", pick from the pool
            if (item.type === "jutsu" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "jutsu", name: RANDOM_JUTSUS[Math.floor(Math.random() * RANDOM_JUTSUS.length)] };
            }
            if (item.type === "scroll" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "scroll", name: RANDOM_SCROLLS[Math.floor(Math.random() * RANDOM_SCROLLS.length)] };
            }
            if (item.type === "combo" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "combo", name: RANDOM_COMBOS[Math.floor(Math.random() * RANDOM_COMBOS.length)] };
            }
            // Otherwise, return as is
            return item;
        }
    }
    // fallback to last item
    return box.contents[box.contents.length - 1];
}

// Utility to add a jutsu, combo, or scroll to jutsu.json
function addToJutsuJson(userId, type, name) {
    let jutsuData = loadJutsuData();
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (type === "jutsu") {
        if (!jutsuData[userId].usersjutsu.includes(name)) jutsuData[userId].usersjutsu.push(name);
    } else if (type === "combo") {
        if (!jutsuData[userId].combos) jutsuData[userId].combos = [];
        if (!jutsuData[userId].combos.includes(name)) jutsuData[userId].combos.push(name);
    } else if (type === "scroll") {
        if (!jutsuData[userId].scrolls) jutsuData[userId].scrolls = [];
        if (!jutsuData[userId].scrolls.includes(name)) jutsuData[userId].scrolls.push(name);
    }
    saveJutsuData(jutsuData);
}

const OWNER_ID = '835408109899219004'; // Set your owner ID here

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gift items or view/claim your gifts')
        .addSubcommand(sub =>
            sub.setName('money')
                .setDescription('Gift money to another user')
                .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('ss')
                .setDescription('Gift Shinobi Shards (SS) to another user (Admin only)')
                .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
                .addIntegerOption(opt => opt.setName('id').setDescription('Unique gift ID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('combo')
                .setDescription('Gift a combo to another user (Admin only)')
                .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true))
                .addStringOption(opt => opt.setName('name').setDescription('Combo Name').setRequired(true))
                .addIntegerOption(opt => opt.setName('id').setDescription('Unique gift ID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('ramen')
                .setDescription('Gift ramen tickets to another user (Admin only)')
                .addUserOption(opt => opt.setName('user').setDescription('Recipient').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
                .addIntegerOption(opt => opt.setName('id').setDescription('Unique gift ID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('inventory')
                .setDescription('View and claim your gifts')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Helper function to handle claiming a single gift
        async function claimSingleGift(gift, userDiscordId, usersData, giftData) {
            let rewardMsg = '';
            let claimedSuccessfully = true;

            // --- Handle ranked_reward gifts ---
            if (gift.type === 'ranked_reward') {
                // This scenario is complex for "claim all" as it requires user interaction.
                // For "claim all", we'll default to the first reward for simplicity,
                // or you might consider making ranked rewards not claimable via "claim all".
                // For this example, we'll choose reward1.
                const chosenReward = gift.reward.reward1;
                if (chosenReward.box) {
                    const boxResult = openMysteryBox(chosenReward.box);
                    if (["jutsu", "combo", "scroll"].includes(boxResult.type)) {
                        addToJutsuJson(userDiscordId, boxResult.type, boxResult.name);
                        rewardMsg = `You received a **${boxResult.name}** from the mystery box!`;
                    } else if (boxResult.type === "ramen") {
                        if (!usersData[userDiscordId].ramen) usersData[userDiscordId].ramen = 0;
                        usersData[userDiscordId].ramen += boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} ramen ticket(s)** from the mystery box!`;
                    } else if (boxResult.type === "money") {
                        if (!usersData[userDiscordId].money) usersData[userDiscordId].money = 0;
                        usersData[userDiscordId].money += boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} Money** from the mystery box!`;
                    } else if (boxResult.type === "ss") {
                        if (!usersData[userDiscordId].ss) usersData[userDiscordId].ss = 0;
                        usersData[userDiscordId].ss += boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} Shinobi Shards (SS)** from the mystery box!`;
                    } else {
                        rewardMsg = `You received a reward from the mystery box!`;
                    }
                } else if (chosenReward.name === 'Money' && chosenReward.amount) {
                    if (!usersData[userDiscordId].money) usersData[userDiscordId].money = 0;
                    let min = chosenReward.amount.min || 0;
                    let max = chosenReward.amount.max || min;
                    let amount = Math.floor(Math.random() * (max - min + 1)) + min;
                    usersData[userDiscordId].money += amount;
                    rewardMsg = `You received **${amount} Money**!`;
                } else if (chosenReward.name.toLowerCase().includes('ramen')) {
                    if (!usersData[userDiscordId].ramen) usersData[userDiscordId].ramen = 0;
                    usersData[userDiscordId].ramen += 1;
                    rewardMsg = `You received **1 ramen ticket**!`;
                } else if (chosenReward.name.toLowerCase().includes('random jutsu')) {
                    let jutsu = RANDOM_JUTSUS[Math.floor(Math.random() * RANDOM_JUTSUS.length)];
                    addToJutsuJson(userDiscordId, "jutsu", jutsu);
                    rewardMsg = `You received a **${jutsu}**!`;
                } else if (chosenReward.name.toLowerCase().includes('random scroll')) {
                    let scroll = RANDOM_SCROLLS[Math.floor(Math.random() * RANDOM_SCROLLS.length)];
                    addToJutsuJson(userDiscordId, "scroll", scroll);
                    rewardMsg = `You received a **${scroll}**!`;
                } else if (chosenReward.name.toLowerCase().includes('random combo')) {
                    let combo = RANDOM_COMBOS[Math.floor(Math.random() * RANDOM_COMBOS.length)];
                    addToJutsuJson(userDiscordId, "combo", combo);
                    rewardMsg = `You received a **${combo}**!`;
                } else if (chosenReward.name.toLowerCase().startsWith('jutsu:')) {
                    let jutsu = chosenReward.name.replace(/^jutsu:\s*/i, '');
                    addToJutsuJson(userDiscordId, "jutsu", jutsu);
                    rewardMsg = `You received **${jutsu}**!`;
                } else if (chosenReward.name.toLowerCase().startsWith('scroll')) {
                    let scroll = chosenReward.name_detail || chosenReward.name.replace(/^scroll:\s*/i, '');
                    addToJutsuJson(userDiscordId, "scroll", scroll);
                    rewardMsg = `You received **${scroll}**!`;
                } else if (chosenReward.name.toLowerCase().startsWith('combo:')) {
                    let combo = chosenReward.name.replace(/^combo:\s*/i, '');
                    addToJutsuJson(userDiscordId, "combo", combo);
                    rewardMsg = `You received **${combo}**!`;
                }
                 else {
                    rewardMsg = `You received **${chosenReward.name}**!`;
                }
                // Update users data if money/ramen were added
                saveUserData(usersData);
            } else if (gift.type === 'money') {
                if (!usersData[userDiscordId].money) usersData[userDiscordId].money = 0;
                usersData[userDiscordId].money += gift.amount;
                rewardMsg = `Claimed ${gift.amount} money.`;
            } else if (gift.type === 'ss') {
                if (!usersData[userDiscordId].ss) usersData[userDiscordId].ss = 0;
                usersData[userDiscordId].ss += gift.amount;
                rewardMsg = `Claimed ${gift.amount} Shinobi Shards (SS).`;
            } else if (gift.type === 'combo') {
                addToJutsuJson(userDiscordId, "combo", gift.name);
                rewardMsg = `Claimed combo: **${gift.name}**`;
            } else if (gift.type === 'ramen') {
                if (!usersData[userDiscordId].ramen) usersData[userDiscordId].ramen = 0;
                usersData[userDiscordId].ramen += gift.amount;
                rewardMsg = `Claimed ${gift.amount} ramen ticket(s).`;
            } else if (gift.type === 'scroll') {
                addToJutsuJson(userDiscordId, "scroll", gift.name);
                rewardMsg = `Claimed scroll: **${gift.name}**`;
            } else if (gift.type === 'jutsu') {
                let jutsuData = loadJutsuData();
                let alreadyOwned = jutsuData[userDiscordId] && Array.isArray(jutsuData[userDiscordId].usersjutsu) && jutsuData[userDiscordId].usersjutsu.includes(gift.name);
                if (alreadyOwned) {
                    rewardMsg = `You already own **${gift.name}**! Duplicate jutsu not added.`;
                    claimedSuccessfully = false; // Mark as not successfully claimed in terms of adding to inventory
                } else {
                    addToJutsuJson(userDiscordId, "jutsu", gift.name);
                    rewardMsg = `Claimed jutsu: **${gift.name}**`;
                }
            } else {
                rewardMsg = `Claimed unknown gift type: ${gift.type}.`;
            }

            // Save updated user data
            saveUserData(usersData);
            return { message: rewardMsg, claimedSuccessfully };
        }

        if (sub === 'money') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });
            if (target.id === userId && userId !== OWNER_ID) return interaction.reply({ content: "You can't gift yourself.", ephemeral: true });

            let users = loadUserData();
            if (userId !== OWNER_ID) {
                if (!users[userId] || typeof users[userId].money !== 'number') {
                    return interaction.reply({ content: "You don't have a valid account or money balance.", ephemeral: true });
                }
                if (users[userId].money < amount) {
                    return interaction.reply({ content: "You don't have enough money to gift that amount.", ephemeral: true });
                }
                users[userId].money -= amount;
                saveUserData(users);
            }
            let giftData = loadGiftData();
            if (!giftData[target.id]) giftData[target.id] = [];
            const id = generateGiftId(giftData[target.id]);
            giftData[target.id].push({
                id,
                type: 'money',
                amount,
                from: userId,
                date: Date.now()
            });
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted ${amount} money to <@${target.id}>! They can claim it from /gift inventory.` });
        }

        if (sub === 'ss') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Shinobi Shards.", ephemeral: true });
            }
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const giftId = interaction.options.getInteger('id');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });
            if (target.id === userId && userId !== OWNER_ID) return interaction.reply({ content: "You can't gift yourself.", ephemeral: true });

            let giftData = loadGiftData();
            if (!giftData[target.id]) giftData[target.id] = [];
            if (giftData[target.id].some(g => g.id === giftId)) {
                return interaction.reply({ content: "Gift ID already exists for this user. Please use a unique ID.", ephemeral: true });
            }
            giftData[target.id].push({
                id: giftId,
                type: 'ss',
                amount,
                from: userId,
                date: Date.now()
            });
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted ${amount} Shinobi Shards (SS) to <@${target.id}>! They can claim it from /gift inventory.` });
        }

        if (sub === 'combo') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Combos.", ephemeral: true });
            }
            const target = interaction.options.getUser('user');
            const comboName = interaction.options.getString('name');
            const giftId = interaction.options.getInteger('id');

            let giftData = loadGiftData();
            if (!giftData[target.id]) giftData[target.id] = [];
            if (giftData[target.id].some(g => g.id === giftId)) {
                return interaction.reply({ content: "Gift ID already exists for this user. Please use a unique ID.", ephemeral: true });
            }
            giftData[target.id].push({
                id: giftId,
                type: 'combo',
                name: comboName,
                from: userId,
                date: Date.now()
            });
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted combo **${comboName}** to <@${target.id}>! They can claim it from /gift inventory.` });
        }

        if (sub === 'ramen') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Ramen Tickets.", ephemeral: true });
            }
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const giftId = interaction.options.getInteger('id');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });

            let giftData = loadGiftData();
            if (!giftData[target.id]) giftData[target.id] = [];
            if (giftData[target.id].some(g => g.id === giftId)) {
                return interaction.reply({ content: "Gift ID already exists for this user. Please use a unique ID.", ephemeral: true });
            }
            giftData[target.id].push({
                id: giftId,
                type: 'ramen',
                amount,
                from: userId,
                date: Date.now()
            });
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted ${amount} ramen ticket(s) to <@${target.id}>! They can claim it from /gift inventory.` });
        }


        if (sub === 'inventory') {
            let giftData = loadGiftData();
            let gifts = giftData[userId] || [];
            if (gifts.length === 0) {
                return interaction.reply({ content: "You have no gifts to claim." });
            }

            let desc = gifts.map((g, i) => {
                if (g.type === 'ranked_reward' && g.reward) {
                    const r1 = g.reward.reward1.display || g.reward.reward1.name;
                    const r2 = g.reward.reward2.display || g.reward.reward2.name;
                    return `**ID:** ${g.id} | **Type:** Ranked Reward | **Choices:** ${r1} or ${r2}` +
                        (g.from ? ` | **From:** <@${g.from}>` : '');
                }
                return `**ID:** ${g.id} | **Type:** ${g.type === 'ss' ? 'Shinobi Shard' : g.type === 'combo' ? 'Combo' : g.type === 'ramen' ? 'Ramen Ticket' : g.type}` +
                    (g.type === 'money' || g.type === 'ss' || g.type === 'ramen' ? ` | **Amount:** ${g.amount}` : '') +
                    (g.type === 'combo' || g.type === 'jutsu' || g.type === 'scroll' ? ` | **Name:** ${g.name}` : '') +
                    (g.from ? ` | **From:** <@${g.from}>` : '');
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('Your Gifts')
                .setDescription(desc)
                .setColor('#FFD700');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_gift')
                    .setLabel('Claim Selected')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('claim_all_gifts')
                    .setLabel('Claim All')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [embed], components: [row] });

            const filter = i => (i.customId === 'claim_gift' || i.customId === 'claim_all_gifts') && i.user.id === userId;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async btnInt => {
                if (btnInt.customId === 'claim_all_gifts') {
                    let users = loadUserData();
                    let claimedMessages = [];
                    let remainingGifts = [];

                    for (const gift of gifts) {
                        // Ranked rewards require user interaction, so we skip them for "Claim All"
                        if (gift.type === 'ranked_reward') {
                            remainingGifts.push(gift);
                            claimedMessages.push(`Skipped Ranked Reward (ID: ${gift.id}) - requires manual selection.`);
                            continue;
                        }

                        const { message, claimedSuccessfully } = await claimSingleGift(gift, userId, users, giftData);
                        claimedMessages.push(`ID: ${gift.id} - ${message}`);
                        if (!claimedSuccessfully) {
                            remainingGifts.push(gift); // Add back if not truly claimed (e.g., duplicate jutsu)
                        }
                    }

                    // Update gift data with remaining gifts (ranked rewards, duplicates)
                    giftData[userId] = remainingGifts;
                    saveGiftData(giftData);
                    saveUserData(users); // Ensure users data is saved after all claims

                    let replyContent = claimedMessages.join('\n');
                    if (remainingGifts.length > 0) {
                        replyContent += "\n\nSome gifts could not be claimed automatically or require manual attention (e.g., Ranked Rewards, duplicate jutsu).";
                    } else {
                        replyContent += "\n\nAll eligible gifts claimed!";
                    }

                    await btnInt.update({ content: replyContent, embeds: [], components: [] });
                    collector.stop(); // Stop the collector after claiming all
                } else if (btnInt.customId === 'claim_gift') {
                    await btnInt.reply({ content: "Enter the ID of the gift you want to claim." });

                    const msgFilter = m => m.author.id === userId && /^\d+$/.test(m.content.trim());
                    const msgCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 60000, max: 1 });
                    msgCollector.on('collect', async msg => {
                        const claimId = parseInt(msg.content.trim(), 10);
                        const idx = gifts.findIndex(g => g.id === claimId);
                        if (idx === -1) {
                            await interaction.followUp({ content: "Invalid gift ID.", ephemeral: true });
                            return;
                        }
                        const gift = gifts[idx];
                        let users = loadUserData(); // Load latest user data

                        // --- Handle ranked_reward gifts (requires selection) ---
                        if (gift.type === 'ranked_reward') {
                            const reward1 = gift.reward.reward1;
                            const reward2 = gift.reward.reward2;
                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId('ranked_reward_select')
                                .setPlaceholder('Choose your reward')
                                .addOptions([
                                    {
                                        label: reward1.name,
                                        description: reward1.desc,
                                        value: 'reward1'
                                    },
                                    {
                                        label: reward2.name,
                                        description: reward2.desc,
                                        value: 'reward2'
                                    }
                                ]);
                            const rewardEmbed = new EmbedBuilder()
                                .setTitle('Choose Your Ranked Reward')
                                .setDescription('Select one of the rewards below:')
                                .setColor('#00BFFF');
                            const rewardRow = new ActionRowBuilder().addComponents(selectMenu);

                            await interaction.followUp({ embeds: [rewardEmbed], components: [rewardRow], ephemeral: true });

                            const selectFilter = i => i.customId === 'ranked_reward_select' && i.user.id === userId;
                            const selectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000, max: 1 });
                            selectCollector.on('collect', async selectInt => {
                                const choice = selectInt.values[0];
                                let chosenReward = choice === 'reward1' ? reward1 : reward2;
                                let rewardMsg = '';

                                if (chosenReward.box) {
                                    const boxResult = openMysteryBox(chosenReward.box);
                                    if (!users[userId]) users[userId] = {};
                                    if (["jutsu", "combo", "scroll"].includes(boxResult.type)) {
                                        addToJutsuJson(userId, boxResult.type, boxResult.name);
                                        rewardMsg = `You received a **${boxResult.name}** from the mystery box!`;
                                    } else if (boxResult.type === "ramen") {
                                        if (!users[userId].ramen) users[userId].ramen = 0;
                                        users[userId].ramen += boxResult.amount;
                                        rewardMsg = `You received **${boxResult.amount} ramen ticket(s)** from the mystery box!`;
                                    } else if (boxResult.type === "money") {
                                        if (!users[userId].money) users[userId].money = 0;
                                        users[userId].money += boxResult.amount;
                                        rewardMsg = `You received **${boxResult.amount} Money** from the mystery box!`;
                                    } else if (boxResult.type === "ss") {
                                        if (!users[userId].ss) users[userId].ss = 0;
                                        users[userId].ss += boxResult.amount;
                                        rewardMsg = `You received **${boxResult.amount} Shinobi Shards (SS)** from the mystery box!`;
                                    } else {
                                        rewardMsg = `You received a reward from the mystery box!`;
                                    }
                                    saveUserData(users);
                                } else if (chosenReward.name === 'Money' && chosenReward.amount) {
                                    if (!users[userId].money) users[userId].money = 0;
                                    let min = chosenReward.amount.min || 0;
                                    let max = chosenReward.amount.max || min;
                                    let amount = Math.floor(Math.random() * (max - min + 1)) + min;
                                    users[userId].money += amount;
                                    rewardMsg = `You received **${amount} Money**!`;
                                    saveUserData(users);
                                } else if (chosenReward.name.toLowerCase().includes('ramen')) {
                                    if (!users[userId].ramen) users[userId].ramen = 0;
                                    users[userId].ramen += 1;
                                    rewardMsg = `You received **1 ramen ticket**!`;
                                    saveUserData(users);
                                } else if (chosenReward.name.toLowerCase().includes('random jutsu')) {
                                    let jutsu = RANDOM_JUTSUS[Math.floor(Math.random() * RANDOM_JUTSUS.length)];
                                    addToJutsuJson(userId, "jutsu", jutsu);
                                    rewardMsg = `You received a **${jutsu}**!`;
                                } else if (chosenReward.name.toLowerCase().includes('random scroll')) {
                                    let scroll = RANDOM_SCROLLS[Math.floor(Math.random() * RANDOM_SCROLLS.length)];
                                    addToJutsuJson(userId, "scroll", scroll);
                                    rewardMsg = `You received a **${scroll}**!`;
                                } else if (chosenReward.name.toLowerCase().includes('random combo')) {
                                    let combo = RANDOM_COMBOS[Math.floor(Math.random() * RANDOM_COMBOS.length)];
                                    addToJutsuJson(userId, "combo", combo);
                                    rewardMsg = `You received a **${combo}**!`;
                                } else if (chosenReward.name.toLowerCase().startsWith('jutsu:')) {
                                    let jutsu = chosenReward.name.replace(/^jutsu:\s*/i, '');
                                    addToJutsuJson(userId, "jutsu", jutsu);
                                    rewardMsg = `You received **${jutsu}**!`;
                                } else if (chosenReward.name.toLowerCase().startsWith('scroll')) {
                                    let scroll = chosenReward.name_detail || chosenReward.name.replace(/^scroll:\s*/i, '');
                                    addToJutsuJson(userId, "scroll", scroll);
                                    rewardMsg = `You received **${scroll}**!`;
                                } else if (chosenReward.name.toLowerCase().startsWith('combo:')) {
                                    let combo = chosenReward.name.replace(/^combo:\s*/i, '');
                                    addToJutsuJson(userId, "combo", combo);
                                    rewardMsg = `You received **${combo}**!`;
                                }
                                else {
                                    rewardMsg = `You received **${chosenReward.name}**!`;
                                }

                                gifts.splice(idx, 1);
                                giftData[userId] = gifts;
                                saveGiftData(giftData);

                                await selectInt.update({ content: `You claimed your ranked reward! ${rewardMsg}`, embeds: [], components: [] });
                                collector.stop(); // Stop the main collector after a single claim from ranked reward
                            });
                            selectCollector.on('end', collected => {
                                if (collected.size === 0) {
                                    interaction.followUp({ content: "Time out. Please try claiming again.", ephemeral: true });
                                }
                            });
                            return; // Stop processing this claim further for now, as it's handled by selectCollector
                        }

                        // --- Handle other gift types as before ---
                        const { message } = await claimSingleGift(gift, userId, users, giftData);

                        // Remove the gift after claiming
                        gifts.splice(idx, 1);
                        giftData[userId] = gifts;
                        saveGiftData(giftData);

                        await msg.reply({ content: message }); // Reply to the message asking for ID
                        await btnInt.editReply({ components: [] }); // Remove buttons after claim
                        collector.stop(); // Stop the collector after a single gift is claimed
                    });
                    msgCollector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({ content: "You did not provide a gift ID in time.", ephemeral: true });
                        }
                    });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: "No interaction received, gift inventory display timed out.", embeds: [embed], components: [] });
                }
            });
        }
    }
};