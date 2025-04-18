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
        // Initialize slots
        const slots = {
            challenger: {
                id: interaction.user.id,
                user: interaction.user,
                data: null,
                transformation: false
            },
            opponent: {
                id: interaction.options.getUser('opponent').id,
                user: interaction.options.getUser('opponent'),
                data: null,
                transformation: false
            },
            battle: {
                active: false,
                currentRound: 1,
                usersPath: path.resolve(__dirname, '../../menma/data/users.json'),
                interaction: interaction // Store the original interaction
            }
        };

        // Basic validations
        if (slots.challenger.id === slots.opponent.id) {
            return interaction.reply({ content: "You can't challenge yourself!", ephemeral: true });
        }

        if (!fs.existsSync(slots.battle.usersPath)) {
            return interaction.reply({ content: "Database not found. Please contact admin.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(slots.battle.usersPath, 'utf8'));
        if (!users[slots.challenger.id] || !users[slots.opponent.id]) {
            return interaction.reply({ content: "Both players must be enrolled to fight!", ephemeral: true });
        }

        // Load player data into slots
        slots.challenger.data = { ...users[slots.challenger.id] };
        slots.opponent.data = { ...users[slots.opponent.id] };

        // Challenge phase
        const challengeEmbed = new EmbedBuilder()
            .setTitle('New Challenger!')
            .setDescription(`<@${slots.opponent.id}>, do you accept <@${slots.challenger.id}>'s challenge?`)
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

        try {
            const challengeMessage = await interaction.reply({
                content: `<@${slots.opponent.id}>`,
                embeds: [challengeEmbed],
                components: [challengeButtons],
                fetchReply: true
            });

            const challengeCollector = challengeMessage.createMessageComponentCollector({ 
                filter: i => i.user.id === slots.opponent.id,
                time: 60000 
            });

            challengeCollector.on('collect', async i => {
                try {
                    if (i.customId === 'decline-challenge') {
                        await i.update({
                            content: 'Challenge declined!',
                            embeds: [],
                            components: []
                        });
                        return challengeCollector.stop();
                    }

                    // Challenge accepted - start battle
                    await i.deferUpdate(); // Defer the interaction first
                    slots.battle.active = true;
                    await runBattle(slots);
                } catch (error) {
                    console.error('Error in challenge collector:', error);
                    if (!i.deferred && !i.replied) {
                        await i.reply({ content: 'An error occurred while processing your response!', ephemeral: true });
                    }
                }
            });

            challengeCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    try {
                        await interaction.editReply({ 
                            content: 'Challenge expired!', 
                            embeds: [], 
                            components: [] 
                        });
                    } catch (error) {
                        console.error('Error editing expired challenge:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error setting up challenge:', error);
            await interaction.followUp({ content: 'An error occurred while setting up the challenge!', ephemeral: true });
        }
    }
};

async function runBattle(slots) {
    const { interaction } = slots.battle;

    // Battle functions
    const generateBattleImage = async () => {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 700, height: 350 });

        const htmlContent = `
            <html>
            <body style="margin: 0; padding: 0; position: relative;">
                <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                
                <div style="position: absolute; left: 50px; top: 50px;">
                    <img src="${slots.challenger.user.displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                </div>

                <div style="position: absolute; right: 50px; top: 50px;">
                    <img src="${slots.opponent.user.displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                </div>

                <div style="position: absolute; left: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                    <div style="width: ${(slots.challenger.data.health / 1000) * 100}%; height: 100%; background: green;"></div>
                </div>

                <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                    <div style="width: ${(slots.opponent.data.health / 1000) * 100}%; height: 100%; background: red;"></div>
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        const imagePath = `./battle_${slots.challenger.id}_${slots.opponent.id}.png`;
        await page.screenshot({ path: imagePath });
        await browser.close();
        return imagePath;
    };

    const createMoveOptions = (playerSlot) => {
        const availableJutsu = Object.values(playerSlot.data.jutsu).filter(j => j !== "None");
        
        const embed = new EmbedBuilder()
            .setTitle(`Round ${slots.battle.currentRound} - ${playerSlot.user.username}'s Turn`)
            .setDescription(`Select your move!`)
            .setColor('#0099ff')
            .addFields({
                name: 'Available Jutsu',
                value: availableJutsu.length > 0 ? 
                    availableJutsu.map((j, i) => `${i+1}. ${j}`).join('\n') : 
                    'No jutsu available'
            })
            .setFooter({ text: `Chakra: ${playerSlot.data.chakra}/10` });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('rest')
                .setLabel('Rest (+1 Chakra)')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Danger)
        );

        if (playerSlot.data.chakra >= 5 && availableJutsu.includes('Transformation Jutsu')) {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId('transform')
                    .setLabel('Transform (5 Chakra)')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        return { 
            embed, 
            components: [row1, row2].filter(row => row.components.length > 0)
        };
    };

    const processMove = async (move, playerSlot) => {
        const opponentSlot = playerSlot === slots.challenger ? slots.opponent : slots.challenger;
        let damage = 0;
        let description = '';
        
        switch(move) {
            case 'attack':
                damage = Math.floor(2 * (playerSlot.data.power + (playerSlot.transformation ? 5 : 0)) / opponentSlot.data.defense);
                description = 'used Attack';
                break;
                
            case 'transform':
                if (playerSlot.data.chakra >= 5) {
                    playerSlot.data.chakra -= 5;
                    playerSlot.transformation = true;
                    description = 'used Transformation Jutsu';
                }
                break;
                
            case 'rest':
                playerSlot.data.chakra = Math.min(playerSlot.data.chakra + 1, 10);
                description = 'rested and gained +1 Chakra';
                break;
                
            case 'flee':
                slots.battle.active = false;
                description = 'fled from battle!';
                break;
        }
        
        return { damage, description };
    };

    const createRoundSummary = (challengerMove, opponentMove) => {
        return new EmbedBuilder()
            .setTitle(`Round ${slots.battle.currentRound} Summary`)
            .setColor('#FFA500')
            .addFields(
                {
                    name: `${slots.challenger.user.username}`,
                    value: `${challengerMove.description}\nDamage: ${challengerMove.damage || 0}`
                },
                {
                    name: `${slots.opponent.user.username}`,
                    value: `${opponentMove.description}\nDamage: ${opponentMove.damage || 0}`
                },
                {
                    name: 'Battle Status',
                    value: `${slots.challenger.user.username}: ${slots.challenger.data.health.toFixed(0)} HP\n${slots.opponent.user.username}: ${slots.opponent.data.health.toFixed(0)} HP`
                }
            )
            .setFooter({ text: `Chakra: ${slots.challenger.data.chakra} | ${slots.opponent.data.chakra}` });
    };

    async function getPlayerMove(playerSlot) {
        const { embed, components } = createMoveOptions(playerSlot);
        let message;
        
        try {
            message = await interaction.followUp({
                content: `<@${playerSlot.id}> it's your turn!`,
                embeds: [embed],
                components: components,
                fetchReply: true
            });
        } catch (error) {
            console.error('Error sending move options:', error);
            return 'attack'; // Default to attack if there's an error
        }

        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === playerSlot.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    resolve(i.customId);
                } catch (error) {
                    console.error('Error processing move:', error);
                    resolve('attack');
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    resolve('attack');
                }
            });
        });
    }

    // Main battle loop
    while (slots.battle.active) {
        try {
            // Show battle image
            const battleImage = new AttachmentBuilder(await generateBattleImage());
            await interaction.followUp({ files: [battleImage] });

            // Challenger's turn
            const challengerMove = await getPlayerMove(slots.challenger);
            const challengerResult = await processMove(challengerMove, slots.challenger);

            if (!slots.battle.active) {
                await interaction.followUp({ content: `<@${slots.challenger.id}> fled from battle!` });
                break;
            }

            // Opponent's turn
            const opponentMove = await getPlayerMove(slots.opponent);
            const opponentResult = await processMove(opponentMove, slots.opponent);

            if (!slots.battle.active) {
                await interaction.followUp({ content: `<@${slots.opponent.id}> fled from battle!` });
                break;
            }

            // Apply damage
            slots.challenger.data.health -= opponentResult.damage;
            slots.opponent.data.health -= challengerResult.damage;

            // Show round summary
            const summaryEmbed = createRoundSummary(challengerResult, opponentResult);
            await interaction.followUp({ embeds: [summaryEmbed] });

            // Check win conditions
            if (slots.challenger.data.health <= 0 || slots.opponent.data.health <= 0) {
                slots.battle.active = false;
                const winner = slots.challenger.data.health > 0 ? slots.challenger : slots.opponent;
                
                // Update stats
                const users = JSON.parse(fs.readFileSync(slots.battle.usersPath, 'utf8'));
                users[winner.id].wins += 1;
                users[winner === slots.challenger ? slots.opponent.id : slots.challenger.id].losses += 1;
                fs.writeFileSync(slots.battle.usersPath, JSON.stringify(users, null, 2));

                await interaction.followUp({ content: `<@${winner.id}> wins the battle!` });
            }

            slots.battle.currentRound++;
        } catch (error) {
            console.error('Error in battle loop:', error);
            slots.battle.active = false;
            await interaction.followUp({ content: 'An error occurred during the battle! The fight has been stopped.' });
            break;
        }
    }
}