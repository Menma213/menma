const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('enroll')
        .setDescription('Enroll in the ninja world'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Ensure user data file exists
        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Check if user is already enrolled
        if (users[userId]) {
            return interaction.reply({ content: '❌ You are already enrolled!', ephemeral: true });
        }

        // Enrollment Embed
        const enrollEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Oh, you wish to become a Shinobi?')
            .setDescription('The path of a ninja is perilous and demanding. Do you have what it takes?')
            .addFields({ name: 'Choose wisely:', value: 'Press **"Accept"** to begin your journey or **"Decline"** to walk away.' })
            .setFooter({ text: 'Your journey begins now...' });

        // Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`accept-${userId}`)
                .setLabel('✅ Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`decline-${userId}`)
                .setLabel('❌ Decline')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the message
        await interaction.reply({ embeds: [enrollEmbed], components: [row] });

        // Button Collector
        const collector = interaction.channel.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: "This isn't your enrollment!", ephemeral: true });
            }

            if (i.customId === `accept-${userId}`) {
                // Register new user
                users[userId] = {
                    level: 1,
                    exp: 0,
                    wins: 0,
                    losses: 0,
                    rank: 'Genin',
                    clan: 'None',
                    bloodline: 'None',
                    health: 1000,
                    power: 100,
                    defense: 50,
                    chakra: 10,
                    jutsu: ['Attack', 'Transformation Jutsu'],
                    ramen: 1,
                    money: 500
                };
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                const npcName = 'Rogue Shinobi';

                // Battle Start Embed
                const battleEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(`Defeat ${npcName} to prove your worth!`)
                    .setDescription('The battle begins now... Show your strength!');

                await i.update({ embeds: [battleEmbed], components: [] });

                // Start the battle
                await startBattle(interaction, users, userId, npcName, {
                    health: 100,
                    power: 10,
                    defense: 10
                });

                collector.stop();
            } else if (i.customId === `decline-${userId}`) {
                await i.update({ content: '❌ Enrollment cancelled. Maybe next time...', embeds: [], components: [] });
                collector.stop();
            }
        });

        // Handle timeout
        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({ content: '❌ You did not respond in time. Enrollment cancelled.', embeds: [], components: [] });
            }
        });
    }
};

// Battle Function
async function startBattle(interaction, users, userId, npcName, npcStats) {
    let userStats = users[userId];
    let battleActive = true;

    const attackPower = 2; // Attack move multiplier
    const transformationMultiplier = 2; // Transformation Jutsu power multiplier
    let transformed = false; // Tracks if the user used Transformation Jutsu

    while (battleActive) {
        // Battle Embed
        const battleEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Battle Round')
            .setDescription(`**${interaction.user.username}** vs **${npcName}**`)
            .addFields(
                { name: 'Your HP', value: `${userStats.health}`, inline: true },
                { name: `${npcName}'s HP`, value: `${npcStats.health}`, inline: true },
                { name: 'Your Chakra', value: `${userStats.chakra}`, inline: true }
            )
            .setFooter({ text: 'React to select your move.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('transform')
                .setLabel('Transformation Jutsu')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.followUp({ embeds: [battleEmbed], components: [row] });

        // Move selection
        const moveCollector = interaction.channel.createMessageComponentCollector({ time: 30000, max: 1 });

        moveCollector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: "This isn't your battle!", ephemeral: true });
            }

            if (i.customId === 'attack') {
                const damage = Math.max(
                    0,
                    (userStats.power * attackPower) / npcStats.defense
                );

                npcStats.health -= damage;

                await i.update({ content: `You dealt **${damage}** damage to ${npcName}!`, components: [] });
            } else if (i.customId === 'transform' && userStats.chakra >= 5) {
                transformed = true;
                userStats.power *= transformationMultiplier;
                userStats.chakra -= 5;

                await i.update({ content: 'You used Transformation Jutsu! Your power temporarily doubled!', components: [] });
            } else {
                await i.update({ content: '❌ Not enough chakra for Transformation Jutsu!', components: [] });
            }

            moveCollector.stop();
        });

        // Enemy attack
        if (npcStats.health > 0) {
            const enemyDamage = Math.max(0, npcStats.power / userStats.defense);
            userStats.health -= enemyDamage;

            await interaction.followUp(`**${npcName}** attacked! You took **${enemyDamage}** damage.`);
        }

        // Check battle end conditions
        if (userStats.health <= 0 || npcStats.health <= 0) {
            battleActive = false;

            if (userStats.health > 0) {
                await interaction.followUp('✅ You defeated the Rogue Shinobi!');
            } else {
                await interaction.followUp('❌ You were defeated by the Rogue Shinobi...');
            }

            users[userId] = userStats; // Update user stats
            fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
        }
    }
}
