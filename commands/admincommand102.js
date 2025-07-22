const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');

// === CONFIGURABLE ===
const GUILD_ID = '1381268582595297321'; // Set your guild/server ID here
const ADMIN_ROLE_ID = '1381268854776529028'; // Set your admin role ID here
const SPAWN_CHANCE = 0.07; // 1.0 = 100% (for testing), set to 0.03 for 3% chance
// const SPAWN_CHANCE = 0.03; // 3% chance per message (uncomment for production)
const REWARDS = [
    { type: 'money', amount: 1, name: '1 Money', desc: 'A single coin. HEHEHEHEH!', weight: 30 },
    { type: 'money', amount: 10000, name: '10,000 Money', desc: 'A nice stack of cash!', weight: 20 },
    { type: 'money', amount: 100000, name: '100,000 Money', desc: 'A big pile of money!', weight: 10 },
    { type: 'ramen', min: 1, max: 5, name: 'Ramen Ticket(s)', desc: 'A delicious bowl of ramen.!', weight: 15 },
    { type: 'combo', name: 'Dance of the Shadows', desc: 'HOLY! :eyes:!', weight: 2 },
    { type: 'ss', amount: 100, name: '100 Shinobi Shards', desc: "You've found the greatest treasure!", weight: 1 }
];
// ====================

function pickReward() {
    const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const reward of REWARDS) {
        if (rand < reward.weight) return reward;
        rand -= reward.weight;
    }
    return REWARDS[0];
}

function addGift(userId, reward) {
    const giftData = fs.existsSync(giftPath) ? JSON.parse(fs.readFileSync(giftPath, 'utf8')) : {};
    if (!giftData[userId]) giftData[userId] = [];
    const id = Math.floor(Math.random() * 50000) + 1000;
    const now = Date.now();
    let giftObj = { id, from: 'admincommand102', date: now };
    if (reward.type === 'money') {
        giftObj.type = 'money';
        giftObj.amount = reward.amount;
    } else if (reward.type === 'ramen') {
        giftObj.type = 'ramen';
        giftObj.amount = reward.min === reward.max ? reward.min : (Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min);
    } else if (reward.type === 'combo') {
        giftObj.type = 'combo';
        giftObj.name = reward.name;
    } else if (reward.type === 'ss') {
        giftObj.type = 'ss';
        giftObj.amount = reward.amount;
    }
    giftData[userId].push(giftObj);
    fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));
    return giftObj;
}

module.exports = {
    name: 'admincommand102',
    description: 'Enables random drops for official server.',
    data: new SlashCommandBuilder()
        .setName('admincommand102')
        .setDescription('Enables random drops for the official server.'),
    async execute(interaction) {
        // Only allow users with the admin role
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }
        await interaction.reply({ content: 'Random drop event is now active.', ephemeral: false });
    },
    setup(client) {
        // Track messages that have already triggered a drop
        const droppedMessages = new Set();

        client.on(Events.MessageCreate, async (message) => {
            // Only in the specified guild, ignore bots
            if (!message.guild || message.guild.id !== GUILD_ID) return;
            if (message.author.bot) return;

            // Prevent multiple drops per message
            if (droppedMessages.has(message.id)) return;

            // Only check random once per message
            if (Math.random() > SPAWN_CHANCE) return;

            droppedMessages.add(message.id);

            const reward = pickReward();
            let displayName = reward.name;
            let displayDesc = reward.desc;
            let displayAmount = reward.amount;
            if (reward.type === 'ramen') {
                displayAmount = reward.min === reward.max ? reward.min : (Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min);
                displayName = `${displayAmount} Ramen Ticket${displayAmount > 1 ? 's' : ''}`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`Oh ${message.author.username}! You found ${displayName}! Congratulations!`)
                .setDescription(displayDesc)
                .setFooter({ text: 'Claim it before anyone else can!' })
                .setColor(0xFFD700);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`claim_giveaway_${message.id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
            );

            const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

            // Claim button logic
            const filter = i => i.customId === `claim_giveaway_${message.id}`;
            const collector = sentMsg.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async btnInt => {
                // Add to gift.json
                const giftObj = addGift(btnInt.user.id, reward);
                await btnInt.reply({ content: `You claimed your reward! Check your gift inventory. (Gift ID: ${giftObj.id})`, ephemeral: true });
                // Disable button after claim
                await sentMsg.edit({ components: [new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true)
                )] });
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    // Disable button after timeout
                    await sentMsg.edit({ components: [new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true)
                    )] });
                }
            });
        });
    }
};
