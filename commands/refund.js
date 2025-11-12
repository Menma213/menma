const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- File Paths ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const autofrankPath = path.resolve(__dirname, '../../menma/data/autofrank.json');

// --- Helper Functions ---
function loadData(filePath) {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return {};
}

function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refund')
        .setDescription('Refund your invested stat points to reallocate them.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        const users = loadData(usersPath);
        const autofrankData = loadData(autofrankPath);

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll as a ninja first!", ephemeral: true });
        }

        let userAutoFrank = autofrankData[userId] || { activeSession: null, features: {} };

        // Check for Stat Refund availability
        if (!userAutoFrank.features['stat_refund'] || userAutoFrank.features['stat_refund'] <= 0) {
            return interaction.reply({ content: "You do not have any Stat Refunds available. Purchase one from the shop!", ephemeral: true });
        }

        // Check for Stat Refund availability
        if (!userAutoFrank.features['stat_refund'] || userAutoFrank.features['stat_refund'] <= 0) {
            return interaction.reply({ content: "You do not have any Stat Refunds available. Purchase one from the shop!", ephemeral: true });
        }

        // Calculate Refundable Points (before resetting)
        const currentHealth = users[userId].health || 0;
        const currentPower = users[userId].power || 0;
        const currentDefense = users[userId].defense || 0;
        const totalRefundedPoints = currentHealth + currentPower + currentDefense;

        // Display Modal for Reallocation
        const modalId = `stat_reallocate_modal_${userId}_${Date.now()}`;
        const reallocateModal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Reallocate Stat Points')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('health_input')
                        .setLabel(`Health (Total available: ${totalRefundedPoints})`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter points for Health')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('power_input')
                        .setLabel('Power')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter points for Power')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('defense_input')
                        .setLabel('Defense')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter points for Defense')
                        .setRequired(true)
                )
            );

        // Show the modal as the initial response
        await interaction.showModal(reallocateModal);

        let modalSubmit;
        try {
            modalSubmit = await interaction.awaitModalSubmit({
                filter: i => i.customId === modalId && i.user.id === userId,
                time: 120000 // 2 minutes to reallocate
            });
        } catch (err) {
            console.error('Stat reallocation modal timed out or failed:', err);
            return interaction.followUp({ content: "Stat reallocation timed out or failed. No changes were made.", ephemeral: true });
        }

        const newHealth = parseInt(modalSubmit.fields.getTextInputValue('health_input'));
        const newPower = parseInt(modalSubmit.fields.getTextInputValue('power_input'));
        const newDefense = parseInt(modalSubmit.fields.getTextInputValue('defense_input'));

        // Validate inputs
        if (isNaN(newHealth) || isNaN(newPower) || isNaN(newDefense) || newHealth < 0 || newPower < 0 || newDefense < 0) {
            return modalSubmit.reply({ content: "Invalid stat input. Please enter non-negative numbers. No changes were made.", ephemeral: true });
        }

        const allocatedPoints = newHealth + newPower + newDefense;

        if (allocatedPoints > totalRefundedPoints) {
            return modalSubmit.reply({ content: `You tried to allocate ${allocatedPoints} points, but you only have ${totalRefundedPoints} available. No changes were made.`, ephemeral: true });
        }

        // Update user stats with new allocation
        users[userId].health = newHealth;
        users[userId].power = newPower;
        users[userId].defense = newDefense;
        
        // Store unallocated points
        const unallocatedPoints = totalRefundedPoints - allocatedPoints;
        users[userId].availableStatPoints = (users[userId].availableStatPoints || 0) + unallocatedPoints;

        // Decrement refund count (consume one stat_refund)
        userAutoFrank.features['stat_refund']--;

        saveData(usersPath, users);
        saveData(autofrankPath, autofrankData);

        let description = `Your stat points have been successfully reallocated!\n` +
                          `**Health:** ${newHealth}\n` +
                          `**Power:** ${newPower}\n` +
                          `**Defense:** ${newDefense}\n`;
        
        let components = [];
        if (users[userId].availableStatPoints > 0) {
            description += `You have **${users[userId].availableStatPoints}** points remaining to allocate.`;
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('allocate_remaining_stats')
                    .setLabel('Allocate Remaining Points')
                    .setStyle(ButtonStyle.Primary)
            ));
        }

        const embed = new EmbedBuilder()
            .setTitle('Stat Points Reallocated!')
            .setDescription(description)
            .setColor('#00FF00')
            .setTimestamp();

        await modalSubmit.reply({ embeds: [embed], components: components, ephemeral: true });

        // Create a collector to listen for the 'allocate_remaining_stats' button
        const collectorFilter = i => i.customId === 'allocate_remaining_stats' && i.user.id === userId;
        const collector = modalSubmit.channel.createMessageComponentCollector({ filter: collectorFilter, time: 60000 });

        collector.on('collect', async i => {
            const currentAvailablePoints = users[userId].availableStatPoints || 0;

            if (currentAvailablePoints <= 0) {
                await i.deferUpdate(); // Defer if no points to allocate, then followUp
                return i.followUp({ content: "You have no remaining points to allocate.", ephemeral: true });
            }

            const reallocateRemainingModalId = `reallocate_remaining_modal_${userId}_${Date.now()}`;
            const reallocateRemainingModal = new ModalBuilder()
                .setCustomId(reallocateRemainingModalId)
                .setTitle('Allocate Remaining Stat Points')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('health_input_rem')
                            .setLabel(`Health (Total available: ${currentAvailablePoints})`)
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter points for Health')
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('power_input_rem')
                            .setLabel('Power')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter points for Power')
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('defense_input_rem')
                            .setLabel('Defense')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter points for Defense')
                            .setRequired(true)
                    )
                );

            await i.showModal(reallocateRemainingModal);

            let remainingModalSubmit;
            try {
                remainingModalSubmit = await i.awaitModalSubmit({
                    filter: (modalI) => modalI.customId === reallocateRemainingModalId && modalI.user.id === userId,
                    time: 120000 // 2 minutes to reallocate
                });
            } catch (err) {
                console.error('Remaining stat reallocation modal timed out or failed:', err);
                return interaction.followUp({ content: "Remaining stat reallocation timed out or failed. Your unallocated points are still available.", ephemeral: true });
            }

            const newHealthRem = parseInt(remainingModalSubmit.fields.getTextInputValue('health_input_rem'));
            const newPowerRem = parseInt(remainingModalSubmit.fields.getTextInputValue('power_input_rem'));
            const newDefenseRem = parseInt(remainingModalSubmit.fields.getTextInputValue('defense_input_rem'));

            // Validate inputs
            if (isNaN(newHealthRem) || isNaN(newPowerRem) || isNaN(newDefenseRem) || newHealthRem < 0 || newPowerRem < 0 || newDefenseRem < 0) {
                return remainingModalSubmit.reply({ content: "Invalid stat input. Please enter non-negative numbers. Your unallocated points are still available.", ephemeral: true });
            }

            const allocatedPointsRem = newHealthRem + newPowerRem + newDefenseRem;

            if (allocatedPointsRem > currentAvailablePoints) {
                return remainingModalSubmit.reply({ content: `You tried to allocate ${allocatedPointsRem} points, but you only have ${currentAvailablePoints} available. Your unallocated points are still available.`, ephemeral: true });
            }

            // Update user stats with new allocation
            users[userId].health = (users[userId].health || 0) + newHealthRem;
            users[userId].power = (users[userId].power || 0) + newPowerRem;
            users[userId].defense = (users[userId].defense || 0) + newDefenseRem;
            users[userId].availableStatPoints = currentAvailablePoints - allocatedPointsRem; // Deduct allocated points

            saveData(usersPath, users);

            const finalEmbed = new EmbedBuilder()
                .setTitle('Remaining Stat Points Allocated!')
                .setDescription(
                    `You have successfully allocated **${allocatedPointsRem}** remaining points!\n` +
                    `**Health:** ${users[userId].health}\n` +
                    `**Power:** ${users[userId].power}\n` +
                    `**Defense:** ${users[userId].defense}\n` +
                    `You now have **${users[userId].availableStatPoints}** points still unallocated.`
                )
                .setColor('#00FF00')
                .setTimestamp();

            return remainingModalSubmit.reply({ embeds: [finalEmbed], ephemeral: true });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                // No button interaction, or timed out
                // The initial reply already contains the info about unallocated points
                // The initial reply already contains the info about unallocated points
            }
        });
    }
};