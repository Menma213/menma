const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const battlepassTiers = require('../data/bptiers.json');
const USERS_FILE = path.resolve(__dirname, '../data/users.json');

const ITEMS_PER_PAGE = 5;

// Helper function to read and parse user data
const getUsers = () => {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading users.json:', error);
        return {};
    }
};

// Helper function to save user data
const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const createBattlepassEmbed = (user, page = 0) => {
    const users = getUsers();
    const userData = users[user.id] || { bxp: 0, claimedTiers: [] };
    const userBxp = userData.bxp;
    const claimedTiers = userData.claimedTiers;

    const totalPages = Math.ceil(battlepassTiers.length / ITEMS_PER_PAGE);
    const startTierIndex = page * ITEMS_PER_PAGE;
    const endTierIndex = Math.min(startTierIndex + ITEMS_PER_PAGE, battlepassTiers.length);
    const currentTiers = battlepassTiers.slice(startTierIndex, endTierIndex);
    
    // Find next tier for progress bar
    const nextTier = battlepassTiers.find(t => userBxp < t.bxpRequired);
    const progressPercentage = nextTier
        ? Math.floor((userBxp / nextTier.bxpRequired) * 100)
        : 100;
    
    const embed = new EmbedBuilder()
        .setTitle('Season 1 Battle Pass')
        .setDescription(`**BXP:** ${userBxp}\n**Progress:** ${progressPercentage}%`)
        .setColor('#FF5555')
        .setThumbnail('https://i.imgur.com/rM1r7w2.png'); // Example thumbnail

    for (const tier of currentTiers) {
        const isUnlocked = userBxp >= tier.bxpRequired;
        const isClaimed = claimedTiers.includes(tier.tier);

        let statusEmoji = '🔒';
        if (isClaimed) {
            statusEmoji = '✅';
        } else if (isUnlocked) {
            statusEmoji = '🔓';
        }

        embed.addFields({
            name: `Tier ${tier.tier} ${statusEmoji}`,
            value: `**Reward:** ${tier.reward}\nBXP Required: ${tier.bxpRequired}`,
            inline: true
        });
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`battlepass_prev_${page}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`battlepass_next_${page}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        );

    const claimRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`battlepass_claim_all`)
                .setLabel('Claim All Unlocked')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!battlepassTiers.some(t => userBxp >= t.bxpRequired && !claimedTiers.includes(t.tier)))
        );

    return { embed, row, claimRow };
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('battlepass')
        .setDescription('View your battlepass progress and rewards.'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const { embed, row, claimRow } = createBattlepassEmbed(interaction.user);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row, claimRow],
            ephemeral: true,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: `This isn't your battlepass to control!`, ephemeral: true });
            }

            const users = getUsers();
            let userData = users[userId] || { bxp: 0, claimedTiers: [] };
            let currentPage = parseInt(i.customId.split('_').pop());

            if (i.customId.startsWith('battlepass_next')) {
                currentPage++;
            } else if (i.customId.startsWith('battlepass_prev')) {
                currentPage--;
            } else if (i.customId === 'battlepass_claim_all') {
                const unlocked = battlepassTiers.filter(t => userData.bxp >= t.bxpRequired);
                const newClaims = unlocked.filter(t => !userData.claimedTiers.includes(t.tier));
                
                if (newClaims.length > 0) {
                    userData.claimedTiers.push(...newClaims.map(t => t.tier));
                    users[userId] = userData;
                    saveUsers(users);
                    await i.followUp({ content: `Successfully claimed ${newClaims.length} rewards!`, ephemeral: true });
                } else {
                    return i.reply({ content: `You have no new rewards to claim.`, ephemeral: true });
                }
            }
            
            const updatedResponse = createBattlepassEmbed(i.user, currentPage);
            await i.update({
                embeds: [updatedResponse.embed],
                components: [updatedResponse.row, updatedResponse.claimRow]
            });
        });

        collector.on('end', () => {
            response.edit({ components: [] }).catch(console.error);
        });
    }
};