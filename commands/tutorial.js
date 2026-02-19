const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const imagesPath = path.resolve(__dirname, '../../menma/data/images');

// Helper to get or create a webhook for Asuma in the current channel
async function getAsumaWebhook(channel) {
    try {
        const webhooks = await channel.fetchWebhooks();
        let asumaWebhook = webhooks.find(wh => wh.name === 'Asuma');
        if (!asumaWebhook) {
            asumaWebhook = await channel.createWebhook({
                name: 'Asuma',
                avatar: 'https://i.pinimg.com/originals/d9/b6/1a/d9b61a4328fd5986574164a3d40e430f.png',
            });
        }
        return asumaWebhook;
    } catch (err) {
        if (err.code === 50013) { // Missing Permissions
            throw new Error('MISSING_WEBHOOK_PERMISSIONS');
        }
        throw err;
    }
}

// Helper to send via webhook, auto-recreate if needed
async function safeWebhookSend(channel, webhook, sendOptions) {
    try {
        return await webhook.send(sendOptions);
    } catch (err) {
        if (err.code === 10015) { // Unknown Webhook
            // Recreate webhook and retry
            try {
                const newWebhook = await getAsumaWebhook(channel);
                return await newWebhook.send(sendOptions);
            } catch (err2) {
                throw err2;
            }
        }
        if (err.code === 50013) { // Missing Permissions
            throw new Error('MISSING_WEBHOOK_PERMISSIONS');
        }
        throw err;
    }
}

// Verification functions
const verifyDrank = function (userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].drankCompleted;
};

const verifyBrank = function (userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].brankWon;
};

const verifySrank = function (userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    return users[userId] && users[userId].srankResult;
};

// Helper function to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Create continue button row
function createContinueRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('continue')
            .setLabel('Continue')
            .setStyle(ButtonStyle.Primary)
    );
}

// Create done button row
function createDoneRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('done')
            .setLabel('Done')
            .setStyle(ButtonStyle.Success)
    );
}

// Create retry button row
function createRetryRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('retry')
            .setLabel('Try Again')
            .setStyle(ButtonStyle.Secondary)
    );
}

// Wait for button interaction with timeout
async function waitForButton(interaction, userId, customId, timeout = 120000) {
    const filter = i => i.customId === customId && i.user.id === userId;
    try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: timeout });
        await buttonInteraction.deferUpdate();
        return true;
    } catch (error) {
        return false;
    }
}

