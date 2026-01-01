const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const Locks = require('../utils/locks') || {};
const userMutex = Locks.userMutex;
const jutsuMutex = Locks.jutsuMutex;
const inventoryMutex = Locks.inventoryMutex;



const EMOJIS = {
    buff: "<:buff:1364946947055816856>",
    debuff: "<:debuff:1368242212374188062>",
    stun: "<:stun:1368243608695738399>",
    heal: "<:heal:1368243632045297766>",
    bleed: "<:bleed:1368243924346605608>",
    flinch: "<:flinch:1368243647711023124>",
    curse: "<:curse:1368243540978827294>",
    status: "<:status:1368243589498540092>"
};
const COMBO_EMOJI_FILLED = ":o:";
const COMBO_EMOJI_EMPTY = ":white_circle:";
module.exports = {
    data: new SlashCommandBuilder()
        .setName('enroll')
        .setDescription('Enroll in the ninja world and face your first trial'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
        const enemyImage = "https://image.tmdb.org/t/p/original/o33WNqmy81CX1QaHXpYl5oQVGE4.jpg";
        const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        const inventoryPath = path.resolve(__dirname, '../../menma/data/inventory.json');
        const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');

        // Initialize files if they don't exist
        if (!fs.existsSync(playersPath)) {
            fs.writeFileSync(playersPath, JSON.stringify({}, null, 2));
        }
        if (!fs.existsSync(usersPath)) {
            fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));
        }
        if (!fs.existsSync(inventoryPath)) {
            fs.writeFileSync(inventoryPath, JSON.stringify({}, null, 2));
        }
        if (!fs.existsSync(jutsuPath)) {
            fs.writeFileSync(jutsuPath, JSON.stringify({}, null, 2));
        }

        let players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        let inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
        let jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));

        try {
            // Check if user is already enrolled by checking either file
            let alreadyEnrolled = false;
            await userMutex.runExclusive(async () => {
                const players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
                const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
                if (players[userId] || users[userId]) {
                    alreadyEnrolled = true;
                }
            });

            if (alreadyEnrolled) {
                return interaction.reply({
                    content: "You are already enrolled! Use /profile to view your stats.",
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(`[Enroll Error - Initial Check]:`, error);
            return interaction.reply({ content: "An error occurred while checking your enrollment status.", ephemeral: true });
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

        // Use fetchReply to get the message for the collector
        const enrollMsg = await interaction.fetchReply();

        // Button collector (fix: use message collector on the reply)
        const collector = enrollMsg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            try {
                if (!i.customId.startsWith('accept-') && !i.customId.startsWith('decline-')) return;
                if (i.user.id !== userId) return i.reply({ content: "This isn't your enrollment!", ephemeral: true });

                if (i.customId === `accept-${userId}`) {
                    // Update: Use locks to save all files safely
                    if (!userMutex || !inventoryMutex || !jutsuMutex) {
                        console.error("[Enroll Error]: One or more mutexes are undefined!", {
                            userMutex: !!userMutex,
                            inventoryMutex: !!inventoryMutex,
                            jutsuMutex: !!jutsuMutex
                        });
                        return interaction.followUp("A system error occurred (Mutex missing). Please contact an admin.");
                    }

                    await Promise.all([
                        userMutex.runExclusive(async () => {
                            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

                            players[userId] = {
                                level: 1,
                                exp: 0,
                                money: 1000,
                                ramen: 1,
                                SS: 0,
                                elo: 0
                            };

                            users[userId] = {
                                wins: 0,
                                losses: 0,
                                rankedPoints: 0,
                                clan: 'None',
                                bloodline: 'Unknown',
                                mentor: 'None',
                                rank: 'Academy Student',
                                occupation: 'Village',
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
                                Combo: "Basic Combo"
                            };

                            fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
                            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        }),
                        inventoryMutex.runExclusive(async () => {
                            const inventory = fs.existsSync(inventoryPath) ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) : {};
                            inventory[userId] = {
                                usersjutsu: ['Transformation Jutsu']
                            };
                            fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));
                        }),
                        jutsuMutex.runExclusive(async () => {
                            const jutsuData = fs.existsSync(jutsuPath) ? JSON.parse(fs.readFileSync(jutsuPath, 'utf8')) : {};
                            if (!jutsuData[userId]) {
                                jutsuData[userId] = {
                                    usersjutsu: ['Transformation Jutsu']
                                };
                            } else if (!jutsuData[userId].usersjutsu.includes('Transformation Jutsu')) {
                                jutsuData[userId].usersjutsu.push('Transformation Jutsu');
                            }
                            fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));
                        })
                    ]);

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
            } catch (error) {
                console.error(`[Enroll Error - Collector]:`, error);
                await i.reply({ content: "An error occurred during enrollment. Please try again.", ephemeral: true }).catch(() => { });
            }
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
        const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

        let players, users;
        await userMutex.runExclusive(async () => {
            players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        });

        let playerData = players[userId];
        let userData = users[userId];

        // Process player move
        const processPlayerMove = (move) => {
            let damage = 0;
            let description = '';
            let chakraCost = 0;

            if (move === 'attack') {
                damage = 2 * (userData.power + (transformationActive ? 5 : 0));
                description = 'used Attack';
            }
            else if (move === 'transform') {
                chakraCost = 5;
                if (userData.chakra >= chakraCost) {
                    userData.chakra -= chakraCost;
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
            const damage = 11 * enemy.power / userData.defense;
            return {
                damage,
                description: 'used Shuriken Throw'
            };
        };

        // Combo system setup
        const comboList = {
            "Basic Combo": {
                name: "Basic Combo",
                requiredJutsus: ["Attack", "Transformation Jutsu"],
                damage: 10000,
                effects: []
            }
        };
        let comboState = {
            combo: comboList["Basic Combo"],
            usedJutsus: new Set()
        };

        // Create moves embed with slot-based jutsu and combo progress
        const createMovesEmbed = () => {
            const jutsuSlots = Object.entries(userData.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([slot, jutsu]) => `${slot.replace('_', ' ')}: ${jutsu}`)
                .join('\n');

            // Combo progress UI
            let comboProgressText = "";
            if (comboState && comboState.combo) {
                const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
                const total = comboState.combo.requiredJutsus.length;
                comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
            }

            const movesEmbed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} - Select Your Move`)
                .setColor('#0099ff')
                .setDescription(
                    `${interaction.user.username}, It is your turn!\nUse the buttons to make your move.` +
                    comboProgressText
                )
                .addFields(
                    {
                        name: 'Your Jutsu Slots',
                        value: jutsuSlots || 'No jutsu equipped'
                    }
                )
                .setFooter({ text: `Chakra: ${userData.chakra}/10` });

            const row = new ActionRowBuilder();
            // Attack button (always available)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${userId}-${roundNum}`)
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Primary)
            );

            // Transformation Jutsu button if available and has chakra
            // Note: The player starts with 10 Chakra (max) and Transformation costs 5
            if (Object.values(userData.jutsu).includes('Transformation Jutsu') && userData.chakra >= 5) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`transform-${userId}-${roundNum}`)
                        .setLabel('Transform (5 Chakra)')
                        .setStyle(ButtonStyle.Primary)
                );
            } else if (Object.values(userData.jutsu).includes('Transformation Jutsu')) {
                // Add disabled button if not enough chakra
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`transform-${userId}-${roundNum}`)
                        .setLabel('Transform (5 Chakra)')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
            }

            // Rest button
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rest-${userId}-${roundNum}`)
                    .setLabel('Rest (+2 Chakra)') // Changed to +2 chakra passive regen to match checkBattleStatus
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
        const playerMaxHealth = users[userId].health; // Max health is set on initial enrollment to 1000

        // --- Damage tracking ---
        let totalDamageDealt = 0;
        let totalDamageTaken = 0;

        // Create round summary
        const createRoundSummary = (playerMove, enemyMove) => {
            // Buff emoji if transformation is active
            const playerBuff = transformationActive ? EMOJIS.buff : "";
            // Combo progress UI
            let comboProgressText = "";
            if (comboState && comboState.combo) {
                const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
                const total = comboState.combo.requiredJutsus.length;
                comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
            }
            return new EmbedBuilder()
                .setTitle(`Round ${roundNum}`)
                .setColor('#0099ff')
                .setDescription(
                    `${playerBuff} ${interaction.user.username} ${playerMove.description} for ${playerMove.damage.toFixed(0)} damage\n` +
                    `${enemy.name} ${enemyMove.description} for ${enemyMove.damage.toFixed(0)} damage` +
                    comboProgressText
                )
                .addFields(
                    {
                        name: 'Battle Status',
                        value: `${interaction.user.username} | ${userData.health.toFixed(0)} HP  ${enemy.name} | ${enemy.currentHealth.toFixed(0)} HP`
                    }
                )
                .setFooter({ text: `Chakra: ${userData.chakra}` });
        };

        // Check battle status
        const checkBattleStatus = async () => {
            if (userData.health <= 0) {
                return {
                    content: `Defeat! You were defeated by the rogue ninja.`,
                    components: []
                };
            }
            if (enemy.currentHealth <= 0) {
                // Update user stats on victory
                await userMutex.runExclusive(async () => {
                    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    const pData = players[userId];
                    const uData = users[userId];

                    if (pData && uData) {
                        uData.wins += 1;
                        pData.exp += 10;
                        pData.money += 5000;
                        uData.health = playerMaxHealth;
                        uData.chakra = 10;

                        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                    }
                });

                // --- START NEW DM LOGIC ---
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🎉 Welcome to the Shinobi World! 🎉')
                        .setDescription(
                            `Congratulations, **${interaction.user.username}**! You successfully passed the Academy Trial and are now an **Academy Student**.\n\n` +
                            `**Next Steps:**\n` +
                            `1. Use \`/profile\` to view your new stats. You can also ping the bot to ask any question!\n` +
                            `2. Use \`/help\` to explore more commands and features.\n` +
                            `3. Use \`/tutorial\` to earn your starter money and learn more commands!\n` +
                            `4. Join the [ShinobiRPG Official Server](https://discord.gg/GPPVnydZ8m) to meet other players!`
                        )
                        .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', size: 128 }))
                        .setFooter({ text: 'Your journey begins now!' });

                    await interaction.user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.error(`Could not send DM to ${interaction.user.tag}.\n`, error);
                    // Optionally, inform the user in the channel if DM fails
                    // This message is ephemeral so only the user sees it
                    await interaction.followUp({ content: "I couldn't send you a welcome DM, please check your privacy settings!", ephemeral: true });
                }
                // --- END NEW DM LOGIC ---

                return {
                    content: `Victory! You defeated the rogue ninja!\nRewards:\n+10 EXP\n+5000 Money`,
                    components: []
                };
            }

            // Passive chakra regeneration (occurs at the end of the opponent's turn, before the next round)
            userData.chakra = Math.min(userData.chakra + 2, 10);

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

        // Add improved generateBattleImage function here (Canvas version)
        const generateBattleImage = async ({ userId, userAvatar, enemyImage, playerHealth, playerMaxHealth, enemyHealth, enemyMaxHealth, roundNum }) => {
            const width = 800, height = 400;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Load images (background, enemy, player avatar)
            const bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
            let bgImg, enemyImg, playerImg;
            try { bgImg = await loadImage(bgUrl); } catch { bgImg = null; }
            try { enemyImg = await loadImage(enemyImage); } catch { enemyImg = null; }

            // --- Use brank.js style avatar logic ---
            let playerAvatarUrl;
            if (interaction.user.avatar) {
                playerAvatarUrl = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
            } else {
                const disc = interaction.user.discriminator ? parseInt(interaction.user.discriminator) % 5 : 0;
                playerAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${disc}.png`;
            }
            try { playerImg = await loadImage(playerAvatarUrl); } catch { playerImg = null; }

            // Draw background
            if (bgImg) ctx.drawImage(bgImg, 0, 0, width, height);
            else {
                ctx.fillStyle = "#222";
                ctx.fillRect(0, 0, width, height);
            }

            // Helper for rounded rectangles
            function roundRect(ctx, x, y, w, h, r) {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r);
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath();
            }

            // Positions
            const charW = 150, charH = 150;
            const playerX = width - 50 - charW, playerY = 120;
            const npcX = 50, npcY = 120;
            const nameY = 80, barY = 280;
            const nameH = 28, barH = 22;

            // Draw enemy character
            ctx.save();
            roundRect(ctx, npcX, npcY, charW, charH, 10);
            ctx.clip();
            if (enemyImg) ctx.drawImage(enemyImg, npcX, npcY, charW, charH);
            else {
                ctx.fillStyle = "#444";
                ctx.fillRect(npcX, npcY, charW, charH);
            }
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#6e1515";
            roundRect(ctx, npcX, npcY, charW, charH, 10);
            ctx.stroke();

            // Draw player character
            ctx.save();
            roundRect(ctx, playerX, playerY, charW, charH, 10);
            ctx.clip();
            if (playerImg) ctx.drawImage(playerImg, playerX, playerY, charW, charH);
            else {
                ctx.fillStyle = "#666";
                ctx.fillRect(playerX, playerY, charW, charH);
            }
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#6e1515";
            roundRect(ctx, playerX, playerY, charW, charH, 10);
            ctx.stroke();

            // Draw name tags
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // Enemy name
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = "#000";
            roundRect(ctx, npcX, nameY, charW, nameH, 5);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 4;
            ctx.fillText("Rogue Ninja", npcX + charW / 2, nameY + nameH / 2);
            ctx.shadowBlur = 0;
            // Player name
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = "#000";
            roundRect(ctx, playerX, nameY, charW, nameH, 5);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 4;
            ctx.fillText(interaction.user.username, playerX + charW / 2, nameY + nameH / 2);
            ctx.shadowBlur = 0;

            // Health bars
            // Enemy
            const npcHealthPercent = Math.max(enemyHealth / enemyMaxHealth, 0);
            ctx.save();
            ctx.fillStyle = "#333";
            roundRect(ctx, npcX, barY, charW, barH, 5);
            ctx.fill();
            ctx.fillStyle = "#ff4444";
            roundRect(ctx, npcX, barY, charW * npcHealthPercent, barH, 5);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 1;

            ctx.shadowBlur = 0;
            ctx.restore();

            // Player
            const playerHealthPercent = Math.max(playerHealth / playerMaxHealth, 0);
            ctx.save();
            ctx.fillStyle = "#333";
            roundRect(ctx, playerX, barY, charW, barH, 5);
            ctx.fill();
            ctx.fillStyle = "#4CAF50";
            roundRect(ctx, playerX, barY, charW * playerHealthPercent, barH, 5);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 1;
            ctx.shadowBlur = 0;
            ctx.restore();

            // VS text
            ctx.save();
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 4;
            ctx.fillText("VS", width / 2, height / 2);
            ctx.restore();

            return canvas.toBuffer('image/png');
        };

        // Main battle loop
        const battleCollector = interaction.channel.createMessageComponentCollector({ time: 300000 });

        // Initial moves selection
        const { embed: movesEmbed, components } = createMovesEmbed();
        const battleImageBuffer = await generateBattleImage({
            userId,
            userAvatar,
            enemyImage,
            playerHealth: userData.health,
            playerMaxHealth: playerMaxHealth,
            enemyHealth: enemy.currentHealth,
            enemyMaxHealth: enemy.health,
            roundNum
        });
        const battleImage = new AttachmentBuilder(battleImageBuffer, { name: `battle_scene_${userId}.png` });

        // Send moves embed first, then battle image, then tip
        let lastBattleMsg = await interaction.followUp({
            embeds: [movesEmbed],
            components,
        });
        await interaction.followUp({ files: [battleImage] });
        // Only send tip after the first battle image
        let tipSent = false;
        if (!tipSent) {
            await interaction.followUp({ content: "Tip: Use Transformation Jutsu then Attack the enemy to combo them!" });
            tipSent = true;
        }

        battleCollector.on('collect', async (i) => {
            try {
                if (!i.customId.includes(userId)) return i.reply({ content: "This isn't your battle!", ephemeral: true });
                await i.deferUpdate();

                // Remove buttons from previous message (if any)
                if (lastBattleMsg) {
                    await lastBattleMsg.edit({ components: [] }).catch(() => { });
                }

                // Extract the base action from the custom ID
                const action = i.customId.split('-')[0];

                let playerMove, enemyMove;

                // Combo tracking
                if (action === 'attack') {
                    playerMove = processPlayerMove('attack');
                    if (comboState.combo.requiredJutsus.includes('Attack')) comboState.usedJutsus.add('Attack');
                    enemy.currentHealth -= playerMove.damage;
                    totalDamageDealt += playerMove.damage; // Track damage dealt
                    enemyMove = processEnemyMove();
                    userData.health -= enemyMove.damage;
                    totalDamageTaken += enemyMove.damage; // Track damage taken
                }
                else if (action === 'transform') {
                    playerMove = processPlayerMove('transform');
                    if (comboState.combo.requiredJutsus.includes('Transformation Jutsu')) comboState.usedJutsus.add('Transformation Jutsu');
                    if (playerMove.description.includes('failed')) {
                        // Send error message as a follow-up and stop
                        await interaction.followUp({ content: `**${interaction.user.username}** ${playerMove.description}. Select your move again.`, ephemeral: true });
                        // Re-send the move selection buttons
                        const nextMoves = createMovesEmbed();
                        lastBattleMsg = await interaction.followUp({
                            embeds: [nextMoves.embed],
                            components: nextMoves.components
                        });
                        // Skip the rest of the round logic and enemy move
                        return;
                    }
                    enemyMove = processEnemyMove();
                    userData.health -= enemyMove.damage;
                    totalDamageTaken += enemyMove.damage;
                }
                else if (action === 'rest') {
                    userData.chakra = Math.min(userData.chakra + 1, 10);
                    enemyMove = processEnemyMove();
                    userData.health -= enemyMove.damage;
                    playerMove = {
                        damage: 0,
                        description: 'rested and gained +1 Chakra',
                        specialEffects: ['+1 Chakra']
                    };
                    totalDamageTaken += enemyMove.damage;
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

                // Combo completion check and bonus damage
                let comboCompletedThisRound = false;
                let comboDamageText = "";
                if (
                    comboState &&
                    comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))
                ) {
                    // Apply combo effects
                    const combo = comboState.combo;
                    playerMove.damage += combo.damage || 0;
                    comboCompletedThisRound = true;
                    comboDamageText = `\n${interaction.user.username} lands a ${combo.name}! Massive damage!`;
                    comboState.usedJutsus.clear();
                    // Apply combo damage immediately (it was added to playerMove.damage, so it is applied to the enemy health here)
                    // enemy.currentHealth -= combo.damage || 0; // The damage is already included in playerMove.damage which subtracted from enemy.currentHealth above
                    totalDamageDealt += combo.damage || 0;
                }

                // Use the new battle image generator for each round
                const newBattleImageBuffer = await generateBattleImage({
                    userId,
                    userAvatar,
                    enemyImage,
                    playerHealth: userData.health,
                    playerMaxHealth: playerMaxHealth,
                    enemyHealth: enemy.currentHealth,
                    enemyMaxHealth: enemy.health,
                    roundNum
                });
                const newBattleImage = new AttachmentBuilder(newBattleImageBuffer, { name: `battle_scene_${userId}.png` });

                // Check battle status
                const battleStatus = await checkBattleStatus();
                if (battleStatus) {
                    // Show final round summary before win/lose screen
                    const summaryEmbed = createRoundSummary(playerMove, enemyMove);
                    if (comboCompletedThisRound) {
                        summaryEmbed.setDescription(
                            summaryEmbed.data.description + comboDamageText
                        );
                    }
                    await interaction.followUp({
                        content: 'Final Round!',
                        embeds: [summaryEmbed],
                        components: [],
                    });

                    // Show final stats in the win/lose screen
                    if (enemy.currentHealth <= 0) {
                        const victoryEmbed = new EmbedBuilder()
                            .setTitle('Congratulations Shinobi!')
                            .setDescription(
                                'You have been accepted into the Shinobi world!\n\n' +
                                `**Total Damage Dealt:** ${Math.round(totalDamageDealt)}\n` +
                                `**Total Damage Taken:** ${Math.round(totalDamageTaken)}\n\n` +
                                'Use `/help` to know more about the bot\nUse `/tutorial` to learn the basics and earn your starter money!'
                            )
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
                        // Defeat
                        const defeatEmbed = new EmbedBuilder()
                            .setTitle('Defeat!')
                            .setDescription(
                                `You were defeated by the rogue ninja.\n\n` +
                                `**Total Damage Dealt:** ${Math.round(totalDamageDealt)}\n` +
                                `**Total Damage Taken:** ${Math.round(totalDamageTaken)}`
                            )
                            .setColor('#b91c1c');
                        await interaction.followUp({
                            embeds: [defeatEmbed],
                            files: [newBattleImage]
                        });
                    }
                    battleCollector.stop();
                    return;
                }

                // Send moves embed first, then battle image (tip only after first image)
                const summaryEmbed = createRoundSummary(playerMove, enemyMove);
                if (comboCompletedThisRound) {
                    summaryEmbed.setDescription(
                        summaryEmbed.data.description + comboDamageText
                    );
                }
                lastBattleMsg = await interaction.followUp({
                    content: 'Battle continues!',
                    embeds: [summaryEmbed],
                    components: [],
                });
                await interaction.followUp({ files: [newBattleImage] });

                // Next round moves selection as a new message
                const nextMoves = createMovesEmbed();
                lastBattleMsg = await interaction.followUp({
                    embeds: [nextMoves.embed],
                    components: nextMoves.components
                });
            } catch (error) {
                console.error(`[Enroll Error - Battle Loop]:`, error);
                await interaction.followUp({ content: "An error occurred during battle!", ephemeral: true }).catch(() => { });
            }
        });

        battleCollector.on('end', () => {
            if (lastBattleMsg) lastBattleMsg.edit({ components: [] }).catch(console.error);
        });
    }
};