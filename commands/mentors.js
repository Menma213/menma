const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, AttachmentBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Paths
const DATA_PATH = path.join(__dirname, '../../menma/data/users.json');
const MENTORS_PATH = path.join(__dirname, '../../menma/data/mentors.json');
const STORYLINES_PATH = path.join(__dirname, '../../menma/data/storylines.json');

// Load data files
async function loadData() {
    const [users, mentors, storylines] = await Promise.all([
        loadJsonFile(DATA_PATH),
        loadJsonFile(MENTORS_PATH),
        loadJsonFile(STORYLINES_PATH)
    ]);
    return { users, mentors, storylines };
}

async function loadJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

async function saveJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Mentor system')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What do you want to do?')
                .setRequired(true)
                .addChoices(
                    { name: 'list', value: 'list' },
                    { name: 'select', value: 'select' },
                    { name: 'learn', value: 'learn' }
                )
        )
        .addStringOption(option =>
            option.setName('mentor')
                .setDescription('Mentor name (required for select)')
                .setRequired(false)
                .setAutocomplete(true)
        ),
    async execute(interaction) {
        const { users, mentors, storylines } = await loadData();
        const userId = interaction.user.id;
        const player = users[userId] || {};

        if (!player.rank) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const mentorName = interaction.options.getString('mentor');
        const playerRank = player.rank || 'Genin';
        const rankMentors = mentors[playerRank] || {};

        // Action: list
        if (action === 'list') {
            const embed = new EmbedBuilder()
                .setTitle(`Available ${playerRank} Mentors`)
                .setDescription(
                    `Use \`/mentor action:select mentor:<mentor>\` to select a mentor.\n\n` +
                    `**Your Mentor EXP:** ${player.mentorExp || 0}\n\n` +
                    `Here are the mentors available for your rank:`
                )
                .setColor('#0099ff');
            for (const [name, data] of Object.entries(rankMentors)) {
                const jutsuList = data.jutsu.map(j => `• ${j.name} (${j.required_exp} EXP)`).join('\n');
                embed.addFields({
                    name: name,
                    value: `${data.clan ? `Clan: ${data.clan}\n` : ''}${jutsuList}`,
                    inline: true
                });
            }
            embed.setFooter({
                text: "You cannot learn the previous ranks' jutsu once you rank up!"
            });
            return interaction.reply({ embeds: [embed] });
        }

        // Action: select
        if (action === 'select') {
            if (!mentorName) {
                return interaction.reply({ content: "Please specify a mentor name.", ephemeral: true });
            }
            const mentorData = rankMentors[mentorName];
            if (!mentorData) {
                return interaction.reply({ content: "That mentor doesn't exist for your rank.", ephemeral: true });
            }
            // If story completed, directly select mentor
            if (player.completedMentorStories?.[mentorName]) {
                player.mentor = mentorName;
                users[userId] = player;
                await saveJsonFile(DATA_PATH, users);
                return interaction.reply({ content: `You have selected **${mentorName}** as your mentor!`, ephemeral: true });
            }
            // Otherwise, start storyline/minigame
            const storyline = storylines[mentorName];
            if (!storyline) {
                return interaction.reply({ content: "This mentor doesn't have a storyline yet.", ephemeral: true });
            }
            // Show only storyline, not jutsus
            let currentPage = 0;
            const embed = new EmbedBuilder()
                .setTitle(storyline.title)
                .setDescription(storyline.pages[currentPage])
                .setColor('#3498db')
                .setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('story_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('story_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
            );

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'story_next') {
                    currentPage++;
                    if (currentPage >= storyline.pages.length - 1) {
                        collector.stop();
                        await showMinigame(i, player, userId, users, mentorName, storyline);
                        return;
                    }
                } else {
                    currentPage--;
                }
                row.components[0].setDisabled(currentPage <= 0);
                row.components[1].setLabel(currentPage >= storyline.pages.length - 1 ? 'Start Minigame' : 'Next');
                embed.setDescription(storyline.pages[currentPage]);
                embed.setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });
                await i.update({ embeds: [embed], components: [row] });
            });
            return;
        }

        // Action: learn
        if (action === 'learn') {
            await handleLearnJutsu(interaction, player, userId, users, mentors);
            return;
        }
    },
    async autocomplete(interaction) {
        const { mentors } = await loadData();
        const focusedOption = interaction.options.getFocused(true);
        const { users } = await loadData();
        const player = users[interaction.user.id] || {};
        const playerRank = player.rank || 'Genin';

        if (focusedOption.name === 'mentor') {
            const rankMentors = mentors[playerRank] || {};
            const mentorChoices = Object.keys(rankMentors)
                .filter(name => name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .map(name => ({ name, value: name }))
                .slice(0, 25);

            await interaction.respond(mentorChoices);
        }
    }
};

