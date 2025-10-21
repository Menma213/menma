const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const jutsuJsonPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

const DROP_TABLE = [
    { name: 'Guillotine Drop', type: 'jutsu', chance: 0.001, color: 0xFFD700 },
    { name: 'Explosive Paper Clone', type: 'jutsu', chance: 0.03, color: 0xFF4500 },
    { name: 'Kirin: Lightning Storm', type: 'jutsu', chance: 0.03, color: 0xFF4500 },
    { name: 'Shadow Clone Jutsu: 1000 clones', type: 'jutsu', chance: 0.05, color: 0x1E90FF },
    { name: 'Lightning Hound', type: 'jutsu', chance: 0.10, color: 0x00BFFF },
    { name: '1000 exp', type: 'exp', amount: 1000, chance: 0.09, color: 0x43B581 },
    { name: '500 exp', type: 'exp', amount: 500, chance: 0.10, color: 0x43B581 },
    { name: '100 exp', type: 'exp', amount: 100, chance: 0.15, color: 0x43B581 },
    { name: '100k money', type: 'money', amount: 100000, chance: 0.05, color: 0xFFD700 },
    { name: '50k money', type: 'money', amount: 50000, chance: 0.10, color: 0xFFEA00 },
    { name: '10 ramen', type: 'ramen', amount: 10, chance: 0.05, color: 0xFFB347 },
    { name: '5 ramen', type: 'ramen', amount: 5, chance: 0.10, color: 0xFFB347 },
    { name: '10,000 exp', type: 'exp', amount: 10000, chance: 0.009, color: 0xFFD700 },
    { name: '15 ramen', type: 'ramen', amount: 15, chance: 0.04, color: 0xFFB347 },
    { name: '5 Crystalline Shards', type: 'shard', amount: 5, chance: 0.05, color: 0x00FFFF },
    { name: '10 Crystalline Shards', type: 'shard', amount: 10, chance: 0.04, color: 0x00FFFF },
    { name: '25 Crystalline Shards', type: 'shard', amount: 25, chance: 0.01, color: 0xFFD700 }
];

const AY_TOKEN = 'Ay Token';
const SINGLE_COST = 10;
const TEN_COST = 100;

function getUserJutsu(userId) {
    if (!fs.existsSync(jutsuJsonPath)) return [];
    const jutsuData = JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8'));
    return (jutsuData[userId] && Array.isArray(jutsuData[userId].usersjutsu)) ? jutsuData[userId].usersjutsu : [];
}

function addJutsu(userId, jutsuName) {
    let jutsuData = fs.existsSync(jutsuJsonPath) ? JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8')) : {};
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], items: {} };
    if (!jutsuData[userId].usersjutsu.includes(jutsuName)) {
        jutsuData[userId].usersjutsu.push(jutsuName);
    }
    fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 2));
}

function addItem(userId, itemName, amount) {
    let jutsuData = fs.existsSync(jutsuJsonPath) ? JSON.parse(fs.readFileSync(jutsuJsonPath, 'utf8')) : {};
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], items: {} };
    if (!jutsuData[userId].items) jutsuData[userId].items = {};
    jutsuData[userId].items[itemName] = (jutsuData[userId].items[itemName] || 0) + amount;
    fs.writeFileSync(jutsuJsonPath, JSON.stringify(jutsuData, null, 2));
}

function loadPlayer(userId) {
    let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
    if (!players[userId]) players[userId] = { ss: 0, money: 0, exp: 0, ramen: 0 };
    return players[userId];
}

function savePlayer(userId, data) {
    let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
    players[userId] = { ...players[userId], ...data };
    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
}

function deductSS(userId, amount) {
    let player = loadPlayer(userId);
    player.ss = (player.ss || 0) - amount;
    savePlayer(userId, player);
}

function hasEnoughSS(userId, amount) {
    let player = loadPlayer(userId);
    return (player.ss || 0) >= amount;
}

function addReward(userId, drop) {
    if (drop.type === 'jutsu') {
        if (!getUserJutsu(userId).includes(drop.name)) {
            addJutsu(userId, drop.name);
            return ` **${drop.name}** (Jutsu)`;
        }
        return null;
    }
    if (drop.type === 'exp') {
        let player = loadPlayer(userId);
        player.exp = (player.exp || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount} EXP**`;
    }
    if (drop.type === 'money') {
        let player = loadPlayer(userId);
        player.money = (player.money || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount.toLocaleString()} Ryo**`;
    }
    if (drop.type === 'ramen') {
        let player = loadPlayer(userId);
        player.ramen = (player.ramen || 0) + drop.amount;
        savePlayer(userId, player);
        return ` **${drop.amount} Ramen**`;
    }
    if (drop.type === 'shard') {
        addItem(userId, 'Crystalline Shard', drop.amount);
        return `**${drop.amount} Crystalline Shards**`;
    }
    return null;
}

