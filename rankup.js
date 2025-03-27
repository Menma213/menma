const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankup')
        .setDescription('Rank up to the next ninja rank if you have enough wins!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Check if the user exists in the database
        if (!users[userId]) {
            return interaction.reply({ content: "❌ You are not enrolled. Use `/enroll` to start your journey.", ephemeral: true });
        }

        let player = users[userId];
        const currentRank = player.rank;
        const currentWins = player.wins;

        // Define the win thresholds for each rank
        const rankThresholds = {
            'Academy Student': 0,
            'Genin': 10,
            'Chuunin': 25,
            'Special Jounin': 50,
            'Jounin': 100
        };

        // Check if the player is already at the highest rank
        if (currentRank === 'Jounin') {
            return interaction.reply({ content: "🏆 You are already a Jounin! No further rankups available.", ephemeral: true });
        }

        // Determine the next rank and its threshold
        const rankKeys = Object.keys(rankThresholds);
        const currentRankIndex = rankKeys.indexOf(currentRank);
        const nextRank = rankKeys[currentRankIndex + 1];
        const nextRankThreshold = rankThresholds[nextRank];

        // Check if the user has enough wins for the next rank
        if (currentWins >= nextRankThreshold) {
            // Rank up the user
            player.rank = nextRank;
            fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

            const rankupEmbed = new EmbedBuilder()
                .setColor(0x4B0082)
                .setTitle(`🎉 Congratulations! You've Ranked Up! 🎉`)
                .setDescription(`You have successfully ranked up to **${nextRank}**! Your hard work and victories have paid off!`)
                .addFields(
                    { name: 'Current Rank', value: currentRank, inline: true },
                    { name: 'New Rank', value: nextRank, inline: true },
                    { name: 'Total Wins', value: currentWins.toString(), inline: true }
                )
                .setFooter({ text: `Keep winning to reach even greater heights!` });

            return interaction.reply({ embeds: [rankupEmbed] });
        } else {
            // Not enough wins for rank up
            const remainingWins = nextRankThreshold - currentWins;
            const rankupEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`❌ You Don't Have Enough Wins to Rank Up! ❌`)
                .setDescription(`You need **${remainingWins} more wins** to rank up to **${nextRank}**.`)
                .addFields(
                    { name: 'Current Rank', value: currentRank, inline: true },
                    { name: 'Total Wins', value: currentWins.toString(), inline: true }
                )
                .setFooter({ text: `Keep fighting and winning to reach the next rank!` });

            return interaction.reply({ embeds: [rankupEmbed] });
        }
    }
};
