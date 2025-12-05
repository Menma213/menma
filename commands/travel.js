const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle } = require('./combinedcommands.js'); // Reuse battle logic
const { userMutex } = require('../utils/locks');

const territoriesPath = path.resolve(__dirname, '../data/territories.json');
const usersPath = path.resolve(__dirname, '../data/users.json');
const playersPath = path.resolve(__dirname, '../data/players.json');

// Guardian Stats Template (scales with tier)
const BASE_GUARDIAN_STATS = {
    health: 1000,
    power: 50,
    defense: 30,
    accuracy: 90,
    dodge: 10
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('travel')
        .setDescription('Travel across the ninja world.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current location and travel status.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move to a different territory.')
                .addStringOption(option =>
                    option.setName('destination')
                        .setDescription('The territory you want to travel to.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Land of Fire (Tier 1)', value: 'land_of_fire' },
                            { name: 'Hidden Village of Sound (Tier 2)', value: 'village_of_sound' },
                            { name: 'Country of Rain (Tier 3)', value: 'country_of_rain' },
                            { name: 'Land of Wind (Tier 4)', value: 'land_of_wind' },
                            { name: 'Hidden Village of Sand (Tier 5)', value: 'village_of_sand' },
                            { name: 'Land of Water (Tier 6)', value: 'land_of_water' },
                            { name: 'Land of Earth (Tier 7)', value: 'land_of_earth' },
                            { name: 'Land of Lightning (Tier 8)', value: 'land_of_lightning' },
                            { name: 'Valley of the End (Tier 9)', value: 'valley_of_the_end' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('challenge')
                .setDescription('Challenge the Guardian of your current location to unlock the next tier.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Load territories (static data, no lock needed usually, but good practice if it changes)
        const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));

        // Initial check (can be loose, but handle* will re-check strictly)
        let userExists = false;
        await userMutex.runExclusive(async () => {
            const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
            if (users[userId]) {
                userExists = true;
                // Initialize user travel data if missing
                if (!users[userId].location) {
                    users[userId].location = 'land_of_fire';
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }
                if (!users[userId].maxTierUnlocked) {
                    users[userId].maxTierUnlocked = 1;
                    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                }
            }
        });

        if (!userExists) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        if (subcommand === 'view') {
            await handleView(interaction, userId, territories);
        } else if (subcommand === 'move') {
            await handleMove(interaction, userId, territories);
        } else if (subcommand === 'challenge') {
            await handleChallenge(interaction, userId, territories);
        }
    }
};

async function handleView(interaction, userId, territoriesData) {
    let user;
    await userMutex.runExclusive(async () => {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        user = users[userId];
    });

    if (!user) return; // Should not happen due to previous check

    const currentLocationId = user.location;
    const currentLocation = territoriesData.territories[currentLocationId];
    const maxTier = user.maxTierUnlocked;

    const embed = new EmbedBuilder()
        .setTitle(`Travel Status: ${interaction.user.username}`)
        .setColor(currentLocation.color || '#FFFFFF')
        .addFields(
            { name: 'Current Location', value: `${currentLocation.displayName} (Tier ${currentLocation.tier})`, inline: true },
            { name: 'Max Tier Unlocked', value: `Tier ${maxTier}`, inline: true },
            { name: 'Guardian', value: currentLocation.guardian, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL());

    if (currentLocation.tier < 9) {
        // Find next tier location
        const nextLocation = Object.values(territoriesData.territories).find(t => t.tier === currentLocation.tier + 1);
        if (nextLocation) {
            const isUnlocked = maxTier >= nextLocation.tier;
            embed.addFields({
                name: 'Next Destination',
                value: `${nextLocation.displayName} (Tier ${nextLocation.tier}) - ${isUnlocked ? 'Unlocked' : 'Locked (Defeat Guardian to unlock)'}`,
                inline: false
            });
        }
    } else {
        embed.addFields({ name: 'Status', value: 'You have reached the pinnacle of the world!', inline: false });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleMove(interaction, userId, territoriesData) {
    const destinationId = interaction.options.getString('destination');
    const destination = territoriesData.territories[destinationId];

    if (!destination) {
        return interaction.reply({ content: "Invalid destination.", ephemeral: true });
    }

    let success = false;
    let message = "";
    let color = '#00FF00';

    await userMutex.runExclusive(async () => {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user) return;

        const maxTier = user.maxTierUnlocked;

        if (destination.tier > maxTier) {
            message = `You cannot travel to **${destination.displayName}** yet. You must defeat the Guardian of your highest unlocked tier to progress.`;
            return; // Fail
        }

        if (user.location === destinationId) {
            message = `You are already in **${destination.displayName}**.`;
            return; // Fail
        }

        // Update location
        user.location = destinationId;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        success = true;
        message = `You have traveled to **${destination.displayName}** (Tier ${destination.tier}).`;
        color = destination.color || '#00FF00';
    });

    if (!success) {
        return interaction.reply({ content: message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('Traveling...')
        .setDescription(message)
        .setColor(color);

    await interaction.reply({ embeds: [embed] });
}

async function handleChallenge(interaction, userId, territoriesData) {
    let guardianStats = null;
    let currentLocation = null;
    let maxTier = 0;

    // Pre-battle check
    await userMutex.runExclusive(async () => {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user) return;

        const currentLocationId = user.location;
        currentLocation = territoriesData.territories[currentLocationId];
        maxTier = user.maxTierUnlocked;
    });

    if (!currentLocation) return;

    // Check if there is a next tier
    if (currentLocation.tier >= 9) {
        return interaction.reply({ content: "You have already conquered the highest tier region!", ephemeral: true });
    }

    // Logic: To unlock Tier X+1, you must beat Guardian of Tier X.
    // If I am in Tier 1 (maxTier 1), I fight Guardian I. Win -> maxTier 2.
    // If I am in Tier 1 (maxTier 2), I can fight Guardian I again, but no new unlock.

    const guardiansData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/guardians.json'), 'utf8'));
    const guardianData = guardiansData.guardians[currentLocation.name];

    if (!guardianData) {
        return interaction.reply({ content: "Error: Guardian data not found for this location.", ephemeral: true });
    }

    guardianStats = {
        ...guardianData.stats,
        statsType: guardianData.statsType || 'scalable',
        name: guardianData.name,
        image: guardianData.image,
        jutsu: guardianData.jutsu.reduce((acc, curr, idx) => ({ ...acc, [idx]: curr }), {}),
        userId: `NPC_${guardianData.name.replace(/\s+/g, '_')}`
    };

    await interaction.reply({ content: `**Challenging ${guardianData.name}!** Get ready for battle...` });

    // Run battle (OUTSIDE MUTEX)
    const { winner } = await runBattle(interaction, interaction.user.id, guardianStats.userId, "guardian", guardianStats);

    if (winner && winner.userId === interaction.user.id) {
        // Player won
        let msg = `**Victory!** You have defeated ${guardianData.name}.`;

        // Post-battle update
        await userMutex.runExclusive(async () => {
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const user = users[userId];
            if (!user) return;

            // Re-check condition in case it changed (unlikely but safe)
            if (currentLocation.tier === user.maxTierUnlocked) {
                user.maxTierUnlocked += 1;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                msg += `\n**New Region Unlocked!** You can now travel to Tier ${user.maxTierUnlocked}.`;
            } else {
                msg += `\n(You had already unlocked the next tier, but good practice!)`;
            }
        });

        await interaction.followUp({ content: msg });
    } else {
        await interaction.followUp({ content: `**Defeat!** ${guardianData.name} was too strong. Train harder and try again.` });
    }
}