// Main mentor command handler
async function handleSelectMentor(interaction, player, userId, users, mentors, storylines) {
    const playerRank = player.rank || 'Genin';
    const rankMentors = mentors[playerRank] || {};

    // If no specific mentor mentioned, show list
    if (!interaction.options.getString('mentor')) {
        const embed = new EmbedBuilder()
            .setTitle(`Available ${playerRank} Mentors`)
            .setDescription('Here are the mentors available for your rank:')
            .setColor('#0099ff');

        for (const [name, data] of Object.entries(rankMentors)) {
            const jutsuList = data.jutsu.map(j => `• ${j.name} (${j.required_exp} EXP)`).join('\n');
            embed.addFields({
                name: name,
                value: `${data.clan ? `Clan: ${data.clan}\n` : ''}${jutsuList}`,
                inline: true
            });
        }

        embed.setFooter({ 
            text: "Use /mentor select <mentor> to choose one\nYou cannot learn previous ranks' jutsu once you rank up!" 
        });

        return interaction.reply({ embeds: [embed] });
    }

    // Handle specific mentor selection
    const mentorName = interaction.options.getString('mentor');
    const mentorData = rankMentors[mentorName];

    if (!mentorData) {
        return interaction.reply({ 
            content: "That mentor doesn't exist for your rank.", 
            ephemeral: true 
        });
    }

    // Check if story already completed
    if (player.completedMentorStories?.[mentorName]) {
        return interaction.reply({ 
            content: `You've already completed ${mentorName}'s storyline.`, 
            ephemeral: true 
        });
    }

    // Start the storyline
    const storyline = storylines[mentorName];
    if (!storyline) {
        return interaction.reply({ 
            content: "This mentor doesn't have a storyline yet.", 
            ephemeral: true 
        });
    }

    await startStoryline(interaction, player, userId, users, mentorName, storyline);
}

// Storyline handler
async function startStoryline(interaction, player, userId, users, mentorName, storyline) {
    let currentPage = 0;

    const embed = new EmbedBuilder()
        .setTitle(storyline.title)
        .setDescription(storyline.pages[currentPage])
        .setColor('#3498db')
        .setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('story_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('story_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.reply({ 
        embeds: [embed], 
        components: [row],
        fetchReply: true
    });

    // Pagination
    const collector = response.createMessageComponentCollector({ 
        filter: i => i.user.id === userId, 
        time: 60000 
    });

    collector.on('collect', async i => {
        if (i.customId === 'story_next') {
            currentPage++;
            if (currentPage >= storyline.pages.length - 1) {
                // Last page - show minigame
                collector.stop();
                await showMinigame(i, player, userId, users, mentorName, storyline);
                return;
            }
        } else {
            currentPage--;
        }

        // Update buttons
        row.components[0].setDisabled(currentPage <= 0);
        row.components[1].setLabel(currentPage >= storyline.pages.length - 1 ? 'Start Minigame' : 'Next');

        embed.setDescription(storyline.pages[currentPage]);
        embed.setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });
        await i.update({ embeds: [embed], components: [row] });
    });
}

