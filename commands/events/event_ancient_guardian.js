const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { runBattle } = require('../combinedcommands.js'); // Assuming combinedcommands.js is in the parent directory

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event_ancient_guardian')
        .setDescription('Encounter the Ancient Guardian of the Whispering Ruins!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        // Define the unique NPC
        const npc = {
            name: 'Chronos, the Time Weaver',
            description: 'An ethereal being made of starlight and ancient sand, Chronos guards the secrets of forgotten ages. Its voice is a gentle hum, and its presence bends time itself.',
            health: 500, // Example health
            attack: 50, // Example attack
            defense: 25, // Example defense
            avatarURL: 'https://i.imgur.com/your_unique_npc_avatar.png' // Replace with a real image URL if available, otherwise it will fallback
        };

        // Construct the embed for the event
        const eventEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('The Ancient Guardian Appears!')
            .setDescription(`As you explore the Whispering Ruins, a shimmering portal opens, and **${npc.name}** materializes before you! \n\n"${npc.description}"\n\nIt seems to be a test of your strength and resolve. Do you dare to challenge it?`)
            .setThumbnail(npc.avatarURL || 'https://via.placeholder.com/150/cccccc/ffffff?text=Fallback+NPC') // Fallback image
            .setImage('https://i.imgur.com/your_event_background.png'); // Optional background image for the event

        // Create action buttons
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accept_battle')
                    .setLabel('Accept the Challenge')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('decline_event')
                    .setLabel('Turn Back')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send the initial message with buttons
        await interaction.reply({
            embeds: [eventEmbed],
            components: [actionRow]
        });

        // Create a message collector to listen for button interactions
        const filter = (i) => i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 }); // 30 seconds to respond

        collector.on('collect', async (i) => {
            if (i.customId === 'accept_battle') {
                await i.deferUpdate(); // Defer update to prevent the original message from disappearing

                // Simulate a battle using the runBattle function
                const battleResult = await runBattle(
                    userId,
                    userName,
                    {
                        health: 100, // Player's base health for this battle
                        attack: 30, // Player's base attack for this battle
                        defense: 10 // Player's base defense for this battle
                    },
                    npc
                );

                // Define rewards
                let moneyReward = 0;
                let expReward = 0;
                let ramenReward = 0;
                let ssReward = false;

                if (battleResult.won) {
                    // Calculate rewards based on battle outcome (can be more complex)
                    moneyReward = Math.floor(Math.random() * 200) + 50; // 50-250 money
                    expReward = Math.floor(Math.random() * 150) + 25; // 25-175 exp
                    ramenReward = Math.floor(Math.random() * 5) + 1; // 1-5 ramen

                    // Small chance for SS
                    if (Math.random() < 0.05) { // 5% chance
                        ssReward = true;
                    }

                    let rewardMessage = `You have defeated **${npc.name}!`;
                    if (moneyReward > 0) rewardMessage += `\n💰 You received ${moneyReward} coins.`;
                    if (expReward > 0) rewardMessage += `\n✨ You gained ${expReward} experience.`;
                    if (ramenReward > 0) rewardMessage += `\n🍜 You found ${ramenReward} bowls of ramen.`;
                    if (ssReward) rewardMessage += `\n🌟 **You also found a rare Special Stone!**`;

                    const winEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('Victory!')
                        .setDescription(rewardMessage);

                    await i.editReply({ embeds: [winEmbed], components: [] });
                } else {
                    const loseEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Defeat...')
                        .setDescription(`**${npc.name}** proved too powerful! You were forced to retreat.`);
                    await i.editReply({ embeds: [loseEmbed], components: [] });
                }
                collector.stop(); // Stop the collector after a decision is made

            } else if (i.customId === 'decline_event') {
                await i.update({
                    content: 'You decided not to challenge the Ancient Guardian and continued your journey.',
                    embeds: [],
                    components: []
                });
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    content: 'You took too long to decide, and the Ancient Guardian vanished.',
                    embeds: [],
                    components: []
                }).catch(console.error); // Handle potential errors if reply was already edited
            }
        });
    },
};