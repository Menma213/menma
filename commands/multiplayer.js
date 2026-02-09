const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { activeBattles } = require('./combinedcommands.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multiplayer')
        .setDescription('Invite a friend to join your battle!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to invite')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        // Find battle where interaction user is the host (player1) and it's in this channel
        let battleId = null;
        let battleState = null;

        // Iterate backwards through activeBattles (Map entries are in insertion order, so latest is last)
        const entries = Array.from(activeBattles.entries());
        for (let i = entries.length - 1; i >= 0; i--) {
            const [id, state] = entries[i];
            // Match host AND channel to ensure we get the correct current battle
            if (state.player1 && state.player1.userId === interaction.user.id && state.channel.id === interaction.channel.id) {
                if (state.battleType === 'event_fight') {
                    return interaction.reply({ content: "Players in Zoro fights are not allowed to invite others!", ephemeral: true });
                }
                battleId = id;
                battleState = state;
                break;
            }
        }

        if (!battleId || !battleState) {
            return interaction.reply({ content: "You are not currently the host of an active battle in this channel!", ephemeral: true });
        }

        // Check if battle is already full (increased max to 4 players)
        if (battleState.player1.subPlayers && battleState.player1.subPlayers.length >= 4) {
            return interaction.reply({ content: "The battle is already full! (Max 4 players)", ephemeral: true });
        }

        // Check if user is already in the battle
        if (battleState.player1.subPlayers && battleState.player1.subPlayers.find(p => p.userId === targetUser.id)) {
            return interaction.reply({ content: "That user is already in the battle!", ephemeral: true });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "You cannot invite yourself!", ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: "You cannot invite bots!", ephemeral: true });
        }

        // Send Invite Embed
        const inviteEmbed = new EmbedBuilder()
            .setTitle("Battle Invite!")
            .setDescription(`<@${interaction.user.id}> has invited <@${targetUser.id}> to join the battle against **${battleState.player2.name}**!`)
            .setColor('#006400');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_invite_${battleId}_${targetUser.id}`)
                    .setLabel('Accept Invite')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`decline_invite_${battleId}_${targetUser.id}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );

        const inviteMsg = await interaction.reply({
            content: `<@${targetUser.id}>`,
            embeds: [inviteEmbed],
            components: [row],
            fetchReply: true
        });

        // Create Collector for Invite
        const filter = i => i.user.id === targetUser.id && (i.customId === `accept_invite_${battleId}_${targetUser.id}` || i.customId === `decline_invite_${battleId}_${targetUser.id}`);
        const collector = inviteMsg.createMessageComponentCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async i => {
            if (i.customId.startsWith('accept')) {
                await i.update({ content: `**${targetUser.username}** accepted the invite! Joining battle...`, components: [], embeds: [] });

                // Add to battle state queue
                if (activeBattles.has(battleId)) {
                    const b = activeBattles.get(battleId);

                    // Add new player to queue
                    if (!b.newPlayersQueue) b.newPlayersQueue = [];
                    b.newPlayersQueue.push(targetUser); // Pass the Discord User object

                    // Trigger "Break" - Interupt the running collector in runBattle
                    if (b.collector && !b.collector.ended) {
                        b.collector.stop('multiplayer_joined');
                    }

                }
            } else {
                await i.update({ content: "Invite declined.", components: [], embeds: [] });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: "Invite expired.", components: [], embeds: [] }).catch(() => { });
            }
        });
    }
};