// Minigame handler
async function showMinigame(interaction, player, userId, users, mentorName, storyline) {
    const minigame = storyline.minigame;
    const embed = new EmbedBuilder()
        .setTitle(minigame.title || "Solve the Challenge")
        .setDescription(minigame.description)
        .setColor('#e67e22');

    minigame.options.forEach((option, index) => {
        embed.addFields({
            name: `${index + 1}. ${option.text}`,
            value: option.hint || '',
            inline: false
        });
    });

    const row = new ActionRowBuilder();
    minigame.options.forEach((_, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`mg_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    // Use reply if not yet replied, otherwise followUp, always with fetchReply: true
    let response;
    if (!interaction.replied && !interaction.deferred) {
        response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });
    } else {
        response = await interaction.followUp({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });
    }

    const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: 60000
    });

    collector.on('collect', async i => {
        const selected = parseInt(i.customId.split('_')[1]);
        const isCorrect = selected === minigame.correct;

        // Update user data
        const { users } = await loadData();
        const user = users[userId] || {};

        if (isCorrect) {
            user.completedMentorStories = user.completedMentorStories || {};
            user.completedMentorStories[mentorName] = true;
            user.mentorExp = (user.mentorExp || 0) + (minigame.rewardExp || 10);
            user.mentor = mentorName; // Directly select mentor after success

            users[userId] = user;
            await saveJsonFile(DATA_PATH, users);

            const successEmbed = new EmbedBuilder()
                .setTitle("Success!")
                .setDescription(minigame.successText)
                .addFields({
                    name: 'Rewards',
                    value: `+${minigame.rewardExp || 10} Mentor EXP\nYou have selected **${mentorName}** as your mentor!`
                })
                .setColor('#2ecc71');

            await i.update({ embeds: [successEmbed], components: [] });
        } else {
            const failEmbed = new EmbedBuilder()
                .setTitle("Try Again")
                .setDescription(minigame.failText || "That wasn't the correct choice.")
                .setColor('#e74c3c');

            await i.update({ embeds: [failEmbed], components: [] });
        }
    });
}

// Learn jutsu handler
async function handleLearnJutsu(interaction, player, userId, users, mentors) {
    if (!player.mentor) {
        return interaction.reply({
            content: "You don't have a mentor selected. Use /mentor select first.",
            ephemeral: true
        });
    }

    const mentorName = player.mentor;
    const playerRank = player.rank || 'Genin';
    const mentorData = mentors[playerRank]?.[mentorName];

    if (!mentorData) {
        return interaction.reply({
            content: "Your current mentor isn't available for your rank anymore.",
            ephemeral: true
        });
    }

    // Check if story completed
    if (!player.completedMentorStories?.[mentorName]) {
        return interaction.reply({
            content: `Complete ${mentorName}'s storyline first with /mentor select ${mentorName}`,
            ephemeral: true
        });
    }

    // Find available jutsu the player can learn
    const availableJutsu = mentorData.jutsu.filter(j =>
        (player.mentorExp || 0) >= j.required_exp &&
        !Object.values(player.jutsu || {}).includes(j.name)
    );

    if (availableJutsu.length === 0) {
        return interaction.reply({
            content: "No jutsus available to learn right now (either not enough EXP or already learned).",
            ephemeral: true
        });
    }

    // Auto-learn the first available jutsu (or could make a select menu)
    const jutsuToLearn = availableJutsu[0];

    // Save to jutsu.json instead of user slots
    const jutsusPath = path.join(__dirname, '../../menma/data/jutsu.json');
    let jutsuData = {};
    try {
        jutsuData = JSON.parse(await fs.readFile(jutsusPath, 'utf8'));
    } catch (e) {
        jutsuData = {};
    }
    // Use usersjutsu array for saving learned jutsu
    if (!jutsuData[userId]) jutsuData[userId] = { usersjutsu: [], scrolls: [] };
    if (!Array.isArray(jutsuData[userId].usersjutsu)) jutsuData[userId].usersjutsu = [];
    if (!jutsuData[userId].usersjutsu.includes(jutsuToLearn.name)) {
        jutsuData[userId].usersjutsu.push(jutsuToLearn.name);
    }
    await fs.writeFile(jutsusPath, JSON.stringify(jutsuData, null, 2));

    // Deduct EXP
    player.mentorExp -= jutsuToLearn.required_exp;
    users[userId] = player;
    await saveJsonFile(DATA_PATH, users);

    interaction.reply({
        content: `You've learned **${jutsuToLearn.name}** from ${mentorName}!`,
        ephemeral: true
    });
}