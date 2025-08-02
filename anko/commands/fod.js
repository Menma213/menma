const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// ADMIN USER ID who can manually start /fod (replace with the specific user's ID)
const ADMIN_USER_ID = '1381268854776529028'; // <<< IMPORTANT: REPLACE THIS WITH THE ACTUAL ADMIN USER ID
// Example: '123456789012345678' (a specific user's ID)

// Role ID for pings (replace with your role ID for pings)
const PING_ROLE_ID = '1389238943823827067'; // <-- Ensure this is your correct ping role ID

// Forest of Death settings
const MIN_PARTICIPANTS = 3; // Editable minimum participants
const JOIN_WAIT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds for joining period
const BATTLE_DELAY_AFTER_DEATHS = 2000; // 2 seconds between death announcements
const BETWEEN_ATTACKS_DELAY = 2000; // 2 seconds between battle attacks

// Paths
const deathsPath = path.resolve(__dirname, '../../menma/data/deaths.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Naruto attacks for the battle
const NARUTO_ATTACKS = [
    'Rasengan',
    'Shadow Clone Jutsu',
    'Chidori',
    'Fireball Jutsu',
    'Summoning Jutsu',
    'Eight Gates',
    'Amaterasu',
    'Susanoo',
];

// --- Automatic Scheduling Variables ---
let fodInterval = null;
let lastFODChannelId = null; // Stores the channel ID for auto-runs

// --- Core FOD Logic Function ---
// This function will be called by the slash command and the interval
async function startFOD(channel) {
    if (!channel || !channel.send) {
        console.error('FOD: Invalid channel provided for startFOD.');
        return;
    }

    try {
        // Unlock the channel (ensure the bot has permissions to do this)
        // Note: You might want to make this optional or configurable,
        // as locking/unlocking public channels frequently might be disruptive.
        // Also ensure the bot has MANAGE_CHANNELS permission.
        if (channel.guild && channel.guild.roles.everyone) {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                SendMessages: true,
            });
            console.log(`FOD: Unlocked channel ${channel.id}`);
        }

        // Ping everyone and send the starting embed
        await channel.send(`<@&${PING_ROLE_ID}>`);

        const startEmbed = new EmbedBuilder()
            .setTitle('Forest of Death')
            .setDescription('Would you like to join the Forest of Death? Type anything in this channel to join!')
            .setColor('#006400')
            .setImage('https://images-ext-1.discordapp.net/external/EHutcWmx0NJT1_xBXJ9rb9v72deI6tS4yeacm_U_xiU/https/pa1.narvii.com/6534/629af99050803dd5f64b124ddb572e3f0cc0d6b2_hq.gif?width=400&height=222');

        await channel.send({ embeds: [startEmbed] });

        // Collect participants via messages (any message from a non-bot user)
        const participants = new Set();
        const messageCollector = channel.createMessageCollector({
            filter: msg => !msg.author.bot,
            time: JOIN_WAIT_TIME
        });

        messageCollector.on('collect', msg => {
            participants.add(msg.author.id);
        });

        messageCollector.on('end', async (collected) => {
            await channel.send(`The joining period for Forest of Death has ended. Total participants: **${participants.size}**`);

            // Check if enough participants joined
            if (participants.size < MIN_PARTICIPANTS) {
                await channel.send(`Not enough participants to start the Forest of Death. Need at least ${MIN_PARTICIPANTS}.`);
                // Unlock the channel again if it was locked
                if (channel.guild && channel.guild.roles.everyone) {
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: true,
                    });
                }
                return;
            }

            // Lock the channel (ensure the bot has permissions)
            if (channel.guild && channel.guild.roles.everyone) {
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                    SendMessages: false,
                });
                console.log(`FOD: Locked channel ${channel.id}`);
            }

            await channel.send('The Forest of Death has begun! No more talking...');

            // Start the Forest of Death main event
            let deaths = [];
            try {
                deaths = JSON.parse(fs.readFileSync(deathsPath, 'utf8'));
            } catch (err) {
                console.error('FOD: Error reading deaths.json:', err);
                await channel.send('An error occurred while fetching death scenarios. The Forest of Death cannot proceed.');
                // Unlock channel in case of error
                if (channel.guild && channel.guild.roles.everyone) {
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: true,
                    });
                }
                return;
            }


            let remainingParticipants = Array.from(participants);

            // Ensure there are enough deaths configured
            if (deaths.length === 0) {
                await channel.send('No death scenarios configured. The Forest of Death cannot proceed.');
                // Unlock channel in case of error
                if (channel.guild && channel.guild.roles.everyone) {
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: true,
                    });
                }
                return;
            }

            await channel.send('Participants will fall one by one...');
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Small delay before first death

            while (remainingParticipants.length > 2) {
                // Randomly select a participant to die
                const deadIndex = Math.floor(Math.random() * remainingParticipants.length);
                const deadUserId = remainingParticipants[deadIndex];
                let deadUser;
                try {
                    deadUser = await channel.client.users.fetch(deadUserId);
                } catch (fetchErr) {
                    console.error(`FOD: Could not fetch user ${deadUserId}:`, fetchErr);
                    // If user can't be fetched, just remove them and continue
                    remainingParticipants.splice(deadIndex, 1);
                    continue;
                }

                // Randomly select a death type
                const deathType = deaths[Math.floor(Math.random() * deaths.length)].deathtype;

                // Send the death message
                const deathEmbed = new EmbedBuilder()
                    .setTitle('Forest of Death')
                    .setDescription(`${deadUser.username} was ${deathType}!`)
                    .setColor('#006400');

                await channel.send({ embeds: [deathEmbed] });

                // Remove the dead participant
                remainingParticipants.splice(deadIndex, 1);
                await new Promise((resolve) => setTimeout(resolve, BATTLE_DELAY_AFTER_DEATHS));
            }

            // Start the RNG-based battle for the final two
            if (remainingParticipants.length !== 2) {
                await channel.send('Something went wrong. Not exactly two participants left for the final battle.');
                // Unlock channel
                if (channel.guild && channel.guild.roles.everyone) {
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: true,
                    });
                }
                return;
            }

            const [player1Id, player2Id] = remainingParticipants;
            const player1 = await channel.client.users.fetch(player1Id);
            const player2 = await channel.client.users.fetch(player2Id);

            let player1HP = 5;
            let player2HP = 5;

            const battleEmbed = new EmbedBuilder()
                .setTitle(`${player1.username} vs ${player2.username}`)
                .setDescription('The final battle begins!')
                .setColor('#006400')
                .setImage('https://images-ext-1.discordapp.net/external/O2_yNRJUKZwqlX3cERTRVZi1EWFj0wMbtds27qzzSPU/https/c.tenor.com/uQA1kJfi9NIAAAAM/sasuke-orochimaru.gif');

            await channel.send({ embeds: [battleEmbed] });
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Battle loop
            while (player1HP > 0 && player2HP > 0) {
                // Player 1 attacks
                const player1Attack = NARUTO_ATTACKS[Math.floor(Math.random() * NARUTO_ATTACKS.length)];
                const player1Damage = Math.floor(Math.random() * 3); // Random damage between 0 and 2

                player2HP -= player1Damage;

                const player1AttackEmbed = new EmbedBuilder()
                    .setTitle('Battle Update')
                    .setDescription(
                        `${player1.username} used **${player1Attack}** and dealt **${player1Damage} damage**!\n\n` +
                        `${player1.username}: ${Math.max(0, player1HP)} HP\n` + // Ensure HP doesn't go negative in display
                        `${player2.username}: ${Math.max(0, player2HP)} HP`
                    )
                    .setColor('#006400');

                await channel.send({ embeds: [player1AttackEmbed] });
                if (player2HP <= 0) break; // Check if Player 2 is defeated

                await new Promise((resolve) => setTimeout(resolve, BETWEEN_ATTACKS_DELAY));

                // Player 2 attacks
                const player2Attack = NARUTO_ATTACKS[Math.floor(Math.random() * NARUTO_ATTACKS.length)];
                const player2Damage = Math.floor(Math.random() * 3); // Random damage between 0 and 2

                player1HP -= player2Damage;

                const player2AttackEmbed = new EmbedBuilder()
                    .setTitle('Battle Update')
                    .setDescription(
                        `${player2.username} used **${player2Attack}** and dealt **${player2Damage} damage**!\n\n` +
                        `${player1.username}: ${Math.max(0, player1HP)} HP\n` +
                        `${player2.username}: ${Math.max(0, player2HP)} HP`
                    )
                    .setColor('#006400');

                await channel.send({ embeds: [player2AttackEmbed] });
                await new Promise((resolve) => setTimeout(resolve, BETWEEN_ATTACKS_DELAY));
            }

            // Determine the winner
            const winner = player1HP > 0 ? player1 : player2;
            const loser = player1HP > 0 ? player2 : player1; // Not explicitly used but good for clarity

            const winnerEmbed = new EmbedBuilder()
                .setTitle('Forest of Death Winner!')
                .setDescription(`${winner.username} has won the Forest of Death and earned **50 Ramen Coupons** and **5000 Money**!`)
                .setColor('#006400');

            await channel.send({ embeds: [winnerEmbed] });

            // Update the winner's profile
            let usersData = {};
            try {
                usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            } catch (err) {
                console.error('FOD: Error reading users.json:', err);
                await channel.send('An error occurred while updating winner\'s profile data. Please contact an admin.');
            }

            if (usersData[winner.id]) {
                usersData[winner.id].ramen = (usersData[winner.id].ramen || 0) + 50;
                usersData[winner.id].money = (usersData[winner.id].money || 0) + 500000;
                fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
            } else {
                await channel.send(`Winner ${winner.username} is not enrolled in the system. Money and Ramen not awarded.`);
            }

            // Unlock the channel after the event concludes
            if (channel.guild && channel.guild.roles.everyone) {
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                    SendMessages: true,
                });
                console.log(`FOD: Unlocked channel ${channel.id}`);
            }

        }); // End of collector.on('end')

    } catch (error) {
        console.error('FOD: Error during Forest of Death execution:', error);
        if (channel && channel.send) {
            await channel.send("An unexpected error occurred during the Forest of Death. Please contact an administrator.");
            // Ensure channel is unlocked on error
            if (channel.guild && channel.guild.roles.everyone) {
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                    SendMessages: true,
                });
            }
        }
    }
}

