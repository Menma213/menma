const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Constants
const ADMIN_ID = "961918563382362122";
const BASE_LEVEL_REQ = 5;
const LEVEL_INCREASE_PER_ATTEMPT = 5;
const REMOVAL_COST = 250000;

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const bloodlinesPath = path.join(dataPath, 'bloodlines.json');
const usersJutsuPath = path.join(dataPath, 'usersjutsu.json');
const battlesPath = path.join(dataPath, 'battles.json');

// Helper functions
const getBloodlineEmoji = (id) => ({
    'Uzumaki': '🌀', 'Uchiha': '👁️', 'Hyuga': '👁️‍🗨️', 'Nara': '🦌',
    'Aburame': '🐛', 'Akimichi': '🍖', 'Inuzuka': '🐕', 'Yamanaka': '💭',
    'Yuki': '❄️', 'Senju': '🌿'
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
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { options } = interaction;
        const subcommand = options.getSubcommand();

        try {
            const users = loadData(usersPath);
            const userId = interaction.user.id;
            const user = users[userId] || {};

            if (!user.level) {
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
                    await this.handleInfo(interaction);
                    break;
                default:
                    return interaction.editReply({ content: "❌ Unknown subcommand" });
            }
        } catch (error) {
            console.error('Bloodline command error:', error);
            interaction.editReply({ content: "❌ An error occurred. Please try again later." });
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
                content: `❌ You already have the ${bloodlines[player.bloodline].name} bloodline!`,
            });
        }

        let requiredLevel = BASE_LEVEL_REQ;
        if (!isAdmin) {
            const attempts = player.bloodlineAttempts || 0;
            requiredLevel += attempts * LEVEL_INCREASE_PER_ATTEMPT;
            
            if (player.level < requiredLevel) {
                users[userId].bloodlineAttempts = attempts + 1;
                saveData(usersPath, users);
                
                return interaction.editReply({
                    content: `🛑 You're too weak to awaken your bloodline!\n` +
                             `Requires level ${requiredLevel} (Attempts: ${attempts + 1})` +
                             (attempts > 0 ? `\n\n*The requirement increases by ${LEVEL_INCREASE_PER_ATTEMPT} levels each attempt.*` : "")
                });
            }
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('bloodlineSelect')
            .setPlaceholder('Choose your bloodline...')
            .addOptions(Object.entries(bloodlines).map(([id, bl]) => ({
                label: bl.name,
                description: `${bl.passive.substring(0, 50)}...`,
                value: id,
                emoji: getBloodlineEmoji(id)
            })));

        await interaction.editReply({
            content: isAdmin 
                ? "✨ **Master**, select your bloodline:" 
                : "🔮 **Choose your bloodline carefully!** This is a permanent decision:",
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        });
    },

    async handleRemove(interaction, player, userId, users) {
        if (!player.bloodline) {
            return interaction.editReply({ content: "❌ You don't have a bloodline to remove!" });
        }

        if (player.money < REMOVAL_COST) {
            return interaction.editReply({
                content: `💰 You need ${REMOVAL_COST.toLocaleString()} Ryo! (You have ${player.money.toLocaleString()} Ryo)`
            });
        }

        const removedBloodline = bloodlines[player.bloodline].name;
        users[userId] = {
            ...player,
            bloodline: null,
            money: player.money - REMOVAL_COST
        };
        saveData(usersPath, users);

        await interaction.editReply({
            content: `✅ Removed ${removedBloodline} bloodline for ${REMOVAL_COST.toLocaleString()} Ryo`
        });
    },

    async handleInfo(interaction) {
        const bloodlineId = interaction.options.getString('bloodline');
        
        if (bloodlineId) {
            const bl = bloodlines[bloodlineId];
            if (!bl) return interaction.editReply({ content: "❌ Bloodline not found!" });

            const embed = new EmbedBuilder()
                .setTitle(`${bl.name} Bloodline ${getBloodlineEmoji(bloodlineId)}`)
                .setDescription(`**${bl.description}**\n${bl.passive}`)
                .addFields(
                    { name: "Level Requirement", value: `Level ${bl.requiredLevel || BASE_LEVEL_REQ}`, inline: true },
                    { name: "Removal Cost", value: `${REMOVAL_COST.toLocaleString()} Ryo`, inline: true }
                )
                .setColor(0x6e1515);

            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("🩸 Bloodline Abilities")
            .setDescription(`Each grants unique powers at level ${BASE_LEVEL_REQ}+`)
            .setColor(0x8B0000);

        Object.entries(bloodlines).forEach(([id, bl]) => {
            embed.addFields({
                name: `${getBloodlineEmoji(id)} ${bl.name}`,
                value: `*${bl.description}*\n${bl.passive.substring(0, 100)}...`,
                inline: true
            });
        });

        await interaction.editReply({ embeds: [embed] });
    },

    processPassive(user, battleData, action) {
        if (!user.bloodline) return null;
        
        const bloodline = bloodlines[user.bloodline];
        if (!bloodline) return null;

        const effects = [];
        const random = Math.random() * 100;

        switch (user.bloodline) {
            case 'Uzumaki':
                if (user.health <= user.maxHealth * 0.3) {
                    effects.push({ 
                        chakra: 15, 
                        message: "🌀 Uzumaki Will: Gained 15 chakra from willpower!" 
                    });
                }
                break;
                
            case 'Uchiha':
                if (action === 'defend' && random <= 15) {
                    effects.push({ 
                        dodged: true, 
                        message: "👁️ Uchiha Reflexes: Dodged the attack!" 
                    });
                }
                break;
                
            case 'Hyuga':
                if (action === 'attack') {
                    effects.push({ 
                        drainChakra: 5, 
                        message: "👁️‍🗨️ Gentle Fist: Drained 5 chakra from opponent!" 
                    });
                }
                break;
                
            case 'Senju':
                if (action === 'heal') {
                    effects.push({
                        healBonus: 10,
                        message: "🌿 Senju Vitality: Healing effectiveness increased by 10%!"
                    });
                }
                break;
                
            case 'Nara':
                if (action === 'strategize' && random <= 20) {
                    effects.push({
                        strategyBonus: 15,
                        message: "🦌 Nara Intelligence: Strategy effectiveness increased by 15%!"
                    });
                }
                break;
        }

        return effects.length > 0 ? effects : null;
    }
};

// Selection handler
module.exports.handleSelection = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { user, values } = interaction;
    const bloodlineId = values[0];
    const bloodline = bloodlines[bloodlineId];

    const users = loadData(usersPath);
    const player = users[user.id] || {};

    if (player.bloodline) {
        return interaction.editReply({ content: "❌ You already have a bloodline!" });
    }

    const isAdmin = user.id === ADMIN_ID;
    const requiredLevel = BASE_LEVEL_REQ + ((player.bloodlineAttempts || 0) * LEVEL_INCREASE_PER_ATTEMPT);
    
    if (!isAdmin && player.level < requiredLevel) {
        return interaction.editReply({ content: "❌ You don't meet the level requirement!" });
    }

    users[user.id] = {
        ...player,
        bloodline: bloodlineId,
        bloodlineAttempts: 0
    };
    saveData(usersPath, users);

    const embed = new EmbedBuilder()
        .setTitle(`🩸 Bloodline Awakened: ${bloodline.name} ${getBloodlineEmoji(bloodlineId)}`)
        .setDescription(`**${bloodline.description}**\n*${bloodline.passive}*`)
        .setColor(0xFF0000)
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: "This power is now yours to command" });

    await interaction.editReply({ embeds: [embed] });
};