const {
    SlashCommandBuilder
} = require('discord.js');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('amongus')
        .setDescription('A social ating impostors.'),
    async execute(interaction, client) {
        // This is a simplified, single-player "Among Us" experience.
        // A full multiplayer Among Us requires complex state management and communication,
        // which is beyond the scope of a single Discord bot command.

        const crewmateEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Among Us - Solo Mission')
            .setDescription('You are a crewmate on a mission. Your goal is to complete tasks and identify the impostor among you. Watch out for suspicious behavior!')
            .addFields({
                name: 'Current Task',
                value: 'Scan your boarding pass at the Entrance.',
                inline: false
            }, {
                name: 'Suspicion Meter',
                value: 'Low',
                inline: true
            }, {
                name: 'Reported Bodies',
                value: '0',
                inline: true
            });

        const impostorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Among Us - Impostor Role')
            .setDescription('You are the impostor! Your goal is to eliminate crewmates without being caught. Sabotage systems and create chaos.')
            .addFields({
                name: 'Elimination Target',
                value: 'Scan your boarding pass at the Entrance.',
                inline: false
            }, {
                name: 'Sabotage Options',
                value: 'Available',
                inline: true
            });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                .setCustomId('complete_task')
                .setLabel('Complete Task')
                .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                .setCustomId('report_body')
                .setLabel('Report Body')
                .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                .setCustomId('accuse')
                .setLabel('Accuse Player')
                .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                .setCustomId('sabotage')
                .setLabel('Sabotage')
                .setStyle(ButtonStyle.Danger)
            );

        // Randomly assign role for a pseudo-impostor experience
        const isImpostor = Math.random() < 0.3; // 30% chance of being impostor

        let embed = isImpostor ? impostorEmbed : crewmateEmbed;

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            ephemeral: true
        });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        }); // 60 seconds timeout

        let tasksCompleted = 0;
        const totalTasks = 5;
        let suspicionLevel = 0;
        let impostorDetected = false;
        let gameEnded = false;

        collector.on('collect', async i => {
            if (gameEnded) return;

            if (i.customId === 'complete_task') {
                if (isImpostor) {
                    await i.reply({
                        content: "You can't complete tasks as an impostor! Try to sabotage or eliminate.",
                        ephemeral: true
                    });
                    return;
                }
                tasksCompleted++;
                crewmateEmbed.spliceFields(0, 1, {
                    name: 'Current Task',
                    value: `Task ${tasksCompleted}/${totalTasks} completed.`,
                    inline: false
                });
                await i.update({
                    embeds: [crewmateEmbed],
                    components: [buttons]
                });

                if (tasksCompleted === totalTasks) {
                    await i.followUp("All tasks completed! Crewmates win!");
                    gameEnded = true;
                    collector.stop();
                }
            } else if (i.customId === 'report_body') {
                if (!isImpostor) {
                    suspicionLevel++;
                    crewmateEmbed.spliceFields(1, 1, {
                        name: 'Suspicion Meter',
                        value: `${suspicionLevel}/3`,
                        inline: true
                    });
                    await i.update({
                        embeds: [crewmateEmbed],
                        components: [buttons]
                    });
                    if (suspicionLevel >= 3) {
                        await i.followUp("You've been too suspicious! You've been ejected.");
                        gameEnded = true;
                        collector.stop();
                    }
                } else {
                    await i.reply({
                        content: "You found a body! Quick, call a meeting!",
                        ephemeral: true
                    });
                    // In a real game, this would trigger a meeting. Here, we simulate a win for the impostor.
                    await i.followUp("You found a body and caused enough chaos. Impostors win!");
                    gameEnded = true;
                    collector.stop();
                }
            } else if (i.customId === 'accuse') {
                // In a single player game, accusing is difficult. We'll simulate a false accusation.
                await i.reply({
                    content: "You pointed fingers, but nobody was ejected. Suspicious...",
                    ephemeral: true
                });
                suspicionLevel++;
                crewmateEmbed.spliceFields(1, 1, {
                    name: 'Suspicion Meter',
                    value: `${suspicionLevel}/3`,
                    inline: true
                });
                await i.update({
                    embeds: [crewmateEmbed],
                    components: [buttons]
                });
                if (suspicionLevel >= 3) {
                    await i.followUp("You've been too suspicious! You've been ejected.");
                    gameEnded = true;
                    collector.stop();
                }
            } else if (i.customId === 'sabotage') {
                if (!isImpostor) {
                    await i.reply({
                        content: "You're not the impostor! You can't sabotage.",
                        ephemeral: true
                    });
                    return;
                }
                // Simulate a successful sabotage
                impostorDetected = true; // For this simplified version, sabotage automatically implies impostor success
                impostorEmbed.spliceFields(1, 1, {
                    name: 'Sabotage Options',
                    value: 'Successfully sabotaged!',
                    inline: true
                });
                await i.update({
                    embeds: [impostorEmbed],
                    components: [buttons]
                });
                await i.followUp("You sabotaged the ship! Impostors win!");
                gameEnded = true;
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (!gameEnded) {
                interaction.editReply({
                    content: 'Game timed out. No actions taken.',
                    embeds: [],
                    components: []
                });
            }
        });
    },
};