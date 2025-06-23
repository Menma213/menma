const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Constants
const ADMIN_ID = "961918563382362122";

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
52
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
    { type: 'd_mission', desc: "Complete D-rank mission {value} times", min: 2, max: 10 },
    { type: 'b_mission', desc: "Complete B-rank mission {value} times", min: 2, max: 6 },
    { type: 's_mission', desc: "Complete S-rank mission {value} times", min: 2, max: 5 },
    { type: 'pvp', desc: "Fight another ninja {value} times", min: 1, max: 3 },
    { type: 'profile_check', desc: "Check profile {value} times", min: 10, max: 10 },
    { type: 's_mission_with_friends', desc: "Complete an S-rank with friends {value} time", min: 1, max: 1 },
    { type: 'train', desc: "Train {value} times", min: 2, max: 5 },
    { type: 'equip_jutsu', desc: "Equip a jutsu {value} time", min: 1, max: 1 }
];

// Complete tutorial pages
const TUTORIAL_PAGES = [
    {
        title: "Welcome to the Sacred Temple",
        content: "Young one. Welcome to the sacred temple of Konoha. I am Asukky, the well-known Asukky The Sage.",
        image: "https://i.pinimg.com/736x/ae/ae/80/aeae806eee029af71359a78bb38ea7e4.jpg"
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

// Generate tutorial page HTML with complete styling
const generateTutorialHtml = (page) => `
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #1a1a1a;
            color: white;
        }
        .tutorial-container {
            width: 600px;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            border-radius: 15px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.5);
            padding: 20px;
            margin: 20px auto;
        }
        .tutorial-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #6e1515;
            padding-bottom: 10px;
        }
        .tutorial-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 3px solid #6e1515;
            margin-right: 15px;
        }
        .tutorial-name {
            font-size: 20px;
            color: #f8d56b;
            font-weight: bold;
        }
        .tutorial-content {
            font-size: 16px;
            line-height: 1.6;
            color: #fff;
            padding: 15px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="tutorial-container">
        <div class="tutorial-header">
            <img src="${page.image}" class="tutorial-avatar">
            <div class="tutorial-name">Asukky The Sage</div>
        </div>
        <div class="tutorial-content">
            <h2>${page.title}</h2>
            ${page.content}
        </div>
    </div>
</body>
</html>
`;

async function generateTutorialImage(page, interaction) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const browserPage = await browser.newPage();
    await browserPage.setViewport({ width: 600, height: 400 });

    const htmlContent = `
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Arial', sans-serif;
                    background-color: #1a1a1a;
                    color: white;
                }
                .card {
                    width: 600px;
                    height: 400px;
                    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                    border-radius: 15px;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }
                .header {
                    background-color: rgba(0,0,0,0.7);
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    border-bottom: 2px solid #6e1515;
                }
                .sage-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    border: 3px solid #6e1515;
                    margin-right: 15px;
                }
                .sage-name {
                    font-size: 20px;
                    color: #f8d56b;
                }
                .content {
                    padding: 20px;
                }
                .title {
                    font-size: 24px;
                    color: #f8d56b;
                    margin-bottom: 15px;
                    text-shadow: 0 0 5px #6e1515;
                }
                .text {
                    font-size: 16px;
                    line-height: 1.6;
                    color: #fff;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <img src="https://i.pinimg.com/736x/ae/ae/80/aeae806eee029af71359a78bb38ea7e4.jpg" class="sage-avatar">
                    <div class="sage-name">Asukky The Sage</div>
                </div>
                <div class="content">
                    <div class="title">${TUTORIAL_PAGES[page].title}</div>
                    <div class="text">${TUTORIAL_PAGES[page].content}</div>
                </div>
            </div>
        </body>
        </html>
    `;

    await browserPage.setContent(htmlContent);
    const screenshot = await browserPage.screenshot();
    await browser.close();
    return screenshot;
}

// Add scroll-jutsu mapping
const SCROLL_JUTSU = {
    "Needle Assault Scroll": "Needle Assault",
    "Silent Assassination Scroll": "Silent Assassination",
    "Serpents Wrath Scroll": "Serpents Wrath"
};

async function generateInfoImage(title, content, commands = false) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: commands ? 600 : 400 });

    const htmlContent = `
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Arial', sans-serif;
                    background-color: #1a1a1a;
                    color: white;
                }
                .card {
                    width: 600px;
                    height: ${commands ? '600px' : '400px'};
                    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                    border-radius: 15px;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }
                .header {
                    background-color: rgba(0,0,0,0.7);
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    border-bottom: 2px solid #6e1515;
                }
                .sage-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    border: 3px solid #6e1515;
                    margin-right: 15px;
                }
                .content {
                    padding: 20px;
                }
                .title {
                    font-size: 24px;
                    color: #f8d56b;
                    margin-bottom: 15px;
                    text-shadow: 0 0 5px #6e1515;
                }
                .text {
                    font-size: 16px;
                    line-height: 1.6;
                    color: #fff;
                }
                .commands {
                    margin-top: 20px;
                    padding: 15px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 10px;
                }
                .command {
                    margin: 10px 0;
                    padding: 8px;
                    background: rgba(110,21,21,0.3);
                    border-left: 3px solid #6e1515;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <img src="https://i.imgur.com/sage_avatar.png" class="sage-avatar">
                    <div class="sage-name">Asukky The Sage</div>
                </div>
                <div class="content">
                    <div class="title">${title}</div>
                    <div class="text">${content}</div>
                    ${commands ? `
                    <div class="commands">
                        <div class="command">/scroll info - View your current scroll progress</div>
                        <div class="command">/scroll set <scrollname> - Set a scroll to work on</div>
                        <div class="command">/learnjutsu - Attempt to learn from your current scroll</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </body>
        </html>
    `;

    await page.setContent(htmlContent);
    const screenshot = await page.screenshot();
    await browser.close();
    return screenshot;
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

                await i.update({
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

            // Use update for button interactions
            await i.update({
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

        // Check if scroll exists in user's collection
        const userScrolls = jutsuData[userId].scrolls;
        if (!userScrolls.includes(scrollName)) {
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
        users[userId].current_scroll = scrollName;
        requirements[userId] = {
            scroll: scrollName,
            requirements: selectedReqs
        };

        saveData(usersPath, users);
        saveData(requirementsPath, requirements);

        const embed = new EmbedBuilder()
            .setColor('#4BB543')
            .setTitle('📜 Scroll Selected')
            .setDescription(`You are now working on **${scrollName}**\nUse \`/scroll info\` to check requirements!`)
            .setThumbnail(interaction.user.displayAvatarURL());

        await interaction.reply({ embeds: [embed] });
    }
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

// Export the update function
module.exports.updateRequirements = updateRequirements;
