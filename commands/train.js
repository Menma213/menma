const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
// const { updateRequirements } = require('./scroll'); // Keep if still needed for other features

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Function to calculate EXP requirement for the next level
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2; // Should not happen if level is 1-indexed
    return 1.1 ** currentLevel; // Exp needed to reach (currentLevel + 1)
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelup')
        .setDescription('Attempt to level up your ninja skills with accumulated EXP.'),

    async execute(interaction) {
        await interaction.deferReply(); // Defer reply for processing

        const userId = interaction.user.id;

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

        const nextLevel = player.level + 1;
        const requiredExp = getExpRequirement(player.level); // Exp needed to reach 'nextLevel'

        // Check EXP requirement
        if (player.exp < requiredExp) {
            return interaction.editReply({
                content: `You need **${requiredExp.toLocaleString()} EXP** to reach Level ${nextLevel}.\n` +
                         `Current EXP: ${player.exp.toLocaleString()}`,
                ephemeral: true
            });
        }

        // Store original stats for comparison in embed
        const originalStats = {
            level: player.level,
            health: player.health,
            power: player.power,
            defense: player.defense,
            chakra: player.chakra
        };

        // Apply level up
        player.level += 1;
        player.exp -= requiredExp; // Deduct required EXP

        // Calculate stat gains
        const healthGain = Math.floor(Math.random() * 101) + 100; // 100-200
        const powerGain = Math.floor(Math.random() * 2) + 2;     // 2-3
        const defenseGain = Math.floor(Math.random() * 3) + 2;   // 2-4
       

        player.health += healthGain;
        player.power += powerGain;
        player.defense += defenseGain;
       

        // Save changes
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Prepare the embed
        const levelUpEmbed = new EmbedBuilder()
            .setColor('#FF9800') // Orange color for level up
            .setTitle(`⬆️ Level Up! Ninja ${interaction.user.username} Reached Level ${player.level}!`)
            .setDescription(`Congratulations, **${interaction.user.username}**! You've become stronger by reaching a new level.`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '__EXP & Level Progress__',
                    value: `**Level Gained:** ${originalStats.level} ➡️ ${player.level}\n` +
                           `**EXP Consumed:** ${requiredExp.toLocaleString()} EXP\n` +
                           `**Remaining EXP:** ${player.exp.toLocaleString()} EXP`,
                    inline: false
                },
                {
                    name: '__Stat Gains__',
                    value: `\`\`\`diff\n` +
                           `+ Health: +${healthGain} (${originalStats.health} -> ${player.health})\n` +
                           `+ Power:  +${powerGain} (${originalStats.power} -> ${player.power})\n` +
                           `+ Defense: +${defenseGain} (${originalStats.defense} -> ${player.defense})\n` +
                           
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