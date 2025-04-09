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
        const enemyImage = "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg";
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
                flags: [64]
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
            if (i.user.id !== userId) return i.reply({ content: "This isn't your enrollment!", flags: [64] });

            if (i.customId === `accept-${userId}`) {
                // Create user profile with jutsu as an array for battle system
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
                    jutsu: ['Attack', 'Transformation Jutsu', 'None', 'None', 'None'], // Changed to array
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
            
            if (move === 'attack') {
                damage = 2 * (player.power + (transformationActive ? 5 : 0));
                description = 'used Attack';
            } 
            else if (move === 'transform') {
                player.chakra -= 5;
                transformationActive = true;
                transformationRounds = 3;
                description = 'used Transformation Jutsu';
            }

            return { damage, description };
        };

        // Process enemy move
        const processEnemyMove = () => {
            const damage = 11 * enemy.power / player.defense;
            return { 
                damage, 
                description: 'used Shuriken Throw' 
            };
        };

        // Create moves embed
        const createMovesEmbed = () => {
            const movesEmbed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} - Select Your Move`)
                .setColor('#0099ff')
                .setDescription(`${interaction.user.username}, It is your turn!\nUse the buttons to make your move.`)
                .addFields(
                    { 
                        name: 'Your Jutsu', 
                        value: player.jutsu.map((j, index) => 
                            `${index + 1}. ${j}${j === 'Transformation Jutsu' ? ' (5 Chakra)' : ''}`
                        ).join('\n')
                    }
                )
                .setFooter({ text: `Chakra: ${player.chakra}` });

            const row = new ActionRowBuilder();
            
            // Button 1 - Attack (always available)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${userId}`)
                    .setLabel('1')
                    .setStyle(ButtonStyle.Primary)
            );

            // Button 2 - Transform (if enough chakra and jutsu exists)
            if (player.chakra >= 5 && player.jutsu.includes('Transformation Jutsu')) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`transform-${userId}`)
                        .setLabel('2')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Button 3 - Rest (+1 Chakra)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rest-${userId}`)
                    .setLabel('😴')
                    .setStyle(ButtonStyle.Primary)
            );

            // Button 4 - Flee
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`flee-${userId}`)
                    .setLabel('❌')
                    .setStyle(ButtonStyle.Primary)
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
        let roundNum = 1; // Start with round 1
        let transformationActive = false;
        let transformationRounds = 0;

        // Generate battle image
        const generateBattleImage = async () => {
            const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setViewport({ width: 700, height: 350 });

            const playerHealthPercent = Math.max((player.health / 1000) * 100, 0);
            const enemyHealthPercent = Math.max((enemy.currentHealth / enemy.health) * 100, 0);

            const htmlContent = `
                <html>
                <body style="margin: 0; padding: 0; position: relative;">
                    <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                    
                    <div style="position: absolute; left: 50px; top: 50px;"><img src="${enemyImage}" width="150" /></div>
                    <div style="position: absolute; right: 50px; top: 50px;"><img src="${userAvatar}" width="120" /></div>

                    <div style="position: absolute; left: 50px; top: 220px; width: 150px; height: 15px; background: gray;">
                        <div style="width: ${enemyHealthPercent}%; height: 100%; background: red;"></div>
                    </div>
                    <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${playerHealthPercent}%; height: 100%; background: green;"></div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(htmlContent);
            const imagePath = `./battle_scene_${userId}.png`;
            await page.screenshot({ path: imagePath });
            await browser.close();
            return imagePath;
        };

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

        // Main battle loop
        const battleCollector = interaction.channel.createMessageComponentCollector({ time: 300000 });

        // Initial moves selection
        const { embed: movesEmbed, components } = createMovesEmbed();
        const battleImage = new AttachmentBuilder(await generateBattleImage());
        const battleMessage = await interaction.followUp({ 
            content: 'Battle Started! Defeat the rogue ninja to complete your enrollment!', 
            embeds: [movesEmbed], 
            components, 
            files: [battleImage] 
        });

        battleCollector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: "This isn't your battle!", flags: [64] });
            
            let playerMove, enemyMove;
            
            if (i.customId === `attack-${userId}`) {
                playerMove = processPlayerMove('attack');
                enemy.currentHealth -= playerMove.damage;
                
                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
            } 
            else if (i.customId === `transform-${userId}`) {
                playerMove = processPlayerMove('transform');
                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
            }
            else if (i.customId === `rest-${userId}`) {
                player.chakra = Math.min(player.chakra + 1, 10);
                enemyMove = processEnemyMove();
                player.health -= enemyMove.damage;
                playerMove = { damage: 0, description: 'rested and gained +1 Chakra' };
            }
            else if (i.customId === `flee-${userId}`) {
                await i.update({
                    content: 'You fled from battle! Enrollment failed.',
                    components: [],
                    files: []
                });
                battleCollector.stop();
                return;
            }
            
            // Update battle image
            const newBattleImage = new AttachmentBuilder(await generateBattleImage());
            
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
                            iconURL: 'https://cdn.discordapp.com/icons/763131066940522496/d62fe06e4b51f2431769fa96b90b8446.jpg' 
                        })
                        .addFields({
                            name: 'Next Steps',
                            value: '[Land of Fire](https://discord.gg/8kJPMp8m) - Start your adventure today!'
                        });

                    await i.update({ 
                        content: null,
                        embeds: [victoryEmbed], 
                        components: [], 
                        files: [newBattleImage] 
                    });
                } else {
                    await i.update({ 
                        content: battleStatus.content, 
                        components: battleStatus.components, 
                        files: [newBattleImage] 
                    });
                }
                battleCollector.stop();
                return;
            }
            
            // Send round summary
            const summaryEmbed = createRoundSummary(playerMove, enemyMove);
            await i.update({ 
                content: 'Battle continues!', 
                embeds: [summaryEmbed], 
                components: [], 
                files: [newBattleImage] 
            });
            
            // Next round moves selection
            const nextMoves = createMovesEmbed();
            await interaction.followUp({ 
                embeds: [nextMoves.embed], 
                components: nextMoves.components 
            });
        });

        battleCollector.on('end', () => {
            interaction.editReply({ components: [] }).catch(console.error);
        });
    }
};