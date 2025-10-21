const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('amoguus')
        .setDescription('A Discord-baare used to divide imposters and crewmates.'),
    async execute(interaction) {
        const players = [];
        const MAX_PLAYERS = 3;
        const IMPOSERS_COUNT = 1; // In a 3-player game, 1 imposter is usually good.

        const joinButton = new ButtonBuilder()
            .setCustomId('join_amoguus')
            .setLabel('Join Game')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(joinButton);

        const embed = new EmbedBuilder()
            .setTitle('Amoguus - The Social Deduction Game')
            .setDescription(`A game for ${MAX_PLAYERS} players. Click the button to join!`)
            .addFields({
                name: 'Players Joined',
                value: 'None yet!'
            })
            .setColor('Blurple');

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'join_amoguus' && !i.isMessageComponent() && i.user.id === interaction.user.id, // Only allow the command invoker to start
            max: 1, // Only one person needs to click to start setup
            time: 60000 // 1 minute to start
        });

        let gameStarted = false;

        collector.on('collect', async i => {
            if (gameStarted) return;
            gameStarted = true;

            await i.update({
                content: 'Game starting! Waiting for players...',
                embeds: [],
                components: []
            });

            const initialEmbed = new EmbedBuilder()
                .setTitle('Amoguus - Waiting for Players')
                .setDescription(`Click the button to join the game. Max players: ${MAX_PLAYERS}`)
                .addFields({
                    name: 'Players Joined',
                    value: `${interaction.user.username}`
                })
                .setColor('Blurple');

            const joinRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId('join_game_button')
                .setLabel('Join')
                .setStyle(ButtonStyle.Success)
            );

            const startEmbed = new EmbedBuilder()
                .setTitle('Amoguus - Game Setup')
                .setDescription('Players are joining. Click the button to join!')
                .addFields({
                    name: 'Players',
                    value: `${interaction.user.username}`
                })
                .setColor('Blurple');

            const startGameRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId('start_game_button')
                .setLabel('Start Game')
                .setStyle(ButtonStyle.Danger)
            );

            const initialMessage = await interaction.followUp({
                embeds: [startEmbed],
                components: [joinRow, startGameRow]
            });

            const gameCollector = interaction.channel.createMessageComponentCollector({
                filter: msgInteraction => msgInteraction.user.id !== interaction.user.id, // Everyone else can join
                time: 120000 // 2 minutes for players to join
            });

            const playersInGame = [interaction.user.id]; // Add the invoker

            gameCollector.on('collect', async msgInteraction => {
                if (msgInteraction.customId === 'join_game_button') {
                    if (playersInGame.length < MAX_PLAYERS) {
                        if (!playersInGame.includes(msgInteraction.user.id)) {
                            playersInGame.push(msgInteraction.user.id);
                            const updatedEmbed = new EmbedBuilder()
                                .setTitle('Amoguus - Waiting for Players')
                                .setDescription(`Click the button to join the game. Max players: ${MAX_PLAYERS}`)
                                .addFields({
                                    name: 'Players Joined',
                                    value: playersInGame.map(id => `<@${id}>`).join('\n') || 'None yet!'
                                })
                                .setColor('Blurple');

                            // Find the current embed message to update
                            const messages = await interaction.channel.messages.fetch({ limit: 10 });
                            const targetMessage = messages.find(msg => msg.id === initialMessage.id);

                            if (targetMessage) {
                                await targetMessage.edit({ embeds: [updatedEmbed] });
                            }

                            await msgInteraction.reply({ content: 'You have joined the game!', ephemeral: true });
                        } else {
                            await msgInteraction.reply({ content: 'You are already in the game!', ephemeral: true });
                        }
                    } else {
                        await msgInteraction.reply({ content: 'The game is full!', ephemeral: true });
                    }
                } else if (msgInteraction.customId === 'start_game_button') {
                    if (msgInteraction.user.id === interaction.user.id) {
                        if (playersInGame.length >= 2) { // Need at least 2 players to start
                            gameCollector.stop(); // Stop the joining collector

                            // Shuffle players to determine roles
                            const shuffledPlayers = playersInGame.sort(() => 0.5 - Math.random());
                            const imposters = shuffledPlayers.slice(0, IMPOSERS_COUNT);
                            const crewmates = shuffledPlayers.slice(IMPOSERS_COUNT);

                            // Announce roles ephemerally
                            await interaction.user.send({ content: 'Your role has been determined!', ephemeral: true }); // Redundant for invoker, but good practice

                            // Send role information to each player
                            for (const playerId of playersInGame) {
                                const isImpster = imposters.includes(playerId);
                                const role = isImpster ? 'Imposter' : 'Crewmate';
                                const embedRole = new EmbedBuilder()
                                    .setTitle('Your Amoguus Role')
                                    .setDescription(`You are a ${role}!`)
                                    .setColor(isImpster ? 'Red' : 'Green');

                                const user = await interaction.client.users.fetch(playerId);
                                await user.send({ embeds: [embedRole] });
                            }

                            // Finalize the game message
                            const finalEmbed = new EmbedBuilder()
                                .setTitle('Amoguus - Game Started!')
                                .setDescription('Roles have been assigned and sent via DM. Good luck!')
                                .addFields({
                                    name: 'Players',
                                    value: playersInGame.map(id => `<@${id}>`).join('\n')
                                })
                                .addFields({
                                    name: 'Imposters',
                                    value: imposters.map(id => `<@${id}>`).join(', ')
                                })
                                .setColor('Purple');

                            await initialMessage.edit({
                                embeds: [finalEmbed],
                                components: [] // Remove buttons
                            });

                            await interaction.followUp({
                                content: 'The game has started! Check your DMs for your role.',
                                ephemeral: true
                            });
                        } else {
                            await msgInteraction.reply({ content: 'You need at least 2 players to start the game!', ephemeral: true });
                        }
                    } else {
                        await msgInteraction.reply({ content: 'Only the game host can start the game!', ephemeral: true });
                    }
                }
            });

            gameCollector.on('end', collected => {
                if (playersInGame.length < MAX_PLAYERS) {
                    // If the collector ends due to time, and not enough players joined
                    initialMessage.edit({
                        content: 'Game timed out. Not enough players joined.',
                        embeds: [],
                        components: []
                    });
                }
            });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !gameStarted) {
                interaction.editReply({
                    content: 'Game creation timed out. No one joined.',
                    embeds: [],
                    components: []
                }).catch(() => {}); // Ignore if message was already deleted or edited
            }
        });
    },
};