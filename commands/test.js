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
                    chakra: Number(user.chakra) || 0
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1, // Ensure at least 1 to prevent division by zero
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0
                }
            };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return 0;
        }
    },

    buff: (user, statsDefinition) => {
        const changes = {};
        const context = {
            user: {
                power: Number(user.power) || 0,
                defense: Number(user.defense) || 0,
                health: Number(user.health) || 0,
                chakra: Number(user.chakra) || 0
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
                chakra: Number(target.chakra) || 0
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
        .setName('test')
        .setDescription('Test your skills against an NPC opponent'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Load user data
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Initialize battle entities
        const player = {
            ...users[userId],
            name: interaction.user.username,
            activeEffects: []
        };

        const npc = {
            name: "Training Dummy",
            health: 800,
            power: 60,
            defense: 30,
            chakra: 10,
            jutsu: ["Attack", "Transformation Jutsu"],
            activeEffects: []
        };

        let roundNum = 1;
        let playerHealth = player.health;
        let npcHealth = npc.health;

        // Generate battle image
        const generateBattleImage = async () => {
            const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setViewport({ width: 700, height: 350 });

            const playerHealthPercent = Math.max((playerHealth / player.health) * 100, 0);
            const npcHealthPercent = Math.max((npcHealth / npc.health) * 100, 0);

            const htmlContent = `
                <html>
                <body style="margin: 0; padding: 0; position: relative;">
                    <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                    
                    <div style="position: absolute; left: 50px; top: 50px;">
                        <img src="${interaction.user.displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                    </div>

                    <div style="position: absolute; right: 50px; top: 50px;">
                        <img src="https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg" width="120" />
                    </div>

                    <div style="position: absolute; left: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${playerHealthPercent}%; height: 100%; background: green;"></div>
                        <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(playerHealth)}/${player.health}</div>
                    </div>

                    <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${npcHealthPercent}%; height: 100%; background: red;"></div>
                        <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(npcHealth)}/${npc.health}</div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(htmlContent);
            const imagePath = `./battle_${userId}.png`;
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
                    specialEffects: ["Jutsu failed!"]
                };
            }

            const result = {
                damage: 0,
                heal: 0,
                description: `${baseUser.name || 'User'} used ${jutsu.name}`,
                specialEffects: []
            };

            // Check and deduct chakra from base user
            if ((baseUser.chakra || 0) < jutsu.chakraCost) {
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name || 'User'} failed to perform ${jutsu.name} (not enough chakra)`,
                    specialEffects: ["Chakra exhausted!"]
                };
            }
            baseUser.chakra -= jutsu.chakraCost;

            // Process all effects
            jutsu.effects.forEach(effect => {
                try {
                    switch (effect.type) {
                        case 'damage':
                            const damage = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula);
                            result.damage += damage;
                            if (damage > 0) {
                                result.specialEffects.push(`Dealt ${Math.round(damage)} damage`);
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
                    }
                } catch (err) {
                    console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                    result.specialEffects.push(`Error applying ${effect.type} effect`);
                }
            });

            return result;
        };

        // Create moves embed with slot system
        const createMovesEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} - ${player.name}'s Turn`)
                .setColor('#0099ff')
                .setDescription("Select your move!")
                .addFields({
                    name: "Jutsu Slots",
                    value: Object.entries(player.jutsu)
                        .filter(([_, jutsu]) => jutsu !== 'None')
                        .map(([slot, jutsu]) => {
                            const jutsuData = jutsuList[jutsu];
                            return `${slot.replace('_', ' ')}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                        })
                        .join('\n')
                })
                .setFooter({ text: `Chakra: ${player.chakra}/10 | Health: ${Math.round(playerHealth)}/${player.health}` });

            const rows = [];
            let currentRow = new ActionRowBuilder();
            
            // Add buttons for each equipped jutsu
            Object.entries(player.jutsu).forEach(([slot, jutsuName]) => {
                if (jutsuName !== 'None') {
                    const jutsu = jutsuList[jutsuName];
                    const disabled = player.chakra < (jutsu?.chakraCost || 0);
                    
                    if (currentRow.components.length >= 5) {
                        rows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                    }
                    
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`${jutsuName}-${userId}-${roundNum}`)
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
                        .setCustomId(`rest-${userId}-${roundNum}`)
                        .setLabel('Rest (+1 Chakra)')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`flee-${userId}-${roundNum}`)
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
        const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
            const action = customId.split('-')[0];
            
            if (action === 'rest') {
                basePlayer.chakra = Math.min(basePlayer.chakra + 1, 10);
                return {
                    damage: 0,
                    heal: 0,
                    description: `${basePlayer.name} gathered chakra and rested`,
                    specialEffects: ["+1 Chakra"]
                };
            }
            
            if (action === 'flee') {
                return { fled: true };
            }
            
            return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
        };

        // NPC chooses move with effective stats
        const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
            // Check if stunned
            const stunnedEffect = baseNpc.activeEffects.find(e => e.type === 'status' && e.status === 'stun');
            if (stunnedEffect) {
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseNpc.name} is stunned and can't move!`,
                    specialEffects: ["Stun active"]
                };
            }

            // Filter available jutsu based on chakra
            const availableJutsu = baseNpc.jutsu.filter(j => {
                const jutsu = jutsuList[j];
                return jutsu && (jutsu.chakraCost || 0) <= baseNpc.chakra;
            });

            if (availableJutsu.length === 0) {
                baseNpc.chakra = Math.min(baseNpc.chakra + 1, 10);
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseNpc.name} gathered chakra and rested`,
                    specialEffects: ["+1 Chakra"]
                };
            }

            const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
            return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
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
                health: stats.health || 100
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
        const createBattleSummary = (playerAction, npcAction) => {
            const embed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} Summary`)
                .setColor('#FFA500')
                .addFields(
                    {
                        name: `${player.name}`,
                        value: `${playerAction.description}\n${playerAction.damage ? `Dealt **${Math.round(playerAction.damage)}** damage` : ''}${playerAction.specialEffects?.length ? '\n' + playerAction.specialEffects.join('\n') : ''}`
                    },
                    {
                        name: `${npc.name}`,
                        value: `${npcAction.description}\n${npcAction.damage ? `Dealt **${Math.round(npcAction.damage)}** damage` : ''}${npcAction.specialEffects?.length ? '\n' + npcAction.specialEffects.join('\n') : ''}`
                    },
                    {
                        name: 'Battle Status',
                        value: `${player.name}: ${Math.round(playerHealth)} HP\n${npc.name}: ${Math.round(npcHealth)} HP`
                    }
                );

            // Add active effects if any
            const playerEffects = player.activeEffects.map(e => 
                e.type === 'status' ? e.status : 
                `${e.type}: ${Object.entries(e.stats).map(([k,v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(', ')} (${e.duration}t)`
            ).filter(Boolean);

            const npcEffects = npc.activeEffects.map(e => 
                e.type === 'status' ? e.status : 
                `${e.type}: ${Object.entries(e.stats).map(([k,v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(', ')} (${e.duration}t)`
            ).filter(Boolean);

            if (playerEffects.length > 0 || npcEffects.length > 0) {
                embed.addFields({
                    name: 'Active Effects',
                    value: `**${player.name}**: ${playerEffects.join(', ') || 'None'}\n**${npc.name}**: ${npcEffects.join(', ') || 'None'}`
                });
            }

            embed.setFooter({ text: `Your Chakra: ${player.chakra}` });

            return embed;
        };

        // Start battle
        try {
            const battleImage = new AttachmentBuilder(await generateBattleImage());
            await interaction.reply({ 
                content: "**Training Battle Started!**",
                files: [battleImage]
            });

            let battleActive = true;
            
            while (battleActive) {
                // Update effect durations at start of turn
                [player, npc].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (effect.duration > 0) effect.duration--;
                    });
                    entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                });

                // Calculate effective stats for this turn
                const effectivePlayer = getEffectiveStats(player);
                const effectiveNpc = getEffectiveStats(npc);

                // Player turn
                const { embed, components } = createMovesEmbed();
                const moveMessage = await interaction.followUp({
                    embeds: [embed],
                    components: components,
                    fetchReply: true
                });

                const playerAction = await new Promise(resolve => {
                    const collector = moveMessage.createMessageComponentCollector({
                        filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                        time: 60000
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        resolve(await processPlayerMove(i.customId, player, npc, effectivePlayer, effectiveNpc));
                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: `${player.name} stood still (timed out)`,
                                specialEffects: ["Missed opportunity!"]
                            });
                        }
                        // Disable all buttons
                        moveMessage.edit({ 
                            components: components.map(row => {
                                const disabledRow = ActionRowBuilder.from(row);
                                disabledRow.components.forEach(c => c.setDisabled(true));
                                return disabledRow;
                            })
                        }).catch(console.error);
                    });
                });

                if (playerAction.fled) {
                    battleActive = false;
                    await interaction.followUp("You fled from the training battle!");
                    break;
                }

                // Apply player action results
                npcHealth -= playerAction.damage || 0;
                if (playerAction.heal) {
                    playerHealth = Math.min(playerHealth + playerAction.heal, player.health);
                }

                // NPC turn (if still alive)
                let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [] };
                if (npcHealth > 0) {
                    npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                    playerHealth -= npcAction.damage || 0;
                    if (npcAction.heal) {
                        npcHealth = Math.min(npcHealth + npcAction.heal, npc.health);
                    }
                }

                // Ensure health doesn't go below 0
                playerHealth = Math.max(0, playerHealth);
                npcHealth = Math.max(0, npcHealth);

                // Update battle image
                const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                // Show results
                await interaction.followUp({
                    embeds: [createBattleSummary(playerAction, npcAction)],
                    files: [newBattleImage]
                });

                // Check win conditions
                if (playerHealth <= 0) {
                    battleActive = false;
                    await interaction.followUp(`**You were defeated!** The training dummy mocks you as you collapse...`);
                } else if (npcHealth <= 0) {
                    battleActive = false;
                    await interaction.followUp(`**Victory!** You destroyed the training dummy!`);
                }

                // Passive chakra regen
                player.chakra = Math.min(player.chakra + 1, 10);
                npc.chakra = Math.min(npc.chakra + 1, 10);

                roundNum++;
                
                // Add delay between rounds if battle continues
                if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (error) {
            console.error("Battle error:", error);
            await interaction.followUp("An error occurred during the battle!");
        }
    }
};