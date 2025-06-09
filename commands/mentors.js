const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, AttachmentBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Constants
const DATA_PATH = path.join(__dirname, '../../menma/data/users.json');
const MENTORS_PATH = path.join(__dirname, '../../menma/data/mentors.json');
const MENTOR_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in ms
const SELECTION_TIMEOUT = 60_000; // 60 seconds

// Mentor storylines
const MENTOR_STORYLINES = {
    "Kakashi": {
        title: "The Missing Icha Icha Paradise",
        pages: [
            "Kakashi sighs deeply as you approach. 'Ah, young shinobi... I seem to have misplaced something very important.'",
            "'You see, I was just reading my latest novel - Icha Icha Paradise: Tactics - when suddenly it was gone!'",
            "'I had it with me at the training grounds, then went to get some dango... When I returned, it was missing.'",
            "'This is most troubling. That book contains... valuable tactical information. Yes, tactical information.'",
            "'Would you help me find it? I suspect someone at the training grounds might have taken it.'"
        ],
        minigame: {
            description: "Three suspicious individuals were at the training grounds:",
            suspects: [
                {
                    name: "Ebisu",
                    description: "The elite instructor was seen lecturing students nearby",
                    hint: "Known to disapprove of Kakashi's reading habits"
                },
                {
                    name: "Naruto",
                    description: "The hyperactive ninja was practicing shadow clones",
                    hint: "Has a history of pranks and mischief"
                },
                {
                    name: "Guy",
                    description: "Kakashi's rival was doing push-ups with weights",
                    hint: "Would never take something from his 'eternal rival'"
                }
            ],
            correctAnswer: 1, // Naruto
            success: "You found Naruto hiding behind a tree, flipping through the book! 'Hehe, I just wanted to see what Kakashi-sensei was always reading!'",
            failure: "Unfortunately, your investigation led to a dead end. The real thief got away!"
        },
        rewards: {
            points: 3,
            unlockJutsu: true
        }
    }
    // Can add more mentor storylines here
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Interact with the mentor system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available mentors'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View information about a specific mentor')
                .addStringOption(option =>
                    option.setName('mentor')
                        .setDescription('The mentor to view')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('learn')
                .setDescription('Learn a jutsu from your mentor')
                .addStringOption(option =>
                    option.setName('jutsu')
                        .setDescription('The jutsu to learn')
                        .setRequired(true)
                        .setAutocomplete(true))),

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
                case 'list':
                    await handleListMentors(interaction, player, mentors);
                    break;
                case 'info':
                    await handleMentorInfo(interaction, player, mentors);
                    break;
                case 'learn':
                    await handleLearnJutsu(interaction, player, userId, mentors, users);
                    break;
            }
        } catch (error) {
            console.error('Mentor command error:', error);
            interaction.reply({
                content: "An error occurred while processing your request. Please try again later.",
                ephemeral: true
            });
        }
    },

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const [users, mentors] = await Promise.all([
            loadJsonFile(DATA_PATH),
            loadJsonFile(MENTORS_PATH)
        ]);

        const player = users[interaction.user.id] || {};
        const playerRank = player.rank || 'Genin';

        if (focusedOption.name === 'mentor') {
            // Filter mentors by player's rank
            const rankMentors = mentors[playerRank] || {};
            const mentorChoices = Object.keys(rankMentors)
                .filter(name => name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .map(name => ({ name, value: name }))
                .slice(0, 25);

            await interaction.respond(mentorChoices);
        } else if (focusedOption.name === 'jutsu') {
            // Show jutsu available from player's mentor
            if (player.mentor) {
                const playerRank = player.rank || 'Genin';
                const mentorJutsu = (mentors[playerRank]?.[player.mentor]?.jutsu || [])
                    .filter(jutsu => jutsu.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .map(jutsu => ({ name: jutsu, value: jutsu }))
                    .slice(0, 25);

                await interaction.respond(mentorJutsu);
            } else {
                await interaction.respond([]);
            }
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
            return {};
        }
        throw error;
    }
}

async function saveJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function handleListMentors(interaction, player, mentors) {
    const playerRank = player.rank || 'Genin';
    const rankMentors = mentors[playerRank] || {};

    const embed = new EmbedBuilder()
        .setTitle(`Available ${playerRank} Mentors`)
        .setDescription('Here are the mentors available for your rank:\n\nTo view a mentor\'s jutsus: `/mentor info <mentor>`')
        .setColor('#0099ff');

    for (const [name, data] of Object.entries(rankMentors)) {
        // Show jutsu with required_exp if available
        let jutsuList = "";
        if (Array.isArray(data.jutsu)) {
            jutsuList = data.jutsu.map(jutsu => {
                if (typeof jutsu === "object" && jutsu.name && jutsu.required_exp) {
                    return `**${jutsu.name}** (EXP: ${jutsu.required_exp})`;
                } else if (typeof jutsu === "string") {
                    // fallback for old format
                    return `**${jutsu}**`;
                }
                return "";
            }).join(', ');
        }
        embed.addFields({
            name: name,
            value: `Specialty: ${jutsuList}${data.clan ? `\nClan: ${data.clan}` : ''}`,
            inline: true
        });
    }

    embed.setFooter({ text: `Mentor EXP: ${player.mentorExp || 0}` });

    await interaction.reply({ embeds: [embed] });
}

