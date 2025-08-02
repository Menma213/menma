const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admincommand106')
        .setDescription('Create a custom ticket channel for user submissions (admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Only allow admins
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Custom Channel Creation')
            .setDescription('Create a channel to submit your custom description!')
            .setFooter({ text: 'After creation please wait for a admin to respond to your description.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_custom_channel')
                .setLabel('Create Channel')
                .setStyle('Primary')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    },
    // Button handler setup for persistent button
    setup(client) {
        client.on('interactionCreate', async interaction => {
            if (!interaction.isButton()) return;
            if (interaction.customId !== 'create_custom_channel') return;

            // Only allow the user who pressed the button to create their own channel
            const user = interaction.user;
            const guild = interaction.guild;
            if (!guild) return;

            // Check if a channel already exists for this user
            const existing = guild.channels.cache.find(
                ch => ch.name === `${user.username.toLowerCase()}-custom-channel`
            );
            if (existing) {
                return interaction.reply({ content: 'You already have a custom channel open.', ephemeral: true });
            }

            // Create the channel
            const channel = await guild.channels.create({
                name: `${user.username.toLowerCase()}-custom-channel`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: user.id,
                        allow: ['ViewChannel', 'SendMessages']
                    }
                ]
            });

            await interaction.reply({ content: `Channel created: ${channel}`, ephemeral: true });
            await channel.send(`<@${user.id}> This is your custom submission channel. Please describe your custom request here. An admin will respond soon.`);
        });
    }
};