function getDrop() {
    let roll = Math.random();
    let acc = 0;
    for (const drop of DROP_TABLE) {
        acc += drop.chance;
        if (roll < acc) return drop;
    }
    // fallback to lowest rarity
    return DROP_TABLE[DROP_TABLE.length - 1];
}

function getRarestColor(drops) {
    let rarest = drops.reduce((a, b) => (a.chance < b.chance ? a : b));
    return rarest.color;
}

function getDropListText() {
    return DROP_TABLE.map(d => {
        let percent = (d.chance * 100).toFixed(2);
        let type = d.type === 'jutsu' ? 'Jutsu' : d.type.charAt(0).toUpperCase() + d.type.slice(1);
        return `• **${d.name}** (${type}) — ${percent}%`;
    }).join('\n');
}

function loadUser(userId) {
    let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    if (!users[userId]) users[userId] = {};
    return users[userId];
}

function saveUser(userId, data) {
    let users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
    users[userId] = { ...users[userId], ...data };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Raikage: A Summon Event!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Check for raikagevent intro
        const user = loadUser(userId);
        if (!user.raikagevent) {
            // 4-page intro sequence
            const pages = [
                {
                    title: "The Fourth Raikage, A",
                    description: `The Fourth Raikage, A was partnered with a powerful Shinobi called "Killer Bee" Which made the famous duo "A-B" combo. A's time as the raikage was pure dominance and his strong desire to protect his village. Known for his speed and agility, A was actually groomed to the Raikage position by his own father, The Third Raikage.`,
                    color: 0xFF9800,
                    image: 'https://i.postimg.cc/5t0YXs7Y/image.png'
                },
                {
                    title: "The Kage Summit",
                    description: `Pains invasion of the hidden leaf village shook all the nations. It was quite clear that the Akatsuki weren't messing around. But then..came war.`,
                    color: 0xFF9800,
                    image: 'https://i.postimg.cc/3rpy04BB/image.png'
                },
                {
                    title: "Revenge for his Brother",
                    description: `The war began and fights broke out everywhere. Raikage A did his job and defeated all the rogue ninjas..until he met Sasuke. Killer Bee was Raikage A's adopted brother and more importantly his partner in battle. Raikage was happy when he found out Sasuke tried to kidnap Killer Bee for his jinchuriki.`,
                    color: 0xFF9800,
                    image: 'https://static.wikia.nocookie.net/naruto/images/8/80/A_and_B.png/revision/latest?cb=20210804203035'
                },
                {
                    title: "The Raikage vs Sasuke & Guillotine Drop",
                    description: `The Raikage fights Sasuke and his Mangekyou Sharingan. Sasuke manages to put up a decent fight against the raikage using his Susanoo. That's when "Guillotin Drop" was created.\n\nGuillotine Drop is an "ultimate jutsu", the rarest jutsu type. This jutsu while may look similar to any other attack has a unique mechanism called "armor pen" which ignores some of your enemies armor making it really strong in fights.\nGet your hands on it now!`,
                    color: 0xFF9800,
                    image: 'https://i.postimg.cc/GpHFW315/image.png'
                }
            ];

            let page = 0;
            const sendPage = async (edit = false) => {
                const embed = new EmbedBuilder()
                    .setTitle(pages[page].title)
                    .setDescription(pages[page].description)
                    .setColor(pages[page].color)
                    .setFooter({ text: `Page ${page + 1}/4` });
                if (pages[page].image) embed.setImage(pages[page].image);
                let row;
                if (page < pages.length - 1) {
                    row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('raikagevent_next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                    );
                } else {
                    row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('raikagevent_finish')
                            .setLabel('Finish')
                            .setStyle(ButtonStyle.Success)
                    );
                }
                if (edit) {
                    await interaction.editReply({ embeds: [embed], components: [row] });
                } else {
                    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
                }
            };

            await sendPage();

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => ['raikagevent_next', 'raikagevent_finish'].includes(i.customId) && i.user.id === userId,
                time: 120000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId === 'raikagevent_next') {
                    page++;
                    await sendPage(true);
                } else if (i.customId === 'raikagevent_finish') {
                    saveUser(userId, { raikagevent: true });
                    // Show a simple embed instead of clearing everything
                    const doneEmbed = new EmbedBuilder()
                        .setTitle("Raikage Event Intro Complete!")
                        .setDescription("You're ready! Use `/event` again to summon.")
                        .setColor(0xFF9800);
                    await interaction.editReply({ embeds: [doneEmbed], components: [] });
                    collector.stop();
                }
            });

            collector.on('end', async () => {
                // Clean up if needed
            });
            return;
        }

        // Initial embed
        const eventEmbed = new EmbedBuilder()
            .setTitle('Raikage: A Summon Event')
            .setDescription(
                `Obtain Raikage A's Jutsu: Guillotine Drop!\n\n` +
                `**All Possible Drops:**\n${getDropListText()}\n\n` +
                `**Guaranteed:** Ay Token (used in event shop)\n\n` +
                `**Prices:**\n• 10 SS — Single Summon\n• 100 SS — 10x Summon\n\n` +
                `Summon for a chance to obtain rare jutsu, shards, exp, ramen, and more!\n` 
            )
            .setImage('https://i.postimg.cc/fRMZ26Zp/image.png')
            .setColor(0xFFD700)
            .setFooter({ text: 'Raikage: A Summon | Ends soon!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('summon_1')
                .setLabel('Summon')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('summon_10')
                .setLabel('Summon x10')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [eventEmbed], components: [row], ephemeral: false });

        const filter = i => ['summon_1', 'summon_10'].includes(i.customId) && i.user.id === userId;
        try {
            const btn = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
            await btn.deferUpdate();

            const spins = btn.customId === 'summon_10' ? 10 : 1;
            const totalCost = spins === 10 ? TEN_COST : SINGLE_COST;

            if (!hasEnoughSS(userId, totalCost)) {
                await interaction.followUp({ content: `You don't have enough SS! You need ${totalCost} SS.`, ephemeral: true });
                return;
            }

            // Deduct SS from players.json
            deductSS(userId, totalCost);

            // Animation: color-changing embed
            const animColors = [0xFFD700, 0x00BFFF, 0xFF4500, 0x43B581, 0xFFEA00, 0xFFB347, 0x00FFFF];
            let animIdx = 0;
            const animEmbed = new EmbedBuilder()
                .setTitle(`${username} is summoning...`)
                .setDescription(`Summoning ${spins} time(s)...!`)
                .setImage('https://media.tenor.com/2hQhXQwQyQwAAAAd/raikage-naruto.gif')
                .setColor(animColors[animIdx])
                .setFooter({ text: 'Summoning...' });

            const animMsg = await interaction.followUp({ embeds: [animEmbed], fetchReply: true });

            // Animate for 3 seconds, changing color every 0.5s
            let interval = setInterval(() => {
                animIdx = (animIdx + 1) % animColors.length;
                animEmbed.setColor(animColors[animIdx]);
                animMsg.edit({ embeds: [animEmbed] });
            }, 500);

            setTimeout(async () => {
                clearInterval(interval);

                // Perform spins
                let results = [];
                let resultText = [];
                let rarestDrop = null;
                for (let i = 0; i < spins; i++) {
                    let drop;
                    let tries = 0;
                    do {
                        drop = getDrop();
                        tries++;
                        // If jutsu, check if user already owns it
                        if (drop.type === 'jutsu' && getUserJutsu(userId).includes(drop.name)) drop = null;
                    } while (!drop && tries < 10);
                    if (!drop) drop = DROP_TABLE.find(d => d.type !== 'jutsu'); // fallback to non-jutsu
                    results.push(drop);
                    if (!rarestDrop || drop.chance < rarestDrop.chance) rarestDrop = drop;
                    let rewardStr = addReward(userId, drop);
                    if (rewardStr) resultText.push(rewardStr);
                }

                // Add Ay Token(s)
                addItem(userId, AY_TOKEN, spins);
                resultText.push(`**${spins} Ay Token${spins > 1 ? 's' : ''}**`);

                // Final result embed
                const resultEmbed = new EmbedBuilder()
                    .setTitle(`${username}'s Raikage: A Summon Results!`)
                    .setDescription(
                        resultText.length > 0
                            ? `You received:\n${resultText.join('\n')}\n\nClaim jutsu and shards from your inventory!`
                            : "No new rewards this time."
                    )
                    .setColor(rarestDrop ? rarestDrop.color : 0xFFD700)
                    .setImage('https://media.tenor.com/2hQhXQwQyQwAAAAd/raikage-naruto.gif')
                    .setFooter({ text: 'Raikage: A Summon Event' });

                await animMsg.edit({ embeds: [resultEmbed] });
            }, 3000);

        } catch {
            await interaction.followUp({ content: "You didn't summon in time. Run /event again!", ephemeral: true });
        }
    }
};
