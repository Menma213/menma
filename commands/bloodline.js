const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Constants
const ADMIN_ID = process.env.BOT_OWNER_ID || "961918563382362122";
const BASE_LEVEL_REQ = 5;
const LEVEL_INCREASE_PER_ATTEMPT = 5;
const REMOVAL_COST = 250000;
const MAX_ATTEMPTS = 5;

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const bloodlinesPath = path.join(dataPath, 'bloodlines.json');

// Emoji system
const BLOODLINE_EMOJIS = {
    'Uzumaki': { name: '🌀', color: 0xe74c3c },
    'Uchiha': { name: '👁️', color: 0xe91e63 },
    'Hyuga': { name: '👁️', color: 0x3498db },
    'Nara': { name: '🦌', color: 0x2ecc71 },
    'Aburame': { name: '🐛', color: 0x1abc9c },
    'Akimichi': { name: '🍖', color: 0xe67e22 },
    'Inuzuka': { name: '🐕', color: 0xf39c12 },
    'Yamanaka': { name: '💭', color: 0x9b59b6 },
    'Yuki': { name: '❄️', color: 0x00b4d8 },
    'Senju': { name: '🌿', color: 0x27ae60 },
    'Kaguya': { name: '🦴', color: 0xecf0f1 },
    'Hozuki': { name: '💧', color: 0x0984e3 }
};

const getBloodlineData = (id) => BLOODLINE_EMOJIS[id] || { name: '🔹', color: 0x7289da };

