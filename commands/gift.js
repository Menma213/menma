const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

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

        if (sub === 'inventory') {
            let giftData = loadGiftData();
            const gifts = giftData[userId] || [];
            if (gifts.length === 0) {
                return interaction.reply({ content: "You have no gifts to claim." });
            }

            // List gifts with ids
            let desc = gifts.map((g, i) =>
                `**ID:** ${g.id} | **Type:** ${g.type}` +
                (g.type === 'money' ? ` | **Amount:** ${g.amount}` : '') +
                (g.from ? ` | **From:** <@${g.from}>` : '')
            ).join('\n');

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

            // Wait for claim button
            const filter = i => i.customId === 'claim_gift' && i.user.id === userId;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
            collector.on('collect', async btnInt => {
                await btnInt.reply({ content: "Enter the ID of the gift you want to claim." });

                // Wait for message with id
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

                    // Claim logic: for money, add to user data
                    if (gift.type === 'money') {
                        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        if (!users[userId].money) users[userId].money = 0;
                        users[userId].money += gift.amount;
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