async function handleMentorInfo(interaction, player, mentors) {
    const mentorName = interaction.options.getString('mentor');
    const playerRank = player.rank || 'Genin';
    const mentorData = mentors[playerRank]?.[mentorName];

    if (!mentorData) {
        return interaction.reply({
            content: "That mentor doesn't exist or isn't available for your rank.",
            ephemeral: true
        });
    }

    // Check if the mentor story is already completed
    if (player.completedMentorStories && player.completedMentorStories[mentorName]) {
        return interaction.reply({
            content: `You finished this mentor's story.`,
            ephemeral: true
        });
    }

    // Show mentor EXP in the embed
    const canvas = await createMentorCanvasImageOnly(mentorName, mentorData);
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'mentor.png' });

    const embed = new EmbedBuilder()
        .setTitle(`Mentor: ${mentorName}`)
        .setDescription(
            `Hello young shinobi. ${interaction.user.username} was it? Nice to meet you.\n` +
            `**Your Mentor EXP:** ${player.mentorExp || 0}`
        )
        .setImage('attachment://mentor.png')
        .setColor('#FFA500');

    // Add jutsu requirements
    const jutsuList = mentorData.jutsu.map(jutsu => {
        const reqs = [];
        if (mentorData.clan) reqs.push(`Clan: ${mentorData.clan}`);
        reqs.push(`Mentor EXP Required: ${jutsu.length * 2}`); // Example requirement
        return `• **${jutsu}**\n${reqs.join(', ')}`;
    }).join('\n\n');

    embed.addFields({
        name: 'Available Jutsus',
        value: jutsuList || 'No special jutsus available'
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`start_story_${mentorName}`)
            .setLabel('Start Storyline')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ 
        embeds: [embed], 
        files: [attachment],
        components: [row] 
    });

    // Handle button interaction
    const filter = i => i.customId === `start_story_${mentorName}` && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        if (mentorName === 'Kakashi') {
            await handleKakashiStoryline(i, player, interaction.user.id);
        }
        // Add other mentors here
    });
}

async function createMentorCanvas(mentorName, mentorData) {
    // Create canvas
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Load background image (placeholder - replace with actual image)
    try {
        const bg = await loadImage('https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png/revision/latest/scale-to-width-down/300?cb=20230803224121'); // Example image
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch (e) {
        // Fallback if image fails to load
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Add mentor name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mentorName, canvas.width - 50, 80);

    // Add jutsu list
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    let yPos = 120;
    mentorData.jutsu.forEach(jutsu => {
        ctx.fillText(`• ${jutsu}`, canvas.width / 2 + 50, yPos);
        yPos += 30;
    });

    return canvas;
}

// Helper: Create mentor canvas image only (no text)
async function createMentorCanvasImageOnly(mentorName, mentorData) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    try {
        const bg = await loadImage('https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png/revision/latest/scale-to-width-down/300?cb=20230803224121');
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch (e) {
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // No text drawn
    return canvas;
}

async function handleKakashiStoryline(interaction, player, userId) {
    const storyline = MENTOR_STORYLINES.Kakashi;
    let currentPage = 0;

    // Create initial story embed
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

    await interaction.update({ embeds: [embed], components: [row] });

    // Handle pagination
    const filter = i => (i.customId === 'story_prev' || i.customId === 'story_next') && i.user.id === userId;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        if (i.customId === 'story_next') {
            currentPage++;
            if (currentPage >= storyline.pages.length - 1) {
                // Last page - change button to minigame
                const minigameRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_minigame')
                        .setLabel('Find the Thief')
                        .setStyle(ButtonStyle.Success)
                );
                embed.setDescription(storyline.pages[currentPage]);
                embed.setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });
                await i.update({ embeds: [embed], components: [minigameRow] });
                collector.stop();
                await handleKakashiMinigame(i, player, userId);
                return;
            }
        } else {
            currentPage--;
        }

        // Update buttons
        row.components[0].setDisabled(currentPage <= 0);
        row.components[1].setLabel(currentPage >= storyline.pages.length - 1 ? 'Find the Thief' : 'Next');

        embed.setDescription(storyline.pages[currentPage]);
        embed.setFooter({ text: `Page ${currentPage + 1}/${storyline.pages.length}` });
        await i.update({ embeds: [embed], components: [row] });
    });
}

