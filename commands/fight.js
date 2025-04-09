const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another player to a PvP battle')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('Select an opponent')
                .setRequired(true)
        ),

    async execute(interaction) {
        const challengerId = interaction.user.id;
        const opponentId = interaction.options.getUser('opponent').id;
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

        // Basic validations
        if (challengerId === opponentId) {
            return interaction.reply({ content: "You can't challenge yourself!", flags: [64] });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found. Please contact admin.", flags: [64] });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[challengerId] || !users[opponentId]) {
            return interaction.reply({ content: "Both players must be enrolled to fight!", flags: [64] });
        }

        // Create challenge embed
        const challengeEmbed = new EmbedBuilder()
            .setTitle('New Challenger!')
            .setDescription(`<@${opponentId}>, do you accept <@${challengerId}>'s challenge?`)
            .setColor('#FF0000')
            .setFooter({ text: 'Challenge expires in 60 seconds' });

        const challengeButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept-challenge')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline-challenge')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        // Send challenge in channel
        const challengeMessage = await interaction.reply({
            content: `<@${opponentId}>`,
            embeds: [challengeEmbed],
            components: [challengeButtons]
        });

        // Challenge collector
        const challengeCollector = challengeMessage.createMessageComponentCollector({ 
            filter: i => i.user.id === opponentId,
            time: 60000 
        });

        challengeCollector.on('collect', async i => {
            if (i.customId === 'decline-challenge') {
                await i.update({
                    content: 'Challenge declined!',
                    embeds: [],
                    components: []
                });
                return challengeCollector.stop();
            }

            // Challenge accepted - start battle
            await i.update({
                content: 'Challenge accepted!',
                embeds: [],
                components: []
            });

            // Initialize battle variables
            const challenger = users[challengerId];
            const opponent = users[opponentId];
            let currentRound = 1;
            let currentPlayer = challengerId; // Challenger goes first
            let battleActive = true;
            let challengerTransformation = false;
            let opponentTransformation = false;

            // Generate battle image function
            const generateBattleImage = async () => {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 700, height: 350 });

                const htmlContent = `
                    <html>
                    <body style="margin: 0; padding: 0; position: relative;">
                        <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                        
                        <div style="position: absolute; left: 50px; top: 50px;">
                            <img src="${interaction.user.displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                        </div>

                        <div style="position: absolute; right: 50px; top: 50px;">
                            <img src="${interaction.options.getUser('opponent').displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                        </div>

                        <div style="position: absolute; left: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                            <div style="width: ${(challenger.health / 1000) * 100}%; height: 100%; background: green;"></div>
                        </div>

                        <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                            <div style="width: ${(opponent.health / 1000) * 100}%; height: 100%; background: red;"></div>
                        </div>
                    </body>
                    </html>
                `;

                await page.setContent(htmlContent);
                const imagePath = `./battle_${challengerId}_${opponentId}.png`;
                await page.screenshot({ path: imagePath });
                await browser.close();
                return imagePath;
            };

            // Create moves embed
            const createMovesEmbed = (playerId) => {
                const player = playerId === challengerId ? challenger : opponent;
                const isCurrentPlayer = playerId === currentPlayer;
                
                const movesEmbed = new EmbedBuilder()
                    .setTitle(`Round ${currentRound} - ${isCurrentPlayer ? 'Your Turn' : 'Waiting'}`)
                    .setDescription(isCurrentPlayer ? 
                        `Select your move, <@${playerId}>!` : 
                        `Waiting for opponent to make their move...`)
                    .setColor('#0099ff')
                    .addFields({
                        name: 'Available Jutsu',
                        value: player.jutsu.map((j, i) => `${i+1}. ${j}`).join('\n')
                    })
                    .setFooter({ text: `Chakra: ${player.chakra}/10` });

                if (!isCurrentPlayer) {
                    return { embed: movesEmbed, components: [] };
                }

                const row = new ActionRowBuilder();
                
                // Basic attack button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('attack')
                        .setLabel('1. Attack')
                        .setStyle(ButtonStyle.Primary)
                );

                // Transformation Jutsu button
                if (player.chakra >= 5 && player.jutsu.includes('Transformation Jutsu')) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('transform')
                            .setLabel('2. Transform (5 Chakra)')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                // Rest button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('rest')
                        .setLabel('3. Rest (+1 Chakra)')
                        .setStyle(ButtonStyle.Secondary)
                );

                // Flee button
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('flee')
                        .setLabel('4. Flee')
                        .setStyle(ButtonStyle.Danger)
                );

                return { embed: movesEmbed, components: [row] };
            };

            // Process moves
            const processMove = async (move, playerId) => {
                const player = playerId === challengerId ? challenger : opponent;
                const opponentPlayer = playerId === challengerId ? opponent : challenger;
                let transformationActive = playerId === challengerId ? challengerTransformation : opponentTransformation;
                
                let damage = 0;
                let description = '';
                
                switch(move) {
                    case 'attack':
                        damage = Math.floor(2 * (player.power + (transformationActive ? 5 : 0)) / opponentPlayer.defense);
                        description = 'used Attack';
                        break;
                        
                    case 'transform':
                        if (player.chakra >= 5) {
                            player.chakra -= 5;
                            if (playerId === challengerId) {
                                challengerTransformation = true;
                            } else {
                                opponentTransformation = true;
                            }
                            description = 'used Transformation Jutsu';
                        }
                        break;
                        
                    case 'rest':
                        player.chakra = Math.min(player.chakra + 1, 10);
                        description = 'rested and gained +1 Chakra';
                        break;
                        
                    case 'flee':
                        battleActive = false;
                        description = 'fled from battle!';
                        break;
                }
                
                return { damage, description };
            };

            // Create round summary
            const createRoundSummary = (challengerMove, opponentMove) => {
                return new EmbedBuilder()
                    .setTitle(`Round ${currentRound} Summary`)
                    .setColor('#FFA500')
                    .addFields(
                        {
                            name: `${interaction.user.username}`,
                            value: `${challengerMove.description}\nDamage: ${challengerMove.damage || 0}`
                        },
                        {
                            name: `${interaction.options.getUser('opponent').username}`,
                            value: `${opponentMove.description}\nDamage: ${opponentMove.damage || 0}`
                        },
                        {
                            name: 'Battle Status',
                            value: `${interaction.user.username}: ${challenger.health.toFixed(0)} HP\n${interaction.options.getUser('opponent').username}: ${opponent.health.toFixed(0)} HP`
                        }
                    )
                    .setFooter({ text: `Chakra: ${challenger.chakra} | ${opponent.chakra}` });
            };

            // Main battle loop
            while (battleActive) {
                // Show battle image
                const battleImage = new AttachmentBuilder(await generateBattleImage());
                const battleMessage = await interaction.followUp({ 
                    files: [battleImage] 
                });

                // Current player move selection
                const currentPlayerId = currentPlayer;
                const moves = createMovesEmbed(currentPlayerId);
                const moveMessage = await interaction.followUp({
                    embeds: [moves.embed],
                    components: moves.components
                });

                const moveCollector = moveMessage.createMessageComponentCollector({
                    filter: i => i.user.id === currentPlayerId,
                    time: 30000
                });

                const moveResult = await new Promise(resolve => {
                    moveCollector.on('collect', async i => {
                        const result = await processMove(i.customId, currentPlayerId);
                        await i.update({
                            content: `You selected ${i.customId}`,
                            components: []
                        });
                        resolve(result);
                    });

                    moveCollector.on('end', () => {
                        if (!moveCollector.collected.size) {
                            resolve({ damage: 0, description: 'did nothing (timed out)' });
                        }
                    });
                });

                // Switch turns
                currentPlayer = currentPlayer === challengerId ? opponentId : challengerId;

                // If both players have moved, show summary
                if (currentPlayer === challengerId) {
                    const opponentMoves = createMovesEmbed(opponentId);
                    const opponentMoveMessage = await interaction.followUp({
                        embeds: [opponentMoves.embed],
                        components: opponentMoves.components
                    });

                    const opponentCollector = opponentMoveMessage.createMessageComponentCollector({
                        filter: i => i.user.id === opponentId,
                        time: 30000
                    });

                    const opponentResult = await new Promise(resolve => {
                        opponentCollector.on('collect', async i => {
                            const result = await processMove(i.customId, opponentId);
                            await i.update({
                                content: `You selected ${i.customId}`,
                                components: []
                            });
                            resolve(result);
                        });

                        opponentCollector.on('end', () => {
                            if (!opponentCollector.collected.size) {
                                resolve({ damage: 0, description: 'did nothing (timed out)' });
                            }
                        });
                    });

                    // Apply damage
                    challenger.health -= opponentResult.damage;
                    opponent.health -= moveResult.damage;

                    // Show round summary
                    const summaryEmbed = createRoundSummary(moveResult, opponentResult);
                    await interaction.followUp({ 
                        embeds: [summaryEmbed] 
                    });

                    // Check win conditions
                    if (challenger.health <= 0 || opponent.health <= 0) {
                        battleActive = false;
                        const winner = challenger.health > 0 ? challengerId : opponentId;
                        
                        // Update stats
                        users[winner].wins += 1;
                        users[winner === challengerId ? opponentId : challengerId].losses += 1;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        await interaction.followUp({ 
                            content: `<@${winner}> wins the battle!` 
                        });
                    }

                    currentRound++;
                }
            }
        });

        challengeCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ 
                    content: 'Challenge expired!', 
                    embeds: [], 
                    components: [] 
                });
            }
        });
    }
};