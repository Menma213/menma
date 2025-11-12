const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- File Paths ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const autofrankPath = path.resolve(__dirname, '../../menma/data/autofrank.json');

// --- Constants ---
const FRANK_COOLDOWN_MS = 3000; // 3 seconds per frank run
const BASE_EXP_PER_FRANK_RUN = 6; // As calculated from user's 3h = 21600 exp
const EXP_PER_HOUR = (3600 * 1000 / FRANK_COOLDOWN_MS) * BASE_EXP_PER_FRANK_RUN; // 7200 exp/hour

const DURATIONS_MS = {
    '3h': 3 * 3600 * 1000,
    '6h': 6 * 3600 * 1000,
    '12h': 12 * 3600 * 1000,
};

const DURATIONS_EXP = {
    '3h': 21600,
    '6h': 43200,
    '12h': 86400,
};

// --- Helper Functions ---
function getCooldownString(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let result = [];
    if (days) result.push(`${days}d`);
    if (hours % 24) result.push(`${hours % 24}h`);
    if (minutes % 60) result.push(`${minutes % 60}m`);
    if (seconds % 60) result.push(`${seconds % 60}s`);

    return result.join(' ') || '0s';
}

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
        .setName('autofrank')
        .setDescription('Manage your automatic F-rank training missions.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start an automatic F-rank training session.')
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('The duration for auto-frank training.')
                        .setRequired(true)
                        .addChoices(
                            { name: '3 Hours', value: '3h' },
                            { name: '6 Hours', value: '6h' },
                            { name: '12 Hours', value: '12h' },
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Claim EXP from your completed auto-frank session.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel your active auto-frank session.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check the status of your auto-frank session.')
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        const users = loadData(usersPath);
        const players = loadData(playersPath);
        const autofrankData = loadData(autofrankPath);

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll as a ninja first!", ephemeral: true });
        }

        let userAutoFrank = autofrankData[userId] || { activeSession: null, features: {} };

        // --- Handle 'start' subcommand ---
        if (subcommand === 'start') {
            const duration = interaction.options.getString('duration');

            if (userAutoFrank.activeSession && userAutoFrank.activeSession.status === 'active') {
                const remainingTime = (userAutoFrank.activeSession.startTime + DURATIONS_MS[userAutoFrank.activeSession.duration]) - Date.now();
                return interaction.reply({
                    content: `You already have an active auto-frank session for ${userAutoFrank.activeSession.duration}. It will be ready to claim in ${getCooldownString(remainingTime)}.`, 
                    ephemeral: true
                });
            }

            // Check if user has the premium feature (consumable count)
            if (!userAutoFrank.features[duration] || userAutoFrank.features[duration] <= 0) {
                return interaction.reply({
                    content: `You do not have any ${duration} auto-frank sessions remaining. Please purchase more from the shop.`, 
                    ephemeral: true
                });
            }

            // Decrement the count of purchased features
            userAutoFrank.features[duration]--;

            userAutoFrank.activeSession = {
                status: 'active',
                duration: duration,
                startTime: Date.now(),
                claimed: false,
            };
            autofrankData[userId] = userAutoFrank;
            saveData(autofrankPath, autofrankData);

            const endTime = userAutoFrank.activeSession.startTime + DURATIONS_MS[duration];
            const embed = new EmbedBuilder()
                .setTitle('Auto-Frank Session Started!')
                .setDescription(
                    `Your auto-frank session for **${duration}** has begun!\n` +
                    `You will be able to claim **${DURATIONS_EXP[duration].toLocaleString()} EXP** after ${getCooldownString(DURATIONS_MS[duration])}.\n` +
                    `Estimated claim time: <t:${Math.floor(endTime / 1000)}:R>\n\n` +
                    `You have **${userAutoFrank.features[duration]}** ${duration} auto-frank sessions remaining.`
                )
                .setColor('#00FF00')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- Handle 'claim' subcommand ---
        if (subcommand === 'claim') {
            if (!userAutoFrank.activeSession || userAutoFrank.activeSession.status !== 'active') {
                return interaction.reply({ content: "You don't have an active auto-frank session to claim.", ephemeral: true });
            }
            if (userAutoFrank.activeSession.claimed) {
                return interaction.reply({ content: "You have already claimed EXP for this session.", ephemeral: true });
            }

            const endTime = userAutoFrank.activeSession.startTime + DURATIONS_MS[userAutoFrank.activeSession.duration];
            const now = Date.now();

            if (now < endTime) {
                const remainingTime = endTime - now;
                return interaction.reply({
                    content: `Your auto-frank session is not yet complete. You can claim in ${getCooldownString(remainingTime)}.`, 
                    ephemeral: true
                });
            }

            // Award EXP
            // capture needed session info before we mutate/clear it
            const sessionDurationKey = userAutoFrank.activeSession.duration;
            const expToAward = DURATIONS_EXP[sessionDurationKey];

            if (!players[userId]) players[userId] = {};
            players[userId].exp = (players[userId].exp || 0) + expToAward;
            saveData(playersPath, players);

            // mark completed/claimed then clear the session
            userAutoFrank.activeSession.claimed = true;
            userAutoFrank.activeSession.status = 'completed';
            // keep sessionDurationKey for the reply (we'll clear the active session now)
            userAutoFrank.activeSession = null;

            autofrankData[userId] = userAutoFrank;
            saveData(autofrankPath, autofrankData);

            const embed = new EmbedBuilder()
                .setTitle('Auto-Frank EXP Claimed!')
                .setDescription(
                    `You have successfully claimed **${expToAward.toLocaleString()} EXP** from your ${sessionDurationKey} auto-frank session!\n` +
                    `Keep grinding, shinobi!`
                )
                .setColor('#00FFFF')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- Handle 'cancel' subcommand ---
        if (subcommand === 'cancel') {
            if (!userAutoFrank.activeSession || userAutoFrank.activeSession.status !== 'active') {
                return interaction.reply({ content: "You don't have an active auto-frank session to cancel.", ephemeral: true });
            }

            const cancelledDuration = userAutoFrank.activeSession.duration;
            userAutoFrank.activeSession = null; // Clear the active session
            autofrankData[userId] = userAutoFrank;
            saveData(autofrankPath, autofrankData);

            const embed = new EmbedBuilder()
                .setTitle('Auto-Frank Session Cancelled')
                .setDescription(
                    `Your active auto-frank session for **${cancelledDuration}** has been cancelled.\n` +
                    `No EXP was awarded.`
                )
                .setColor('#FF0000')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- Handle 'status' subcommand (default) ---
        if (subcommand === 'status') {
            let description = '';
            let color = '#FFA500'; // Orange

            if (userAutoFrank.activeSession && userAutoFrank.activeSession.status === 'active') {
                const endTime = userAutoFrank.activeSession.startTime + DURATIONS_MS[userAutoFrank.activeSession.duration];
                const now = Date.now();
                const remainingTime = endTime - now;

                description += `You have an active auto-frank session for **${userAutoFrank.activeSession.duration}**.\n`;
                if (now < endTime) {
                    description += `It will be ready to claim in **${getCooldownString(remainingTime)}**.\n`;
                    description += `Estimated claim time: <t:${Math.floor(endTime / 1000)}:R>`;
                } else {
                    description += `It is ready to be claimed! Use **/autofrank claim** to get your EXP.`;
                    color = '#00FF00'; // Green for ready to claim
                }
            } else {
                description += "You don't have any active auto-frank sessions.\n";
                color = '#808080'; // Gray for no active session
            }

            // Add purchased features info
            description += '\n**Available Auto-Frank Sessions:**\n';
            let hasFeatures = false;
            for (const durationKey of Object.keys(DURATIONS_MS)) {
                const count = userAutoFrank.features[durationKey] || 0;
                if (count > 0) {
                    description += `• ${durationKey}: **${count}** remaining\n`;
                    hasFeatures = true;
                }
            }
            if (!hasFeatures) {
                description += 'No auto-frank sessions purchased. Visit the shop to get some!';
            }

            const embed = new EmbedBuilder()
                .setTitle('Auto-Frank Status')
                .setDescription(description)
                .setColor(color)
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
    }
};