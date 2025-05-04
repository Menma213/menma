//first patch Haku, Zabuza and the next one. Make Asukky a srank boss, a raid boss and the story boss!
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const srankPath = path.resolve(__dirname, '../../menma/data/srank.json');

// Load data
let jutsuList = {};
let srankBosses = {};
let jutsuData = {};
if (fs.existsSync(jutsusPath)) jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8')); // Universal jutsu definitions
if (fs.existsSync(srankPath)) srankBosses = JSON.parse(fs.readFileSync(srankPath, 'utf8')); // S-Rank bosses
if (fs.existsSync(jutsuPath)) jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8')); // Player inventory

// Cooldown tracking
const cooldowns = new Map();

// Effect handlers (unchanged from your original code)
const effectHandlers = {
    damage: (user, target, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0
                }
            };
            
            const hitChance = Math.max(0, Math.min(100, context.user.accuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            
            if (!hits) return { damage: 0, hit: false };
            
            const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
            return { damage, hit: true };
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return { damage: 0, hit: false };
        }
    },
    // ... (rest of your effect handlers remain the same) ...



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
        .setName('srank')
        .setDescription('Embark on a dangerous S-Rank mission')
        .addUserOption(option =>
            option.setName('player2')
                .setDescription('Optional second player'))
        .addUserOption(option =>
            option.setName('player3')
                .setDescription('Optional third player')),

    async execute(interaction) {
        try {
            // Check cooldown
            const cooldownTime = 60 * 1000; // 60 seconds in milliseconds
            if (cooldowns.has(interaction.user.id)) {
                const expirationTime = cooldowns.get(interaction.user.id) + cooldownTime;
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    return await interaction.reply({ 
                        content: `You must wait ${Math.ceil(timeLeft)} seconds before starting another S-Rank mission.`,
                        ephemeral: true 
                    });
                }
            }
            cooldowns.set(interaction.user.id, Date.now());

            await interaction.deferReply();

            const userId = interaction.user.id;
            const player2 = interaction.options.getUser('player2');
            const player3 = interaction.options.getUser('player3');

            // Load user data
            if (!fs.existsSync(usersPath)) {
                return await interaction.editReply({ content: "Database not found." });
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (!users[userId]) {
                return await interaction.editReply({ content: "You need to enroll first!" });
            }

            const players = [
                { id: userId, username: interaction.user.username, ...users[userId] }
            ];

            if (player2) {
                if (!users[player2.id]) {
                    return await interaction.editReply({ content: `${player2.username} needs to enroll first!` });
                }
                players.push({ id: player2.id, username: player2.username, ...users[player2.id] });
            }

            if (player3) {
                if (!users[player3.id]) {
                    return await interaction.editReply({ content: `${player3.username} needs to enroll first!` });
                }
                players.push({ id: player3.id, username: player3.username, ...users[player3.id] });
            }

            // Create boss selection menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('srank_boss_selection')
                .setPlaceholder('Select an S-Rank mission')
                .addOptions(
                    Object.entries(srankBosses).map(([bossId, boss]) => ({
                        label: boss.name,
                        description: `Power: ${boss.power} | Health: ${boss.health}`,
                        value: bossId
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('S-Rank Mission Selection')
                .setDescription('Choose your opponent carefully! These are extremely dangerous missions.')
                .setColor('#FF0000')
                .setFooter({ text: 'Warning: High chance of defeat!' });

            const message = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Handle boss selection
            const filter = i => i.user.id === userId && i.customId === 'srank_boss_selection';
            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    collector.stop(); // Immediately stop the collector after selection
                    
                    const bossId = i.values[0];
                    const boss = srankBosses[bossId];
                    
                    // Initialize battle
                    const npc = {
                        ...boss,
                        activeEffects: [],
                        jutsu: boss.jutsu.map(j => jutsuList[j] ? j : 'Attack'),
                        currentHealth: boss.health
                    };

                    // Multiplayer adjustments
                    const totalPlayerHealth = players.reduce((sum, player) => sum + player.health, 0);
                    const totalPlayerChakra = players.reduce((sum, player) => sum + player.chakra, 0);

                    // Generate battle image with proper HP bar sizing
                    const generateBattleImage = async () => {
                        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                        const page = await browser.newPage();
                        await page.setViewport({ width: 700, height: 350 });

                        const playerHealthPercent = Math.max((totalPlayerHealth / totalPlayerHealth) * 100, 0);
                        const npcHealthPercent = Math.max((npc.currentHealth / npc.health) * 100, 0);

                        const htmlContent = `
                            <html>
                            <body style="margin: 0; padding: 0; position: relative;">
                                <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                                
                                <div style="position: absolute; left: 50px; top: 50px;">
                                    <img src="${npc.image}" width="120" />
                                </div>

                                <div style="position: absolute; right: 50px; top: 50px;">
                                    <img src="${interaction.user.displayAvatarURL({ format: 'png', size: 128 })}" width="120" />
                                </div>

                                <div style="position: absolute; left: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                                    <div style="width: ${npcHealthPercent}%; height: 100%; background: #6e1515;"></div>
                                    <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(npc.currentHealth)}/${npc.health}</div>
                                </div>

                                <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                                    <div style="width: ${playerHealthPercent}%; height: 100%; background: #6e1515;"></div>
                                    <div style="position: absolute; left: 0; top: 0; color: white; font-size: 12px; padding: 1px 4px;">${Math.round(totalPlayerHealth)}/${totalPlayerHealth}</div>
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

                    // Execute a jutsu
                    const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) => {
                        const jutsu = jutsuList[jutsuName];
                        if (!jutsu) {
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${baseUser.name} attempted unknown jutsu: ${jutsuName}`,
                                specialEffects: ["Jutsu failed!"],
                                hit: false
                            };
                        }

                        const result = {
                            damage: 0,
                            heal: 0,
                            description: `${baseUser.name} used ${jutsu.name}`,
                            specialEffects: [],
                            hit: true
                        };

                        if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                                specialEffects: ["Chakra exhausted!"],
                                hit: false
                            };
                        }
                        baseUser.chakra -= jutsu.chakraCost || 0;

                        jutsu.effects.forEach(effect => {
                            try {
                                switch (effect.type) {
                                    case 'damage':
                                        const hasHiddenMist = effectiveUser.activeEffects?.some(e => 
                                            e.type === 'buff' && e.stats?.dodge > 0
                                        );
                                        const context = {
                                            user: {
                                                power: effectiveUser.power,
                                                defense: effectiveUser.defense,
                                                health: effectiveUser.health,
                                                chakra: effectiveUser.chakra,
                                                accuracy: effectiveUser.accuracy
                                            },
                                            target: {
                                                power: effectiveTarget.power,
                                                defense: effectiveTarget.defense,
                                                health: effectiveTarget.health,
                                                chakra: effectiveTarget.chakra,
                                                dodge: effectiveTarget.dodge
                                            },
                                            hasHiddenMist
                                        };
                                        
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

                    // Create moves embed
                    const createMovesEmbed = () => {
                        const embed = new EmbedBuilder()
                            .setTitle(`Round 1 - ${players[0].username}'s Turn`)
                            .setColor('#FF0000')
                            .setDescription(`S-Rank Mission: ${npc.name}`)
                            .addFields({
                                name: "Jutsu Slots",
                                value: Object.entries(players[0].jutsu)
                                    .filter(([_, jutsu]) => jutsu !== 'None')
                                    .map(([slot, jutsu]) => {
                                        const jutsuData = jutsuList[jutsu];
                                        return `${slot.replace('_', ' ')}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                                    })
                                    .join('\n')
                            })
                            .addFields({
                                name: "Stats",
                                value: `Accuracy: ${players[0].accuracy}%\nDodge: ${players[0].dodge}%`
                            })
                            .setFooter({ text: `Chakra: ${players[0].chakra}/10 | Health: ${players[0].health}/${players[0].health}` });

                        const rows = [];
                        let currentRow = new ActionRowBuilder();
                        
                        Object.entries(players[0].jutsu).forEach(([slot, jutsuName]) => {
                            if (jutsuName !== 'None') {
                                const jutsu = jutsuList[jutsuName];
                                const disabled = players[0].chakra < (jutsu?.chakraCost || 0);
                                
                                if (currentRow.components.length >= 5) {
                                    rows.push(currentRow);
                                    currentRow = new ActionRowBuilder();
                                }
                                
                                currentRow.addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`${jutsuName}-${userId}-1`)
                                        .setLabel(`${slot.replace('_', ' ')}: ${jutsu?.name || jutsuName}`)
                                        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                        .setDisabled(disabled)
                                );
                            }
                        });

                        const utilityRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`rest-${userId}-1`)
                                    .setLabel('Rest (+1 Chakra)')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId(`flee-${userId}-1`)
                                    .setLabel('Flee')
                                    .setStyle(ButtonStyle.Danger)
                            );

                        if (currentRow.components.length > 0) {
                            rows.push(currentRow);
                        }
                        rows.push(utilityRow);

                        return { embed, components: rows };
                    };

                    // Modified processPlayerMove to handle timeout differently
                    const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
                        const action = customId.split('-')[0];
                        
                        if (action === 'rest') {
                            basePlayer.chakra = Math.min(basePlayer.chakra + 1, 10);
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
                        
                        return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
                    };
                    // NPC chooses move
                    const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
                        const stunnedEffect = baseNpc.activeEffects.find(e => e.type === 'status' && e.status === 'stun');
                        if (stunnedEffect) {
                            return {
                                damage: 0,
                                heal: 0,
                                description: `${baseNpc.name} is stunned and can't move!`,
                                specialEffects: ["Stun active"],
                                hit: false
                            };
                        }

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
                                specialEffects: ["+1 Chakra"],
                                hit: true
                            };
                        }

                        const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
                        return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
                    };

                    // Calculate effective stats
                    const getEffectiveStats = (entity) => {
                        const stats = { ...entity };
                        delete stats.activeEffects;

                        const effectiveStats = {
                            power: stats.power || 10,
                            defense: stats.defense || 10,
                            chakra: stats.chakra || 10,
                            health: stats.health || 100,
                            accuracy: stats.accuracy || 100,
                            dodge: stats.dodge || 0
                        };

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
                            .setTitle(`Round 1 Summary`)
                            .setColor('#FF0000')
                            .addFields(
                                {
                                    name: `${players[0].username}`,
                                    value: `${playerAction.description}\n${playerAction.damage ? `Dealt **${Math.round(playerAction.damage)}** damage` : ''}${!playerAction.hit ? ' (Missed!)' : ''}${playerAction.specialEffects?.length ? '\n' + playerAction.specialEffects.join('\n') : ''}`
                                },
                                {
                                    name: `${npc.name}`,
                                    value: `${npcAction.description}\n${npcAction.damage ? `Dealt **${Math.round(npcAction.damage)}** damage` : ''}${!npcAction.hit ? ' (Missed!)' : ''}${npcAction.specialEffects?.length ? '\n' + npcAction.specialEffects.join('\n') : ''}`
                                },
                                {
                                    name: 'Battle Status',
                                    value: `${players[0].username}: ${players[0].health}/${players[0].health} HP\n${npc.name}: ${Math.round(npc.currentHealth)}/${npc.health} HP`
                                }
                            );

                        const playerEffects = players[0].activeEffects.map(e => 
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
                                value: `**${players[0].username}**: ${playerEffects.join(', ') || 'None'}\n**${npc.name}**: ${npcEffects.join(', ') || 'None'}`
                            });
                        }

                        embed.setFooter({ text: `Your Chakra: ${players[0].chakra}` });

                        return embed;
                    };

                    // Start battle
                    const battleImage = new AttachmentBuilder(await generateBattleImage());
                    await interaction.editReply({ 
                        content: `**S-Rank Mission Started!** You're facing ${npc.name}!`,
                        files: [battleImage]
                    });

                    let battleActive = true;
                    let roundNum = 1;
                    let playerHealth = totalPlayerHealth;
                    
                    while (battleActive) {
                        // Ensure activeEffects is initialized for all entities
                        [players[0], npc].forEach(entity => {
                            if (!entity.activeEffects) entity.activeEffects = [];
                            entity.activeEffects.forEach(effect => {
                                if (effect.duration > 0) effect.duration--;
                            });
                            entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                        });

                        // Calculate effective stats
                        const effectivePlayer = getEffectiveStats(players[0]);
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
                                resolve(await processPlayerMove(i.customId, players[0], npc, effectivePlayer, effectiveNpc));
                                collector.stop();
                            });
    
                            collector.on('end', (collected, reason) => {
                                if (reason === 'time') {
                                    resolve({ fled: true });
                                }
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
                            await interaction.followUp(`${players[0].username} fled from the battle!`);
                            break;
                        }

                        // Apply player action
                        npc.currentHealth -= playerAction.damage || 0;
                        if (playerAction.heal) {
                            playerHealth = Math.min(playerHealth + playerAction.heal, totalPlayerHealth);
                        }

                        // NPC turn
                        let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
                        if (npc.currentHealth > 0) {
                            npcAction = npcChooseMove(npc, players[0], effectiveNpc, effectivePlayer);
                            playerHealth -= npcAction.damage || 0;
                            if (npcAction.heal) {
                                npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                            }
                        }

                       
                       

                        // Update battle image
                        const newBattleImage = new AttachmentBuilder(await generateBattleImage());

                        // Show results
                        await interaction.followUp({
                            embeds: [createBattleSummary(playerAction, npcAction)],
                            files: [newBattleImage]
                        });

                         // Modified victory/defeat messages to use embeds
                    if (playerHealth > 0) {
                        const expReward = 500 + Math.floor(players[0].level * 50);
                        const moneyReward = 1000 + Math.floor(players[0].level * 30);
                        players.forEach(player => {
                            users[player.id].exp += expReward;
                            users[player.id].money += moneyReward;
                            users[player.id].wins += 1;
                            users[player.id].health = player.health;

                            // Check for jutsu reward
                            if (Math.random() < boss.rewardChance) {
                                if (!jutsuData[player.id]) jutsuData[player.id] = { usersjutsu: [] };
                                if (!jutsuData[player.id].usersjutsu.includes(boss.reward)) {
                                    jutsuData[player.id].usersjutsu.push(boss.reward);
                                }
                            }
                        });

                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        fs.writeFileSync(jutsuPath, JSON.stringify(jutsuData, null, 2));

                        const victoryEmbed = new EmbedBuilder()
                            .setTitle('Mission Complete!')
                            .setColor('#00FF00')
                            .setDescription(`You defeated ${npc.name}!`)
                            .addFields(
                                { name: 'EXP Gained', value: expReward.toString(), inline: true },
                                { name: 'Money Earned', value: `${moneyReward} Ryo`, inline: true }
                            );

                        await interaction.followUp({ embeds: [victoryEmbed] });
                        battleActive = false; // Ensure the battle ends cleanly
                    } else {
                        const defeatEmbed = new EmbedBuilder()
                            .setTitle('Mission Failed')
                            .setColor('#FF0000')
                            .setDescription(`You were defeated by ${npc.name}...`);
                        await interaction.followUp({ embeds: [defeatEmbed] });
                        battleActive = false; // Ensure the battle ends cleanly
                    }


                        // Passive chakra regen
                        players[0].chakra = Math.min(players[0].chakra + 3, 1000000);
                        npc.chakra = Math.min(npc.chakra + 3, 1000000000000);

                        roundNum++;
                        
                        // Add delay between rounds
                        if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (error) {
                    console.error("Battle error:", error);
                    await interaction.followUp("An error occurred during the battle!");
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.followUp({ content: 'Mission selection timed out.' });
                }
            });
        } catch (error) {
            console.error("Command error:", error);
            await interaction.editReply({ content: "An error occurred while executing this command." });
        }
    }
};
