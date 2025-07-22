const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const EVENTS_ROLE_ID = '1389238943823827067'; // Replace with your events role ID
const ALLOWED_ROLE_ID = '1381268854776529028'; // Replace with the role ID allowed to use this command

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admincommand101')
    .setDescription('Send an event role embed with a subscribe/unsubscribe button (admin only)'),
  async execute(interaction) {
    // Check if user has the allowed role
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const eventsRole = interaction.guild.roles.cache.get(EVENTS_ROLE_ID);
    if (!eventsRole) {
      return interaction.reply({ content: 'Events role not found. Please check the role ID.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('ShinboiRPG Event Role')
      .setDescription(
        `Use the button below to get the ${eventsRole}.\n\n` +
        `After you get the role you'll be notified for the following events:\n\n` +
        `**Forest of Death** - Participate in a gamemode against other players and if you're lucky you get awesome rewards!\n` +
        `**The Ramen Quiz** - Get notified for this knowledge-based quiz based on Naruto and earn ramen tickets as a reward!\n\n` +
        `In the upcoming patches, you'll also be notified for the Hokage tournament, the selection of the Akatsuki leader and also the war between the Hokage and the Akatsuki!`
      )
      .setFooter({ text: 'Reuse the button to unsubscribe from the event notifications' })
      .setColor('#006400');

    const button = new ButtonBuilder()
      .setCustomId('toggle_event_role')
      .setLabel('Toggle Event Role')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async handleComponent(interaction) {
    // Only handle the correct button
    if (interaction.customId !== 'toggle_event_role') return;

    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(EVENTS_ROLE_ID);
    if (!role) {
      return interaction.reply({ content: 'Events role not found.', ephemeral: true, flags: 64 });
    }

    if (member.roles.cache.has(EVENTS_ROLE_ID)) {
      await member.roles.remove(role);
      await interaction.reply({ content: 'Events role removed.', ephemeral: true, flags: 64 });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: 'Events role added.', ephemeral: true, flags: 64 });
    }
  }
};
