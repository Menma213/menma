const { SlashCommandBuilder, WebhookClient, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const AKATSUKI_LEADER_ROLE_ID = '1381606426908033136'; // Your Akatsuki Leader Role ID

// Mysterious Entity's webhook details (reusing from invite.js)
const MYSTERIOUS_ENTITY_NAME = 'Mysterious Entity';
// IMPORTANT: Use the same direct link to an avatar for the Mysterious Entity as in invite.js!
const MYSTERIOUS_ENTITY_AVATAR = 'https://i.postimg.cc/zD9L6T4N/image.png'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('command')
        .setDescription('Command an Akatsuki member to a specific role')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Akatsuki member to assign a role')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role to assign')
                .setRequired(true)
                .addChoices(
                    { name: 'Co-Leader', value: 'Co-Leader' },
                    { name: 'Bruiser', value: 'Bruiser' },
                    { name: 'Scientist', value: 'Scientist' }
                )
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

        const targetUser = interaction.options.getUser('user');
        const role = interaction.options.getString('role'); // Role chosen by the leader via slash command
        const channel = interaction.channel;

        // Load users from the database
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        // Check if the target user is an Akatsuki member
        if (!users[targetUser.id] || users[targetUser.id].occupation !== "Akatsuki") {
            return interaction.reply({ content: "This user is not an Akatsuki member and cannot be assigned an Akatsuki role.", ephemeral: true });
        }

        // Defer the reply to give time for webhook setup and messages
        await interaction.deferReply({ ephemeral: true });

        // --- Webhook Handling (Reusing logic from invite.js) ---
        let webhooks = await channel.fetchWebhooks();
        let mysteriousEntityWebhook = webhooks.find(w => w.owner && w.owner.id === interaction.client.user.id && w.name === MYSTERIOUS_ENTITY_NAME);

        if (!mysteriousEntityWebhook) {
            try {
                mysteriousEntityWebhook = await channel.createWebhook({
                    name: MYSTERIOUS_ENTITY_NAME,
                    avatar: MYSTERIOUS_ENTITY_AVATAR,
                    reason: 'For Akatsuki role assignment ceremony'
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

        // Mysterious Entity starts the ceremony
        await mysteriousEntitySay(`I think you'll be a good **${role}**, <@${targetUser.id}>.`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay for dramatic effect

        // --- Role-specific checks and explanations ---
        let appointmentSuccessful = true;

        if (role === 'Co-Leader') {
            const existingCoLeader = Object.values(users).find(u => u.occupation === "Akatsuki" && u.role === "Co-Leader");
            if (existingCoLeader) {
                appointmentSuccessful = false;
                await mysteriousEntitySay(`There can only be one Co-Leader, and <@${existingCoLeader.id}> currently holds that position. A new Co-Leader cannot be appointed at this time.`);
            } else {
                await mysteriousEntitySay(
                    `As **Co-Leader**, <@${targetUser.id}>, you will take charge of the Akatsuki Hideout in the Akatsuki Leader's absence. You are the second in command when the Leader is away. This role demands you to step up.`
                );
            }
        } else if (role === 'Bruiser') {
            await mysteriousEntitySay(
                `As a **Bruiser**, <@${targetUser.id}>, your strength will be put to use in the war. You will gain access to the \`/rob\` command, which allows you to rob different stores for ramen. But be vary; this command has a 3-hour cooldown.`
            );
        } else if (role === 'Scientist') {
            await mysteriousEntitySay(
                `As a **Scientist**, <@${targetUser.id}>, you hold a very crucial role in the war. You are the minds behind our most devastating weapons. You're the one who make the "Nuclear Chakra Bombs" needed to invade the villages during war.`
            );
        }

        if (!appointmentSuccessful) {
            return interaction.followUp({ content: `Role assignment for ${targetUser.username} as **${role}** was cancelled due to existing limitations.`, ephemeral: false });
        }

        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay before final confirmation

        // Assign the role in users.json
        users[targetUser.id].role = role;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        await mysteriousEntitySay(`Your path is set, <@${targetUser.id}>. You are now officially a **${role}** of the Akatsuki.`);
        await interaction.followUp({ content: `${targetUser.username} has been officially assigned the role of **${role}** within the Akatsuki!`, ephemeral: false });

        // Optional: Delete the webhook after the ceremony.
        // await mysteriousEntityWebhook.delete('Akatsuki role assignment finished.');
    }
};