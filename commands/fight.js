const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '/workspaces/menma/data/jutsus.json');


// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Effect handlers with improved error handling
const effectHandlers = {
    damage: (user, target, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100 // Default 100% accuracy if not specified
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0 // Default 0% dodge if not specified
                }
            };
            
            // Calculate hit chance (user accuracy vs target dodge)
            const hitChance = Math.max(0, Math.min(100, context.user.accuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            
            if (!hits) {
                return { damage: 0, hit: false };
            }
            
            const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
            return { damage, hit: true };
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return { damage: 0, hit: false };
        }
    },

    buff: (user, statsDefinition) => {
        const changes = {};
        const context = {
            user: {
                power: Number(user.power) || 0,
                defense: Number(user.defense) || 0,
                health: Number(user.health) || 0,
                chakra: Number(user.chakra) || 0,
                accuracy: Number(user.accuracy) || 100
            }
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                changes[stat] = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : Math.floor(math.evaluate(formulaOrValue, context));
            } catch (err) {
                console.error(`Buff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = {
            target: {
                power: Number(target.power) || 0,
                defense: Number(target.defense) || 1,
                health: Number(target.health) || 0,
                chakra: Number(target.chakra) || 0,
                accuracy: Number(target.accuracy) || 100,
                dodge: Number(target.dodge) || 0
            }
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                const value = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : math.evaluate(formulaOrValue, context);
                changes[stat] = value < 0 ? value : -Math.abs(value);
            } catch (err) {
                console.error(`Debuff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    heal: (user, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0
                }
            };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Heal formula error: ${formula}`, err);
            return 0;
        }
    },

    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1)
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another player to a battle')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('The player to challenge')
                .setRequired(true)
        ),

    async execute(interaction) {
        const challengerId = interaction.user.id;
        const opponentId = interaction.options.getUser('opponent').id;

        // Basic validations
        if (challengerId === opponentId) {
            return interaction.reply({ content: "You can't challenge yourself!", ephemeral: true });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[challengerId] || !users[opponentId]) {
            return interaction.reply({ content: "Both players must be enrolled to fight!", ephemeral: true });
        }

        // Challenge phase
        const challengeEmbed = new EmbedBuilder()
            .setTitle('Battle Challenge!')
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

        const challengeMessage = await interaction.reply({
            content: `<@${opponentId}>`,
            embeds: [challengeEmbed],
            components: [challengeButtons],
            fetchReply: true
        });

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
            await i.deferUpdate();
            
            // Initialize battle entities
            const challenger = {
                ...users[challengerId],
                name: interaction.user.username,
                activeEffects: [],
                accuracy: 100, // Base accuracy
                dodge: 0      // Base dodge
            };

            const opponent = {
                ...users[opponentId],
                name: interaction.options.getUser('opponent').username,
                activeEffects: [],
                accuracy: 100, // Base accuracy
                dodge: 0       // Base dodge
            };

            let roundNum = 1;
            let challengerHealth = challenger.health;
            let opponentHealth = opponent.health;

            // Generate battle image
            const generateBattleImage = async () => {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();
                await page.setViewport({ width: 700, height: 350 });

                const challengerHealthPercent = Math.max((challengerHealth / challenger.health) * 100, 0);
                const opponentHealthPercent = Math.max((opponentHealth / opponent.health) * 100, 0);

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
                            <div style="width: ${challengerHealthPercent}%; height: 100%; background: green;"></div>
                            <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(challengerHealth)}/${challenger.health}</div>
                        </div>

                        <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                            <div style="width: ${opponentHealthPercent}%; height: 100%; background: red;"></div>
                            <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(opponentHealth)}/${opponent.health}</div>
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

            // Execute a jutsu with base and effective stats
            const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) => {
                const jutsu = jutsuList[jutsuName];
                if (!jutsu) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name || 'User'} attempted unknown jutsu: ${jutsuName}`,
                        specialEffects: ["Jutsu failed!"],
                        hit: false
                    };
                }

                const result = {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name || 'User'} used ${jutsu.name}`,
                    specialEffects: [],
                    hit: true
                };

                // Check and deduct chakra from base user
                if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name || 'User'} failed to perform ${jutsu.name} (not enough chakra)`,
                        specialEffects: ["Chakra exhausted!"],
                        hit: false
                    };
                }
                baseUser.chakra -= jutsu.chakraCost || 0;

                // Process all effects
                jutsu.effects.forEach(effect => {
                    try {
                        switch (effect.type) {
                            case 'damage':
                                const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula);
                                result.damage += damageResult.damage;
                                result.hit = damageResult.hit;
                                if (damageResult.hit && damageResult.damage > 0) {
                                    result.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                                } else if (!damageResult.hit) {
                                    result.specialEffects.push("Attack missed!");
                                }
                                break;

                            case 'buff':
                                const buffChanges = effectHandlers.buff(baseUser, effect.stats);
                                if (!baseUser.activeEffects) baseUser.activeEffects = [];
                                baseUser.activeEffects.push({
                                    type: 'buff',
                                    stats: buffChanges,
                                    duration: effect.duration || 1
                                });
                                result.specialEffects.push(`Gained buffs: ${Object.entries(buffChanges)
                                    .map(([k, v]) => `${k}: +${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;

                            case 'debuff':
                                const debuffChanges = effectHandlers.debuff(baseTarget, effect.stats);
                                if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                baseTarget.activeEffects.push({
                                    type: 'debuff',
                                    stats: debuffChanges,
                                    duration: effect.duration || 1
                                });
                                result.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;

                            case 'heal':
                                const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                result.heal += healAmount;
                                if (healAmount > 0) {
                                    result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                                }
                                break;

                            case 'instantKill':
                                if (effectHandlers.instantKill(effect.chance)) {
                                    result.damage = effectiveTarget.health;
                                    result.specialEffects.push("INSTANT KILL!");
                                }
                                break;

                            case 'status':
                                if (effectHandlers.status(effect.chance)) {
                                    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                    baseTarget.activeEffects.push({
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1
                                    });
                                    result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                }
                                break;

                            case 'chakra_gain':
                                let gainAmount = 0;
                                if (typeof effect.amount === 'number') {
                                    gainAmount = effect.amount;
                                } else {
                                    try {
                                        gainAmount = Math.max(0, math.evaluate(effect.amount, { user: baseUser }));
                                    } catch(e) { 
                                        console.error("chakra_gain formula error", e); 
                                        gainAmount = 0;
                                    }
                                }
                                baseUser.chakra = Math.min((baseUser.chakra || 0) + gainAmount, 10);
                                if (gainAmount > 0) {
                                    result.specialEffects.push(`Gained ${Math.round(gainAmount)} Chakra`);
                                }
                                break;
                        }
                    } catch (err) {
                        console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                        result.specialEffects.push(`Error applying ${effect.type} effect`);
                    }
                });

                return result;
            };

            // Create moves embed with slot system
            const createMovesEmbed = (currentPlayer) => {
                const embed = new EmbedBuilder()
                    .setTitle(`Round ${roundNum} - ${currentPlayer.name}'s Turn`)
                    .setColor('#0099ff')
                    .setDescription("Select your move!")
                    .addFields({
                        name: "Jutsu Slots",
                        value: Object.entries(currentPlayer.jutsu)
                            .filter(([_, jutsu]) => jutsu !== 'None')
                            .map(([slot, jutsu]) => {
                                const jutsuData = jutsuList[jutsu];
                                return `${slot.replace('_', ' ')}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                            })
                            .join('\n')
                    })
                    .addFields({
                        name: "Stats",
                        value: `Accuracy: ${currentPlayer.accuracy}%\nDodge: ${currentPlayer.dodge}%`
                    })
                    .setFooter({ text: `Chakra: ${currentPlayer.chakra} | Health: ${Math.round(currentPlayer === challenger ? challengerHealth : opponentHealth)}/${currentPlayer.health}` });

                const rows = [];
                let currentRow = new ActionRowBuilder();
                
                // Add buttons for each equipped jutsu
                Object.entries(currentPlayer.jutsu).forEach(([slot, jutsuName]) => {
                    if (jutsuName !== 'None') {
                        const jutsu = jutsuList[jutsuName];
                        const disabled = currentPlayer.chakra < (jutsu?.chakraCost || 0);
                        
                        if (currentRow.components.length >= 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                        }
                        
                        currentRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`${jutsuName}-${currentPlayer === challenger ? challengerId : opponentId}-${roundNum}`)
                                .setLabel(`${slot.replace('_', ' ')}: ${jutsu?.name || jutsuName}`)
                                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(disabled)
                        );
                    }
                });

                // Add utility buttons to a new row
                const utilityRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rest-${currentPlayer === challenger ? challengerId : opponentId}-${roundNum}`)
                            .setLabel('Rest (+1 Chakra)')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`flee-${currentPlayer === challenger ? challengerId : opponentId}-${roundNum}`)
                            .setLabel('Flee')
                            .setStyle(ButtonStyle.Danger)
                    );

                if (currentRow.components.length > 0) {
                    rows.push(currentRow);
                }
                rows.push(utilityRow);

                return { embed, components: rows };
            };

            // Process player move with effective stats
            const processPlayerMove = async (customId, basePlayer, baseTarget, effectivePlayer, effectiveTarget) => {
                const action = customId.split('-')[0];
                
                if (action === 'rest') {
                    basePlayer.chakra = Math.min(basePlayer.chakra + 1);
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${basePlayer.name} gathered chakra and rested`,
                        specialEffects: ["+1 Chakra"],
                        hit: true
                    };
                }
                
                if (action === 'flee') {
                    return { fled: true };
                }
                
                return executeJutsu(basePlayer, baseTarget, effectivePlayer, effectiveTarget, action);
            };

            // Calculate effective stats considering active effects
            const getEffectiveStats = (entity) => {
                const stats = { ...entity };
                delete stats.activeEffects;

                // Start with base stats
                const effectiveStats = {
                    power: stats.power || 10,
                    defense: stats.defense || 10,
                    chakra: stats.chakra || 10,
                    health: stats.health || 100,
                    accuracy: stats.accuracy || 100, // Default accuracy
                    dodge: stats.dodge || 0         // Default dodge
                };

                // Apply all active effects
                entity.activeEffects.forEach(effect => {
                    if (effect.type === 'buff' || effect.type === 'debuff') {
                        Object.entries(effect.stats).forEach(([stat, value]) => {
                            effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                        });
                    }
                });

                return effectiveStats;
            };

            // Create battle summary
            const createBattleSummary = (challengerAction, opponentAction) => {
                const embed = new EmbedBuilder()
                    .setTitle(`Round ${roundNum} Summary`)
                    .setColor('#FFA500')
                    .addFields(
                        {
                            name: `${challenger.name}`,
                            value: `${challengerAction.description}\n${challengerAction.damage ? `Dealt **${Math.round(challengerAction.damage)}** damage` : ''}${!challengerAction.hit ? ' (Missed!)' : ''}${challengerAction.specialEffects?.length ? '\n' + challengerAction.specialEffects.join('\n') : ''}`
                        },
                        {
                            name: `${opponent.name}`,
                            value: `${opponentAction.description}\n${opponentAction.damage ? `Dealt **${Math.round(opponentAction.damage)}** damage` : ''}${!opponentAction.hit ? ' (Missed!)' : ''}${opponentAction.specialEffects?.length ? '\n' + opponentAction.specialEffects.join('\n') : ''}`
                        },
                        {
                            name: 'Battle Status',
                            value: `${challenger.name}: ${Math.round(challengerHealth)}/${challenger.health} HP\n${opponent.name}: ${Math.round(opponentHealth)}/${opponent.health} HP`
                        }
                    );

                // Add active effects if any
                const challengerEffects = challenger.activeEffects.map(e => 
                    e.type === 'status' ? e.status : 
                    `${e.type}: ${Object.entries(e.stats).map(([k,v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(', ')} (${e.duration}t)`
                ).filter(Boolean);

                const opponentEffects = opponent.activeEffects.map(e => 
                    e.type === 'status' ? e.status : 
                    `${e.type}: ${Object.entries(e.stats).map(([k,v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(', ')} (${e.duration}t)`
                ).filter(Boolean);

                if (challengerEffects.length > 0 || opponentEffects.length > 0) {
                    embed.addFields({
                        name: 'Active Effects',
                        value: `**${challenger.name}**: ${challengerEffects.join(', ') || 'None'}\n**${opponent.name}**: ${opponentEffects.join(', ') || 'None'}`
                    });
                }

                embed.setFooter({ 
                    text: `Chakra: ${challenger.chakra} | ${opponent.chakra} | Round ${roundNum}` 
                });

                return embed;
            };

            // Start battle
            try {
                const battleImage = new AttachmentBuilder(await generateBattleImage());
                await interaction.followUp({ 
                    content: `**Battle Started!** ${challenger.name} vs ${opponent.name}`,
                    files: [battleImage]
                });

                let battleActive = true;
                
                while (battleActive) {
                    // Update effect durations at start of turn
                    [challenger, opponent].forEach(entity => {
                        entity.activeEffects.forEach(effect => {
                            if (effect.duration > 0) effect.duration--;
                        });
                        entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                    });

                    // Calculate effective stats for this turn
                    const effectiveChallenger = getEffectiveStats(challenger);
                    const effectiveOpponent = getEffectiveStats(opponent);

                    // Challenger's turn
                    const { embed: challengerEmbed, components: challengerComponents } = createMovesEmbed(challenger);
                    const challengerMessage = await interaction.followUp({
                        content: `<@${challengerId}> it's your turn!`,
                        embeds: [challengerEmbed],
                        components: challengerComponents,
                        fetchReply: true
                    });

                    const challengerAction = await new Promise(resolve => {
                        const collector = challengerMessage.createMessageComponentCollector({
                            filter: i => i.user.id === challengerId && i.customId.endsWith(`-${challengerId}-${roundNum}`),
                            time: 60000
                        });

                        collector.on('collect', async i => {
                            await i.deferUpdate();
                            resolve(await processPlayerMove(i.customId, challenger, opponent, effectiveChallenger, effectiveOpponent));
                            collector.stop();
                        });

                        collector.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                resolve({
                                    damage: 0,
                                    heal: 0,
                                    description: `${challenger.name} stood still (timed out)`,
                                    specialEffects: ["Missed opportunity!"],
                                    hit: false
                                });
                            }
                            // Disable all buttons
                            challengerMessage.edit({ 
                                components: challengerComponents.map(row => {
                                    const disabledRow = ActionRowBuilder.from(row);
                                    disabledRow.components.forEach(c => c.setDisabled(true));
                                    return disabledRow;
                                })
                            }).catch(console.error);
                        });
                    });

                    if (challengerAction.fled) {
                        battleActive = false;
                        await interaction.followUp(`${challenger.name} fled from the battle!`);
                        break;
                    }

                    // Apply challenger action results
                    opponentHealth -= challengerAction.damage || 0;
                    if (challengerAction.heal) {
                        challengerHealth = Math.min(challengerHealth + challengerAction.heal, challenger.health);
                    }

                    // Opponent's turn (if still alive)
                    let opponentAction = { damage: 0, heal: 0, description: `${opponent.name} is defeated`, specialEffects: [], hit: false };
                    if (opponentHealth > 0) {
                        const { embed: opponentEmbed, components: opponentComponents } = createMovesEmbed(opponent);
                        const opponentMessage = await interaction.followUp({
                            content: `<@${opponentId}> it's your turn!`,
                            embeds: [opponentEmbed],
                            components: opponentComponents,
                            fetchReply: true
                        });

                        opponentAction = await new Promise(resolve => {
                            const collector = opponentMessage.createMessageComponentCollector({
                                filter: i => i.user.id === opponentId && i.customId.endsWith(`-${opponentId}-${roundNum}`),
                                time: 60000
                            });

                            collector.on('collect', async i => {
                                await i.deferUpdate();
                                resolve(await processPlayerMove(i.customId, opponent, challenger, effectiveOpponent, effectiveChallenger));
                                collector.stop();
                            });

                            collector.on('end', (collected, reason) => {
                                if (reason === 'time') {
                                    resolve({
                                        damage: 0,
                                        heal: 0,
                                        description: `${opponent.name} stood still (timed out)`,
                                        specialEffects: ["Missed opportunity!"],
                                        hit: false
                                    });
                                }
                                // Disable all buttons
                                opponentMessage.edit({ 
                                    components: opponentComponents.map(row => {
                                        const disabledRow = ActionRowBuilder.from(row);
                                        disabledRow.components.forEach(c => c.setDisabled(true));
                                        return disabledRow;
                                    })
                                }).catch(console.error);
                            });
                        });

                        if (opponentAction.fled) {
                            battleActive = false;
                            await interaction.followUp(`${opponent.name} fled from the battle!`);
                            break;
                        }

                        // Apply opponent action results
                        challengerHealth -= opponentAction.damage || 0;
                        if (opponentAction.heal) {
                            opponentHealth = Math.min(opponentHealth + opponentAction.heal, opponent.health);
                        }
                    }

                    
                    // Update battle image
                    const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                    // Show results
                    await interaction.followUp({
                        embeds: [createBattleSummary(challengerAction, opponentAction)],
                        files: [newBattleImage]
                    });

                    // Check win conditions
                    if (challengerHealth <= 0 || opponentHealth <= 0) {
                        battleActive = false;
                        const winner = challengerHealth > 0 ? challenger : opponent;
                        const loser = challengerHealth > 0 ? opponent : challenger;
                        
                      

                        await interaction.followUp(`**${winner.name} wins the battle!**`);
                    }

                    // Passive chakra regen
                    challenger.chakra = Math.min(challenger.chakra + 3);
                    opponent.chakra = Math.min(opponent.chakra + 3);

                    roundNum++;
                    
                    // Add delay between rounds if battle continues
                    if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.error("Battle error:", error);
                await interaction.followUp("An error occurred during the battle!");
            }
        });

        challengeCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ 
                    content: 'Challenge expired!', 
                    embeds: [], 
                    components: [] 
                }).catch(console.error);
            }
        });
    }
};