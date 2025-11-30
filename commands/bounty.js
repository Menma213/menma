const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { runBattle } = require('./combinedcommands.js');

// Register fonts
try {
    registerFont(path.join(__dirname, '../fonts/ninjafont.ttf'), { family: 'NinjaFont' });
    registerFont(path.join(__dirname, '../fonts/ninjafont-bold.ttf'), { family: 'NinjaFont', weight: 'bold' });
} catch (e) {
    console.warn('Could not register custom fonts. Using system defaults.');
}

async function loadBountyData(client) {
    const bountyPath = path.resolve(__dirname, '../data/bounty.json');
    const usersPath = path.resolve(__dirname, '../data/users.json');
    
    if (!fs.existsSync(bountyPath)) return [];

    try {
        const bountyData = JSON.parse(fs.readFileSync(bountyPath, 'utf8'));
        const usersData = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        
        const allUsers = [];

        for (const id in bountyData) {
            const userBounty = bountyData[id];
            const user = usersData[id] || {};
            
            if (userBounty.bounty > 0) {
                allUsers.push({ 
                    id, 
                    username: user.username || 'Unknown Ninja',
                    value: userBounty.bounty,
                    displayValue: `💰 ${userBounty.bounty.toLocaleString()}`,
                    avatarUrl: user.avatar ? 
                                `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=256` : 
                                `https://cdn.discordapp.com/embed/avatars/${parseInt(id.slice(-1)) % 5}.png`
                });
            }
        }

        allUsers.sort((a, b) => b.value - a.value);
        
        const top7 = allUsers.slice(0, 7);

        const usersWithResolvedAvatars = await Promise.all(
            top7.map(async (user) => {
                try {
                    let finalAvatarUrl = user.avatarUrl; 
                    let resolvedUsername = user.username;
                    
                    const discordUser = await client.users.fetch(user.id).catch(() => null); 

                    if (discordUser) {
                        finalAvatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 256 });
                        resolvedUsername = discordUser.username;
                    }

                    return {
                        ...user,
                        username: resolvedUsername,
                        avatarUrl: finalAvatarUrl
                    };
                } catch {
                    return user; 
                }
            })
        );

        return usersWithResolvedAvatars;
    } catch (error) {
        console.error(`Error reading bounty leaderboard data:`, error);
        return [];
    }
}

async function generateBountyImage(leaderboardData) {
    const width = 800;
    const height = 1000;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Background ---
    try {
        const background = await loadImage('https://www.publicdomainpictures.net/pictures/20000/velka/parchment-paper-background.jpg');
        ctx.drawImage(background, 0, 0, width, height);
    } catch (e) {
        console.error("Failed to load background image, using fallback color.", e);
        ctx.fillStyle = '#e8dcb5'; // Fallback parchment color
        ctx.fillRect(0, 0, width, height);
    }

    // --- Title ---
    ctx.font = 'bold 70px NinjaFont, sans-serif';
    ctx.fillStyle = '#5a3a22'; // Dark brown color
    ctx.textAlign = 'center';
    ctx.fillText('MOST WANTED', width / 2, 100);

    // --- Top 3 Users ---
    const top3Y = 150;
    const top3Positions = [
        { x: width / 4, size: 120 },
        { x: width / 2, size: 150 },
        { x: (width / 4) * 3, size: 120 },
    ];

    for (let i = 0; i < 3 && i < leaderboardData.length; i++) {
        const user = leaderboardData[i];
        const pos = top3Positions[i];

        // Draw avatar
        try {
            const avatarImg = await loadImage(user.avatarUrl);
            ctx.drawImage(avatarImg, pos.x - pos.size / 2, top3Y, pos.size, pos.size);
        } catch (e) {
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(pos.x - pos.size / 2, top3Y, pos.size, pos.size);
        }

        // Draw username
        ctx.font = '24px NinjaFont, sans-serif';
        ctx.fillStyle = '#5a3a22';
        ctx.fillText(user.username, pos.x, top3Y + pos.size + 30);

        // Draw bounty
        ctx.font = 'bold 20px NinjaFont, sans-serif';
        ctx.fillText(user.displayValue, pos.x, top3Y + pos.size + 60);
    }

    // --- Ranks 4-7 ---
    let y = top3Y + 250;
    const itemHeight = 80;
    const padding = 40;

    for (let i = 3; i < 7 && i < leaderboardData.length; i++) {
        const user = leaderboardData[i];

        // Avatar
        try {
            const avatarImg = await loadImage(user.avatarUrl);
            ctx.drawImage(avatarImg, padding + 20, y, 60, 60);
        } catch (e) {
            ctx.fillStyle = '#5a3a22';
            ctx.fillRect(padding + 20, y, 60, 60);
        }

        // Username
        ctx.font = '24px NinjaFont, sans-serif';
        ctx.fillStyle = '#5a3a22';
        ctx.textAlign = 'left';
        ctx.fillText(user.username, padding + 100, y + itemHeight / 2 - 10);

        // Bounty
        ctx.font = 'bold 20px NinjaFont, sans-serif';
        ctx.fillText(user.displayValue, padding + 100, y + itemHeight / 2 + 20);

        y += itemHeight + 10;
    }

    return canvas.toBuffer('image/png');
}

// --- File I/O Helpers ---
function readJsonFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Error reading or parsing ${filePath}:`, e);
            return null;
        }
    }
    return {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bounty')
        .setDescription('Display the bounty leaderboard or hunt a user.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Display the bounty leaderboard.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hunt')
                .setDescription('Hunt an Akatsuki member (ANBU only).')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The Akatsuki member to hunt.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'leaderboard') {
            await interaction.deferReply();

            try {
                const leaderboardData = await loadBountyData(interaction.client);
                const imageBuffer = await generateBountyImage(leaderboardData);
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'bounty_leaderboard.png' });

                await interaction.editReply({ files: [attachment] });

            } catch (error) {
                console.error("Error in bounty command:", error);
                await interaction.editReply({ 
                    content: 'An unexpected error occurred while generating the bounty leaderboard.',
                    components: []
                });
            }
        } else if (subcommand === 'hunt') {
            const anbuPath = path.resolve(__dirname, '../data/anbu.json');
            const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');

            const anbuData = readJsonFile(anbuPath);
            const akatsukiData = readJsonFile(akatsukiPath);

            if (!anbuData || !anbuData.members || !anbuData.members[interaction.user.id]) {
                return interaction.reply({ content: 'You must be an ANBU member to hunt.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            if (!akatsukiData || !akatsukiData.members || !akatsukiData.members[targetUser.id]) {
                return interaction.reply({ content: 'You can only hunt Akatsuki members.', ephemeral: true });
            }

            await interaction.reply({ content: `The hunt is on! ${interaction.user.username} is hunting ${targetUser.username}!`, ephemeral: false });
            await runBattle(interaction, interaction.user.id, targetUser.id, 'fight', null, 'friendly');
        }
    },
};
