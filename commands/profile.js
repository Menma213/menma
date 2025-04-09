const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your ninja profile'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;

            // Ensure necessary data files exist
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }
            if (!fs.existsSync(dataPath)) {
                fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
            }

            let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

            // Check if the user is enrolled
            if (!users[userId]) {
                return interaction.reply({ 
                    content: "You haven't enrolled yet! Use `/enroll` to start.", 
                    ephemeral: true 
                });
            }

            const user = users[userId];

            // Default values for missing attributes
            const profile = {
                level: user.level || 1,
                exp: user.exp || 0,
                wins: user.wins || 0,
                losses: user.losses || 0,
                rankedPoints: user.rankedPoints || 0,
                clan: user.clan || 'None',
                bloodline: user.bloodline || 'Unknown',
                mentor: user.mentor || 'None',
                rank: user.rank || 'Genin',
                health: user.health || 100,
                power: user.power || 10,
                defense: user.defense || 10,
                chakra: user.chakra || 10,
                jutsu: user.jutsu || [],
                money: user.money || 0,
                ramen: user.ramen || 0
            };

            // Avatar image
            const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

            // Profile embed (structured for sleekness and readability)
            const profileEmbed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle(`Ninja Card: ${interaction.user.username}`)
                .setThumbnail(avatarUrl)
                .setDescription(
                    `**Level:** **${profile.level}**\n` +
                    `**EXP:** **${profile.exp}**\n\n` +
                    `**Record:**\n` +
                    `Wins: **${profile.wins}**\n` +
                    `Losses: **${profile.losses}**\n` +
                    `Ranked Points: **${profile.rankedPoints}**\n\n` +
                    `**Clan:** ${profile.clan}  **| Bloodline:** ${profile.bloodline}  **| Mentor:** ${profile.mentor}\n\n` +
                    `**Rank:** **${profile.rank}**\n\n` +
                    `**Battle Stats:**\n` +
                    `Health: **${profile.health}**\n` +
                    `Power: **${profile.power}**\n` +
                    `Defense: **${profile.defense}**\n` +
                    `Chakra: **${profile.chakra}**\n\n` +
                    `**Jutsu:**\n${profile.jutsu.length > 0 ? profile.jutsu.join('\n') : 'None'}\n\n` +
                    `**Inventory**\n` +
                    `Ramen Coupons: **${profile.ramen}**\n\n` +
                    `**Your Money:** **${profile.money} Ryo**`
                )
                .setFooter({ text: "Train hard and become the strongest shinobi!" });

            await interaction.reply({ embeds: [profileEmbed] });

        } catch (error) {
            console.error('Error executing /profile:', error);
            return interaction.reply({ 
                content: "An error occurred while retrieving your profile. Please try again later.", 
                ephemeral: true
            });
        }
    }
};