const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
// const { updateRequirements } = require('./scroll'); // Keep if still needed for other features

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');

// Function to calculate EXP requirement for the next level
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2;
    if (currentLevel < 50) return (1 + currentLevel) * 2;
    if (currentLevel < 100) return (1 + currentLevel) * 3;
    if (currentLevel < 200) return (1 + currentLevel) * 4;
    if (currentLevel < 300) return (1 + currentLevel) * 5;
    if (currentLevel < 400) return (1 + currentLevel) * 6;
    if (currentLevel < 500) return (1 + currentLevel) * 7;
    if (currentLevel < 600) return (1 + currentLevel) * 8;
    if (currentLevel < 700) return (1 + currentLevel) * 9;
    if (currentLevel < 800) return (1 + currentLevel) * 10;
    if (currentLevel < 900) return (1 + currentLevel) * 11;
    if (currentLevel < 1000) return (1 + currentLevel) * 12;
    return (1 + currentLevel) * 13;
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

        // Only use players.json for level and exp
        let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        if (!players[userId]) players[userId] = { level: 1, exp: 0 };
        // Ensure level and exp are numbers
        players[userId].level = Number(players[userId].level) || 1;
        players[userId].exp = Number(players[userId].exp) || 0;

        // Initialize player stats if they don't exist (for new enrollments)
        const player = users[userId];
        
        // TYPE COERCION: Force all stats to be numbers before any calculations
        player.health = Number(player.health) || 100;
        player.power = Number(player.power) || 10;
        player.defense = Number(player.defense) || 5;
        player.chakra = Number(player.chakra) || 10; // Default chakra

        // Store original stats for comparison in embed
        const originalStats = {
            level: players[userId].level,
            health: player.health,
            power: player.power,
            defense: player.defense,
            chakra: player.chakra
        };

        let levelsGained = 0;
        let totalExpConsumed = 0;
        let finalReplyContent = "";

        if (subCommand === 'one') {
            const requiredExp = getExpRequirement(players[userId].level);
            if (players[userId].exp < requiredExp) {
                return interaction.editReply({
                    content: `You need **${requiredExp.toLocaleString()} EXP** to reach Level ${players[userId].level + 1}.\n` +
                             `Current EXP: ${players[userId].exp.toLocaleString()}`,
                    ephemeral: true
                });
            }
            // Apply single level up (only in players.json)
            players[userId].level = Number(players[userId].level) + 1;
            players[userId].exp = Number(players[userId].exp) - requiredExp;
            totalExpConsumed = requiredExp;
            levelsGained = 1;

            // Calculate stat gains for one level
            const healthGain = Math.floor(Math.random() * 2) + 2; // 2-3
            const powerGain = Math.floor(Math.random() * 2) + 3;     // 3-4
            const defenseGain = Math.floor(Math.random() * 2) + 1;   // 1-2

            // TYPE COERCION: Ensure numeric addition
            player.health = Number(player.health) + healthGain;
            player.power = Number(player.power) + powerGain;
            player.defense = Number(player.defense) + defenseGain;

        } else if (subCommand === 'all') {
            let currentLevelUpExp = getExpRequirement(players[userId].level);
            let cumulativeHealthGain = 0;
            let cumulativePowerGain = 0;
            let cumulativeDefenseGain = 0;
            while (players[userId].exp >= currentLevelUpExp) {
                players[userId].exp = Number(players[userId].exp) - currentLevelUpExp;
                totalExpConsumed += currentLevelUpExp;
                players[userId].level = Number(players[userId].level) + 1;
                levelsGained += 1;
                cumulativeHealthGain += Math.floor(Math.random() * 2) + 2;
                cumulativePowerGain += Math.floor(Math.random() * 2) + 3;
                cumulativeDefenseGain += Math.floor(Math.random() * 2) + 1;
                currentLevelUpExp = getExpRequirement(players[userId].level);
            }
            if (levelsGained === 0) {
                return interaction.editReply({
                    content: `You don't have enough EXP to level up even once. You need **${getExpRequirement(players[userId].level).toLocaleString()} EXP** to reach Level ${players[userId].level + 1}.\n` +
                             `Current EXP: ${players[userId].exp.toLocaleString()}`,
                    ephemeral: true
                });
            }
            
            // TYPE COERCION: Ensure numeric addition
            player.health = Number(player.health) + cumulativeHealthGain;
            player.power = Number(player.power) + cumulativePowerGain;
            player.defense = Number(player.defense) + cumulativeDefenseGain;
        }

        // Save stats as backup in players.json
        players[userId].backup = {
            health: player.health,
            power: player.power,
            defense: player.defense,
            chakra: player.chakra
        };
        // Save changes
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

        // Prepare the embed
        const levelUpEmbed = new EmbedBuilder()
            .setColor('#FF9800') // Orange color for level up
            .setTitle(`⬆️ Level Up! Ninja ${interaction.user.username} Reached Level ${players[userId].level}!`)
            .setDescription(`Congratulations, **${interaction.user.username}**! You've become stronger by reaching a new level!`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '__EXP & Level Progress__',
                    value: `**Levels Gained:** ${originalStats.level} ➡️ ${players[userId].level} (Total: ${levelsGained})\n` +
                           `**EXP Consumed:** ${totalExpConsumed.toLocaleString()} EXP\n` +
                           `**Remaining EXP:** ${players[userId].exp.toLocaleString()} EXP`,
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
                    value: `To reach Level ${players[userId].level + 1}, you will need **${getExpRequirement(players[userId].level).toLocaleString()} EXP**.`,
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