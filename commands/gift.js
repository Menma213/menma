const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');

// --- Random reward pools ---
const RANDOM_JUTSUS = ["Fireball", "Rasengan", "Analysis"];
const RANDOM_SCROLLS = ["Needle Assault Scroll"];
const RANDOM_COMBOS = ["Basic Combo"];

// Utility to load and save gift.json
function loadGiftData() {
    if (!fs.existsSync(giftPath)) return {};
    return JSON.parse(fs.readFileSync(giftPath, 'utf8'));
}
function saveGiftData(data) {
    fs.writeFileSync(giftPath, JSON.stringify(data, null, 2));
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
    let jutsuData = fs.existsSync(jutsuPath) ? JSON.parse(fs.readFileSync(jutsuPath, 'utf8')) : {};
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
    fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));
}

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
            sub.setName('inventory')
                .setDescription('View and claim your gifts')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'money') {
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive." });
            if (target.id === userId) return interaction.reply({ content: "You can't gift yourself." });

            // Add to gift.json, not directly to user data
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
            // Only allow admins to use this subcommand
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: "Only admins can gift Shinobi Shards.", ephemeral: true });
            }
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const giftId = interaction.options.getInteger('id');
            if (amount <= 0) return interaction.reply({ content: "Amount must be positive." });
            if (target.id === userId) return interaction.reply({ content: "You can't gift yourself." });

            let giftData = loadGiftData();
            if (!giftData[target.id]) giftData[target.id] = [];
            // Ensure unique id for this user's gifts
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

        if (sub === 'inventory') {
            let giftData = loadGiftData();
            const gifts = giftData[userId] || [];
            if (gifts.length === 0) {
                return interaction.reply({ content: "You have no gifts to claim." });
            }

            // List gifts with ids
            let desc = gifts.map((g, i) => {
                if (g.type === 'ranked_reward' && g.reward) {
                    // Use display or name for both rewards
                    const r1 = g.reward.reward1.display || g.reward.reward1.name;
                    const r2 = g.reward.reward2.display || g.reward.reward2.name;
                    return `**ID:** ${g.id} | **Type:** Ranked Reward | **Choices:** ${r1} or ${r2}` +
                        (g.from ? ` | **From:** <@${g.from}>` : '');
                }
                return `**ID:** ${g.id} | **Type:** ${g.type === 'ss' ? 'Shinobi Shard' : g.type}` +
                    (g.type === 'money' || g.type === 'ss' ? ` | **Amount:** ${g.amount}` : '') +
                    (g.from ? ` | **From:** <@${g.from}>` : '');
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('Your Gifts')
                .setDescription(desc)
                .setColor('#FFD700');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_gift')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [embed], components: [row] });

            const filter = i => i.customId === 'claim_gift' && i.user.id === userId;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
            collector.on('collect', async btnInt => {
                await btnInt.reply({ content: "Enter the ID of the gift you want to claim." });

                const msgFilter = m => m.author.id === userId && /^\d+$/.test(m.content.trim());
                const msgCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 60000, max: 1 });
                msgCollector.on('collect', async msg => {
                    const claimId = parseInt(msg.content.trim(), 10);
                    const idx = gifts.findIndex(g => g.id === claimId);
                    if (idx === -1) {
                        await interaction.followUp({ content: "Invalid gift ID." });
                        return;
                    }
                    const gift = gifts[idx];

                    // --- Handle ranked_reward gifts ---
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

                        await interaction.followUp({ embeds: [rewardEmbed], components: [rewardRow] });

                        // Wait for user to select
                        const selectFilter = i => i.customId === 'ranked_reward_select' && i.user.id === userId;
                        const selectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000, max: 1 });
                        selectCollector.on('collect', async selectInt => {
                            const choice = selectInt.values[0];
                            let chosenReward = choice === 'reward1' ? reward1 : reward2;
                            let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                            let rewardMsg = '';

                            // --- Handle mystery box ---
                            if (chosenReward.box) {
                                const boxResult = openMysteryBox(chosenReward.box);
                                if (!users[userId]) users[userId] = {};
                                // Add to jutsu.json if needed
                                if (["jutsu", "combo", "scroll"].includes(boxResult.type)) {
                                    addToJutsuJson(userId, boxResult.type, boxResult.name);
                                    rewardMsg = `You received a **${boxResult.name}** from the mystery box!`;
                                } else if (boxResult.type === "ramen") {
                                    if (!users[userId].ramen) users[userId].ramen = 0;
                                    users[userId].ramen += boxResult.amount;
                                    rewardMsg = `You received **${boxResult.amount} ramen ticket(s)** from the mystery box!`;
                                } else {
                                    rewardMsg = `You received a reward from the mystery box!`;
                                }
                                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                            }
                            // --- Handle money reward (with random amount if min/max) ---
                            else if (chosenReward.name === 'Money' && chosenReward.amount) {
                                if (!users[userId].money) users[userId].money = 0;
                                let min = chosenReward.amount.min || 0;
                                let max = chosenReward.amount.max || min;
                                let amount = Math.floor(Math.random() * (max - min + 1)) + min;
                                users[userId].money += amount;
                                rewardMsg = `You received **${amount} Money**!`;
                                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                            }
                            // --- Handle ramen ticket reward ---
                            else if (chosenReward.name.toLowerCase().includes('ramen')) {
                                if (!users[userId].ramen) users[userId].ramen = 0;
                                users[userId].ramen += 1;
                                rewardMsg = `You received **1 ramen ticket**!`;
                                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                            }
                            // --- Handle random jutsu/scroll/combo ---
                            else if (chosenReward.name.toLowerCase().includes('random jutsu')) {
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
                            }
                            // --- Handle specific jutsu/scroll/combo ---
                            else if (chosenReward.name.toLowerCase().startsWith('jutsu:')) {
                                let jutsu = chosenReward.name.replace(/^jutsu:\s*/i, '');
                                addToJutsuJson(userId, "jutsu", jutsu);
                                rewardMsg = `You received **${jutsu}**!`;
                            } else if (chosenReward.name.toLowerCase().startsWith('scroll')) {
                                // If name_detail exists, use it, else fallback to name
                                let scroll = chosenReward.name_detail || chosenReward.name.replace(/^scroll:\s*/i, '');
                                addToJutsuJson(userId, "scroll", scroll);
                                rewardMsg = `You received **${scroll}**!`;
                            } else if (chosenReward.name.toLowerCase().startsWith('combo:')) {
                                let combo = chosenReward.name.replace(/^combo:\s*/i, '');
                                addToJutsuJson(userId, "combo", combo);
                                rewardMsg = `You received **${combo}**!`;
                            }
                            // --- Fallback ---
                            else {
                                rewardMsg = `You received **${chosenReward.name}**!`;
                            }

                            // Remove the gift after claiming
                            gifts.splice(idx, 1);
                            giftData[userId] = gifts;
                            saveGiftData(giftData);

                            await selectInt.reply({ content: `You claimed your ranked reward! ${rewardMsg}` });
                        });
                        return;
                    }

                    // --- Handle money and ss gifts as before ---
                    if (gift.type === 'money') {
                        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        if (!users[userId].money) users[userId].money = 0;
                        users[userId].money += gift.amount;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }
                    if (gift.type === 'ss') {
                        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        if (!users[userId].ss) users[userId].ss = 0;
                        users[userId].ss += gift.amount;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }
                    // Remove from gift.json
                    gifts.splice(idx, 1);
                    giftData[userId] = gifts;
                    saveGiftData(giftData);

                    await interaction.followUp({ content: `You claimed your gift (ID: ${claimId})!` });
                });
            });
        }
    }
};
