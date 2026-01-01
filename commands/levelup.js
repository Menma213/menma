const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { userMutex } = require('../utils/locks');

const usersPath = path.resolve(__dirname, '../data/users.json');
const playersPath = path.resolve(__dirname, '../data/players.json');

async function getAkatsukiWebhook(channel) {
    try {
        const webhooks = await channel.fetchWebhooks();
        let akatsukiWebhook = webhooks.find(wh => wh.name === 'The Akatsuki' || wh.name === 'Mysterious Entity');
        if (!akatsukiWebhook) {
            akatsukiWebhook = await channel.createWebhook({
                name: 'Mysterious Entity',
                avatar: 'https://cdn.shopify.com/s/files/1/0568/2298/8958/files/image1_b48d6300-3717-4b53-846f-6ddef8f6acc1_480x480.png?v=1712888667',
            });
        }
        return akatsukiWebhook;
    } catch (err) {
        if (err.code === 50013) throw new Error('MISSING_WEBHOOK_PERMISSIONS');
        throw err;
    }
}

async function safeWebhookSend(channel, webhook, sendOptions) {
    try {
        return await webhook.send(sendOptions);
    } catch (err) {
        if (err.code === 10015) {
            const newWebhook = await getAkatsukiWebhook(channel);
            return await newWebhook.send(sendOptions);
        }
        if (err.code === 50013) throw new Error('MISSING_WEBHOOK_PERMISSIONS');
        throw err;
    }
}

function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2;
    return (1 + currentLevel) * (Math.floor(currentLevel / 100) + 2);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelup')
        .setDescription('Attempt to level up your ninja skills with accumulated EXP.')
        .addSubcommand(subcommand => subcommand.setName('one').setDescription('Consumes EXP for one level up.'))
        .addSubcommand(subcommand => subcommand.setName('all').setDescription('Consumes all available EXP to level up.')),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const subCommand = interaction.options.getSubcommand();

        await userMutex.runExclusive(async () => {
            const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
            const players = JSON.parse(await fs.readFile(playersPath, 'utf8'));

            if (!users[userId] || !players[userId]) {
                return interaction.editReply("You must enroll first!");
            }

            const player = users[userId];
            const playerData = players[userId];

            playerData.level = Number(playerData.level) || 1;
            playerData.exp = Number(playerData.exp) || 0;
            player.health = Number(player.health) || 100;
            player.power = Number(player.power) || 10;
            player.defense = Number(player.defense) || 5;

            const originalStats = {
                level: playerData.level,
                health: player.health,
                power: player.power,
                defense: player.defense
            };

            let levelsGained = 0;
            let totalExpConsumed = 0;

            if (subCommand === 'one') {
                const requiredExp = getExpRequirement(playerData.level);
                if (playerData.exp < requiredExp) {
                    return interaction.editReply(`You need **${requiredExp.toLocaleString()} EXP** for next level. Current: ${playerData.exp.toLocaleString()}`);
                }
                playerData.level++;
                playerData.exp -= requiredExp;
                totalExpConsumed = requiredExp;
                levelsGained = 1;

                player.health += Math.floor(Math.random() * 2) + 2;
                player.power += Math.floor(Math.random() * 2) + 3;
                player.defense += Math.floor(Math.random() * 2) + 1;
            } else {
                while (true) {
                    const req = getExpRequirement(playerData.level);
                    if (playerData.exp < req) break;
                    playerData.exp -= req;
                    totalExpConsumed += req;
                    playerData.level++;
                    levelsGained++;
                    player.health += Math.floor(Math.random() * 2) + 2;
                    player.power += Math.floor(Math.random() * 2) + 3;
                    player.defense += Math.floor(Math.random() * 2) + 1;
                }
                if (levelsGained === 0) {
                    return interaction.editReply(`Not enough EXP. Need **${getExpRequirement(playerData.level).toLocaleString()}**.`);
                }
            }

            await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
            await fs.writeFile(playersPath, JSON.stringify(players, null, 2));

            const levelUpEmbed = new EmbedBuilder()
                .setColor('#FF9800')
                .setTitle(`⬆️ Level Up! Reached Level ${playerData.level}!`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: 'Progress', value: `Levels: ${originalStats.level} ➡️ ${playerData.level}\nEXP Consumed: ${totalExpConsumed.toLocaleString()}` },
                    { name: 'Stats', value: `\`\`\`diff\n+ Health: ${player.health} (+${player.health - originalStats.health})\n+ Power: ${player.power} (+${player.power - originalStats.power})\n+ Defense: ${player.defense} (+${player.defense - originalStats.defense})\n\`\`\`` }
                );

            await interaction.editReply({ embeds: [levelUpEmbed] });

            if (playerData.level >= 250 && originalStats.level < 250) {
                try {
                    const wh = await getAkatsukiWebhook(interaction.channel);
                    await safeWebhookSend(interaction.channel, wh, {
                        content: '||The Akatsuki are watching. Chosen your path yet?||',
                        username: 'Mysterious Entity'
                    });
                } catch (e) { }
            }
        });
    }
};