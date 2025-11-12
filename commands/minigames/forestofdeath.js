const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forestofdeath')
        .setDescription('forest of death'),
    async execute(interaction) {
        const playerHealth = 100;
        const playerAttack = 10;
        const playerDefense = 5;

        const enemies = [
            { name: 'Goblin', health: 30, attack: 8, defense: 2, description: 'A small, green creature with sharp teeth.' },
            { name: 'Wolf', health: 50, attack: 12, defense: 4, description: 'A fierce predator with glowing eyes.' },
            { name: 'Ogre', health: 80, attack: 15, defense: 6, description: 'A large, brutish monster with immense strength.' },
        ];

        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];

        let currentEnemy = { ...randomEnemy };
        let remainingPlayerHealth = playerHealth;

        const embed = new EmbedBuilder()
            .setColor('#8B0000') // Dark Red
            .setTitle('The Forest of Death')
            .setDescription(`You have entered the perilous Forest of Death!\n\nA wild **${currentEnemy.name}** appears!\n\n${currentEnemy.description}`)
            .addFields(
                { name: 'Your Health', value: `${remainingPlayerHealth} HP`, inline: true },
                { name: `${currentEnemy.name} Health`, value: `${currentEnemy.health} HP`, inline: true }
            )
            .setFooter({ text: 'Choose your action wisely!' });

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('attack')
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('defend')
                    .setLabel('Defend')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('run')
                    .setLabel('Run')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({ embeds: [embed], components: [actionRow] });

        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 60 seconds

        collector.on('collect', async i => {
            if (i.customId === 'run') {
                collector.stop();
                await i.update({ content: 'You managed to escape the Forest of Death!', embeds: [], components: [] });
                return;
            }

            let enemyAttackDamage = Math.max(0, currentEnemy.attack - playerDefense);
            let playerAttackDamage = Math.max(0, playerAttack - (currentEnemy.defense + (i.customId === 'defend' ? 5 : 0))); // Bonus defense when defending

            if (i.customId === 'attack') {
                remainingPlayerHealth -= enemyAttackDamage;
                currentEnemy.health -= playerAttackDamage;

                let message = `You attacked the ${currentEnemy.name} for ${playerAttackDamage} damage!\n`;
                if (remainingPlayerHealth > 0 && currentEnemy.health > 0) {
                    message += `The ${currentEnemy.name} attacked you for ${enemyAttackDamage} damage!`;
                } else if (remainingPlayerHealth <= 0) {
                    message += `You have been defeated in the Forest of Death.`;
                    collector.stop();
                } else if (currentEnemy.health <= 0) {
                    message += `You have defeated the ${currentEnemy.name}! You survived the Forest of Death for now.`;
                    collector.stop();
                }

                embed.setDescription(message)
                    .setFields(
                        { name: 'Your Health', value: `${Math.max(0, remainingPlayerHealth)} HP`, inline: true },
                        { name: `${currentEnemy.name} Health`, value: `${Math.max(0, currentEnemy.health)} HP`, inline: true }
                    );

                await i.update({ embeds: [embed], components: [actionRow] });
            } else if (i.customId === 'defend') {
                remainingPlayerHealth -= Math.max(0, enemyAttackDamage - 5); // Reduced damage when defending

                let message = `You braced yourself against the ${currentEnemy.name}'s attack, taking reduced damage.\n`;
                if (remainingPlayerHealth > 0) {
                    message += `The ${currentEnemy.name} attacked you for ${Math.max(0, enemyAttackDamage - 5)} damage!`;
                } else {
                    message += `You have been defeated in the Forest of Death.`;
                    collector.stop();
                }

                embed.setDescription(message)
                    .setFields(
                        { name: 'Your Health', value: `${Math.max(0, remainingPlayerHealth)} HP`, inline: true },
                        { name: `${currentEnemy.name} Health`, value: `${currentEnemy.health} HP`, inline: true }
                    );

                await i.update({ embeds: [embed], components: [actionRow] });
            }
        });

        collector.on('end', collected => {
            if (!interaction.channel.messages.cache.get(interaction.id)) return; // If the initial message was already updated/deleted

            const finalEmbed = new EmbedBuilder()
                .setColor('#808080') // Grey
                .setTitle('Game Over')
                .setDescription('The Forest of Death claims another victim, or you escaped.');

            const components = [];
            if (collected.size > 0) {
                // If the game ended by running or winning, the initial message would have been updated.
                // If the game timed out or the user was defeated, we update here.
                const lastInteraction = collected.last();
                if (lastInteraction && (remainingPlayerHealth <= 0 || currentEnemy.health <= 0)) {
                    // Game ended by win/loss, message already updated by the last button click.
                    return;
                } else if (remainingPlayerHealth > 0 && currentEnemy.health > 0) {
                    // Game timed out
                    finalEmbed.setDescription('Time ran out! You are lost in the Forest of Death.');
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('restart')
                            .setLabel('Try Again?')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true) // Disable for timeout
                    ));
                }
            } else {
                // Game timed out without any interaction
                finalEmbed.setDescription('Time ran out! You are lost in the Forest of Death.');
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('restart')
                        .setLabel('Try Again?')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true) // Disable for timeout
                ));
            }

            // Ensure the interaction response is updated only if it still exists and hasn't been fully cleared.
            if (interaction.channel.messages.cache.get(interaction.id)) {
                interaction.editReply({ embeds: [finalEmbed], components: components }).catch(err => console.error("Failed to edit reply:", err));
            }
        });
    },
};