// Battle image generation for the final ceremony battle
async function generateBattleImage(player, npc, roundNum = 1) {
    const width = 800, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const bgUrl = 'https://i.redd.it/di9ffo2m9q171.jpg';
    let bgImg;
    try {
        bgImg = await loadImage(bgUrl);
    } catch (error) {
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, width, height);
    }
    if (bgImg) ctx.drawImage(bgImg, 0, 0, width, height);

    // Character images
    const hashiramaImgUrl = 'https://i.postimg.cc/Pxrv0Q0Q/image.png';
    const madaraImgUrl = 'https://i.postimg.cc/rwX0qkv4/image.png';
    let hashiramaImg, madaraImg;
    try {
        hashiramaImg = await loadImage(hashiramaImgUrl);
        madaraImg = await loadImage(madaraImgUrl);
    } catch (error) {
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(50, 120, 150, 150);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(600, 120, 150, 150);
    }

    // --- RECTANGLE STYLE (from brank.js) ---
    function roundRect(x, y, w, h, r) {
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
    const npcX = 50, npcY = 120;
    const playerX = width - 50 - charW, playerY = 120;
    const nameY = 80, barY = 280;
    const nameH = 28, barH = 22;

    // Draw NPC character (left)
    if (madaraImg) {
        ctx.save();
        roundRect(npcX, npcY, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(madaraImg, npcX, npcY, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(npcX, npcY, charW, charH, 10);
        ctx.stroke();
    }

    // Draw Player character (right)
    if (hashiramaImg) {
        ctx.save();
        roundRect(playerX, playerY, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(hashiramaImg, playerX, playerY, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(playerX, playerY, charW, charH, 10);
        ctx.stroke();
    }

    // Name tags
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // NPC name
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    roundRect(npcX, nameY, charW, nameH, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("Madara Uchiha", npcX + charW / 2, nameY + nameH / 2);
    ctx.shadowBlur = 0;
    // Player name
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    roundRect(playerX, nameY, charW, nameH, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("Hashirama Senju", playerX + charW / 2, nameY + nameH / 2);
    ctx.shadowBlur = 0;

    // Health bars
    function drawHealthBar(x, y, percent, color) {
        ctx.save();
        ctx.fillStyle = "#333";
        roundRect(x, y, charW, barH, 5);
        ctx.fill();
        ctx.fillStyle = color;
        roundRect(x, y, charW * Math.max(0, percent), barH, 5);
        ctx.fill();
        ctx.restore();
    }
    drawHealthBar(npcX, barY, npc.currentHealth / npc.health, "#ff4444");
    drawHealthBar(playerX, barY, player.currentHealth / player.health, "#4CAF50");

    // VS text
    ctx.save();
    ctx.font = "bold 48px Arial";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("VS", width / 2, height / 2);
    ctx.restore();

    // Save to buffer
    const buffer = canvas.toBuffer('image/png');
    return buffer;
}

// Battle system for the final ceremony
async function runCeremonyBattle(interaction, userId, asumaWebhook) {
    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "*Asuma starts reading strange words in the ancient shinobi language. Soon the Shinigami appears and your vision goes blurry...*"
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "You can hear Asuma screaming \"Are you alright!? THIS WAS A MISTAKE!\" but you realize you find yourself in a strange place that you've never seen before."
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "You see Madara Uchiha standing on a nearby cliff, his eyes filled with killing intent. You grasp the situation and understand that you need to fight Madara."
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "You look at your body and notice the bruises healing instantly... soon you realize that you're inside the first Hokage, Hashirama Senju's body."
    });

    await delay(4500);

    // Initialize battle state
    const player = {
        name: "Hashirama Senju",
        health: 10000,
        currentHealth: 10000,
        chakra: 10,
        jutsus: {
            move1: "Wood Clones",
            move2: "Sage Mode",
            move3: "True Several Thousand Hands"
        },
        sageMode: false
    };
    const npc = {
        name: "Madara Uchiha",
        health: 10000,
        currentHealth: 10000,
        chakra: 10,
        jutsus: {
            move1: "Fireball Jutsu",
            move2: "Susanoo"
        },
        susanoo: false
    };
    let round = 1;

    // Moves embed style from brank.js
    function createMovesEmbed(player) {
        return new EmbedBuilder()
            .setTitle(`${player.name}`)
            .setColor('#006400')
            .setDescription(
                `${player.name}, It is your turn!\nUse buttons to make a choice.\n\n` +
                `1: Wood Clones\n` +
                `2: Sage Mode${player.sageMode ? " (Active)" : ""}\n` +
                `3: True Several Thousand Hands${player.sageMode ? "" : " (Requires Sage Mode)"}\n\n` +
                `Chakra: ${player.chakra}`
            );
    }

    while (player.currentHealth > 0 && npc.currentHealth > 0 && round <= 10) {
        // 1. Send moves embed
        const movesEmbed = createMovesEmbed(player);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`move1-${userId}-${round}`)
                .setLabel('1')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`move2-${userId}-${round}`)
                .setLabel('2')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`move3-${userId}-${round}`)
                .setLabel('3')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!player.sageMode)
        );
        await safeWebhookSend(interaction.channel, asumaWebhook, { embeds: [movesEmbed], components: [row] });

        // 2. Send battle image
        const battleImageBuffer = await generateBattleImage(player, npc, round);
        const attachment = new AttachmentBuilder(battleImageBuffer, { name: 'battle.png' });
        await safeWebhookSend(interaction.channel, asumaWebhook, { files: [attachment] });

        // 3. Wait for player move
        const filter = i => i.customId.startsWith('move') && i.user.id === userId;
        let moveInteraction;
        try {
            moveInteraction = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });
            await moveInteraction.deferUpdate();
        } catch (error) {
            await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You didn't make a move in time. The tutorial has ended. Try again!" });
            return false;
        }

        const moveId = moveInteraction.customId.split('-')[0];
        const moveNum = parseInt(moveId.replace('move', ''));

        let playerAction = {};
        let npcAction = {};

        // Process player move
        switch (moveNum) {
            case 1: // Wood Clones
                playerAction = {
                    name: "Wood Clones",
                    damage: 2500,
                    description: "Hashirama's Wood clones attack Madara"
                };
                npc.currentHealth -= 2500;
                break;
            case 2: // Sage Mode
                playerAction = {
                    name: "Sage Mode",
                    description: "Hashirama concentrates and dives into the divine sage mode. (Unlocks the True Several Thousand Hands move)"
                };
                player.sageMode = true;
                break;
            case 3: // True Several Thousand Hands
                if (player.sageMode) {
                    if (round === 1) {
                        playerAction = {
                            name: "True Several Thousand Hands",
                            description: "Hashirama uses sage art wood release and summons a buddha with several thousand hands.\nThe Buddha Collides with Madara's Susanoo."
                        };
                    } else {
                        playerAction = {
                            name: "True Several Thousand Hands",
                            description: "**Chojo Kebutsu**\nThe several thousand hands attack Madara's Susanoo",
                            damage: 30000
                        };
                        npc.currentHealth -= 30000;
                    }
                } else {
                    playerAction = {
                        name: "True Several Thousand Hands",
                        description: "Jutsu failed! Sage Mode is required."
                    };
                }
                break;
        }

        // Process NPC move (simple AI)
        if (npc.currentHealth > 50000 && !npc.susanoo) {
            npcAction = {
                name: "Susanoo",
                description: "Madara summons his Susanoo, his defense is greatly increased."
            };
            npc.susanoo = true;
        } else {
            npcAction = {
                name: "Fireball Jutsu",
                description: "Shoots a fireball at Hashirama",
                damage: npc.susanoo ? 300 : 600
            };
            player.currentHealth -= npc.susanoo ? 300 : 600;
        }

        // 4. Send battle summary
        // Image URLs for Hashirama's jutsus
        const hashiramaJutsuImages = {
            "Wood Clones": "https://i.makeagif.com/media/7-28-2016/_eMaFk.gif",
            "Sage Mode": "https://media.tenor.com/4Yi8L0rA9qoAAAAM/hashirama.gif",
            "True Several Thousand Hands": "https://i.pinimg.com/originals/a6/7a/74/a67a741d96af74538bd6481365a8e8fa.gif"
        };

        // Get image for the player's jutsu if available
        const playerJutsuImage = hashiramaJutsuImages[playerAction.name] || null;

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`Round ${round} Summary`)
            .setColor('#006400')
            .setDescription(
                `${player.name} used ${playerAction.name}!\n` +
                `${playerAction.description}${playerAction.damage ? ` for ${playerAction.damage} damage!` : ''}\n\n` +
                `${npc.name} used ${npcAction.name}!\n` +
                `${npcAction.description}${npcAction.damage ? ` for ${npcAction.damage} damage!` : ''}`
            )
            .addFields(
                { name: 'Battle Status', value: `${player.name}: ${Math.max(0, player.currentHealth)}/${player.health} HP\n${npc.name}: ${Math.max(0, npc.currentHealth)}/${npc.health} HP`, inline: true }
            );

        // Attach image if player's jutsu has one
        if (playerJutsuImage) {
            summaryEmbed.setImage(playerJutsuImage);
        }
        await safeWebhookSend(interaction.channel, asumaWebhook, { embeds: [summaryEmbed] });

        round++;
    }

    // Battle conclusion
    if (npc.currentHealth <= 0) {
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: "**Madara has been defeated!** The vision fades and you find yourself back in the real world."
        });
    } else if (player.currentHealth <= 0) {
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: "**Hashirama has been defeated!** The vision fades and you find yourself back in the real world."
        });
    } else {
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: "**The battle ends in a stalemate!** The vision fades and you find yourself back in the real world."
        });
    }

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "You wake up hours later in a hospital back at Konoha. You wake up and see Asuma worried and panicked."
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "As soon as Asuma sees your active condition he says \"Are you alright? what in the world happened? You suddenly passed out, we've never seen anything like that in newer Shinobi!\""
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "You mumble: \"I saw a vision...\""
    });

    await delay(4500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "Asuma stands up and takes a few steps backward, his face widened with awe. \"Are you the Prodigy...!? I must inform the elders about this!\""
    });

    await delay(5500);

    await safeWebhookSend(interaction.channel, asumaWebhook, {
        content: "\"Oh before I pass out because of shock, don't be surprised if you randomly see visions after defeating certain NPCs or bosses. They will contain information about the past and possibly you might become the savior of this world.\""
    });

    return npc.currentHealth <= 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tutorial')
        .setDescription('Start the interactive tutorial with Asuma!'),
    verifyDrank,
    verifyBrank,
    verifySrank,
    async execute(interaction) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userId = interaction.user.id;

        // If tutorial already completed, show tasks embed
        if (users[userId] && users[userId].tutorialStory) {
            const trialsDone = users[userId].tutorialTrialsComplete;
            const trainingDone = users[userId].tutorialTrainingComplete;
            const finalDone = users[userId].tutorialFinalComplete;

            const embed = new EmbedBuilder()
                .setTitle("Tutorial Tasks")
                .setDescription("Complete the tasks below to finish the tutorial!")
                .addFields([
                    {
                        name: "1. Hokage Trials",
                        value: trialsDone ? "✅ Completed" : "Complete the Hokage Trials."
                    },
                    {
                        name: "2. Leveling Up",
                        value: trainingDone ? "✅ Completed" : "Learn about leveling up."
                    },
                    {
                        name: "3. Final Information",
                        value: finalDone ? "✅ Completed" : "Learn about advanced game mechanics."
                    }
                ])
                .setColor(0x00AE86);

            const row = createContinueRow();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });

            // Wait for continue button
            if (!await waitForButton(interaction, userId, 'continue')) {
                await interaction.followUp({ content: "You didn't continue in time. Run /tutorial again!", ephemeral: true });
                return;
            }

            const asumaWebhook = await getAsumaWebhook(interaction.channel);

            // If trials not done, start trials tutorial
            if (!trialsDone) {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "Welcome back. I've told about your strength to the Hokage! They're interested in testing you personally. Go on, give it a try by using `/trials`.",
                    components: [createDoneRow()]
                });

                let trialsCompleted = false;
                while (!trialsCompleted) {
                    if (!await waitForButton(interaction, userId, 'done', 600000)) {
                        await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You haven't finished the Hokage Trials yet. Try again after using `/trials`!" });
                        return;
                    }

                    const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                    trialsCompleted = usersNow[userId] && usersNow[userId].trialsResult;

                    if (trialsCompleted) {
                        if (usersNow[userId].trialsResult === "win") {
                            await safeWebhookSend(interaction.channel, asumaWebhook, {
                                content: "No words. I'm flabbergasted. You've defeated the Hokage trials!"
                            });
                        } else {
                            await safeWebhookSend(interaction.channel, asumaWebhook, {
                                content: "Ah. That was expected. Here's a tip: Get to at least 30000 HP before attempting the Hokage trials. Every Hokage after Hiruzen Sarutobi has a really strong level requirement."
                            });
                        }

                        const usersFinal = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        usersFinal[userId] = usersFinal[userId] || {};
                        usersFinal[userId].tutorialTrialsComplete = true;
                        fs.writeFileSync(usersPath, JSON.stringify(usersFinal, null, 2));

                        await safeWebhookSend(interaction.channel, asumaWebhook, {
                            content: "Run /tutorial again to continue with the next section."
                        });
                    } else {
                        await safeWebhookSend(interaction.channel, asumaWebhook, {
                            content: "You haven't completed the Hokage Trials yet. Please use `/trials` and complete them, then press Done again.",
                            components: [createDoneRow()]
                        });
                    }
                }
                return;
            }

            // Training section (replaced with leveling)
            if (trialsDone && !trainingDone) {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "Now it's time to get you leveled up! From doing all those missions you must have enough exp accumulated to at least level once. Level up using /levelup and press Done when you're done.",
                    components: [createDoneRow()]
                });

                let leveledUp = false;
                while (!leveledUp) {
                    if (!await waitForButton(interaction, userId, 'done', 600000)) {
                        await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You haven't leveled up yet. Try using /levelup after accumulating enough EXP!" });
                        return;
                    }

                    const usersNow = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../menma/data/players.json'), 'utf8'));
                    leveledUp = usersNow[userId] && usersNow[userId].level > 1;

                    if (leveledUp) {
                        await safeWebhookSend(interaction.channel, asumaWebhook, {
                            content: "Congratulations on those new stats. Leveling is simple as that! Once you accumulate enough exp, just use the levelup command. F-rank mission is widely considered the \"grinding\" command because of its low cooldown and exp drop. Good luck!"
                        });

                        users[userId].tutorialTrainingComplete = true;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                        await safeWebhookSend(interaction.channel, asumaWebhook, {
                            content: "Run /tutorial again to continue with the final section."
                        });
                    } else {
                        await safeWebhookSend(interaction.channel, asumaWebhook, {
                            content: "You haven't leveled up yet. Please use `/levelup` to level up, then press Done again.",
                            components: [createDoneRow()]
                        });
                    }
                }
                return;
            }

            // Final section
            if (users[userId].tutorialTrainingComplete && !finalDone) {
                // Helper to send message and wait for "continue" button
                async function sendContinue(content, imageUrl = null) {
                    if (imageUrl) {
                        await safeWebhookSend(interaction.channel, asumaWebhook, { content, files: [imageUrl], components: [createContinueRow()] });
                    } else {
                        await safeWebhookSend(interaction.channel, asumaWebhook, { content, components: [createContinueRow()] });
                    }
                    if (!await waitForButton(interaction, userId, 'continue')) {
                        // Mark tutorial as completed if user doesn't respond
                        users[userId].tutorialFinalComplete = true;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You didn't continue in time. Tutorial marked as complete. Run /tutorial again if you want to repeat!" });
                        throw new Error("Tutorial continue timeout");
                    }
                }

                try {
                    await sendContinue("Alright! Let's wrap up the tutorial session. There are several important things to look out for in your shinobi journey. Press the Continue button on every upcoming message to continue.");
                    await sendContinue("Bloodlines: You can decide your bloodline but the cost for first time selection of bloodlines is 100,000. And if you are switching bloodlines, that's gonna be 250,000 + 100,000 for the new bloodline! So decide your first bloodline wisely!");
                    await sendContinue("You'll have to pray at that bloodline's shrine for the given times to actually activate the bloodline ability. The bloodline abilities aren't explicitly mentioned, they'll activate if you've met the requirements inside a battle.");
                    await sendContinue("Ranked: Ranked is like any other 1v1 battle mode with elo drop. Climb through ranks and the more the elo you obtain, the more rewards you obtain from the ranked rewards.");
                    await sendContinue("Hokage and Akatsuki Leader: Inside the server, there's gonna be an election for the Hokage every month. Alternately, There's gonna be a tournament for the Akatsuki Leader every month. Both Hokage and Akatsuki Leader have many powerful commands that decide the fate of the village.");
                    await sendContinue("Combos: You may have probably noticed the existence of combos. Combos are powerful series of attacks that make your attacking arsenal even stronger. You can obtain them through missions or from the shop.");
                    await sendContinue("Mentors: Mentors are the main source of learning jutsus early on when you don't have access to stronger Sranks, Trials and cannot afford the costlier scrolls from the shop.");
                    await sendContinue("Another additional important section of the game is the Perks. Perks come in the form of Shinobi Shards. Shinobi Shards(SS) can then be used to buy anything from the premium side of the game.");
                    // Gamepass message with image
                    await sendContinue("Gamepasses, Jutsu Spins, Customs and Battlepass. In the shop you will notice the custom saying (single effect) because the more the effects the higher the price goes.\n[Gamepass Preview Below]", "https://i.postimg.cc/7LTXZh19/image.png");
                    await sendContinue("Please understand that this bot took ALOT of time and effort to make and your support is always appreciated!");
                    await sendContinue("Now let's wrap things up! That's it for the tutorial and the basic information that will turn you into a fine Shinobi.");
                    await sendContinue("I know this won't work but let's try this anyway... I will now perform a ceremony on you. The ceremony is done to people that have potential, and you seem to have plenty.");
                    await sendContinue("But note this, this ceremony has only succeeded once in history and that was to The Legendary Hagoromo Otsutsuki. So the chances of you passing this ceremony are quite low, but good luck!");

                    // Run the ceremony battle
                    const battleWon = await runCeremonyBattle(interaction, userId, asumaWebhook);

                    // Mark final tutorial as complete
                    users[userId].tutorialFinalComplete = true;
                    users[userId].tutorialCeremonyWon = battleWon;
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                } catch {
                    return;
                }
                return;
            }

            if (users[userId].tutorialFinalComplete) {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "Congratulations! You've completed the entire tutorial. You're now ready to embark on your ninja journey!"
                });
                return;
            }
            return;
        }

        // Defer reply so we can use webhooks for the rest
        await interaction.deferReply({ ephemeral: true });

        // Get Asuma webhook for this channel
        let asumaWebhook;
        try {
            asumaWebhook = await getAsumaWebhook(interaction.channel);
        } catch (err) {
            if (err.message === 'MISSING_WEBHOOK_PERMISSIONS') {
                await interaction.editReply({ content: "Missing permissions: Please give me permissions to create webhooks." });
                return;
            }
            throw err;
        }

        // Replace all asumaWebhook.send with safeWebhookSend
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: `Hey ${interaction.user}, I'm Asuma! I'm here to guide you through the basics of being a ninja. We'll go step by step. Ready?`,
            components: [createContinueRow()]
        });

        // Wait for continue button
        if (!await waitForButton(interaction, userId, 'continue')) {
            await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You didn't continue in time. Run /tutorial again to restart!" });
            return;
        }

        // 3. Ask user to do /drank
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: `First, try using the /drank command! Press the Done button when you've completed it.`,
            components: [createDoneRow()]
        });

        // Wait for drank completion
        let drankCompleted = false;
        while (!drankCompleted) {
            if (!await waitForButton(interaction, userId, 'done')) {
                await safeWebhookSend(interaction.channel, asumaWebhook, { content: "Looks like you haven't completed /drank yet. Try again!" });
                return;
            }
            drankCompleted = module.exports.verifyDrank(userId);

            if (!drankCompleted) {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "You haven't completed /drank yet. Please complete it and press Done again.",
                    components: [createDoneRow()]
                });
            }
        }

        // 4. Ask user to do /brank and explain combo
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: `Good job, now start a brank. Brank Ninjas are fairly weak, but since you're new too, I'd recommend using the basic combo: Attack then Transform.`,
            components: [createContinueRow()]
        });

        if (!await waitForButton(interaction, userId, 'continue')) {
            await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You didn't continue in time. Run /tutorial again to restart!" });
            return;
        }

        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: `Press the Done button when you've won a brank.`,
            components: [createDoneRow()]
        });

        // Wait for brank win
        let brankWon = false;
        while (!brankWon) {
            if (!await waitForButton(interaction, userId, 'done')) {
                await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You haven't won a brank yet. Try again!" });
                return;
            }
            brankWon = module.exports.verifyBrank(userId);

            if (!brankWon) {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "You haven't won a brank yet. Please win a brank and press Done again.",
                    components: [createDoneRow()]
                });
            }
        }

        // 5. S-rank challenge
        await safeWebhookSend(interaction.channel, asumaWebhook, {
            content: `You're smarter than I thought! But time for the real test! Try defeating an S-rank! Press Done when you're finished.`,
            components: [createDoneRow()]
        });

        // Wait for srank result
        let srankCompleted = false;
        let srankResult = null;
        while (!srankCompleted) {
            if (!await waitForButton(interaction, userId, 'done')) {
                await safeWebhookSend(interaction.channel, asumaWebhook, { content: "You haven't finished an S-rank yet. Try again!" });
                return;
            }
            srankCompleted = module.exports.verifySrank(userId);

            if (srankCompleted) {
                const usersNow = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                srankResult = usersNow[userId].srankResult;
            } else {
                await safeWebhookSend(interaction.channel, asumaWebhook, {
                    content: "You haven't completed an S-rank yet. Please complete one and press Done again.",
                    components: [createDoneRow()]
                });
            }
        }

        // 6. Handle S-rank win/loss
        if (srankResult === 'lose') {
            await safeWebhookSend(interaction.channel, asumaWebhook, {
                content: `Ah. Nice try, but it's the expected result. S-rank Ninjas are the strongest ranks out of all ordinary ninjas. Here's a tip: Focus on improving your jutsu combos and most importantly stats. Use the tutorial command again to see what you need to do next!`
            });
        } else {
            await safeWebhookSend(interaction.channel, asumaWebhook, {
                content: `WOAHHH! You beat em? I did not expect that. That ends my tutorial session with you, pro sir. Haha, just kidding! Use the tutorial command again to see what you need to do next and complete all the tasks!`
            });
        }

        // Mark tutorial as complete
        users[userId] = users[userId] || {};
        users[userId].tutorialStory = true;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    }
};