// Data handling
const loadData = (path) => {
    try {
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (err) {
        console.error(`Error loading ${path}:`, err);
        return {};
    }
};

const saveData = (path, data) => {
    try {
        const dir = path.split('/').slice(0, -1).join('/');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${path}:`, err);
    }
};

const bloodlines = loadData(bloodlinesPath);

// Helper function to safely respond to interactions
async function safeReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        }
        return await interaction.reply({ ...options, fetchReply: true });
    } catch (err) {
        if (err.code !== 40060 && err.code !== 10062) {
            console.error('Interaction response failed:', err);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bloodline')
        .setDescription('Manage your ninja bloodline abilities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('choose')
                .setDescription('Awaken your bloodline (Level 5 required)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription(`Remove your current bloodline (${REMOVAL_COST.toLocaleString()} Ryo)`)
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View detailed bloodline information')
                .addStringOption(option =>
                    option.setName('bloodline')
                        .setDescription('Specific bloodline to view')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available bloodlines')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const isEphemeral = subcommand !== 'list';
            
            try {
                await interaction.deferReply({ ephemeral: isEphemeral });
            } catch (error) {
                if (error.code === 10062) {
                    console.log('Interaction timed out before response');
                    return;
                }
                throw error;
            }

            const users = loadData(usersPath);
            const userId = interaction.user.id;
            const user = users[userId] || { level: 0, money: 0 };

            if (!user.level && subcommand !== 'info' && subcommand !== 'list') {
                return await safeReply(interaction, {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ Enrollment Required')
                            .setDescription('You need to enroll as a ninja first!')
                    ]
                });
            }

            switch (subcommand) {
                case 'choose': 
                    await this.handleChoose(interaction, user, userId, users);
                    break;
                case 'remove':
                    await this.handleRemove(interaction, user, userId, users);
                    break;
                case 'info':
                    await this.handleInfo(interaction);
                    break;
                case 'list':
                    await this.handleList(interaction);
                    break;
            }
        } catch (error) {
            console.error('Bloodline command error:', error);
            await this.handleCommandError(interaction, error);
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = Object.entries(bloodlines)
            .filter(([_, bl]) => bl.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(([id, bl]) => ({ 
                name: `${getBloodlineData(id).name} ${bl.name}`, 
                value: id 
            }));
        
        await interaction.respond(filtered).catch(() => {});
    },

    async handleChoose(interaction, player, userId, users) {
        const isAdmin = userId === ADMIN_ID;
        
        if (player.bloodline) {
            const current = bloodlines[player.bloodline];
            return await safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ Bloodline Already Awakened')
                        .setDescription(`You already have the ${current?.name || 'unknown'} bloodline!`)
                        .addFields({
                            name: 'Want to change?',
                            value: `Use \`/bloodline remove\` (costs ${REMOVAL_COST.toLocaleString()} Ryo)`
                        })
                ]
            });
        }

        let requiredLevel = BASE_LEVEL_REQ;
        if (!isAdmin) {
            const attempts = player.bloodlineAttempts || 0;
            const cappedAttempts = Math.min(attempts, MAX_ATTEMPTS);
            requiredLevel += cappedAttempts * LEVEL_INCREASE_PER_ATTEMPT;
            
            if (player.level < requiredLevel) {
                users[userId].bloodlineAttempts = attempts + 1;
                saveData(usersPath, users);
                
                const nextAttempt = Math.min(attempts + 1, MAX_ATTEMPTS);
                const nextRequirement = BASE_LEVEL_REQ + (nextAttempt * LEVEL_INCREASE_PER_ATTEMPT);
                
                return await safeReply(interaction, {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf39c12)
                            .setTitle('🛑 Level Requirement Not Met')
                            .setDescription(`You're too weak to awaken your bloodline!`)
                            .addFields(
                                { name: 'Current Level', value: `${player.level}`, inline: true },
                                { name: 'Required Level', value: `${requiredLevel}`, inline: true },
                                { name: 'Attempts', value: `${attempts + 1}/${MAX_ATTEMPTS}`, inline: true },
                                { 
                                    name: 'Next Attempt', 
                                    value: `Will require level ${nextRequirement}`,
                                    inline: false 
                                }
                            )
                    ]
                });
            }
        }

        const availableBloodlines = Object.entries(bloodlines)
            .filter(([id, bl]) => isAdmin || player.level >= (bl.requiredLevel || BASE_LEVEL_REQ))
            .map(([id, bl]) => ({
                label: bl.name,
                description: `${bl.passive.substring(0, 50)}...`,
                value: id,
                emoji: getBloodlineData(id).name
            }));

        if (availableBloodlines.length === 0) {
            return await safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ No Bloodlines Available')
                        .setDescription('You do not qualify for any bloodlines at your current level!')
                ]
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('bloodlineSelect')
            .setPlaceholder('Choose your bloodline...')
            .addOptions(availableBloodlines);

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔮 Bloodline Awakening')
            .setDescription('Choose your bloodline carefully! This is a permanent decision.')
            .addFields(
                { 
                    name: 'Available Bloodlines', 
                    value: `${availableBloodlines.length}/${Object.keys(bloodlines).length}`,
                    inline: true 
                },
                { 
                    name: 'Level Requirement', 
                    value: `${requiredLevel}+`,
                    inline: true 
                }
            )
            .setFooter({ text: 'Select from the menu below' });

        await safeReply(interaction, {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        });
    },

    async handleRemove(interaction, player, userId, users) {
        if (!player.bloodline) {
            return await safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ No Bloodline Found')
                        .setDescription("You don't have a bloodline to remove!")
                ]
            });
        }

        if (player.money < REMOVAL_COST) {
            return await safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xf39c12)
                        .setTitle('💰 Insufficient Funds')
                        .setDescription(`You need ${REMOVAL_COST.toLocaleString()} Ryo to remove your bloodline!`)
                        .addFields(
                            { name: 'Your Balance', value: `${player.money?.toLocaleString() || 0} Ryo`, inline: true },
                            { name: 'Missing', value: `${(REMOVAL_COST - player.money).toLocaleString()} Ryo`, inline: true }
                        )
                ]
            });
        }

        const removedBloodline = bloodlines[player.bloodline]?.name || 'unknown';
        users[userId] = {
            ...player,
            bloodline: null,
            money: player.money - REMOVAL_COST,
            bloodlineAttempts: (player.bloodlineAttempts || 0) + 1
        };
        saveData(usersPath, users);

        await safeReply(interaction, {
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Bloodline Removed')
                    .setDescription(`**${removedBloodline}** bloodline has been removed for ${REMOVAL_COST.toLocaleString()} Ryo`)
                    .addFields({
                        name: 'Note',
                        value: 'You can now attempt to awaken a new bloodline, but the level requirement will be higher.'
                    })
            ]
        });
    },

    async handleInfo(interaction) {
        const bloodlineId = interaction.options.getString('bloodline');
        const bl = bloodlines[bloodlineId];
        
        if (!bl) {
            return await safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ Bloodline Not Found')
                        .setDescription('The specified bloodline could not be found!')
                ]
            });
        }

        const emojiData = getBloodlineData(bloodlineId);
        const embed = new EmbedBuilder()
            .setTitle(`${emojiData.name} ${bl.name} Bloodline`)
            .setDescription(bl.description)
            .setColor(emojiData.color)
            .addFields(
                { 
                    name: 'Passive Ability', 
                    value: bl.passive,
                    inline: false 
                },
                { 
                    name: 'Requirements', 
                    value: `• Level: ${bl.requiredLevel || BASE_LEVEL_REQ}\n• Removal Cost: ${REMOVAL_COST.toLocaleString()} Ryo`,
                    inline: true 
                },
                { 
                    name: 'Specialty', 
                    value: bl.specialty || 'General',
                    inline: true 
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: 'Bloodline abilities activate automatically in battle' });

        await safeReply(interaction, { embeds: [embed] });
    },

    async handleList(interaction) {
        const groupedBloodlines = Object.entries(bloodlines).reduce((acc, [id, bl]) => {
            const specialty = bl.specialty || 'General';
            if (!acc[specialty]) acc[specialty] = [];
            acc[specialty].push({ id, ...bl });
            return acc;
        }, {});

        const embed = new EmbedBuilder()
            .setTitle('🩸 Available Bloodlines')
            .setDescription(`Each grants unique powers starting at level ${BASE_LEVEL_REQ}\nUse \`/bloodline info [name]\` for details`)
            .setColor(0x9b59b6);

        for (const [specialty, bls] of Object.entries(groupedBloodlines)) {
            embed.addFields({
                name: `▸ ${specialty}`,
                value: bls.map(bl => {
                    const emoji = getBloodlineData(bl.id).name;
                    return `${emoji} **${bl.name}** - ${bl.description.substring(0, 50)}...`;
                }).join('\n'),
                inline: false
            });
        }

        embed.setFooter({ text: `Total bloodlines: ${Object.keys(bloodlines).length}` });

        await safeReply(interaction, { embeds: [embed] });
    },

    async handleCommandError(interaction, error) {
        try {
            const content = "❌ An error occurred. Please try again later.";
            await safeReply(interaction, { content });
        } catch (err) {
            console.error('Failed to handle error:', err);
        }
    }
};

