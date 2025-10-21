const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');

// --- Random reward pools ---
const RANDOM_JUTSUS = ["Fireball", "Rasengan", "Analysis"];
const RANDOM_SCROLLS = ["Needle Assault Scroll"];
const RANDOM_COMBOS = ["Basic Combo", "Advanced Combo"];

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
            if (item.type === "jutsu" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "jutsu", name: RANDOM_JUTSUS[Math.floor(Math.random() * RANDOM_JUTSUS.length)] };
            }
            if (item.type === "scroll" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "scroll", name: RANDOM_SCROLLS[Math.floor(Math.random() * RANDOM_SCROLLS.length)] };
            }
            if (item.type === "combo" && item.name && item.name.toLowerCase().includes("random")) {
                return { type: "combo", name: RANDOM_COMBOS[Math.floor(Math.random() * RANDOM_COMBOS.length)] };
            }
            return item;
        }
    }
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

const OWNER_ID = '835408109899219004';
const GIFT_LOG_CHANNEL_ID = 'YOUR_GIFT_LOG_CHANNEL_ID_HERE'; // Set your gift log channel ID

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
            sub.setName('ss_global')
                .setDescription('Gift Shinobi Shards (SS) to ALL users (Admin only)')
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
            sub.setName('combo_global')
                .setDescription('Gift a combo to ALL users (Admin only)')
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
            sub.setName('ramen_global')
                .setDescription('Gift ramen tickets to ALL users (Admin only)')
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

        // Helper function to log SS gifts to the specific channel
        async function logSSGift(gifterId, recipientId, amount, giftId, isGlobal = false) {
            const logChannel = interaction.client.channels.cache.get(GIFT_LOG_CHANNEL_ID);
            if (!logChannel) return;
            
            const embed = new EmbedBuilder()
                .setTitle('🎁 Shinobi Shards Gift Log')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Gifter', value: `<@${gifterId}>`, inline: true },
                    { name: 'Recipient', value: isGlobal ? '**ALL USERS**' : `<@${recipientId}>`, inline: true },
                    { name: 'Amount', value: amount.toString(), inline: true },
                    { name: 'Gift ID', value: giftId.toString(), inline: true },
                    { name: 'Type', value: isGlobal ? 'Global Gift' : 'Individual Gift', inline: true },
                    { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setFooter({ text: 'Gift System Log' })
                .setTimestamp();

            try {
                await logChannel.send({ embeds: [embed] });
            } catch (error) {
                console.error('Failed to send gift log:', error);
            }
        }

        // Helper function to handle claiming a single gift
        async function claimSingleGift(gift, userDiscordId, usersData, giftData) {
            let rewardMsg = '';
            let claimedSuccessfully = true;
            const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
            let playersData = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
            if (!playersData[userDiscordId]) playersData[userDiscordId] = {};

            if (gift.type === 'ranked_reward') {
                const chosenReward = gift.reward.reward1;
                if (chosenReward.box) {
                    const boxResult = openMysteryBox(chosenReward.box);
                    if (["jutsu", "combo", "scroll"].includes(boxResult.type)) {
                        addToJutsuJson(userDiscordId, boxResult.type, boxResult.name);
                        rewardMsg = `You received a **${boxResult.name}** from the mystery box!`;
                    } else if (boxResult.type === "ramen") {
                        playersData[userDiscordId].ramen = Number(playersData[userDiscordId].ramen || 0) + boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} ramen ticket(s)** from the mystery box!`;
                    } else if (boxResult.type === "money") {
                        playersData[userDiscordId].money = Number(playersData[userDiscordId].money || 0) + boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} Money** from the mystery box!`;
                    } else if (boxResult.type === "ss") {
                        playersData[userDiscordId].ss = Number(playersData[userDiscordId].ss || 0) + boxResult.amount;
                        rewardMsg = `You received **${boxResult.amount} Shinobi Shards (SS)** from the mystery box!`;
                    } else {
                        rewardMsg = `You received a reward from the mystery box!`;
                    }
                } else if (chosenReward.name === 'Money' && chosenReward.amount) {
                    let min = chosenReward.amount.min || 0;
                    let max = chosenReward.amount.max || min;
                    let amount = Math.floor(Math.random() * (max - min + 1)) + min;
                    playersData[userDiscordId].money = Number(playersData[userDiscordId].money || 0) + amount;
                    rewardMsg = `You received **${amount} Money**!`;
                } else if (chosenReward.name.toLowerCase().includes('ramen')) {
                    playersData[userDiscordId].ramen = Number(playersData[userDiscordId].ramen || 0) + 1;
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
                } else {
                    rewardMsg = `You received **${chosenReward.name}**!`;
                }
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'money') {
                playersData[userDiscordId].money = Number(playersData[userDiscordId].money || 0) + gift.amount;
                rewardMsg = `Claimed ${gift.amount} money.`;
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'ss') {
                playersData[userDiscordId].ss = Number(playersData[userDiscordId].ss || 0) + gift.amount;
                rewardMsg = `Claimed ${gift.amount} Shinobi Shards (SS).`;
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'combo') {
                addToJutsuJson(userDiscordId, "combo", gift.name);
                rewardMsg = `Claimed combo: **${gift.name}**`;
            } else if (gift.type === 'ramen') {
                playersData[userDiscordId].ramen = Number(playersData[userDiscordId].ramen || 0) + gift.amount;
                rewardMsg = `Claimed ${gift.amount} ramen ticket(s).`;
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'scroll') {
                addToJutsuJson(userDiscordId, "scroll", gift.name);
                rewardMsg = `Claimed scroll: **${gift.name}**`;
            } else if (gift.type === 'jutsu') {
                let jutsuData = loadJutsuData();
                let alreadyOwned = jutsuData[userDiscordId] && Array.isArray(jutsuData[userDiscordId].usersjutsu) && jutsuData[userDiscordId].usersjutsu.includes(gift.name);
                if (alreadyOwned) {
                    rewardMsg = `You already own **${gift.name}**! Duplicate jutsu not added.`;
                    claimedSuccessfully = false;
                } else {
                    addToJutsuJson(userDiscordId, "jutsu", gift.name);
                    rewardMsg = `Claimed jutsu: **${gift.name}**`;
                }
            } else if (gift.type === 'exp') {
                playersData[userDiscordId].exp = Number(playersData[userDiscordId].exp || 0) + gift.amount;
                rewardMsg = `Claimed ${gift.amount} EXP.`;
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'elo') {
                playersData[userDiscordId].elo = Number(playersData[userDiscordId].elo || 0) + gift.amount;
                rewardMsg = `Claimed ${gift.amount} ELO.`;
                fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
            } else if (gift.type === 'material') {
                const occupation = usersData[userDiscordId]?.occupation?.toLowerCase() || '';
                const matKey = gift.key;
                const matAmount = gift.amount || 0;
                let added = false;
                if (["anbu", "hokage", "right hand man", "guard", "spy", "village"].some(role => occupation.includes(role))) {
                    const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
                    let villageData = fs.existsSync(villagePath) ? JSON.parse(fs.readFileSync(villagePath, 'utf8')) : {};
                    if (!villageData[matKey]) villageData[matKey] = 0;
                    villageData[matKey] += matAmount;
                    fs.writeFileSync(villagePath, JSON.stringify(villageData, null, 2));
                    rewardMsg = `Claimed ${matAmount} ${gift.name} for the Village!`;
                    added = true;
                } else if (["akatsuki", "rogue"].some(role => occupation.includes(role))) {
                    const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
                    let akatsukiData = fs.existsSync(akatsukiPath) ? JSON.parse(fs.readFileSync(akatsukiPath, 'utf8')) : {};
                    if (!akatsukiData[matKey]) akatsukiData[matKey] = 0;
                    akatsukiData[matKey] += matAmount;
                    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsukiData, null, 2));
                    rewardMsg = `Claimed ${matAmount} ${gift.name} for Akatsuki!`;
                    added = true;
                } else {
                    rewardMsg = `Claimed ${matAmount} ${gift.name}, but your occupation is not eligible for material storage.`;
                }
                claimedSuccessfully = added;
            } else {
                rewardMsg = `Claimed unknown gift type: ${gift.type}.`;
            }

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

            // Log the SS gift
            await logSSGift(userId, target.id, amount, giftId, false);

            return interaction.reply({ content: `Gifted ${amount} Shinobi Shards (SS) to <@${target.id}>! They can claim it from /gift inventory.` });
        }

        if (sub === 'ss_global') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Shinobi Shards globally.", ephemeral: true });
            }
            const amount = interaction.options.getInteger('amount');
            const giftId = interaction.options.getInteger('id');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });

            let giftData = loadGiftData();
            let users = loadUserData();
            let userCount = 0;

            // Gift to every user in users.json
            for (const userId in users) {
                if (!giftData[userId]) giftData[userId] = [];
                if (!giftData[userId].some(g => g.id === giftId)) {
                    giftData[userId].push({
                        id: giftId,
                        type: 'ss',
                        amount,
                        from: userId,
                        date: Date.now(),
                        global: true
                    });
                    userCount++;
                }
            }
            saveGiftData(giftData);

            // Log the global SS gift
            await logSSGift(userId, 'ALL', amount, giftId, true);

            return interaction.reply({ content: `Gifted ${amount} Shinobi Shards (SS) to ${userCount} users globally! They can claim it from /gift inventory.` });
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

        if (sub === 'combo_global') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Combos globally.", ephemeral: true });
            }
            const comboName = interaction.options.getString('name');
            const giftId = interaction.options.getInteger('id');

            let giftData = loadGiftData();
            let users = loadUserData();
            let userCount = 0;

            // Gift to every user in users.json
            for (const userId in users) {
                if (!giftData[userId]) giftData[userId] = [];
                if (!giftData[userId].some(g => g.id === giftId)) {
                    giftData[userId].push({
                        id: giftId,
                        type: 'combo',
                        name: comboName,
                        from: userId,
                        date: Date.now(),
                        global: true
                    });
                    userCount++;
                }
            }
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted combo **${comboName}** to ${userCount} users globally! They can claim it from /gift inventory.` });
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

        if (sub === 'ramen_global') {
            if (!interaction.member.permissions.has('Administrator') && userId !== OWNER_ID) {
                return interaction.reply({ content: "Only admins can gift Ramen Tickets globally.", ephemeral: true });
            }
            const amount = interaction.options.getInteger('amount');
            const giftId = interaction.options.getInteger('id');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive.", ephemeral: true });

            let giftData = loadGiftData();
            let users = loadUserData();
            let userCount = 0;

            // Gift to every user in users.json
            for (const userId in users) {
                if (!giftData[userId]) giftData[userId] = [];
                if (!giftData[userId].some(g => g.id === giftId)) {
                    giftData[userId].push({
                        id: giftId,
                        type: 'ramen',
                        amount,
                        from: userId,
                        date: Date.now(),
                        global: true
                    });
                    userCount++;
                }
            }
            saveGiftData(giftData);

            return interaction.reply({ content: `Gifted ${amount} ramen ticket(s) to ${userCount} users globally! They can claim it from /gift inventory.` });
        }

        if (sub === 'inventory') {
            let giftData = loadGiftData();
            let gifts = giftData[userId] || [];
            if (gifts.length === 0) {
                return interaction.reply({ content: "You have no gifts to claim." });
            }

            const MAX_DESC_LENGTH = 4096;
            const PAGE_SIZE = 10;
            let pages = [];
            let currentPage = 0;
            let tempDesc = '';
            let tempArr = [];
            for (let i = 0; i < gifts.length; i++) {
                let g = gifts[i];
                let line = '';
                if (g.type === 'ranked_reward' && g.reward) {
                    const r1 = g.reward.reward1.display || g.reward.reward1.name;
                    const r2 = g.reward.reward2.display || g.reward.reward2.name;
                    line = `**ID:** ${g.id} | **Type:** Ranked Reward | **Choices:** ${r1} or ${r2}` + (g.from ? ` | **From:** <@${g.from}>` : '');
                } else {
                    line = `**ID:** ${g.id} | **Type:** ${g.type === 'ss' ? 'Shinobi Shard' : g.type === 'combo' ? 'Combo' : g.type === 'ramen' ? 'Ramen Ticket' : g.type}` +
                        (g.type === 'money' || g.type === 'ss' || g.type === 'ramen' ? ` | **Amount:** ${g.amount}` : '') +
                        (g.type === 'combo' || g.type === 'jutsu' || g.type === 'scroll' ? ` | **Name:** ${g.name}` : '') +
                        (g.from ? ` | **From:** <@${g.from}>` : '') +
                        (g.global ? ` | **Global Gift**` : '');
                }
                if (tempDesc.length + line.length + 1 > MAX_DESC_LENGTH || tempArr.length >= PAGE_SIZE) {
                    pages.push(tempArr.slice());
                    tempArr = [];
                    tempDesc = '';
                }
                tempArr.push(line);
                tempDesc += line + '\n';
            }
            if (tempArr.length > 0) pages.push(tempArr);

            function getEmbed(pageIdx) {
                const embed = new EmbedBuilder()
                    .setTitle('Your Gifts')
                    .setDescription(pages[pageIdx].join('\n'))
                    .setColor('#FFD700');
                if (pages.length > 1) {
                    embed.setFooter({ text: `Page ${pageIdx + 1} of ${pages.length}` });
                }
                return embed;
            }

            const getRow = (pageIdx) => {
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
                if (pages.length > 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIdx === 0),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIdx === pages.length - 1)
                    );
                }
                return row;
            };

            await interaction.reply({ embeds: [getEmbed(currentPage)], components: [getRow(currentPage)] });

            const filter = i => (
                i.user.id === userId &&
                (i.customId === 'claim_gift' || i.customId === 'claim_all_gifts' || i.customId === 'prev_page' || i.customId === 'next_page')
            );
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async btnInt => {
                try {
                    if (btnInt.customId === 'prev_page' && currentPage > 0) {
                        currentPage--;
                        try {
                            await btnInt.update({ embeds: [getEmbed(currentPage)], components: [getRow(currentPage)] });
                        } catch (err) {
                            if (err.code !== 10062) console.error('Pagination prev_page error:', err);
                        }
                        return;
                    }
                    if (btnInt.customId === 'next_page' && currentPage < pages.length - 1) {
                        currentPage++;
                        try {
                            await btnInt.update({ embeds: [getEmbed(currentPage)], components: [getRow(currentPage)] });
                        } catch (err) {
                            if (err.code !== 10062) console.error('Pagination next_page error:', err);
                        }
                        return;
                    }
                    if (btnInt.customId === 'claim_all_gifts') {
                        let users = loadUserData();
                        let claimedMessages = [];
                        let remainingGifts = [];
                        for (const gift of gifts) {
                            if (gift.type === 'ranked_reward') {
                                remainingGifts.push(gift);
                                claimedMessages.push(`Skipped Ranked Reward (ID: ${gift.id}) - requires manual selection.`);
                                continue;
                            }
                            const { message, claimedSuccessfully } = await claimSingleGift(gift, userId, users, giftData);
                            claimedMessages.push(`ID: ${gift.id} - ${message}`);
                            if (!claimedSuccessfully) {
                                remainingGifts.push(gift);
                            }
                        }
                        giftData[userId] = remainingGifts;
                        saveGiftData(giftData);
                        saveUserData(users);
                        let replyContent = '';
                        if (claimedMessages.join('\n').length > 1800) {
                            replyContent = claimedMessages.slice(0, 5).join('\n') + '\n...More...';
                        } else {
                            replyContent = claimedMessages.join('\n');
                        }
                        if (remainingGifts.length > 0) {
                            replyContent += "\n\nSome gifts could not be claimed automatically or require manual attention (e.g., Ranked Rewards, duplicate jutsu).";
                        } else {
                            replyContent += "\n\nAll eligible gifts claimed!";
                        }
                        try {
                            await btnInt.update({ content: replyContent, embeds: [], components: [] });
                        } catch (err) {
                            if (err.code !== 10062) console.error('Interaction update error:', err);
                        }
                        collector.stop();
                        return;
                    }
                    if (btnInt.customId === 'claim_gift') {
                        try {
                            await btnInt.reply({ content: "Enter the ID of the gift you want to claim." });
                        } catch (err) {
                            if (err.code !== 10062) console.error('Interaction reply error:', err);
                        }
                        const msgFilter = m => m.author.id === userId && /^\d+$/.test(m.content.trim());
                        const msgCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 60000, max: 1 });
                        msgCollector.on('collect', async msg => {
                            const claimId = parseInt(msg.content.trim(), 10);
                            const idx = gifts.findIndex(g => g.id === claimId);
                            if (idx === -1) {
                                try {
                                    await interaction.followUp({ content: "Invalid gift ID.", ephemeral: true });
                                } catch (err) {
                                    if (err.code !== 10062) console.error('FollowUp error:', err);
                                }
                                return;
                            }
                            const gift = gifts[idx];
                            let users = loadUserData();
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
                                try {
                                    await interaction.followUp({ embeds: [rewardEmbed], components: [rewardRow], ephemeral: true });
                                } catch (err) {
                                    if (err.code !== 10062) console.error('FollowUp error:', err);
                                }
                                const selectFilter = i => i.customId === 'ranked_reward_select' && i.user.id === userId;
                                const selectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000, max: 1 });
                                selectCollector.on('collect', async selectInt => {
                                    const choice = selectInt.values[0];
                                    let chosenReward = choice === 'reward1' ? reward1 : reward2;
                                    let rewardMsg = '';
                                    // ...existing code for reward logic...
                                    gifts.splice(idx, 1);
                                    giftData[userId] = gifts;
                                    saveGiftData(giftData);
                                    try {
                                        await selectInt.update({ content: `You claimed your ranked reward! ${rewardMsg}`, embeds: [], components: [] });
                                    } catch (err) {
                                        if (err.code !== 10062) console.error('SelectInt update error:', err);
                                    }
                                    collector.stop();
                                });
                                selectCollector.on('end', collected => {
                                    if (collected.size === 0) {
                                        try {
                                            interaction.followUp({ content: "Time out. Please try claiming again.", ephemeral: true });
                                        } catch (err) {
                                            if (err.code !== 10062) console.error('FollowUp error:', err);
                                        }
                                    }
                                });
                                return;
                            }
                            const { message } = await claimSingleGift(gift, userId, users, giftData);
                            gifts.splice(idx, 1);
                            giftData[userId] = gifts;
                            saveGiftData(giftData);
                            try {
                                await msg.reply({ content: message });
                            } catch (err) {
                                if (err.code !== 10062) console.error('Msg reply error:', err);
                            }
                            try {
                                await btnInt.editReply({ components: [] });
                            } catch (err) {
                                if (err.code !== 10062) console.error('EditReply error:', err);
                            }
                            collector.stop();
                        });
                        msgCollector.on('end', collected => {
                            if (collected.size === 0) {
                                try {
                                    interaction.followUp({ content: "You did not provide a gift ID in time.", ephemeral: true });
                                } catch (err) {
                                    if (err.code !== 10062) console.error('FollowUp error:', err);
                                }
                            }
                        });
                        return;
                    }
                } catch (err) {
                    if (err.code !== 10062) console.error('Collector handler error:', err);
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    try {
                        interaction.editReply({ content: "No interaction received, gift inventory display timed out.", embeds: [getEmbed(currentPage)], components: [] });
                    } catch (err) {
                        if (err.code !== 10062) console.error('EditReply error:', err);
                    }
                }
            });
        }
    }
};