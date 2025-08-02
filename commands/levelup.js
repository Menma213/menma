const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
// const { updateRequirements } = require('./scroll'); // Keep if still needed for other features

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Function to calculate EXP requirement for the next level
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2; // Should not happen if level is 1-indexed
    return Math.ceil(1.1 ** currentLevel); // Exp needed to reach (currentLevel + 1), ensure integer
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelup')
        .setDescription('Attempt to level up your ninja skills with accumulated EXP.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('one')
                .setDescription('Consumes EXP for one level up.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Consumes all available EXP to level up as much as possible.')
        ),

    async execute(interaction) {
        await interaction.deferReply(); // Defer reply for processing

        const userId = interaction.user.id;
        const subCommand = interaction.options.getSubcommand(); // Get the chosen subcommand

        if (!fs.existsSync(usersPath)) {
            return interaction.editReply("Database connection failed. Please try again later.");
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        if (!users[userId]) {
            return interaction.editReply({
                content: "You must enroll as a ninja before you can level up!",
                ephemeral: true
            });
        }

        const player = users[userId];

        // Initialize player stats if they don't exist (for new enrollments)
        if (player.level === undefined) player.level = 1;
        if (player.exp === undefined) player.exp = 0;
        if (player.health === undefined) player.health = 1000;
        if (player.power === undefined) player.power = 10;
        if (player.defense === undefined) player.defense = 5;
        if (player.chakra === undefined) player.chakra = 10; // Default chakra

        // Store original stats for comparison in embed
        const originalStats = {
            level: player.level,
            health: player.health,
            power: player.power,
            defense: player.defense,
            chakra: player.chakra
        };

        let levelsGained = 0;
        let totalExpConsumed = 0;
        let finalReplyContent = "";

        if (subCommand === 'one') {
            const requiredExp = getExpRequirement(player.level);

            if (player.exp < requiredExp) {
                return interaction.editReply({
                    content: `You need **${requiredExp.toLocaleString()} EXP** to reach Level ${player.level + 1}.\n` +
                             `Current EXP: ${player.exp.toLocaleString()}`,
                    ephemeral: true
                });
            }

            // Apply single level up
            player.level += 1;
            player.exp -= requiredExp;
            totalExpConsumed = requiredExp;
            levelsGained = 1;

            // Calculate stat gains for one level
            const healthGain = Math.floor(Math.random() * 101) + 100; // 100-200
            const powerGain = Math.floor(Math.random() * 2) + 2;     // 2-3
            const defenseGain = Math.floor(Math.random() * 3) + 2;   // 2-4
            
            player.health += healthGain;
            player.power += powerGain;
            player.defense += defenseGain;

        } else if (subCommand === 'all') {
            let currentLevelUpExp = getExpRequirement(player.level);
            let cumulativeHealthGain = 0;
            let cumulativePowerGain = 0;
            let cumulativeDefenseGain = 0;

            while (player.exp >= currentLevelUpExp) {
                player.exp -= currentLevelUpExp;
                totalExpConsumed += currentLevelUpExp;
                player.level += 1;
                levelsGained += 1;

                // Calculate stat gains for each level
                cumulativeHealthGain += Math.floor(Math.random() * 101) + 100;
                cumulativePowerGain += Math.floor(Math.random() * 2) + 2;
                cumulativeDefenseGain += Math.floor(Math.random() * 3) + 2;

                currentLevelUpExp = getExpRequirement(player.level); // Get next level's requirement
            }

            if (levelsGained === 0) {
                return interaction.editReply({
                    content: `You don't have enough EXP to level up even once. You need **${getExpRequirement(player.level).toLocaleString()} EXP** to reach Level ${player.level + 1}.\n` +
                             `Current EXP: ${player.exp.toLocaleString()}`,
                    ephemeral: true
                });
            }

            // Apply cumulative stat gains
            player.health += cumulativeHealthGain;
            player.power += cumulativePowerGain;
            player.defense += cumulativeDefenseGain;

        }

        // Save changes
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Prepare the embed
        const levelUpEmbed = new EmbedBuilder()
            .setColor('#FF9800') // Orange color for level up
            .setTitle(`⬆️ Level Up! Ninja ${interaction.user.username} Reached Level ${player.level}!`)
            .setDescription(`Congratulations, **${interaction.user.username}**! You've become stronger by reaching a new level${levelsGained > 1 ? `s!` : `!`}`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '__EXP & Level Progress__',
                    value: `**Levels Gained:** ${originalStats.level} ➡️ ${player.level} (Total: ${levelsGained})\n` +
                           `**EXP Consumed:** ${totalExpConsumed.toLocaleString()} EXP\n` +
                           `**Remaining EXP:** ${player.exp.toLocaleString()} EXP`,
                    inline: false
                },
                {
                    name: '__Stat Gains__',
                    value: `\`\`\`diff\n` +
                           `+ Health: +${player.health - originalStats.health} (${originalStats.health} -> ${player.health})\n` +
                           `+ Power:  +${player.power - originalStats.power} (${originalStats.power} -> ${player.power})\n` +
                           `+ Defense: +${player.defense - originalStats.defense} (${originalStats.defense} -> ${player.defense})\n` +
                           `\`\`\``,
                    inline: false
                },
                {
                    name: '__Next Level Up Requirement__',
                    value: `To reach Level ${player.level + 1}, you will need **${getExpRequirement(player.level).toLocaleString()} EXP**.`,
                    inline: false
                }
            )
            .setImage('https://media.tenor.com/8-kXsED3TwwAAAAM/modo-senin-naruto.gif') // **IMPORTANT: Replace with your actual GIF URL**
            .setFooter({ text: 'Keep grinding, ninja!' })
            .setTimestamp();

        await interaction.editReply({ embeds: [levelUpEmbed] });

        // If updateRequirements is still relevant for a 'levelup' event
        // await updateRequirements(userId, 'levelup');
    },
};