// Helper to set up the automatic interval
function setupFODInterval(client) {
    if (fodInterval) return; // Prevent multiple intervals

    // Check if a channel ID was previously set (from a manual run)
    // In a real application, you'd load this from a persistent config/database
    if (!lastFODChannelId) {
        console.warn('FOD: No channel set for automatic FOD. Please run /fod manually once to set the channel.');
        return; // Cannot set up interval without a channel
    }

    // Interval time: 6 hours = 6 * 60 * 60 * 1000 milliseconds
    const INTERVAL_MS = 6 * 60 * 60 * 1000;

    fodInterval = setInterval(async () => {
        try {
            const channel = await client.channels.fetch(lastFODChannelId);
            if (channel && channel.send) {
                console.log(`FOD: Automatically starting Forest of Death in channel ${channel.id}`);
                await startFOD(channel);
            } else {
                console.warn(`FOD: Stored channel ${lastFODChannelId} not found or not a text channel for automatic FOD.`);
                // If channel is invalid, clear interval to prevent endless errors
                clearInterval(fodInterval);
                fodInterval = null;
                lastFODChannelId = null;
            }
        } catch (error) {
            console.error('FOD: Error during automatic interval execution:', error);
        }
    }, INTERVAL_MS);
    console.log(`FOD: Automatic Forest of Death scheduled to run every 6 hours in channel ${lastFODChannelId}.`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fod')
        .setDescription('Start the Forest of Death!'),
    name: 'fod',
    description: 'Start the Forest of Death!',

    // This client parameter is crucial for the auto-run to fetch the channel
    async execute(interaction, client) {
        const commandInvokerId = interaction.user.id;

        // Check if the user has the required role
        const member = await interaction.guild.members.fetch(commandInvokerId);
        if (!member.roles.cache.has(ADMIN_USER_ID)) {
            return interaction.reply({ content: 'Only users with the required role can start the Forest of Death manually.', ephemeral: true });
        }

        await interaction.deferReply(); // Defer to prevent timeout

        const channel = interaction.channel;
        lastFODChannelId = channel.id; // Store the channel ID for future auto-runs

        await startFOD(channel); // Start the FOD immediately

        // Set up the interval if not already set
        setupFODInterval(client);

        // Final reply to the manual command.
        await interaction.editReply({ content: 'Forest of Death has been initiated and automatic runs are now scheduled!' });
    },

    // A method to initialize the automatic task when the bot starts
    // This assumes your bot's main file (e.g., index.js) calls this.
    init(client, channelIdForAutoRun = null) {
        if (channelIdForAutoRun) {
            lastFODChannelId = channelIdForAutoRun;
            console.log(`FOD: Initializing with channel ${lastFODChannelId} for auto-runs.`);
        }
        setupFODInterval(client);
    }
};