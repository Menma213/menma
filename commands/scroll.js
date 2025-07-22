const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Constants
const ADMIN_ID = "961918563382362122";

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const jutsusPath = path.join(dataPath, 'jutsu.json');  // Fixed path
const requirementsPath = path.join(dataPath, 'requirements.json');

// Helper functions
const loadData = (path) => {
    try {
        return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
    } catch (err) {
        console.error(`Error loading ${path}:`, err);
        return {};
    }
};

const saveData = (path, data) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${path}:`, err);
    }
};

// Constants for requirements
const REQUIREMENT_TYPES = [
    { type: 'd_mission', desc: "Complete D-rank mission {value} times", min: 2, max: 6 },
    { type: 'b_mission', desc: "Complete B-rank mission {value} times", min: 2, max: 4 },
    { type: 's_mission', desc: "Complete S-rank mission {value} times", min: 2, max: 3 },
    { type: 'pvp', desc: "Fight another ninja {value} times", min: 1, max: 3 },
    { type: 'profile_check', desc: "Check profile {value} times", min: 3, max: 7 },
    { type: 's_mission_with_friends', desc: "Complete an S-rank with friends {value} time", min: 1, max: 2 },
    { type: 'train', desc: "Train {value} times", min: 2, max: 2},
    { type: 'equip_jutsu', desc: "Equip a jutsu {value} time", min: 1, max: 1 }
];

// Complete tutorial pages
const TUTORIAL_PAGES = [
    {
        title: "Welcome to the Sacred Temple",
        content: "Young one. Welcome to the sacred temple of Konoha. I am Asukky, the well-known Asukky The Sage.",
        image: "https://i.pinimg.com/736x/ae/ae/80/aeae806eee029af71359a7.jpg8bb38ea7e4"
    },
    {
        title: "The History of Scrolls",
        content: "I shall tell you everything about The Ninja scrolls. Ninja scrolls are like a personal diary of ninjas, passed down the generations. Hagoromo Otsutsuki, The first Ninja was the first person ever to create a Ninja scroll.",
        image: "https://i.imgur.com/sage_avatar.png"
    },
    {
        title: "Finding Scrolls",
        content: "Ninja scrolls have been scattered across the globe in various locations, some have been sealed away while some are very easy to obtain. Bring them to me and I shall guide you.",
        image: "https://i.imgur.com/sage_avatar.png"
    },
    {
        title: "Learning from Scrolls",
        content: "Obtaining a ninja scroll does not mean you have learnt the Jutsu! I am going to be teaching you on how to Master Jutsus. To learn a jutsu from its scroll you must complete the requirements from the specified jutsu scroll.",
        image: "https://i.imgur.com/sage_avatar.png"
    },
    {
        title: "Requirements System",
        content: "There will be 5 requirements. If you complete one you get a 20% chance of learning the jutsu. Remember though! Number of attempts at learning the jutsu might be infinite, but only the first attempt is going to be free, so make sure you've stacked up those chances of learning!",
        image: "https://i.imgur.com/sage_avatar.png"
    }
];



async function generateTutorialImage(pageIdx, interaction) {
    const page = TUTORIAL_PAGES[pageIdx];
    const width = 600, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#0f0c29");
    grad.addColorStop(0.5, "#302b63");
    grad.addColorStop(1, "#24243e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Card border
    ctx.save();
    ctx.strokeStyle = "#6e1515";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, width, height);
    ctx.restore();

    // Avatar
    let avatarImg;
    try {
        avatarImg = await loadImage(page.image);
    } catch {
        avatarImg = null;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 35, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    if (avatarImg) ctx.drawImage(avatarImg, 25, 25, 70, 70);
    else {
        ctx.fillStyle = "#333";
        ctx.fillRect(25, 25, 70, 70);
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 35, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#6e1515";
    ctx.stroke();
    ctx.restore();

    // Sage name
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#f8d56b";
    ctx.textAlign = "left";
    ctx.fillText("Asukky The Sage", 110, 60);

    // Title
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#f8d56b";
    ctx.textAlign = "center";
    ctx.fillText(page.title, width / 2, 120);

    // Content box
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(40, 140, 520, 220, 18);
    ctx.fill();
    ctx.restore();

    // Content text
    ctx.font = "16px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    // Wrap text
    const content = page.content;
    let y = 170;
    const lineHeight = 26;
    const maxWidth = 500;
    function wrapText(text) {
        const words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, 60, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 60, y);
    }
    wrapText(content);

    return canvas.toBuffer('image/png');
}

// --- Canvas-based info image generation ---
async function generateInfoImage(title, content, commands = false) {
    const width = 600, height = commands ? 600 : 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#0f0c29");
    grad.addColorStop(0.5, "#302b63");
    grad.addColorStop(1, "#24243e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Card border
    ctx.save();
    ctx.strokeStyle = "#6e1515";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, width, height);
    ctx.restore();

    // Avatar
    let avatarImg;
    try {
        avatarImg = await loadImage("https://i.imgur.com/sage_avatar.png");
    } catch {
        avatarImg = null;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 35, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    if (avatarImg) ctx.drawImage(avatarImg, 25, 25, 70, 70);
    else {
        ctx.fillStyle = "#333";
        ctx.fillRect(25, 25, 70, 70);
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 35, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#6e1515";
    ctx.stroke();
    ctx.restore();

    // Sage name
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#f8d56b";
    ctx.textAlign = "left";
    ctx.fillText("Asukky The Sage", 110, 60);

    // Title
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#f8d56b";
    ctx.textAlign = "center";
    ctx.fillText(title, width / 2, 120);

    // Content box
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(40, 140, 520, commands ? 320 : 220, 18);
    ctx.fill();
    ctx.restore();

    // Content text
    ctx.font = "16px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    // Wrap text
    let y = 170;
    const lineHeight = 26;
    const maxWidth = 500;
    function wrapText(text) {
        const words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, 60, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 60, y);
        return y;
    }
    y = wrapText(content);

    // Commands section
    if (commands) {
        ctx.font = "bold 18px Arial";
        ctx.fillStyle = "#f8d56b";
        ctx.fillText("Available Commands", 60, y + 40);

        ctx.font = "16px Arial";
        ctx.fillStyle = "#fff";
        const cmds = [
            "/scroll info - View your current scroll progress",
            "/scroll set <scrollname> - Set a scroll to work on",
            "/learnjutsu - Attempt to learn from your current scroll"
        ];
        let cy = y + 70;
        for (const cmd of cmds) {
            ctx.save();
            ctx.fillStyle = "rgba(110,21,21,0.3)";
            ctx.beginPath();
            ctx.roundRect(60, cy - 18, 480, 32, 8);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#fff";
            ctx.fillText(cmd, 75, cy);
            cy += 40;
        }
    }

    return canvas.toBuffer('image/png');
}

// Add scroll-jutsu mapping
const SCROLL_JUTSU = {
    "Needle Assault Scroll": "Needle Assault",
    "Silent Assassination Scroll": "Silent Assassination",
    "Serpents Wrath Scroll": "Serpents Wrath",
    "Infused Chakra Blade Scroll": "Infused Chakra Blade",
};

// Add new method to track requirements
async function updateRequirements(userId, type, value = 1) {
    const requirements = loadData(requirementsPath);
    const userReqs = requirements[userId];
    
    if (!userReqs) return;

    const requirementToUpdate = userReqs.requirements.find(r => r.type === type);
    if (requirementToUpdate && requirementToUpdate.completed < requirementToUpdate.needed) {
        requirementToUpdate.completed += value;
        saveData(requirementsPath, requirements);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scroll')
        .setDescription('Manage your ninja scrolls')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View your scroll information'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set active scroll')
                .addStringOption(option =>
                    option.setName('scrollname')
                        .setDescription('Name of the scroll')
                        .setRequired(true))),

    async execute(interaction) {
        const users = loadData(usersPath);
        const jutsuData = loadData(jutsusPath);
        const requirements = loadData(requirementsPath);

        const userId = interaction.user.id;
        if (!users[userId]) {
            return interaction.reply({ content: "You need to be a ninja first!", ephemeral: true });
        }

        // Check for first time tutorial
        if (!users[userId].firstusescroll) {
            await this.showTutorial(interaction, users, userId);
            return;
        }

        // Handle regular command
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'info') {
            await this.handleInfo(interaction, users, jutsuData, requirements, userId);
        } else if (subcommand === 'set') {
            await this.handleSet(interaction, users, jutsuData, requirements, userId);
        }
    },

    async showTutorial(interaction, users, userId) {
        let currentPage = 0;

        // Defer reply to keep the interaction alive
        await interaction.deferReply();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('finish_tutorial')
                    .setLabel('Finish')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );

        const tutorialImage = new AttachmentBuilder(
            await generateTutorialImage(currentPage, interaction),
            { name: 'tutorial.png' }
        );

        // Use editReply since we deferred above
        const message = await interaction.editReply({
            files: [tutorialImage],
            components: [row]
        });

        const collector = message.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This tutorial is not for you!', ephemeral: true });
            }

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            } else if (i.customId === 'finish_tutorial') {
                users[userId].firstusescroll = true;
                saveData(usersPath, users);

                const finalEmbed = new EmbedBuilder()
                    .setColor('#4BB543')
                    .setTitle('Tutorial Completed!')
                    .setDescription('You can now use `/scroll info` to check your scrolls and requirements!')
                    .setThumbnail(TUTORIAL_PAGES[0].image);

                // Use editReply instead of update to avoid "Unknown interaction" error
                await interaction.editReply({
                    embeds: [finalEmbed],
                    components: [],
                    files: []
                });
                return;
            }

            const buttons = row.components;
            buttons[0].setDisabled(currentPage === 0);
            buttons[1].setDisabled(currentPage === TUTORIAL_PAGES.length - 1);
            buttons[2].setDisabled(currentPage !== TUTORIAL_PAGES.length - 1);

            const newTutorialImage = new AttachmentBuilder(
                await generateTutorialImage(currentPage, interaction),
                { name: 'tutorial.png' }
            );

            // Use editReply instead of update to avoid "Unknown interaction" error
            await interaction.editReply({
                files: [newTutorialImage],
                components: [row],
                embeds: []
            });
        });
    },

    async handleInfo(interaction, users, jutsuData, requirements, userId) {
        await interaction.deferReply();
        
        const userScrolls = jutsuData[userId]?.scrolls || [];
        const currentScroll = users[userId]?.current_scroll;
        const userReqs = requirements[userId];

        // Create main embed
        const embed = new EmbedBuilder()
            .setColor('#302b63')
            .setAuthor({ 
                name: 'Asukky The Sage', 
                iconURL: 'https://i.pinimg.com/736x/ae/ae/80/aeae806eee029af71359a78bb38ea7e4.jpg' 
            })
            .setTitle('📜 The Sacred Scrolls')
            .setThumbnail(interaction.user.displayAvatarURL());

        if (currentScroll) {
            const progress = userReqs ? (userReqs.requirements.filter(r => r.completed >= r.needed).length * 20) : 0;
            embed.setDescription(
                "Welcome back to the Temple of Scrolls. Complete requirements to master new jutsu.\n\n" +
                `**Current Scroll:** ${currentScroll}\n` +
                `**Progress:** ${progress}%`
            );
            
            if (userReqs) {
                userReqs.requirements.forEach((req, i) => {
                    const status = req.completed >= req.needed ? '✅' : `[${req.completed}/${req.needed}]`;
                    embed.addFields({ 
                        name: `Requirement ${i + 1}`, 
                        value: `${req.description} ${status}`, 
                        inline: true 
                    });
                });
            }

            // Add command help as footer
            embed.setFooter({ 
                text: 'Use /learnjutsu to attempt learning when requirements are met' 
            });
        } else {
            embed.setDescription(
                "Welcome back to the Temple of Scrolls. Complete requirements to master new jutsu.\n\n" +
                `You have ${userScrolls.length} scroll(s)\nUse \`/scroll set\` to start working on one!`
            );
            if (userScrolls.length > 0) {
                embed.addFields({ 
                    name: 'Your Scrolls', 
                    value: userScrolls.join('\n').substring(0, 1024) 
                });
            }
            // Add available commands
            embed.addFields({
                name: 'Available Commands',
                value: [
                    '`/scroll info` - View your current scroll progress',
                    '`/scroll set <scrollname>` - Set a scroll to work on',
                    '`/learnjutsu` - Attempt to learn from your current scroll'
                ].join('\n')
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleSet(interaction, users, jutsuData, requirements, userId) {
        const scrollName = interaction.options.getString('scrollname');
        
        // Debug log
        console.log('Setting scroll:', scrollName);
        console.log('User data:', jutsuData[userId]);
        
        // Check if user has scrolls array
        if (!jutsuData[userId] || !jutsuData[userId].scrolls) {
            const availableScrolls = jutsuData[userId]?.scrolls?.join(", ") || "None";
            return interaction.reply({
                content: `You don't have any scrolls yet!\nYour scrolls: ${availableScrolls}`,
                ephemeral: true
            });
        }

        // --- Case-insensitive scroll lookup ---
        const userScrolls = jutsuData[userId].scrolls;
        const matchedScroll = userScrolls.find(s => s.toLowerCase() === scrollName.toLowerCase());
        if (!matchedScroll) {
            return interaction.reply({
                content: `You don't have the "${scrollName}"!\nAvailable scrolls: ${userScrolls.join(", ")}`,
                ephemeral: true
            });
        }

        // Generate random requirements
        const selectedReqs = [];
        const shuffled = [...REQUIREMENT_TYPES].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < 5; i++) {
            const req = shuffled[i];
            const value = Math.floor(Math.random() * (req.max - req.min + 1)) + req.min;
            selectedReqs.push({
                description: req.desc.replace('{value}', value),
                completed: 0,
                needed: value,
                type: req.type
            });
        }

        // Update user data
        users[userId].current_scroll = matchedScroll;
        requirements[userId] = {
            scroll: matchedScroll,
            requirements: selectedReqs
        };

        saveData(usersPath, users);
        saveData(requirementsPath, requirements);

        const embed = new EmbedBuilder()
            .setColor('#4BB543')
            .setTitle('📜 Scroll Selected')
            .setDescription(`You are now working on **${matchedScroll}**\nUse \`/scroll info\` to check requirements!`)
            .setThumbnail(interaction.user.displayAvatarURL());

        await interaction.reply({ embeds: [embed] });
    },

    updateRequirements
};