// Selection handler
module.exports.handleSelection = async function(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const { user, values } = interaction;
        const bloodlineId = values[0];
        const bloodline = bloodlines[bloodlineId];

        if (!bloodline) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ Bloodline Not Found')
                        .setDescription('The selected bloodline no longer exists!')
                ]
            });
        }

        const users = loadData(usersPath);
        const player = users[user.id] || { level: 0 };

        if (player.bloodline) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('❌ Bloodline Already Awakened')
                        .setDescription('You already have a bloodline!')
                ]
            });
        }

        const isAdmin = user.id === ADMIN_ID;
        const requiredLevel = bloodline.requiredLevel || BASE_LEVEL_REQ;
        const attempts = player.bloodlineAttempts || 0;
        const actualRequiredLevel = requiredLevel + (Math.min(attempts, MAX_ATTEMPTS) * LEVEL_INCREASE_PER_ATTEMPT;
        
        if (!isAdmin && player.level < actualRequiredLevel) {
            return await interaction.editReply({ 
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xf39c12)
                        .setTitle('❌ Level Requirement Not Met')
                        .setDescription(`You need level ${actualRequiredLevel} for the ${bloodline.name} bloodline!`)
                        .addFields(
                            { name: 'Your Level', value: `${player.level}`, inline: true }
                        )
                ]
            });
        }

        users[user.id] = {
            ...player,
            bloodline: bloodlineId,
            bloodlineAttempts: 0
        };
        saveData(usersPath, users);

        const emojiData = getBloodlineData(bloodlineId);
        const embed = new EmbedBuilder()
            .setTitle(`✨ ${emojiData.name} Bloodline Awakened: ${bloodline.name}`)
            .setDescription(`**${bloodline.description}**`)
            .setColor(emojiData.color)
            .addFields(
                { 
                    name: 'Passive Ability', 
                    value: bloodline.passive,
                    inline: false 
                },
                { 
                    name: 'Specialty', 
                    value: bloodline.specialty || 'General',
                    inline: true 
                }
            )
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: 'This power is now yours to command' });

        await interaction.editReply({ embeds: [embed] });
        
        if (!isAdmin && player.level >= 20) {
            await interaction.followUp({
                content: `🎉 **${user.username}** has awakened the **${bloodline.name}** bloodline!`,
                ephemeral: false
            }).catch(() => {});
        }
    } catch (error) {
        console.error('Bloodline selection error:', error);
        try {
            const content = "❌ An error occurred during bloodline selection.";
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(() => {});
            }
        } catch (err) {
            console.error('Failed to handle selection error:', err);
        }
    }
};