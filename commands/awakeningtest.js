const {
    SlashCommandBuilder
} = require('discord.js');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const bloodlines = [{
    name: 'Sharingan',
    description: 'Enhanced vision, allows predicting opponent moves.',
    abilities: {
        standard: [{
            name: 'Genjutsu',
            description: 'Inflict confusion.',
            cost: 20,
            effect: (player, enemy) => {
                enemy.confusion = true;
                return `${player.name} cast Genjutsu on ${enemy.name}! They are confused.`;
            }
        }, {
            name: 'Taijutsu Boost',
            description: 'Temporarily increase physical attack.',
            cost: 15,
            effect: (player, enemy) => {
                player.attackBoost = 5;
                setTimeout(() => player.attackBoost = 0, 5000); // Boost lasts 5 seconds
                return `${player.name} uses Taijutsu Boost! Their next attacks will be stronger.`;
            }
        }],
        awakened: [{
            name: 'Mangekyo Genjutsu',
            description: 'Overwhelm opponent with illusions.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                enemy.hp = Math.max(0, enemy.hp - 40);
                return `${player.name} unleashes Mangekyo Genjutsu! ${enemy.name} is overwhelmed and takes heavy damage.`;
            }
        }, {
            name: 'Susanoo',
            description: 'Summon a powerful armored warrior.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                player.defense += 10;
                enemy.hp = Math.max(0, enemy.hp - 20);
                return `${player.name} summons Susanoo! Their defense increases, and they strike their opponent.`;
            }
        }]
    }
}, {
    name: 'Byakugan',
    description: 'See chakra points and predict movements.',
    abilities: {
        standard: [{
            name: 'Chakra Sight',
            description: 'Reveal enemy weaknesses.',
            cost: 25,
            effect: (player, enemy) => {
                return `${player.name} uses Chakra Sight. ${enemy.name}'s weak points are revealed.`;
            }
        }, {
            name: 'Gentle Fist',
            description: 'Disrupt enemy chakra flow.',
            cost: 20,
            effect: (player, enemy) => {
                enemy.chakra = Math.max(0, enemy.chakra - 30);
                return `${player.name} strikes ${enemy.name}'s chakra points with Gentle Fist!`;
            }
        }],
        awakened: [{
            name: 'Eight Inner Gates',
            description: 'Unlock incredible physical prowess.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                player.attack += 15;
                setTimeout(() => player.attack -= 15, 7000); // Boost lasts 7 seconds
                enemy.hp = Math.max(0, enemy.hp - 30);
                return `${player.name} opens the Eight Inner Gates! Their attacks become devastating.`;
            }
        }, {
            name: 'All-Seeing Byakugan',
            description: 'Gain superior perception and targeting.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                player.accuracy = 1.0; // 100% hit chance
                setTimeout(() => player.accuracy = 0.9, 5000); // Reset after 5 seconds
                return `${player.name}'s Byakugan reaches its peak, ensuring every strike lands true.`;
            }
        }]
    }
}, {
    name: 'Rinnegan',
    description: 'Possesses all five basic nature transformations and extraordinary abilities.',
    abilities: {
        standard: [{
            name: 'Universal Pull',
            description: 'Pull enemies towards you or push them away.',
            cost: 30,
            effect: (player, enemy) => {
                enemy.hp = Math.max(0, enemy.hp - 25);
                return `${player.name} uses Universal Pull, drawing ${enemy.name} closer and dealing damage.`;
            }
        }, {
            name: 'Chakra Absorption',
            description: 'Drain a small amount of enemy chakra.',
            cost: 10,
            effect: (player, enemy) => {
                const drained = Math.min(enemy.chakra, 20);
                enemy.chakra -= drained;
                player.chakra += drained;
                return `${player.name} absorbs ${drained} chakra from ${enemy.name}.`;
            }
        }],
        awakened: [{
            name: 'Chibaku Tensei',
            description: 'Create a massive celestial body to crush opponents.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                enemy.hp = Math.max(0, enemy.hp - 60);
                return `${player.name} unleashes Chibaku Tensei! ${enemy.name} is crushed by a falling celestial body.`;
            }
        }, {
            name: 'Six Paths Power',
            description: 'A surge of immense power grants temporary invincibility and devastating strikes.',
            cost: 0, // Free when awakened
            effect: (player, enemy) => {
                player.isInvincible = true;
                setTimeout(() => player.isInvincible = false, 3000); // Invincible for 3 seconds
                enemy.hp = Math.max(0, enemy.hp - 35);
                return `${player.name} taps into Six Paths Power! They become momentarily invulnerable and strike with immense force.`;
            }
        }]
    }
}, {
    name: 'None',
    description: 'No special bloodline.',
    abilities: {
        standard: [{
            name: 'Basic Attack',
            description: 'A standard physical strike.',
            cost: 0,
            effect: (player, enemy) => {
                return `${player.name} lands a basic attack on ${enemy.name}.`;
            }
        }],
        awakened: []
    }
}];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('awakeningtest')
        .setDescription('Naruto themed game wit chamemode to test these abilities.')
        .addStringOption(option =>
            option.setName('bloodline')
            .setDescription('Choose your bloodline for the test.')
            .setRequired(true)
            .addChoices(...bloodlines.map(b => ({
                name: b.name,
                value: b.name
            })))),
    async execute(interaction, client) {
        const chosenBloodlineName = interaction.options.getString('bloodline');
        const chosenBloodline = bloodlines.find(b => b.name === chosenBloodlineName);

        if (!chosenBloodline) {
            await interaction.reply({
                content: 'Invalid bloodline selected. Please try again.',
                ephemeral: true
            });
            return;
        }

        const player = {
            name: interaction.user.username,
            bloodline: chosenBloodline.name,
            hp: 100,
            maxHp: 100,
            chakra: 50,
            maxChakra: 100,
            attack: 10,
            defense: 5,
            isAwakened: false,
            abilities: chosenBloodline.abilities.standard,
            attackBoost: 0,
            isInvincible: false,
            accuracy: 0.9, // Default accuracy
        };

        const enemy = {
            name: 'Rival Ninja',
            hp: 100,
            maxHp: 100,
            chakra: 50,
            maxChakra: 100,
            attack: 10,
            defense: 5,
            isAwakened: false,
            abilities: bloodlines.find(b => b.name === 'None').abilities.standard, // Generic enemy
            attackBoost: 0,
            isInvincible: false,
            accuracy: 0.9,
        };

        // Function to generate the game embed
        const getGameEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle('Awakening Test')
                .setDescription(`**${player.name} vs ${enemy.name}**\n\n${player.name} (${player.bloodline}${player.isAwakened ? ' Awakened' : ''})`)
                .addFields(
                    { name: 'HP', value: `${player.hp}/${player.maxHp}`, inline: true },
                    { name: 'Chakra', value: `${player.chakra}/${player.maxChakra}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                    { name: '\u200B', value: `**${enemy.name}**`, inline: false },
                    { name: 'HP', value: `${enemy.hp}/${enemy.maxHp}`, inline: true },
                    { name: 'Chakra', value: `${enemy.chakra}/${enemy.maxChakra}`, inline: true }
                )
                .setColor(player.isAwakened ? 0x00FFFF : 0x0099ff); // Cyan when awakened

            if (player.attackBoost > 0) {
                embed.setFooter({
                    text: `${player.name} attack boost active!`
                });
            }
            if (player.isInvincible) {
                embed.setFooter({
                    text: `${player.name} is invulnerable!`
                });
            }
            return embed;
        };

        // Function to generate action buttons
        const getActionButtons = () => {
            const row = new ActionRowBuilder();

            // Attack Button
            row.addComponents(
                new ButtonBuilder()
                .setCustomId('attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(enemy.hp <= 0 || player.hp <= 0)
            );

            // Ability Buttons
            player.abilities.forEach((ability, index) => {
                const button = new ButtonBuilder()
                    .setCustomId(`ability_${index}`)
                    .setLabel(`${ability.name} (${ability.cost} Chakra)`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(player.chakra < ability.cost || enemy.hp <= 0 || player.hp <= 0);
                row.addComponents(button);
            });

            // Awaken Button
            const awakenButton = new ButtonBuilder()
                .setCustomId('awaken')
                .setLabel('Awaken')
                .setStyle(ButtonStyle.Success)
                .setDisabled(player.isAwakened || player.chakra < 75 || enemy.hp <= 0 || player.hp <= 0);
            row.addComponents(awakenButton);

            return [row];
        };

        const message = await interaction.reply({
            embeds: [getGameEmbed()],
            components: getActionButtons(),
            fetchReply: true
        });

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        }); // 60 seconds timeout

        collector.on('collect', async i => {
            await i.deferUpdate(); // Defer the update to prevent timeout

            if (player.hp <= 0 || enemy.hp <= 0) return; // Game over

            const action = i.customId;

            // Player Turn
            if (action === 'attack') {
                const damageDealt = Math.max(0, player.attack + player.attackBoost - enemy.defense);
                const hit = Math.random() < player.accuracy;
                if (hit) {
                    enemy.hp = Math.max(0, enemy.hp - damageDealt);
                    player.chakra = Math.min(player.maxChakra, player.chakra + 5); // Gain small chakra on attack
                } else {
                    player.chakra = Math.min(player.maxChakra, player.chakra + 5); // Gain small chakra even on miss
                }
                let message = hit ? `${player.name} attacks ${enemy.name} for ${damageDealt} damage.` : `${player.name} missed their attack!`;
                // Check for confusion effect
                if (player.confusion) {
                    message = `${player.name} is confused and misses their attack!`;
                    player.confusion = false; // Reset confusion
                }
                await updateGame(message);
            } else if (action.startsWith('ability_')) {
                const abilityIndex = parseInt(action.split('_')[1]);
                const ability = player.abilities[abilityIndex];

                if (player.chakra >= ability.cost) {
                    player.chakra -= ability.cost;
                    let message = ability.effect(player, enemy);
                    await updateGame(message);
                } else {
                    await i.followUp({
                        content: 'Not enough chakra!',
                        ephemeral: true
                    });
                }
            } else if (action === 'awaken') {
                if (!player.isAwakened && player.chakra >= 75) {
                    player.isAwakened = true;
                    player.chakra -= 75; // Cost to awaken
                    player.abilities = chosenBloodline.abilities.awakened; // Switch to awakened abilities
                    // Apply initial effects of awakening if any
                    if (chosenBloodline.name === 'Sharingan') {
                        player.attackBoost += 3;
                        setTimeout(() => player.attackBoost -= 3, 10000); // Boost lasts 10 seconds
                    } else if (chosenBloodline.name === 'Byakugan') {
                        player.accuracy = 1.0;
                        setTimeout(() => player.accuracy = 0.9, 10000);
                    } else if (chosenBloodline.name === 'Rinnegan') {
                        player.defense += 3;
                        setTimeout(() => player.defense -= 3, 10000);
                    }

                    await updateGame(`${player.name} has awakened their ${player.bloodline}!`);
                }
            }

            // Check for game over after player's turn
            if (enemy.hp <= 0) {
                collector.stop('player_wins');
                await updateGame(`${player.name} defeated ${enemy.name}!`, true);
                return;
            }

            // Enemy Turn (simple AI)
            setTimeout(async () => {
                if (player.hp <= 0 || enemy.hp <= 0) return; // Don't let enemy attack if game is over

                const enemyAction = Math.random();
                let enemyMessage = '';

                if (enemyAction < 0.5) { // Basic Attack
                    const hit = Math.random() < enemy.accuracy;
                    if (hit) {
                        const damageDealt = Math.max(0, enemy.attack - (player.defense + (player.isInvincible ? 999 : 0))); // Massive defense if invincible
                        player.hp = Math.max(0, player.hp - damageDealt);
                        enemy.chakra = Math.min(enemy.maxChakra, enemy.chakra + 5);
                        enemyMessage = hit ? ` ${enemy.name} attacks ${player.name} for ${damageDealt} damage.` : ` ${enemy.name} missed their attack!`;
                    } else {
                        enemy.chakra = Math.min(enemy.maxChakra, enemy.chakra + 5);
                        enemyMessage = ` ${enemy.name} missed their attack!`;
                    }
                } else { // Enemy uses a standard ability (if available and affordable)
                    const availableAbilities = enemy.abilities.filter(abil => enemy.chakra >= abil.cost);
                    if (availableAbilities.length > 0) {
                        const chosenAbility = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
                        enemy.chakra -= chosenAbility.cost;
                        enemyMessage = ` ${chosenAbility.effect(enemy, player)}`;
                    } else { // Fallback to basic attack if no abilities affordable
                        const hit = Math.random() < enemy.accuracy;
                        if (hit) {
                            const damageDealt = Math.max(0, enemy.attack - (player.defense + (player.isInvincible ? 999 : 0)));
                            player.hp = Math.max(0, player.hp - damageDealt);
                            enemy.chakra = Math.min(enemy.maxChakra, enemy.chakra + 5);
                            enemyMessage = hit ? ` ${enemy.name} attacks ${player.name} for ${damageDealt} damage.` : ` ${enemy.name} missed their attack!`;
                        } else {
                            enemy.chakra = Math.min(enemy.maxChakra, enemy.chakra + 5);
                            enemyMessage = ` ${enemy.name} missed their attack!`;
                        }
                    }
                }

                // Check for game over after enemy's turn
                if (player.hp <= 0) {
                    collector.stop('enemy_wins');
                    await updateGame(`${enemy.name} defeated ${player.name}!`, true);
                    return;
                }

                await updateGame(enemyMessage);
            }, 1000); // Slight delay for enemy turn
        });

        collector.on('end', async (collected, reason) => {
            let finalMessage = '';
            if (reason === 'time') {
                finalMessage = 'The battle timed out!';
            } else if (reason === 'player_wins') {
                finalMessage = 'Congratulations! You won!';
            } else if (reason === 'enemy_wins') {
                finalMessage = 'Game Over! You were defeated.';
            }

            const disabledButtons = getActionButtons().map(row =>
                new ActionRowBuilder().addComponents(
                    row.components.map(button =>
                        ButtonBuilder.from(button).setDisabled(true)
                    )
                )
            );

            await message.edit({
                embeds: [getGameEmbed().setFooter({
                    text: finalMessage
                })],
                components: disabledButtons
            });
        });

        // Helper function to update the game message
        async function updateGame(actionMessage, isGameOver = false) {
            // Update chakra/hp based on effects that might have happened
            player.chakra = Math.min(player.maxChakra, player.chakra);
            enemy.chakra = Math.min(enemy.maxChakra, enemy.chakra);
            player.hp = Math.max(0, player.hp);
            enemy.hp = Math.max(0, enemy.hp);

            // Reset temporary buffs/debuffs if their duration is over (simplified for now)
            if (player.attackBoost > 0 && !actionMessage.includes("boost active")) { // Re-apply footer logic
                // This part needs careful management, maybe a timestamp system
            }

            const embed = getGameEmbed();
            embed.setFooter({
                text: actionMessage
            });

            const buttons = getActionButtons();
            if (isGameOver) {
                buttons.forEach(row => row.components.forEach(button => button.setDisabled(true)));
            }

            await message.edit({
                embeds: [embed],
                components: buttons
            });
        }
    },
};