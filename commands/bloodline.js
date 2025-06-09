const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Constants
const ADMIN_ID = "961918563382362122";
const BASE_LEVEL_REQ = 5;
const LEVEL_INCREASE_PER_ATTEMPT = 5;
const REMOVAL_COST = 250000;
const MAX_ATTEMPTS = 5;

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const bloodlinesPath = path.join(dataPath, 'bloodlines.json');

// Helper functions
const getBloodlineEmoji = (id) => ({
    'Uzumaki': '🌀', 'Uchiha': '👁️', 'Hyuga': '👁️‍🗨️', 'Nara': '🦌',
    'Aburame': '🐛', 'Akimichi': '🍖', 'Inuzuka': '🐕', 'Yamanaka': '💭',
    'Yuki': '❄️', 'Senju': '🌿', 'Kaguya': '🦴', 'Hozuki': '💧'
}[id] || '🔹');

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

// Load bloodlines data
const bloodlines = loadData(bloodlinesPath);

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
                .setDescription('View bloodline information')
                .addStringOption(option =>
                    option.setName('bloodline')
                        .setDescription('Specific bloodline to view')
                        .setAutocomplete(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available bloodlines')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const isEphemeral = subcommand !== 'list';
            
            // Defer the reply first to prevent interaction timeout
            await interaction.deferReply({ ephemeral: isEphemeral });

            const users = loadData(usersPath);
            const userId = interaction.user.id;
            const user = users[userId] || {};

            if (!user.level && subcommand !== 'info' && subcommand !== 'list') {
                return interaction.editReply({ content: "❌ You need to enroll as a ninja first!" });
            }

            switch (subcommand) {
                case 'choose': 
                    await this.handleChoose(interaction, user, userId, users);
                    break;
                case 'remove':
                    await this.handleRemove(interaction, user, userId, users);
                    break;
                case 'info':
                    await this.handleInfo(interaction, interaction.options.getString('bloodline'));
                    break;
                case 'list':
                    await this.handleList(interaction);
                    break;
                default:
                    await interaction.editReply({ content: "❌ Unknown subcommand" });
            }
        } catch (error) {
            console.error('Bloodline command error:', error);
            
            // Check if the interaction has already been replied to
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: "❌ An error occurred. Please try again later.",
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: "❌ An error occurred. Please try again later." 
                });
            }
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = Object.entries(bloodlines)
            .filter(([_, bl]) => bl.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(([id, bl]) => ({ name: bl.name, value: id }));
        
        await interaction.respond(filtered);
    },

    async handleChoose(interaction, player, userId, users) {
        const isAdmin = userId === ADMIN_ID;
        
        if (player.bloodline) {
            return interaction.editReply({
                content: `❌ You already have the ${bloodlines[player.bloodline]?.name || 'unknown'} bloodline!`,
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
                
                return interaction.editReply({
                    content: `🛑 You're too weak to awaken your bloodline!\n` +
                             `Requires level ${requiredLevel} (Attempts: ${attempts + 1}/${MAX_ATTEMPTS})` +
                             (attempts > 0 ? `\n\n*The requirement increases by ${LEVEL_INCREASE_PER_ATTEMPT} levels each attempt up to ${MAX_ATTEMPTS} times.*` : "") +
                             `\nNext attempt will require level ${nextRequirement}`
                });
            }
        }

        const availableBloodlines = Object.entries(bloodlines)
            .filter(([id, bl]) => isAdmin || player.level >= (bl.requiredLevel || BASE_LEVEL_REQ))
            .map(([id, bl]) => ({
                label: bl.name,
                description: `${bl.passive.substring(0, 50)}...`,
                value: id,
                emoji: getBloodlineEmoji(id)
            }));

        if (availableBloodlines.length === 0) {
            return interaction.editReply({
                content: "❌ No bloodlines available for your current level!"
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('bloodlineSelect')
            .setPlaceholder('Choose your bloodline...')
            .addOptions(availableBloodlines);

        await interaction.editReply({
            content: isAdmin 
                ? "✨ **Master**, select your bloodline:" 
                : `🔮 **Choose your bloodline carefully!** This is a permanent decision:\n` +
                  `You qualify for ${availableBloodlines.length}/${Object.keys(bloodlines).length} bloodlines`,
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        });
    },

    async handleRemove(interaction, player, userId, users) {
        if (!player.bloodline) {
            return interaction.editReply({ content: "❌ You don't have a bloodline to remove!" });
        }

        if (player.money < REMOVAL_COST) {
            return interaction.editReply({
                content: `💰 You need ${REMOVAL_COST.toLocaleString()} Ryo to remove your bloodline! (You have ${player.money?.toLocaleString() || 0} Ryo)`
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

        await interaction.editReply({
            content: `✅ Removed ${removedBloodline} bloodline for ${REMOVAL_COST.toLocaleString()} Ryo\n` +
                     `You can now attempt to awaken a new bloodline, but the level requirement will be higher.`
        });
    },

    async handleInfo(interaction, bloodlineId) {
        if (bloodlineId) {
            const bl = bloodlines[bloodlineId];
            if (!bl) return interaction.editReply({ content: "❌ Bloodline not found!" });

            const embed = new EmbedBuilder()
                .setTitle(`${bl.name} Bloodline ${getBloodlineEmoji(bloodlineId)}`)
                .setDescription(`**${bl.description}**\n\n**Passive Ability:**\n${bl.passive}`)
                .addFields(
                    { name: "Level Requirement", value: `Level ${bl.requiredLevel || BASE_LEVEL_REQ}`, inline: true },
                    { name: "Removal Cost", value: `${REMOVAL_COST.toLocaleString()} Ryo`, inline: true },
                    { name: "Specialty", value: bl.specialty || "General", inline: true }
                )
                .setColor(0x6e1515)
                .setFooter({ text: "Bloodline abilities activate automatically in battle" });

            return interaction.editReply({ embeds: [embed] });
        }

        await this.handleList(interaction);
    },

    async handleList(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("🩸 Available Bloodlines")
            .setDescription(`Each grants unique powers starting at level ${BASE_LEVEL_REQ}\nUse \`/bloodline info [name]\` for details`)
            .setColor(0x8B0000)
            .setFooter({ text: `Total bloodlines: ${Object.keys(bloodlines).length}` });

        const bloodlineArray = Object.entries(bloodlines);
        for (let i = 0; i < bloodlineArray.length; i += 3) {
            const chunk = bloodlineArray.slice(i, i + 3);
            embed.addFields({
                name: '\u200b',
                value: chunk.map(([id, bl]) => 
                    `**${getBloodlineEmoji(id)} ${bl.name}**\n` +
                    `*${bl.description.substring(0, 50)}...*\n` +
                    `Req: Lv. ${bl.requiredLevel || BASE_LEVEL_REQ}`
                ).join('\n\n'),
                inline: true
            });
        }

        await interaction.editReply({ embeds: [embed] });
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
            return interaction.editReply({ content: "❌ That bloodline no longer exists!" });
        }

        const users = loadData(usersPath);
        const player = users[user.id] || {};

        if (player.bloodline) {
            return interaction.editReply({ content: "❌ You already have a bloodline!" });
        }

        const isAdmin = user.id === ADMIN_ID;
        const requiredLevel = bloodline.requiredLevel || BASE_LEVEL_REQ;
        const attempts = player.bloodlineAttempts || 0;
        const actualRequiredLevel = requiredLevel + (Math.min(attempts, MAX_ATTEMPTS) * LEVEL_INCREASE_PER_ATTEMPT);
        
        if (!isAdmin && player.level < actualRequiredLevel) {
            return interaction.editReply({ 
                content: `❌ You don't meet the level requirement for ${bloodline.name} (Need level ${actualRequiredLevel})!` 
            });
        }

        users[user.id] = {
            ...player,
            bloodline: bloodlineId,
            bloodlineAttempts: 0
        };
        saveData(usersPath, users);

        const embed = new EmbedBuilder()
            .setTitle(`🩸 Bloodline Awakened: ${bloodline.name} ${getBloodlineEmoji(bloodlineId)}`)
            .setDescription(`**${bloodline.description}**\n\n**Passive Ability:**\n${bloodline.passive}`)
            .addFields(
                { name: "Specialty", value: bloodline.specialty || "General", inline: true },
                { name: "Level Required", value: `${actualRequiredLevel}`, inline: true }
            )
            .setColor(0xFF0000)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: "This power is now yours to command" });

        await interaction.editReply({ embeds: [embed] });
        
        if (!isAdmin && player.level >= 20) {
            await interaction.followUp({
                content: `🎉 **${user.username}** has awakened the **${bloodline.name}** bloodline!`,
                ephemeral: false
            });
        }
    } catch (error) {
        console.error('Bloodline selection error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: "❌ An error occurred during bloodline selection.",
                ephemeral: true 
            });
        } else {
            await interaction.editReply({ 
                content: "❌ An error occurred during bloodline selection." 
            });
        }
    }
};

