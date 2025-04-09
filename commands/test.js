const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Effect handlers
const effectHandlers = {
    damageFormula: (user, target, formula) => {
        // Validate user and target properties
        validateVariables(user, target, formula);

        if (typeof formula === 'number') return formula; // If formula is a number, return it directly
        return Math.max(0, math.evaluate(formula, { user, target }));
    },
    userBuffs: (user, buffs) => {
        const changes = {};
        for (const [stat, formula] of Object.entries(buffs)) {
            validateVariables(user, null, formula);

            changes[stat] = typeof formula === 'number' ? formula : math.evaluate(formula, { user });
        }
        return changes;
    },
    targetDebuffs: (target, debuffs) => {
        const changes = {};
        for (const [stat, formula] of Object.entries(debuffs)) {
            validateVariables(null, target, formula);

            changes[stat] = typeof formula === 'number' ? formula : math.evaluate(formula, { target });
        }
        return changes;
    },
    heal: (user, formula) => {
        validateVariables(user, null, formula);

        if (typeof formula === 'number') return formula; // If formula is a number, return it directly
        return Math.max(0, math.evaluate(formula, { user }));
    },
    instantKill: (chance) => Math.random() < chance,
    stun: (chance) => Math.random() < chance
};

// Helper function to validate variables
function validateVariables(user, target, formula) {
    const variables = formula.match(/[a-zA-Z_][a-zA-Z0-9_.]*/g); // Extract variable names from the formula
    if (!variables) return;

    for (const variable of variables) {
        const [object, property] = variable.split('.');
        if (object === 'user' && (!user || user[property] === undefined)) {
            throw new Error(`Invalid formula: ${variable} is undefined in user object`);
        }
        if (object === 'target' && (!target || target[property] === undefined)) {
            throw new Error(`Invalid formula: ${variable} is undefined in target object`);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test your skills against an NPC opponent'),

    async execute(interaction) {
        const userId = interaction.user.id;

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        const player = users[userId];
        const npc = {
            name: "Training Dummy",
            health: 800,
            power: 60,
            defense: 30,
            chakra: 10,
            jutsu: ["Attack", "Transformation Jutsu"],
            stunned: false
        };

        let roundNum = 1;
        let playerHealth = player.health;
        let npcHealth = npc.health;

        // Generate battle image (original version)
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
                    </div>

                    <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${npcHealthPercent}%; height: 100%; background: red;"></div>
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

        // Create moves embed with proper button organization
        const createMovesEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle(`Round ${roundNum} - ${interaction.user.username}'s Turn`)
                .setColor('#0099ff')
                .setDescription("Select your jutsu!")
                .addFields({
                    name: "Available Jutsu",
                    value: player.jutsu.map((j, i) => {
                        const jutsu = jutsuList[j];
                        return `${i + 1}. **${j}**${jutsu?.chakraCost ? ` (${jutsu.chakraCost} Chakra)` : ''} - ${jutsu?.description || 'Basic attack'}`;
                    }).join('\n')
                })
                .setFooter({ text: `Chakra: ${player.chakra}/10 | Health: ${Math.round(playerHealth)}/${player.health}` });
        
            // Create unique action rows with unique custom IDs
            const rows = [];
            let currentRow = new ActionRowBuilder();
        
            // Add jutsu buttons with unique custom IDs
            player.jutsu.forEach((jutsuName, index) => {
                const jutsu = jutsuList[jutsuName];
                const disabled = jutsu?.chakraCost > player.chakra;
        
                // Create a unique custom ID by combining jutsu name, round number, and user ID
                const customId = `${jutsuName}-${roundNum}-${userId}-${index}`;
        
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customId)
                        .setLabel(`${index + 1}. ${jutsuName}`)
                        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(disabled)
                );
        
                // Start a new row after 5 buttons
                if (currentRow.components.length === 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
            });
        
            // Add any remaining buttons to a row
            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }
        
            // Add utility buttons in their own row
            const utilityRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rest-${roundNum}-${userId}`)
                        .setLabel('Rest (+1 Chakra)')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`flee-${roundNum}-${userId}`)
                        .setLabel('Flee')
                        .setStyle(ButtonStyle.Danger)
                );
            rows.push(utilityRow);
        
            return { embed, components: rows };
        };
        // Execute any jutsu
        const executeJutsu = (user, target, jutsu) => {
            const result = {
                damage: 0,
                description: jutsu.description,
                userEffects: {},
                targetEffects: {},
                specialEffects: []
            };

            if (jutsu.effects) {
                // Damage
                if (jutsu.effects.damageFormula) {
                    result.damage = effectHandlers.damageFormula(user, target, jutsu.effects.damageFormula);
                }

                // Buffs/Debuffs
                if (jutsu.effects.userBuffs) {
                    result.userEffects = effectHandlers.userBuffs(user, jutsu.effects.userBuffs);
                }
                if (jutsu.effects.targetDebuffs) {
                    result.targetEffects = effectHandlers.targetDebuffs(target, jutsu.effects.targetDebuffs);
                }

                // Healing
                if (jutsu.effects.heal) {
                    const healAmount = effectHandlers.heal(user, jutsu.effects.heal);
                    result.userEffects.heal = healAmount;
                    result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                }

                // Instant Kill
                if (jutsu.effects.instantKillChance) {
                    if (effectHandlers.instantKill(jutsu.effects.instantKillChance)) {
                        result.damage = target.health;
                        result.specialEffects.push("INSTANT KILL!");
                    }
                }

                // Stun
                if (jutsu.effects.stun) {
                    if (effectHandlers.stun(jutsu.effects.stun)) {
                        target.stunned = true;
                        result.specialEffects.push("STUNNED the opponent!");
                    }
                }
            }

            return result;
        };

        // Process player move
        const processPlayerMove = async (customId) => {
            // Extract the base action from the custom ID
            const action = customId.split('-')[0];
            
            if (action === 'rest') {
                player.chakra = Math.min(player.chakra + 1, 10);
                return {
                    damage: 0,
                    description: "gathered chakra and rested",
                    specialEffects: ["+1 Chakra"]
                };
            }
            
            if (action === 'flee') {
                return { fled: true };
            }
            
            const jutsu = jutsuList[action];
            if (!jutsu) {
                return {
                    damage: 0,
                    description: "attempted an unknown technique!",
                    specialEffects: ["Jutsu failed!"]
                };
            }
            
            if (jutsu.chakraCost > player.chakra) {
                return {
                    damage: 0,
                    description: "failed to perform jutsu (not enough chakra)",
                    specialEffects: ["Chakra exhausted!"]
                };
            }
            
            player.chakra -= jutsu.chakraCost;
            return executeJutsu(player, npc, jutsu);
        };

        // NPC chooses move
        const npcChooseMove = () => {
            if (npc.stunned) {
                npc.stunned = false;
                return {
                    damage: 0,
                    description: "is stunned and can't move!",
                    specialEffects: ["Stun cleared"]
                };
            }

            const availableJutsu = npc.jutsu.filter(j => {
                const jutsu = jutsuList[j];
                return jutsu && (jutsu.chakraCost || 0) <= npc.chakra;
            });

            if (availableJutsu.length === 0) {
                npc.chakra = Math.min(npc.chakra + 1, 10);
                return {
                    damage: 0,
                    description: "gathered chakra and rested",
                    specialEffects: ["+1 Chakra"]
                };
            }

            const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
            const jutsu = jutsuList[randomJutsu];
            npc.chakra -= jutsu.chakraCost || 0;
            
            return executeJutsu(npc, player, jutsu);
        };

        // Create battle summary
        const createBattleSummary = (playerAction, npcAction) => {
            return new EmbedBuilder()
                .setTitle(`Round ${roundNum} Summary`)
                .setColor('#FFA500')
                .addFields(
                    {
                        name: `${interaction.user.username}`,
                        value: `${playerAction.description}\n${playerAction.damage ? `Dealt **${Math.round(playerAction.damage)}** damage` : ''}${playerAction.specialEffects?.length ? '\n' + playerAction.specialEffects.join('\n') : ''}`
                    },
                    {
                        name: `${npc.name}`,
                        value: `${npcAction.description}\n${npcAction.damage ? `Dealt **${Math.round(npcAction.damage)}** damage` : ''}${npcAction.specialEffects?.length ? '\n' + npcAction.specialEffects.join('\n') : ''}`
                    },
                    {
                        name: 'Battle Status',
                        value: `${interaction.user.username}: ${Math.round(playerHealth)} HP\n${npc.name}: ${Math.round(npcHealth)} HP`
                    }
                )
                .setFooter({ text: `Your Chakra: ${player.chakra}` });
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
                // Player turn
                const { embed, components } = createMovesEmbed();
                const moveMessage = await interaction.followUp({
                    embeds: [embed],
                    components: components
                });

                const playerAction = await new Promise(resolve => {
                    const collector = moveMessage.createMessageComponentCollector({
                        filter: i => i.user.id === userId,
                        time: 30000
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        resolve(await processPlayerMove(i.customId));
                        collector.stop();
                    });

                    collector.on('end', () => {
                        if (!collector.collected.size) {
                            resolve({ 
                                damage: 0, 
                                description: "stood still (timed out)",
                                specialEffects: ["Missed opportunity!"]
                            });
                        }
                    });
                });

                if (playerAction.fled) {
                    battleActive = false;
                    await interaction.followUp("You fled from the training battle!");
                    break;
                }

                // Apply player effects
                if (playerAction.userEffects?.heal) {
                    playerHealth = Math.min(playerHealth + playerAction.userEffects.heal, player.health);
                }
                npcHealth -= playerAction.damage;

                // NPC turn (if still alive)
                let npcAction = { damage: 0, description: "is defeated", specialEffects: [] };
                if (npcHealth > 0) {
                    npcAction = npcChooseMove();
                    playerHealth -= npcAction.damage;
                }

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
                if (battleActive) await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error("Battle error:", error);
            await interaction.followUp("An error occurred during the battle!");
        }
    }
};