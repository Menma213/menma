const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// === CONFIGURABLE ===
const ADMIN_ROLE_ID = '1381268854776529028'; // Replace with your admin role ID
const ALLOWED_CHANNEL_ID = '1391003713270845591'; // Replace with the channel ID where this command can be used
const ROLE_TO_ADD_ID = '1381269621637775542'; // Replace with the role to give on agreement
const WHITE_CHECK_MARK = '✅';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admincommand103')
        .setDescription('Send terms and conditions agreement embed (admin only)'),
    async execute(interaction) {
        // Only allow in the specified channel
        if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
            return interaction.reply({ content: "This command can only be used in the designated channel.", ephemeral: true });
        }
        // Only allow users with the admin role
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        // Terms and conditions text
        const termsText = `
**Bot Terms and Conditions & Legal Notice**

By using this bot, you agree to abide by all rules and guidelines set forth by the server administrators. The bot "Shinobi RPG" is an insipiration of a late discord RPG bot called "Konoha RPG". Your data may be stored for gameplay and moderation purposes. The bot creators are not liable for any damages or losses incurred through use of this bot such as discord banning your id, money-loss due to a third party service, etc. Exploiting bugs or glitches is strictly prohibited and may result in a ban from the server. If you encounter any issues, please report them to the server administrators immediately.

If you do not agree, do not interact with this message.
        `;

        const embed = new EmbedBuilder()
            .setTitle("Terms and Conditions Agreement")
            .setDescription(termsText)
            .setColor(0x2b2d31)
            .setFooter({ text: "By reacting with ✅ you agree to the terms and conditions." });

        // Send ephemeral embed to the user
        const msg = await interaction.reply({ embeds: [embed], ephemeral: false, fetchReply: true });

        // React with white check mark
        await msg.react(WHITE_CHECK_MARK);

        // Create a reaction collector for the user
        const filter = (reaction, user) =>
            reaction.emoji.name === WHITE_CHECK_MARK && user.id === interaction.user.id;
        const collector = msg.createReactionCollector({ filter, max: 1, time: 120000 });

        collector.on('collect', async () => {
            // Add the role to the user
            try {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (member.roles.cache.has(ROLE_TO_ADD_ID)) {
                    await interaction.followUp({ content: "You already have the role.", ephemeral: true });
                } else {
                    await member.roles.add(ROLE_TO_ADD_ID);
                    await interaction.followUp({ content: "You have agreed to the terms and have been given access.", ephemeral: true });
                }
            } catch (err) {
                await interaction.followUp({ content: "Failed to assign the role. Please contact an admin.", ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ content: "You did not agree in time.", ephemeral: true });
            }
        });
    }
};
