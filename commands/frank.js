const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder, // Added ButtonBuilder
    ButtonStyle // Added ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Resolve the correct path to your data files
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const BAN_FILE = path.resolve(__dirname, '../../menma/data/frank_bans.json');

// Constant IDs for roles, channels, and users
const SERVER_BOOSTER_ROLE = '1399150845022572544';
const COOLDOWN = 3000; // 3 seconds
const CAPTCHA_FAIL_ALERT_CHANNEL = '1381271394901557323';
const MAIN_SERVER_ID = '1381268582595297321';
const ADMIN_ID = '1381268854776529028';
const CAPTCHA_TIMEOUT_MS = 300000; // 5 minutes to click the button
const MODAL_SUBMISSION_TIMEOUT_MS = 60000; // 60 seconds to submit the modal

// Function to load the ban list from the JSON file
function loadBans() {
    if (!fs.existsSync(BAN_FILE)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(BAN_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading bans file:', error);
        return {};
    }
}

// Function to save the ban list to the JSON file
function saveBans(bans) {
    try {
        fs.writeFileSync(BAN_FILE, JSON.stringify(bans, null, 2));
    } catch (error) {
        console.error('Error writing bans file:', error);
    }
}

module.exports = {
    // Defines the slash command structure
    data: new SlashCommandBuilder()
        .setName('frank')
        .setDescription('Do a micro training mission for quick EXP')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Optional action (e.g., "unlock" to unban a user)')
                .addChoices(
                    { name: 'unlock', value: 'unlock' }
                )
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User for the "unlock" action (Admin only)')
                .setRequired(false)
        ),

    // The core logic of the command
    async execute(interaction) {
        // --- 1. Initial Checks ---
        if (!interaction.guild || interaction.guild.id !== MAIN_SERVER_ID) {
            return interaction.reply({ content: 'This command can only be used in the main server.', ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;
        let bans = loadBans();

        // Handle the 'unlock' action for admins
        if (action === 'unlock') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Only users with administrator permissions can use the "unlock" action.', ephemeral: true });
            }
            if (!targetUser) {
                return interaction.reply({ content: 'You must provide a user to unlock.', ephemeral: true });
            }
            if (bans[targetUser.id]) {
                delete bans[targetUser.id];
                saveBans(bans);
                console.log(`User ${targetUser.username} (${targetUser.id}) has been unbanned from frank.`);
                return interaction.reply({ content: `Unbanned <@${targetUser.id}> from using frank.`, ephemeral: false });
            } else {
                return interaction.reply({ content: `<@${targetUser.id}> is not banned from frank.`, ephemeral: true });
            }
        }

        // Check if the user is banned from normal use
        if (bans[userId]) {
            return interaction.reply({
                content: "You have been temporarily banned from using frank. Please approach an admin to get yourself unbanned.",
                ephemeral: true
            });
        }

        // Check for the user's data file and existence
        if (!fs.existsSync(usersPath) || !fs.existsSync(playersPath)) {
            return interaction.reply("Database connection failed. Please try again later.", { ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({
                content: "You must enroll as a ninja before you can train!",
                ephemeral: true
            });
        }
        const player = { ...users[userId], ...(players[userId] || {}) };

        // Cooldown check
        if (!global._frankCooldown) global._frankCooldown = {};
        const now = Date.now();
        if (global._frankCooldown[userId] && now - global._frankCooldown[userId] < COOLDOWN) {
            const wait = Math.ceil((COOLDOWN - (now - global._frankCooldown[userId])) / 1000);
            return interaction.reply({
                content: `You must wait ${wait} more second(s) before doing another F-rank mission.`,
                ephemeral: false
            });
        }
        global._frankCooldown[userId] = now;

        // --- 2. CAPTCHA Logic (Interactive Button/Modal Flow) ---
        let captchaPassed = true; // Assume success unless CAPTCHA is required

        // 5% chance to trigger CAPTCHA
        if (Math.random() < 0.05) {
            captchaPassed = false;
            const captcha = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
            const buttonId = `FRANK_CAPTCHA_PROMPT_${userId}`;
            const modalId = `FRANK_CAPTCHA_MODAL_${userId}`;

            // Create the initial message with the button
            const captchaEmbed = new EmbedBuilder()
                .setColor('#FF9800')
                .setTitle('🚨 Anti-Cheat Verification Required 🚨')
                .setDescription(`To continue your mission, please click the **Enter Code** button below and submit the following 5-digit code in the pop-up modal:
> **Code to Enter:** \`${captcha}\`

You have **${Math.floor(CAPTCHA_TIMEOUT_MS / 60000)} minutes** to click the button and **60 seconds** to submit the code in the modal.`)
                .setFooter({ text: 'Closing the modal by mistake? Click "Enter Code" again.' });

            const enterButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel('Enter Code')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📝')
            );

            // Send the initial reply with the button
            const initialReply = await interaction.reply({
                embeds: [captchaEmbed],
                components: [enterButtonRow],
                ephemeral: false,
                fetchReply: true // Get the message object for the collector
            });

            let componentInteraction;
            try {
                // Wait for the user to click the button
                componentInteraction = await initialReply.awaitMessageComponent({
                    filter: i => i.customId === buttonId && i.user.id === userId,
                    time: CAPTCHA_TIMEOUT_MS,
                    errors: ['time'],
                });
            } catch (err) {
                // Button Timeout: Ban the user
                bans[userId] = { bannedAt: now, reason: 'Captcha button timeout' };
                saveBans(bans);

                // Edit the original message to show failure and remove the button
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#DC3545')
                    .setTitle('❌ Verification Failed - Timed Out')
                    .setDescription('You failed to click the submission button within 5 minutes. You have been temporarily banned from using frank.')
                    .setFooter({ text: 'Approach an admin for an unban.' });

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => console.error('Failed to edit reply on captcha button timeout.'));

                // Alert admin channel
                try {
                    const alertChannel = await interaction.client.channels.fetch(CAPTCHA_FAIL_ALERT_CHANNEL);
                    if (alertChannel) {
                        await alertChannel.send(`<@${ADMIN_ID}>, <@${userId}> has failed the captcha (button timeout) in <#${interaction.channel.id}> and has been banned from frank.`);
                    }
                } catch (alertErr) {
                    console.error('Failed to send captcha fail alert (button timeout):', alertErr);
                }
                return; // End command execution
            }

            // Button Clicked: Show the Modal
            const captchaModal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle('Anti-Cheat Code Submission')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('captcha_input')
                            .setLabel(`Enter the anti-cheat code: ${captcha}`)
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter the number here')
                            .setRequired(true)
                            .setMinLength(5)
                            .setMaxLength(5)
                    )
                );

            await componentInteraction.showModal(captchaModal);

            let modalSubmitInteraction;
            try {
                // Wait for Modal Submission
                modalSubmitInteraction = await componentInteraction.awaitModalSubmit({
                    filter: i => i.customId === modalId && i.user.id === userId,
                    time: MODAL_SUBMISSION_TIMEOUT_MS,
                    errors: ['time'],
                });
            } catch (err) {
                // Modal Submission Timeout: Ban the user
                bans[userId] = { bannedAt: now, reason: 'Modal submission timeout' };
                saveBans(bans);

                // Edit the original message to show failure and remove the button
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#DC3545').setTitle('❌ Modal Timed Out').setDescription('You did not submit the code in time. You have been temporarily banned from using frank.')],
                    components: [] // Remove the button
                }).catch(() => console.error('Failed to edit reply on modal submission timeout.'));

                // Alert admin channel
                try {
                    const alertChannel = await interaction.client.channels.fetch(CAPTCHA_FAIL_ALERT_CHANNEL);
                    if (alertChannel) {
                        await alertChannel.send(`<@${ADMIN_ID}>, <@${userId}> has failed the captcha (modal timeout) in <#${interaction.channel.id}> and has been banned from frank.`);
                    }
                } catch (alertErr) {
                    console.error('Failed to send captcha fail alert (modal timeout):', alertErr);
                }
                return; // End command execution
            }

            // Code Verification
            const userInput = modalSubmitInteraction.fields.getTextInputValue('captcha_input');

            // Disable the button immediately on submission (success or failure)
            await interaction.editReply({ components: [] }).catch(() => { });

            if (userInput === captcha) {
                captchaPassed = true;
                await modalSubmitInteraction.reply({ content: "✅ Captcha passed! Proceeding with the mission.", ephemeral: true });
                // Fall through to mission reward
            } else {
                // Incorrect Input: Ban the user
                bans[userId] = { bannedAt: now, reason: 'Incorrect captcha input' };
                saveBans(bans);

                // Reply to the modal submission
                await modalSubmitInteraction.reply({
                    content: "❌ Captcha failed. You have been temporarily banned from using frank. Please approach an admin to get yourself unbanned.",
                    ephemeral: true
                });

                // Alert admin channel
                try {
                    const alertChannel = await interaction.client.channels.fetch(CAPTCHA_FAIL_ALERT_CHANNEL);
                    if (alertChannel) {
                        await alertChannel.send(`<@${ADMIN_ID}>, <@${userId}> has failed the captcha (incorrect input) in <#${interaction.channel.id}> and has been banned from frank.`);
                    }
                } catch (alertErr) {
                    console.error('Failed to send captcha fail alert (incorrect input):', alertErr);
                }
                return; // End command execution
            }
        }

        // --- 3. Mission Reward Logic ---

        // This block is only reached if:
        // A) CAPTCHA was skipped (interaction.replied is false)
        // B) CAPTCHA was successfully passed (interaction.replied is true)

        let replyFunction;

        if (interaction.replied) {
            // Case B: CAPTCHA was handled, and the initial message/button was already sent. Use followUp.
            replyFunction = interaction.followUp;
        } else {
            // Case A: CAPTCHA was skipped, and no reply has been sent yet. Defer, then use editReply.
            await interaction.deferReply({ ephemeral: false });
            replyFunction = interaction.editReply;
        }

        // Calculate and award EXP
        const baseExp = 2; // Base EXP for frank missions
        let exp = baseExp + Math.floor((player.level || 1) * 0.05); // Scale with player level
        let boosterMessage = '';
        if (interaction.member && interaction.member.roles.cache.has(SERVER_BOOSTER_ROLE)) {
            exp = Math.floor(exp * 1.5); // Apply 1.5x booster bonus
            boosterMessage = ' *(Server Booster Bonus!)*';
        }

        // Update EXP in players.json
        if (!players[userId]) players[userId] = {};
        players[userId].exp = (players[userId].exp || 0) + exp;
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

        // Create and send the embed
        const frankEmbed = new EmbedBuilder()
            .setColor('#FF9800')
            .setTitle(` Micro Training Complete!`)
            .setDescription(`**${interaction.user.username}** successfully completed the F-rank mission and gained **${exp} EXP**${boosterMessage}`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setImage('https://media.tenor.com/8-kXsED3TwwAAAAM/modo-senin-naruto.gif')
            .setFooter({ text: 'Keep grinding, shinobi!' })
            .setTimestamp();

        await replyFunction.call(interaction, { embeds: [frankEmbed] });
    }
};
