const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Constants
const DATA_PATH = path.join(__dirname, '../data/users.json');
const MENTORS_PATH = path.join(__dirname, '../data/mentors.json');
const MENTOR_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in ms
const SELECTION_TIMEOUT = 60_000; // 60 seconds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Choose or manage your mentor relationship')
        .addSubcommand(subcommand =>
            subcommand
                .setName('select')
                .setDescription('Select a new mentor'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View information about your current mentor'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('change')
                .setDescription('Request to change your mentor (cooldown applies)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            // Load data
            const [users, mentors] = await Promise.all([
                loadJsonFile(DATA_PATH),
                loadJsonFile(MENTORS_PATH)
            ]);

            // Check if user exists
            if (!users[userId]) {
                return interaction.reply({
                    content: "You need to enroll first using `/enroll`.",
                    ephemeral: true
                });
            }

            const player = users[userId];

            // Handle different subcommands
            switch (subcommand) {
                case 'select':
                    await handleSelectMentor(interaction, player, userId, mentors, users);
                    break;
                case 'info':
                    await handleMentorInfo(interaction, player);
                    break;
                case 'change':
                    await handleChangeMentor(interaction, player, userId, mentors, users);
                    break;
            }
        } catch (error) {
            console.error('Mentor command error:', error);
            interaction.reply({
                content: "An error occurred while processing your request. Please try again later.",
                ephemeral: true
            });
        }
    }
};

// Helper functions
async function loadJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty object
            return {};
        }
        throw error;
    }
}

async function saveJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function handleSelectMentor(interaction, player, userId, mentors, users) {
    if (player.mentor) {
        return interaction.reply({
            content: `You already have a mentor: **${player.mentor}**. Use \`/mentor change\` if you want to change.`,
            ephemeral: true
        });
    }

    const availableMentors = getAvailableMentors(player, mentors);
    
    if (availableMentors.length === 0) {
        return interaction.reply({
            content: "No mentors are currently available for your rank and clan.",
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('Choose Your Mentor')
        .setDescription('Select a mentor from the list below. Each mentor specializes in different areas.')
        .setColor('#0099ff');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mentor_selection')
        .setPlaceholder('Select a mentor')
        .addOptions(availableMentors.map(mentor => ({
            label: mentor.name,
            value: mentor.id,
            description: mentor.specialty || 'General training',
            emoji: mentor.emoji || '👨‍🏫'
        })));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });

    try {
        const selection = await response.awaitMessageComponent({
            filter: i => i.user.id === userId && i.customId === 'mentor_selection',
            time: SELECTION_TIMEOUT
        });

        const selectedMentorId = selection.values[0];
        const selectedMentor = availableMentors.find(m => m.id === selectedMentorId);

        // Update player data
        player.mentor = selectedMentor.name;
        player.mentorId = selectedMentor.id;
        player.mentorSince = new Date().toISOString();
        player.mentorExp = 0;
        player.mentorCooldown = null;
        
        users[userId] = player;
        await saveJsonFile(DATA_PATH, users);

        // Create mentor info embed
        const successEmbed = new EmbedBuilder()
            .setTitle(`Mentor Assigned: ${selectedMentor.name}`)
            .setDescription(selectedMentor.description || 'Your journey begins now!')
            .addFields(
                { name: 'Specialty', value: selectedMentor.specialty || 'General training', inline: true },
                { name: 'Teaching Style', value: selectedMentor.style || 'Balanced', inline: true }
            )
            .setThumbnail(selectedMentor.image || '')
            .setColor('#4BB543');

        await selection.update({
            embeds: [successEmbed],
            components: []
        });
    } catch (error) {
        // Selection timed out
        await interaction.editReply({
            content: "Mentor selection timed out. Please try again.",
            components: []
        });
    }
}

function getAvailableMentors(player, mentorsData) {
    const playerRank = player.rank || 'Genin';
    const playerClan = player.clan || null;
    
    // Get all mentors for the player's rank
    const rankMentors = mentorsData[playerRank] || {};
    
    // Convert to array and filter by clan requirements
    return Object.entries(rankMentors)
        .map(([id, mentor]) => ({ id, ...mentor }))
        .filter(mentor => {
            // If mentor has no clan requirement OR player's clan matches
            return !mentor.clan || mentor.clan === playerClan;
        });
}

async function handleMentorInfo(interaction, player) {
    if (!player.mentor) {
        return interaction.reply({
            content: "You don't currently have a mentor. Use `/mentor select` to choose one.",
            ephemeral: true
        });
    }

    // In a real implementation, you would fetch mentor details from your data
    const mentorInfoEmbed = new EmbedBuilder()
        .setTitle(`Your Mentor: ${player.mentor}`)
        .setDescription(`Mentor since: ${new Date(player.mentorSince).toLocaleDateString()}`)
        .addFields(
            { name: 'Mentor EXP', value: player.mentorExp.toString(), inline: true },
            { name: 'Lessons Completed', value: (player.mentorLessons || 0).toString(), inline: true }
        )
        .setColor('#FFA500');

    interaction.reply({
        embeds: [mentorInfoEmbed],
        ephemeral: true
    });
}

async function handleChangeMentor(interaction, player, userId, mentors, users) {
    if (!player.mentor) {
        return interaction.reply({
            content: "You don't have a mentor to change. Use `/mentor select` instead.",
            ephemeral: true
        });
    }

    // Check cooldown
    if (player.mentorCooldown && new Date(player.mentorCooldown) > new Date()) {
        const cooldownEnd = new Date(player.mentorCooldown);
        return interaction.reply({
            content: `You can change mentors again on ${cooldownEnd.toLocaleString()}.`,
            ephemeral: true
        });
    }

    // Proceed with mentor change
    const availableMentors = getAvailableMentors(player, mentors);
    
    // Filter out current mentor
    const otherMentors = availableMentors.filter(m => m.id !== player.mentorId);
    
    if (otherMentors.length === 0) {
        return interaction.reply({
            content: "No other mentors are currently available for your rank and clan.",
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('Change Your Mentor')
        .setDescription(`You are about to change from ${player.mentor}. This will reset your mentor progress.`)
        .setColor('#FFA500');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mentor_change')
        .setPlaceholder('Select a new mentor')
        .addOptions(otherMentors.map(mentor => ({
            label: mentor.name,
            value: mentor.id,
            description: mentor.specialty || 'General training'
        })));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });

    try {
        const selection = await response.awaitMessageComponent({
            filter: i => i.user.id === userId && i.customId === 'mentor_change',
            time: SELECTION_TIMEOUT
        });

        const selectedMentorId = selection.values[0];
        const selectedMentor = otherMentors.find(m => m.id === selectedMentorId);

        // Update player data with cooldown
        player.mentor = selectedMentor.name;
        player.mentorId = selectedMentor.id;
        player.mentorSince = new Date().toISOString();
        player.mentorExp = 0;
        player.mentorCooldown = new Date(Date.now() + MENTOR_COOLDOWN).toISOString();
        
        users[userId] = player;
        await saveJsonFile(DATA_PATH, users);

        const successEmbed = new EmbedBuilder()
            .setTitle(`Mentor Changed to ${selectedMentor.name}`)
            .setDescription(`Your training progress has been reset. You cannot change mentors again for 24 hours.`)
            .setColor('#4BB543');

        await selection.update({
            embeds: [successEmbed],
            components: []
        });
    } catch (error) {
        await interaction.editReply({
            content: "Mentor change timed out. Please try again.",
            components: []
        });
    }
}