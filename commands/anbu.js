const { SlashCommandBuilder, WebhookClient, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const HOKAGE_ROLE_ID = '1381606285577031772'; // Replace with the actual Hokage role ID
const ANBU_ROLE_ID = '1382055740268744784'; // Replace with the actual Anbu role ID

// Kakashi Sensei's webhook details
const KAKASHI_NAME = 'Kakashi Sensei';
// Replace with a direct link to Kakashi's avatar.
// You might need to upload one to an image hosting service like Imgur.
const KAKASHI_AVATAR = 'https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png/revision/latest/scale-to-width-down/300?cb=20230803224121'; // <--- !!! IMPORTANT: REPLACE THIS !!!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anbu')
        .setDescription('Appoint a user as an Anbu and initiate the oath ceremony.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to appoint as Anbu')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Ensure the command is used in a guild text channel
        if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: "This command can only be used in a server text channel.", ephemeral: true });
        }

        // Check if the user has the Hokage role
        if (!interaction.member.roles.cache.has(HOKAGE_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const guild = interaction.guild;
        const channel = interaction.channel;

        // Load users from the database
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[targetUser.id]) {
            return interaction.reply({ content: "This user is not enrolled in the system.", ephemeral: true });
        }

        // Defer the reply to give time for webhook setup and messages
        await interaction.deferReply({ ephemeral: true });

        // --- Webhook Handling (Inspired by trade.js) ---
        let webhooks = await channel.fetchWebhooks();
        let kakashiWebhook = webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id && w.name === KAKASHI_NAME);

        if (!kakashiWebhook) {
            try {
                kakashiWebhook = await channel.createWebhook({
                    name: KAKASHI_NAME,
                    avatar: KAKASHI_AVATAR,
                    reason: 'For Anbu appointment ceremony by Kakashi Sensei'
                });
            } catch (error) {
                console.error("Failed to create Kakashi Sensei webhook:", error);
                return interaction.editReply({ content: "Failed to create the Kakashi Sensei webhook. Please check bot permissions (Manage Webhooks).", ephemeral: true });
            }
        }

        // Helper to send messages as Kakashi Sensei
        async function kakashiSay(content, opts = {}) {
            return await kakashiWebhook.send({ content, username: KAKASHI_NAME, avatarURL: KAKASHI_AVATAR, ...opts });
        }

        // Helper to send embeds as Kakashi Sensei (not strictly needed for this command but good to have)
        async function kakashiEmbed(embed) {
            return await kakashiWebhook.send({ embeds: [embed], username: KAKASHI_NAME, avatarURL: KAKASHI_AVATAR });
        }
        // --- End Webhook Handling ---

        // Kakashi Sensei initiates the ceremony
        await kakashiSay(`A new shadow stirs... <@${targetUser.id}>, the Hokage has observed your potential.`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay for dramatic effect

        await kakashiSay(
            `The **Anbu Black Ops** operate in the shadows, executing high-priority missions, protecting the village from within, and often making impossible choices for the greater good. Your life, your very being, will now serve Konoha in ways few can comprehend.`
        );
        await new Promise(resolve => setTimeout(resolve, 3000));

        await kakashiSay(
            `<@${targetUser.id}>, are you ready for this huge shift in life and are you ready to sacrifice your life for the Anbu Black Ops? If so, please take the OATH by saying **"I shall not abandon the Anbu"**`
        );

        // Update the Hokage's ephemeral reply
        await interaction.editReply({ content: `Kakashi Sensei has initiated the Anbu oath for ${targetUser.username}. Waiting for their confirmation...`, ephemeral: true });

        // Wait for the user to say the oath (case-insensitive)
        const filter = m => m.author.id === targetUser.id && m.content.toLowerCase() === "i shall not abandon the anbu";
        const collector = channel.createMessageCollector({ filter, time: 60000, max: 1 }); // 60 seconds to respond

        collector.on('collect', async m => {
            // Add the Anbu role in Discord
            try {
                const member = await guild.members.fetch(targetUser.id);
                await member.roles.add(ANBU_ROLE_ID, "Appointed as Anbu after taking the oath");

                // Update the user's occupation in users.json
                users[targetUser.id].occupation = "Anbu";
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

                await kakashiSay(
                    `Excellent, <@${targetUser.id}>. Welcome to the shadows. Your commitment is noted.`
                );

                // Send a public success message
                await interaction.followUp({ content: `${targetUser.username} has successfully taken the oath and been appointed as an Anbu!`, ephemeral: false });

            } catch (err) {
                console.error("Failed to add Anbu role or update database:", err);
                await interaction.followUp({ content: "Failed to complete the Anbu appointment. Check bot permissions and role hierarchy.", ephemeral: true });
            } finally {
                // Optionally delete the webhook after the ceremony. This can prevent webhook clutter.
                // If you want Kakashi to always be available without recreation, comment out the line below.
                // await kakashiWebhook.delete('Anbu ceremony finished.');
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await kakashiSay(`It seems <@${targetUser.id}> hesitated. The path of the Anbu is not for the faint of heart. The appointment is cancelled.`);
                await interaction.followUp({ content: `${targetUser.username} did not take the Anbu oath in time. The appointment has been cancelled.`, ephemeral: false });
            }
            // If you chose to delete the webhook after use in the 'collect' event, it will already be gone.
            // If you want to ensure it's deleted even on timeout, uncomment the line below.
            // await kakashiWebhook.delete('Anbu ceremony finished or timed out.');
        });
    }
};