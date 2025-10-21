const { SlashCommandBuilder, WebhookClient, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const AKATSUKI_LEADER_ROLE_ID = '1381606426908033136';
const AKATSUKI_ROLE_ID = '1382055870229119159'; // <-- set this

// Mysterious Entity's webhook details
const MYSTERIOUS_ENTITY_NAME = 'Mysterious Entity';
// IMPORTANT: Replace with a direct link to an avatar for the Mysterious Entity.
// This could be a shadowy figure, a symbolic eye, or anything enigmatic!
const MYSTERIOUS_ENTITY_AVATAR = 'https://sdmntprnorthcentralus.oaiusercontent.com/files/00000000-d680-622f-8957-0bf4ef8386ad/raw?se=2025-07-08T16%3A57%3A36Z&sp=r&sv=2024-08-04&sr=b&scid=da03a89c-5a38-5563-b365-bc05dd1aa303&skoid=f28c0102-4d9d-4950-baf0-4a8e5f6cf9d4&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-07T21%3A51%3A17Z&ske=2025-07-08T21%3A51%3A17Z&sks=b&skv=2024-08-04&sig=pX3W76gPeFxDPxTtJR68Aad4z74wjbxub2OfsXQmAVg%3D'; // <--- !!! IMPORTANT: REPLACE THIS !!!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite a rogue ninja to the Akatsuki and initiate their induction.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to invite to the Akatsuki')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Ensure the command is used in a guild text channel
        if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: "This command can only be used in a server text channel.", ephemeral: true });
        }

        // Check if the command user has the Akatsuki Leader role
        if (!interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID)) {
            return interaction.reply({ content: "Only the Akatsuki Leader can use this command.", ephemeral: true });
        }

        const akatsukiLeader = interaction.user;
        const targetUser = interaction.options.getUser('user');
        const guild = interaction.guild;
        const channel = interaction.channel;

        // Load users from the database
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        // Check if the target user is a rogue ninja and not already in Akatsuki
        if (!users[targetUser.id] || users[targetUser.id].occupation !== "Rogue") {
            return interaction.reply({ content: "This user is not a rogue ninja, or is already part of an organization. Only rogue ninjas can be invited.", ephemeral: true });
        }

        // Defer the reply to give time for webhook setup and messages
        await interaction.deferReply({ ephemeral: true });

        // --- Webhook Handling ---
        let webhooks = await channel.fetchWebhooks();
        let mysteriousEntityWebhook = webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id && w.name === MYSTERIOUS_ENTITY_NAME);

        if (!mysteriousEntityWebhook) {
            try {
                mysteriousEntityWebhook = await channel.createWebhook({
                    name: MYSTERIOUS_ENTITY_NAME,
                    avatar: MYSTERIOUS_ENTITY_AVATAR,
                    reason: 'For Akatsuki induction ceremony'
                });
            } catch (error) {
                console.error("Failed to create Mysterious Entity webhook:", error);
                return interaction.editReply({ content: "Failed to create the Mysterious Entity webhook. Please check bot permissions (Manage Webhooks).", ephemeral: true });
            }
        }

        // Helper to send messages as Mysterious Entity
        async function mysteriousEntitySay(content, opts = {}) {
            return await mysteriousEntityWebhook.send({ content, username: MYSTERIOUS_ENTITY_NAME, avatarURL: MYSTERIOUS_ENTITY_AVATAR, ...opts });
        }
        // --- End Webhook Handling ---

        // Mysterious Entity starts the convo
        await mysteriousEntitySay(`Who's this? <@${akatsukiLeader.id}>...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay

        await mysteriousEntitySay(`Hmm... I see potential in <@${targetUser.id}>, but will they prove us right? Regardless, welcome to the Akatsuki, <@${targetUser.id}>.`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        await mysteriousEntitySay(
            `The Akatsuki is a mysterious group. We work in the shadows, collecting powerful beasts and changing the world. Our goals are big, and our methods are... direct. We don't follow village rules. We follow our own path.`
        );
        await new Promise(resolve => setTimeout(resolve, 4000));

        await mysteriousEntitySay(
            `If you understand this, and are ready to join us, give me **10,000 money** and I will make your identity official. Type **"I accept Akatsuki"** to confirm.`
        );

        // Update the Akatsuki Leader's ephemeral reply
        await interaction.editReply({ content: `The Mysterious Entity is awaiting ${targetUser.username}'s confirmation and payment.`, ephemeral: true });

        // Wait for the target user to confirm and accept the payment
        const confirmationFilter = m => m.author.id === targetUser.id && m.content.toLowerCase().trim() === "i accept akatsuki";
        const collector = channel.createMessageCollector({ filter: confirmationFilter, time: 60000, max: 1 }); // 60 seconds to respond

        collector.on('collect', async m => {
            let currentUserData = users[targetUser.id]; // Get the latest data for the target user
            // Deduct money from players.json instead of users.json
            const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
            let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
            if (!players[targetUser.id]) players[targetUser.id] = {};
            if ((players[targetUser.id].money || 0) < 10000) {
                await mysteriousEntitySay(`You do not have enough money, <@${targetUser.id}>. This offer is rescinded.`);
                return interaction.followUp({ content: `${targetUser.username} failed to join the Akatsuki due to insufficient funds.`, ephemeral: false });
            }
            players[targetUser.id].money = (players[targetUser.id].money || 0) - 10000;
            fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

            // Update occupation and save to database
            currentUserData.occupation = "Akatsuki";
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

            // Add Akatsuki role in Discord
            try {
                const member = await guild.members.fetch(targetUser.id);
                await member.roles.add(AKATSUKI_ROLE_ID, "Joined the Akatsuki after payment and confirmation");
            } catch (err) {
                console.error("Failed to add Akatsuki role:", err);
                await mysteriousEntitySay(`An error occurred while making your identity official, <@${targetUser.id}>. Your money has been taken, but the role could not be assigned. Contact the Leader.`);
                return interaction.followUp({ content: `Failed to add Akatsuki role to ${targetUser.username}. Money deducted, but role assignment failed.`, ephemeral: true });
            }

            await mysteriousEntitySay(`Excellent. Your identity is now official, <@${targetUser.id}>. Welcome to our ranks. Your journey begins now.`);
            await interaction.followUp({ content: `${targetUser.username} has paid 10,000 money and officially joined the Akatsuki!`, ephemeral: false });

            // Optional: Delete the webhook after the ceremony.
            // await mysteriousEntityWebhook.delete('Akatsuki induction finished.');
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await mysteriousEntitySay(`No response. This opportunity is lost, <@${targetUser.id}>. Perhaps you were not ready.`);
                await interaction.followUp({ content: `${targetUser.username} did not accept the Akatsuki invitation in time.`, ephemeral: false });
            }
            // Optional: If you want to ensure it's deleted even on timeout, uncomment here.
            // await mysteriousEntityWebhook.delete('Akatsuki induction finished or timed out.');
        });
    }
};