async function handleKakashiMinigame(interaction, player, userId) {
    const storyline = MENTOR_STORYLINES.Kakashi;
    const suspects = storyline.minigame.suspects;

    const embed = new EmbedBuilder()
        .setTitle("Who Stole Kakashi's Book?")
        .setDescription(storyline.minigame.description)
        .setColor('#e67e22');

    suspects.forEach((suspect, index) => {
        embed.addFields({
            name: `${index + 1}. ${suspect.name}`,
            value: `${suspect.description}\n*${suspect.hint}*`,
            inline: false
        });
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('suspect_0')
            .setLabel('Ebisu')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('suspect_1')
            .setLabel('Naruto')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('suspect_2')
            .setLabel('Guy')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.followUp({ embeds: [embed], components: [row] });

    // Handle suspect selection
    const filter = i => i.customId.startsWith('suspect_') && i.user.id === userId;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        const selected = parseInt(i.customId.split('_')[1]);
        const isCorrect = selected === storyline.minigame.correctAnswer;

        // Update user data
        const users = await loadJsonFile(DATA_PATH);
        const user = users[userId];
        
        if (isCorrect) {
            user.mentorPoints = (user.mentorPoints || 0) + storyline.rewards.points;
            user.completedMentorStories = user.completedMentorStories || {};
            user.completedMentorStories.Kakashi = true;
            
            await saveJsonFile(DATA_PATH, users);

            const successEmbed = new EmbedBuilder()
                .setTitle("Case Solved!")
                .setDescription(storyline.minigame.success)
                .addFields({
                    name: 'Rewards',
                    value: `+${storyline.rewards.points} Mentor Points\nKakashi's jutsus are now available to learn!`
                })
                .setColor('#2ecc71');

            await i.update({ embeds: [successEmbed], components: [] });
        } else {
            const failEmbed = new EmbedBuilder()
                .setTitle("Wrong Suspect")
                .setDescription(storyline.minigame.failure)
                .setColor('#e74c3c');

            await i.update({ embeds: [failEmbed], components: [] });
        }
    });
}

async function handleLearnJutsu(interaction, player, userId, mentors, users) {
    const jutsuName = interaction.options.getString('jutsu');
    const mentorName = player.mentor;
    const playerRank = player.rank || 'Genin';

    if (!mentorName) {
        return interaction.reply({
            content: "You don't have a mentor. Use `/mentor list` to choose one.",
            ephemeral: true
        });
    }

    // Check if player has completed the mentor's storyline
    if (!player.completedMentorStories?.[mentorName]) {
        return interaction.reply({
            content: `You need to complete ${mentorName}'s storyline first! Use \`/mentor info ${mentorName}\` to start it.`,
            ephemeral: true
        });
    }

    // Check if jutsu is available from mentor
    const mentorJutsu = mentors[playerRank]?.[mentorName]?.jutsu || [];
    if (!mentorJutsu.includes(jutsuName)) {
        return interaction.reply({
            content: `That jutsu isn't available from ${mentorName}.`,
            ephemeral: true
        });
    }

    // Check mentor EXP (example: 2 exp per jutsu character)
    const expRequired = jutsuName.length * 2; // Simple formula
    if ((player.mentorExp || 0) < expRequired) {
        return interaction.reply({
            content: `You need ${expRequired} mentor EXP to learn this jutsu (you have ${player.mentorExp || 0}).`,
            ephemeral: true
        });
    }

    // Learn the jutsu
    player.mentorExp -= expRequired;
    player.jutsu = player.jutsu || {};
    
    // Find an empty jutsu slot
    let slotFound = false;
    for (let i = 1; i <= 6; i++) {
        if (!player.jutsu[i] || player.jutsu[i] === 'None') {
            player.jutsu[i] = jutsuName;
            slotFound = true;
            break;
        }
    }

    if (!slotFound) {
        return interaction.reply({
            content: "You don't have any empty jutsu slots! Remove a jutsu first.",
            ephemeral: true
        });
    }

    // Save changes
    users[userId] = player;
    await saveJsonFile(DATA_PATH, users);

    await interaction.reply({
        content: `Congratulations! You've learned **${jutsuName}** from ${mentorName}!`,
        ephemeral: true
    });
}

// Add this function to increment mentorExp for a user
async function addMentorExp(userId, amount = 1) {
    const users = await loadJsonFile(DATA_PATH);
    if (!users[userId]) return;
    users[userId].mentorExp = (users[userId].mentorExp || 0) + amount;
    await saveJsonFile(DATA_PATH, users);
}

// Export the function for use in other modules (like scroll.js or mission handlers)
module.exports.addMentorExp = addMentorExp;