const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const jutsuJsonPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

function getAllJutsuNames() {
    const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
    return Object.keys(jutsus);
}

function getUserJutsu(userId) {
    if (!fs.existsSync(jutsuJsonPath)) return [];
    const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));
    return (jutsuData[userId] && Array.isArray(jutsuData[userId].usersjutsu)) ? jutsuData[userId].usersjutsu : [];
}

function addGift(userId, jutsuName) {
    let giftData = fs.existsSync(giftPath) ? JSON.parse(fs.readFileSync(giftPath, 'utf8')) : {};
    if (!giftData[userId]) giftData[userId] = [];
    let id;
    do {
        id = Math.floor(Math.random() * 5000) + 1;
    } while (giftData[userId].some(g => g.id === id));
    giftData[userId].push({
        id,
        type: 'jutsu',
        name: jutsuName,
        from: 'BetaEvent',
        date: Date.now()
    });
    fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
}

function deductMoney(userId, amount) {
    let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    if (!users[userId]) users[userId] = {};
    users[userId].money = (users[userId].money || 0) - amount;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function hasEnoughMoney(userId, amount) {
    let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    return users[userId] && typeof users[userId].money === 'number' && users[userId].money >= amount;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Participate in the Beta Testing Event: Common Jutsus Spin!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const eventName = "Beta Testing Event";
        const spinName = "Common Jutsus Spin";
        const spinCost = 1;

        const eventEmbed = new EmbedBuilder()
            .setTitle('Beta Testing Event: Common Jutsus Spin')
            .setDescription(
                `Test your luck and try out all the jutsus!\n\n` +
                `**Spin Cost:** 1 RYO per spin\n` +
                `**Spin x10:** 10 RYO for 10 spins\n\n` +
                `You will receive a random jutsu you don't already own. Duplicates are not given.`
            )
            .setImage('https://static.wikia.nocookie.net/naruto/images/c/c0/Amenomihashira.png/revision/latest?cb=20160721141416')
            .setFooter({ text: 'Beta Testing Event | Ends soon!' })
            .setColor(0xFFD700);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('spin_1')
                .setLabel('Spin')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('spin_10')
                .setLabel('Spin x10')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [eventEmbed], components: [row], ephemeral: false });

        const filter = i => ['spin_1', 'spin_10'].includes(i.customId) && i.user.id === userId;
        try {
            const btn = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
            await btn.deferUpdate();

            const spins = btn.customId === 'spin_10' ? 10 : 1;
            const totalCost = spinCost * spins;

            if (!hasEnoughMoney(userId, totalCost)) {
                await interaction.followUp({ content: `You don't have enough RYO! You need ${totalCost} RYO.`, ephemeral: true });
                return;
            }

            // Deduct money
            deductMoney(userId, totalCost);

            // Get all jutsu names and user's owned jutsu
            const allJutsu = getAllJutsuNames();
            const ownedJutsu = getUserJutsu(userId);

            // Filter out already owned jutsu
            let availableJutsu = allJutsu.filter(j => !ownedJutsu.includes(j));
            if (availableJutsu.length === 0) {
                await interaction.followUp({ content: "You already own all jutsus in the event!", ephemeral: true });
                return;
            }

            // Pick up to 'spins' unique jutsu
            let results = [];
            for (let i = 0; i < spins && availableJutsu.length > 0; i++) {
                const idx = Math.floor(Math.random() * availableJutsu.length);
                results.push(availableJutsu[idx]);
                availableJutsu.splice(idx, 1);
            }

            // Send spinning embed
            const spinningEmbed = new EmbedBuilder()
                .setTitle(`${username} is spinning a ${spinName}!`)
                .setDescription(`Please wait... Spinning for ${spins} jutsu(s) in the **${eventName}**!`)
                .setColor(0x00BFFF)
                .setFooter({ text: 'Results will be revealed in 5 seconds.' });

            const spinMsg = await interaction.followUp({ embeds: [spinningEmbed], fetchReply: true });

            // Wait 5 seconds (5000 ms)
            setTimeout(async () => {
                // Add each jutsu as a separate gift (if not already owned)
                let added = [];
                for (const jutsu of results) {
                    // Double-check user doesn't own it (in case of race condition)
                    const currentOwned = getUserJutsu(userId);
                    if (!currentOwned.includes(jutsu)) {
                        addGift(userId, jutsu);
                        added.push(jutsu);
                    }
                }
                const resultEmbed = new EmbedBuilder()
                    .setTitle(`${username}'s ${spinName} Results!`)
                    .setDescription(
                        added.length > 0
                            ? `You received:\n${added.map(j => `• **${j}**`).join('\n')}\n\nClaim them from your gift inventory!`
                            : "You already own all possible jutsus. No new jutsu was added."
                    )
                    .setColor(0x43B581)
                    .setFooter({ text: 'Beta Testing Event' });
                await spinMsg.edit({ embeds: [resultEmbed] });
            }, 3000); //5 seconds

        } catch {
            // Button not pressed in time
            await interaction.followUp({ content: "You didn't spin in time. Run /event again!", ephemeral: true });
        }
    }
};
