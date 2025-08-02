const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { GifUtil, GifFrame, GifCodec } = require('gifwrap');
const path = require('path');
const fs = require('fs');
// const welcomeCmd = require('./commands/welcome.js');

// Configuration
const BASE_GIF_PATH = path.join('C:\\Users\\HI\\Downloads\\menma\\assets\\welcome_poke_base.gif');
const CONFIG_PATH = path.join(__dirname, 'welcome_config.json');
const AVATAR_SIZE = 128; // Size for user avatars

// Frame data for avatar placement (pre-analyzed)
const avatarPlacementData = [
    // Frame 0 - Initial position
    { frameIndex: 0, x: 150, y: 180, width: 40, height: 40, rotation: 0 },
    // Frame 1 - Poke contact
    { frameIndex: 1, x: 155, y: 178, width: 40, height: 40, rotation: 0 },
    // Frame 2 - Start moving (35 degrees up-left)
    { frameIndex: 2, x: 140, y: 160, width: 40, height: 40, rotation: -0.61 },
    // Frame 3 - Continue trajectory
    { frameIndex: 3, x: 120, y: 140, width: 40, height: 40, rotation: -0.61 },
    // Frame 4 - Further along
    { frameIndex: 4, x: 100, y: 120, width: 40, height: 40, rotation: -0.61 },
    // Frame 5 - Almost off-screen
    { frameIndex: 5, x: 80, y: 100, width: 40, height: 40, rotation: -0.61 },
    // Frame 6 - Off-screen
    { frameIndex: 6, x: 60, y: 80, width: 40, height: 40, rotation: -0.61 }
];

// Load or create config file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading config:', error);
        return {};
    }
}

// Save config to file
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Create the welcome GIF with user's avatar
async function createWelcomeGif(userAvatarUrl) {
    try {
        // Load base GIF
        const gif = await GifUtil.read(BASE_GIF_PATH);
        const codec = new GifCodec();
        
        // Load user avatar
        const avatar = await loadImage(userAvatarUrl);
        
        // Process each frame
        const newFrames = [];
        for (let i = 0; i < gif.frames.length; i++) {
            const frame = gif.frames[i];
            const frameData = avatarPlacementData.find(data => data.frameIndex === i);
            
            // Create canvas for this frame
            const canvas = createCanvas(frame.bitmap.width, frame.bitmap.height);
            const ctx = canvas.getContext('2d');
            
            // Draw original frame
            ctx.drawImage(await loadImage(frame.bitmap), 0, 0);
            
            // Add user avatar if this frame needs it
            if (frameData) {
                ctx.save();
                
                // Position and rotate avatar
                ctx.translate(frameData.x + frameData.width / 2, frameData.y + frameData.height / 2);
                ctx.rotate(frameData.rotation);
                
                // Draw avatar (centered at the translation point)
                ctx.drawImage(
                    avatar,
                    -frameData.width / 2,
                    -frameData.height / 2,
                    frameData.width,
                    frameData.height
                );
                
                ctx.restore();
            }
            
            // Create new frame with original timing
            const newFrame = new GifFrame(
                ctx.getImageData(0, 0, canvas.width, canvas.height),
                {
                    delayCentisecs: frame.delayCentisecs,
                    disposalMethod: frame.disposalMethod
                }
            );
            
            newFrames.push(newFrame);
        }
        
        // Encode the new GIF
        const outputBuffer = await codec.encodeGif(newFrames, { loops: gif.loops });
        return outputBuffer.buffer;
    } catch (error) {
        console.error('Error creating welcome GIF:', error);
        throw error;
    }
}

// Admin command to enable/disable welcome GIFs
module.exports = {
    data: new SlashCommandBuilder()
        .setName('admincommand105')
        .setDescription('Manage welcome GIF settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable welcome GIFs for this server')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send welcome messages')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('(Test) Send welcome GIF for this user immediately')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable welcome GIFs for this server')
        ),
    
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
        }
        
        const config = loadConfig();
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'enable') {
            const channel = interaction.options.getChannel('channel');
            const testUser = interaction.options.getUser('user');
            
            config[guildId] = {
                enabled: true,
                channelId: channel.id
            };
            
            saveConfig(config);

            // If a user is provided, send the welcome GIF for that user (test mode)
            if (testUser) {
                try {
                    // Get user avatar URL
                    const avatarURL = testUser.displayAvatarURL({
                        extension: 'png',
                        size: AVATAR_SIZE,
                        forceStatic: true
                    });
                    const gifBuffer = await createWelcomeGif(avatarURL);
                    await channel.send({
                        content: `Hey <@${testUser.id}>, welcome to the server! (Test)`,
                        files: [new AttachmentBuilder(gifBuffer, { name: 'welcome.gif' })]
                    });
                    await interaction.reply({ content: `Welcome GIF sent for <@${testUser.id}> in ${channel}.`, ephemeral: true });
                } catch (error) {
                    console.error('Error sending test welcome GIF:', error);
                    await interaction.reply({ content: 'Failed to send test welcome GIF.', ephemeral: true });
                }
            } else {
                await interaction.reply({ content: `Welcome GIFs enabled! They will be sent to ${channel}.`, ephemeral: true });
            }
        } else if (subcommand === 'disable') {
            if (config[guildId]) {
                delete config[guildId];
                saveConfig(config);
            }
            await interaction.reply({ content: 'Welcome GIFs disabled for this server.', ephemeral: true });
        }
    },
    
    // Function to handle new member joins
    async handleNewMember(member) {
        const config = loadConfig();
        const guildConfig = config[member.guild.id];
        
        if (!guildConfig || !guildConfig.enabled) return;
        
        try {
            const channel = member.guild.channels.cache.get(guildConfig.channelId);
            if (!channel) return;
            
            // Get user avatar URL
            const avatarURL = member.user.displayAvatarURL({
                extension: 'png',
                size: AVATAR_SIZE,
                forceStatic: true
            });
            
            // Create welcome GIF
            const gifBuffer = await createWelcomeGif(avatarURL);
            
            // Send welcome message
            await channel.send({
                content: `Hey ${member}, welcome to the server!`,
                files: [new AttachmentBuilder(gifBuffer, { name: 'welcome.gif' })]
            });
        } catch (error) {
            console.error('Error handling new member:', error);
        }
    }
};

// Listen for new guild members and trigger welcome GIF
// Remove the direct use of 'client' here. Instead, in your main bot file (e.g., index.js or main.js), add:

// const welcomeCommand = require('./commands/welcome.js');
// client.on('guildMemberAdd', member => {
//     welcomeCommand.handleNewMember(member);
// });

// 1. Add this to your client's 'guildMemberAdd' event:
// client.on('guildMemberAdd', member => {
//     module.exports.handleNewMember(member);
// });
//
// 2. Make sure you have the base GIF file at assets/welcome_poke_base.gif
// 3. The config will be saved to welcome_config.json