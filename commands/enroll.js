const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('enroll')
        .setDescription('Enroll in the ninja world and face your first trial'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
        const enemyImage = "https://image.tmdb.org/t/p/original/o33WNqmy81CX1QaHXpYl5oQVGE4.jpg";
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        const inventoryPath = path.resolve(__dirname, '../../menma/data/inventory.json');
        const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');

        // Initialize files if they don't exist
        if (!fs.existsSync(usersPath)) {
            fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));
        }
        if (!fs.existsSync(inventoryPath)) {
            fs.writeFileSync(inventoryPath, JSON.stringify({}, null, 2));
        }
        if (!fs.existsSync(jutsuPath)) {
            fs.writeFileSync(jutsuPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        let inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
        let jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));

        // Check if user is already enrolled
        if (users[userId]) {
            return interaction.reply({ 
                content: "You are already enrolled! Use /profile to view your stats.", 
                ephemeral: true 
            });
        }

        // Create enrollment embed
        const enrollEmbed = new EmbedBuilder()
            .setColor('#006400')
            .setTitle('Your Journey Awaits')
            .setDescription('Before you can begin your path as a shinobi, you must pass the Academy Trial by defeating a rogue ninja!')
            .addFields(
                { name: 'The Path of the Shinobi', value: 'Defeat the rogue ninja to prove your worth and begin your journey!' },
                { name: 'How will you begin?', value: 'Press "Accept" to begin your trial or "Decline" to stay behind.' }
            )
            .setImage('https://static1.cbrimages.com/wordpress/wp-content/uploads/2020/03/Konohagakure.jpg')
            .setFooter({ text: 'Only the worthy will become shinobi!' });

        // Create accept/decline buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`accept-${userId}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`decline-${userId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [enrollEmbed], components: [row] });

        // Button collector
        const collector = interaction.channel.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (!i.customId.startsWith('accept-') && !i.customId.startsWith('decline-')) return;
            if (i.user.id !== userId) return i.reply({ content: "This isn't your enrollment!", ephemeral: true });

            if (i.customId === `accept-${userId}`) {
                // Create user profile with slot-based jutsu
                users[userId] = {
                    level: 1,
                    exp: 0,
                    wins: 0,
                    losses: 0,
                    rankedPoints: 0,
                    clan: 'None',
                    bloodline: 'Unknown',
                    mentor: 'None',
                    rank: 'Academy Student',
                    health: 1000,
                    power: 100,
                    defense: 50,
                    chakra: 10,
                    jutsu: {
                        slot_0: 'Attack',
                        slot_1: 'Transformation Jutsu',
                        slot_2: 'None',
                        slot_3: 'None',
                        slot_4: 'None',
                        slot_5: 'None'
                    },
                    money: 10000,
                    ramen: 1
                };
                
                // Add to inventory
                inventory[userId] = {
                    usersjutsu: ['Transformation Jutsu']
                };

                // Add to jutsu.json
                if (!jutsuData[userId]) {
                    jutsuData[userId] = {
                        usersjutsu: ['Transformation Jutsu']
                    };
                } else if (!jutsuData[userId].usersjutsu.includes('Transformation Jutsu')) {
                    jutsuData[userId].usersjutsu.push('Transformation Jutsu');
                }

                // Save all files
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
                fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));

                await i.update({ 
                    content: 'You have accepted the trial! Prepare for battle...', 
                    components: [] 
                });

                // Start battle
                await this.startBattle(interaction, userId, userAvatar, enemyImage);
            } else {
                await i.update({ 
                    content: 'You chose to remain in the shadows... Maybe next time.', 
                    components: [] 
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({ 
                    content: 'Enrollment timed out. Try again later.', 
                    components: [] 
                });
            }
        });
    },

    async startBattle(interaction, userId, userAvatar, enemyImage) {
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        let player = users[userId];

        // Process player move
        const processPlayerMove = (move) => {
            let damage = 0;
            let description = '';
            let chakraCost = 0;
            
            if (move === 'attack') {
                damage = 2 * (player.power + (transformationActive ? 5 : 0));
                description = 'used Attack';
            } 
            else if (move === 'transform') {
                chakraCost = 5;
                if (player.chakra >= chakraCost) {
                    player.chakra -= chakraCost;
                    transformationActive = true;
                    transformationRounds = 3;
                    description = 'used Transformation Jutsu';
                } else {
                    return { 
                        damage: 0, 
                        description: 'failed to perform jutsu (not enough chakra)',
                        specialEffects: ['Chakra exhausted!']
                    };
                }
            }

            return { 
                damage, 
                description,
                chakraCost
            };
        };

        // Process enemy move
        const processEnemyMove = () => {
            const damage = 11 * enemy.power / player.defense;
            return { 
                damage, 
                description: 'used Shuriken Throw' 
            };
        };

        // Create moves embed with slot-based jutsu
        const createMovesEmbed = () => {
            const jutsuSlots = Object.entries(player.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([slot, jutsu]) => `${slot.replace('_', ' ')}: ${jutsu}`)
                .join('\n');

            const movesEmbed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} - Select Your Move`)
                .setColor('#0099ff')
                .setDescription(`${interaction.user.username}, It is your turn!\nUse the buttons to make your move.`)
                .addFields(
                    { 
                        name: 'Your Jutsu Slots', 
                        value: jutsuSlots || 'No jutsu equipped'
                    }
                )
                .setFooter({ text: `Chakra: ${player.chakra}/10` });

            const row = new ActionRowBuilder();
            
            // Attack button (always available)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${userId}-${roundNum}`)
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Primary)
            );

            // Transformation Jutsu button if available and has chakra
            if (Object.values(player.jutsu).includes('Transformation Jutsu') && player.chakra >= 5) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`transform-${userId}-${roundNum}`)
                        .setLabel('Transform (5 Chakra)')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Rest button
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rest-${userId}-${roundNum}`)
                    .setLabel('Rest (+1 Chakra)')
                    .setStyle(ButtonStyle.Success)
            );

            // Flee button
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`flee-${userId}-${roundNum}`)
                    .setLabel('Flee')
                    .setStyle(ButtonStyle.Danger)
            );

            return { embed: movesEmbed, components: [row] };
        };

        // Rogue Ninja stats
        let enemy = {
            name: "Rogue Ninja",
            health: 400,
            power: 80,
            defense: 40,
            currentHealth: 400,
            jutsu: ["Shuriken Throw"]
        };

        // Battle variables
        let roundNum = 1;
        let transformationActive = false;
        let transformationRounds = 0;

        // Create round summary
        const createRoundSummary = (playerMove, enemyMove) => {
            return new EmbedBuilder()
                .setTitle(`Round ${roundNum}`)
                .setColor('#0099ff')
                .setDescription(
                    `${interaction.user.username} ${playerMove.description} for ${playerMove.damage.toFixed(0)} damage\n` +
                    `${enemy.name} ${enemyMove.description} for ${enemyMove.damage.toFixed(0)} damage`
                )
                .addFields(
                    { 
                        name: 'Battle Status', 
                        value: `${interaction.user.username} | ${player.health.toFixed(0)} HP  ${enemy.name} | ${enemy.currentHealth.toFixed(0)} HP`
                    }
                )
                .setFooter({ text: `Chakra: ${player.chakra}` });
        };

        // Check battle status
        const checkBattleStatus = async () => {
            if (player.health <= 0) {
                return { 
                    content: `Defeat! You were defeated by the rogue ninja.`, 
                    components: [] 
                };
            }
            if (enemy.currentHealth <= 0) {
                // Update user stats on victory
                player.wins += 1;
                player.exp += 100;
                player.money += 5000;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                
                return { 
                    content: `Victory! You defeated the rogue ninja!\nRewards:\n+100 EXP\n+5000 Money`, 
                    components: [] 
                };
            }
            
            // Passive chakra regeneration
            player.chakra = Math.min(player.chakra + 2, 10);
            
            // Update transformation status
            if (transformationActive) {
                transformationRounds -= 1;
                if (transformationRounds <= 0) {
                    transformationActive = false;
                }
            }
            
            roundNum += 1;
            return null;
        };

        // Add improved generateBattleImage function here
        const generateBattleImage = async ({ userId, userAvatar, enemyImage, playerHealth, playerMaxHealth, enemyHealth, enemyMaxHealth, roundNum }) => {
            const puppeteer = require('puppeteer');
            const path = require('path');
            const fs = require('fs');
            const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setViewport({ width: 800, height: 400 });

            const playerHealthPercent = Math.max((playerHealth / playerMaxHealth) * 100, 0);
            const npcHealthPercent = Math.max((enemyHealth / enemyMaxHealth) * 100, 0);

            // Create images directory if it doesn't exist
            const imagesDir = path.resolve(__dirname, '../images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            const htmlContent = `
                <html>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .battle-container {
                        width: 800px;
                        height: 400px;
                        position: relative;
                        background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat;
                        background-size: cover;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    .character {
                        position: absolute;
                        width: 150px;
                        height: 150px;
                        border-radius: 10px;
                        border: 3px solid #6e1515;
                        object-fit: cover;
                    }
                    .player {
                        right: 50px;
                        top: 120px;
                    }
                    .enemy {
                        left: 50px;
                        top: 120px;
                    }
                    .name-tag {
                        position: absolute;
                        width: 150px;
                        text-align: center;
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 18px;
                        font-weight: bold;
                        text-shadow: 2px 2px 4px #000;
                        top: 80px;
                        background: rgba(0,0,0,0.5);
                        border-radius: 5px;
                        padding: 2px 0;
                    }
                    .player-name {
                        right: 50px;
                    }
                    .enemy-name {
                        left: 50px;
                    }
                    .health-bar {
                        position: absolute;
                        width: 150px;
                        height: 22px;
                        background-color: #333;
                        border-radius: 5px;
                        overflow: hidden;
                        top: 280px;
                    }
                    .health-fill {
                        height: 100%;
                    }
                    .npc-health-fill {
                        background-color: #ff4444;
                        width: ${npcHealthPercent}%;
                    }
                    .player-health-fill {
                        background-color: #4CAF50;
                        width: ${playerHealthPercent}%;
                    }
                    .health-text {
                        position: absolute;
                        width: 100%;
                        text-align: center;
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 13px;
                        line-height: 22px;
                        text-shadow: 1px 1px 1px black;
                    }
                    .player-health {
                        right: 50px;
                    }
                    .enemy-health {
                        left: 50px;
                    }
                    .vs-text {
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-family: Arial, sans-serif;
                        font-size: 48px;
                        font-weight: bold;
                        text-shadow: 2px 2px 4px #000;
                    }
                </style>
                <body>
                    <div class="battle-container">
                        <div class="name-tag enemy-name">Rogue Ninja</div>
                        <img class="character enemy" src="${enemyImage}">
                        <div class="health-bar enemy-health">
                            <div class="health-fill npc-health-fill"></div>
                            <div class="health-text">${Math.round(enemyHealth)}/${enemyMaxHealth}</div>
                        </div>
                        
                        <div class="name-tag player-name">${interaction.user.username}</div>
                        <img class="character player" src="${userAvatar}">
                        <div class="health-bar player-health">
                            <div class="health-fill player-health-fill"></div>
                            <div class="health-text">${Math.round(playerHealth)}/${playerMaxHealth}</div>
                        </div>
                        <div class="vs-text">VS</div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(htmlContent);
            const imagePath = path.join(imagesDir, `battle_${userId}_${Date.now()}.png`);
            await page.screenshot({ path: imagePath });
            const buffer = fs.readFileSync(imagePath);
            await browser.close();
            return buffer;
        };

        // Main battle loop
        const battleCollector = interaction.channel.createMessageComponentCollector({ time: 300000 });

        // Initial moves selection
        const { embed: movesEmbed, components } = createMovesEmbed();
        const battleImageBuffer = await generateBattleImage({
            userId,
            userAvatar,
            enemyImage,
            playerHealth: player.health,
            playerMaxHealth: 1000,
            enemyHealth: enemy.currentHealth,
            enemyMaxHealth: enemy.health,
            roundNum
        });
        const battleImage = new AttachmentBuilder(battleImageBuffer, { name: `battle_scene_${userId}.png` });

        // Send the initial round embed as a new message
        let lastBattleMsg = await interaction.followUp({ 
            content: 'Battle Started! Defeat the rogue ninja to complete your enrollment!', 
            embeds: [movesEmbed], 
            components, 
            files: [battleImage] 
        });

        battleCollector.on('collect', async (i) => {
            if (!i.customId.includes(userId)) return i.reply({ content: "This isn't your battle!", ephemeral: true });
            await i.deferUpdate();

            // Remove buttons from previous message (if any)
            if (lastBattleMsg) {
                await lastBattleMsg.edit({ components: [] }).catch(() => {});
            }

            // Extract the base action from the custom ID
            const action = i.customId.split('-')[0];

            let playerMove, enemyMove;

            if (action === 'attack') {
                playerMove = processPlayerMove('attack');
                enemy.currentHealth -= playerMove.damage;

                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
            } 
            else if (action === 'transform') {
                playerMove = processPlayerMove('transform');
                if (playerMove.description.includes('failed')) {
                    // Edit the last reply since we've already deferred
                    await interaction.editReply({ content: playerMove.description, embeds: [], components: [] });
                    battleCollector.stop();
                    return;
                }
                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
            }
            else if (action === 'rest') {
                player.chakra = Math.min(player.chakra + 1, 10);
                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
                playerMove = { 
                    damage: 0, 
                    description: 'rested and gained +1 Chakra',
                    specialEffects: ['+1 Chakra']
                };
            }
            else if (action === 'flee') {
                await interaction.editReply({
                    content: 'You fled from battle! Enrollment failed.',
                    embeds: [],
                    components: [],
                    files: []
                });
                battleCollector.stop();
                return;
            }

            // Use the new battle image generator for each round
            const newBattleImageBuffer = await generateBattleImage({
                userId,
                userAvatar,
                enemyImage,
                playerHealth: player.health,
                playerMaxHealth: 1000,
                enemyHealth: enemy.currentHealth,
                enemyMaxHealth: enemy.health,
                roundNum
            });
            const newBattleImage = new AttachmentBuilder(newBattleImageBuffer, { name: `battle_scene_${userId}.png` });

            // Check battle status
            const battleStatus = await checkBattleStatus();
            if (battleStatus) {
                if (enemy.currentHealth <= 0) {
                    const victoryEmbed = new EmbedBuilder()
                        .setTitle('Congratulations Shinobi!')
                        .setDescription('You have been accepted into the Shinobi world!\n\nUse `/help` to know more about the bot\nUse `/tutorial` to learn the basics and earn your starter money!')
                        .setColor('#4B0082')
                        .setImage('https://static.wikia.nocookie.net/naruto/images/5/50/Team_Kakashi.png/revision/latest?cb=20161219035928')
                        .setFooter({ 
                            text: 'Begin your journey', 
                            iconURL: 'https://i.pinimg.com/736x/a3/c2/6c/a3c26c173f6a317431b2ddd586f8b10a.jpg' 
                        })
                        .addFields({
                            name: 'Next Steps',
                            value: '[ShinobiRPG Official Server](https://discord.gg/GPPVnydZ8m) - Start your adventure today!'
                        });

                    await interaction.followUp({ 
                        content: null,
                        embeds: [victoryEmbed], 
                        components: [], 
                        files: [newBattleImage] 
                    });
                } else {
                    await interaction.followUp({ 
                        content: battleStatus.content, 
                        embeds: [],
                        components: battleStatus.components, 
                        files: [newBattleImage] 
                    });
                }
                battleCollector.stop();
                return;
            }

            // Send round summary as a new message (not editing previous)
            const summaryEmbed = createRoundSummary(playerMove, enemyMove);
            lastBattleMsg = await interaction.followUp({ 
                content: 'Battle continues!', 
                embeds: [summaryEmbed], 
                components: [], 
                files: [newBattleImage] 
            });

            // Next round moves selection as a new message
            const nextMoves = createMovesEmbed();
            lastBattleMsg = await interaction.followUp({ 
                embeds: [nextMoves.embed], 
                components: nextMoves.components 
            });
        });

        battleCollector.on('end', () => {
            if (lastBattleMsg) lastBattleMsg.edit({ components: [] }).catch(console.error);
        });
    }
};