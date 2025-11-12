const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle } = require('./combinedcommands.js');
const { processTournamentFight } = require('./tournament.js'); // Import the tournament handler

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another user to a PvP fight')
        .addUserOption(opt => opt.setName('user').setDescription('User to challenge').setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        const opponent = interaction.options.getUser('user');
        if (!opponent || opponent.id === userId) {
            return interaction.reply({ content: "You must mention a valid user to challenge.", ephemeral: true });
        }
        if (!users[opponent.id]) {
            return interaction.reply({ content: "The challenged user must be enrolled.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Fight Invitation!')
            .setDescription(`<@${opponent.id}>, do you accept <@${userId}>'s challenge?`)
            .setFooter({ text: 'You have 60 seconds to respond' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('accept_fight').setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('decline_fight').setLabel('Decline').setStyle(ButtonStyle.Danger)
            );

        const response = await interaction.reply({
            content: `<@${opponent.id}>`,
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const filter = i => (i.customId === 'accept_fight' || i.customId === 'decline_fight') && i.user.id === opponent.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate().catch(() => {});
            if (i.customId === 'accept_fight') {
                await response.edit({ content: "Fight accepted! Starting battle...", components: [] }).catch(() => {});
                let battleResult;
                try {
                    // Capture the result of the battle
                    battleResult = await runBattle(interaction, userId, opponent.id, 'fight');
                } catch (err) {
                    console.error('runBattle error (fight command):', err);
                    await interaction.followUp({ content: 'An error occurred while starting the fight.', ephemeral: true }).catch(() => {});
                }

                // --- TOURNAMENT HOOK ---
                // If the battle completed and returned a winner/loser, process it.
                if (battleResult && battleResult.winner && battleResult.loser) {
                    try {
                        // This will silently do nothing if the match isn't part of an active tournament.
                        await processTournamentFight(interaction.client, battleResult.winner.userId, battleResult.loser.userId, interaction.user.id);
                    } catch (err) {
                        console.error("Error processing tournament fight result:", err);
                    }
                }
                // --- END TOURNAMENT HOOK ---

            } else {
                await response.edit({ content: "Fight declined.", components: [] }).catch(() => {});
            }
            collector.stop();
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                response.edit({ content: "Fight invitation expired.", components: [] }).catch(() => {});
            }
        });
    }
};
