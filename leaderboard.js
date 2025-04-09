const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the top users by level.'),

  async execute(interaction) {
    // Load users.json
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Convert users to an array and sort by level (descending)
    const sortedUsers = Object.entries(users)
      .map(([id, user]) => ({ id, ...user }))
      .sort((a, b) => b.level - a.level);

    // Fetch usernames from Discord API
    const fetchedUsers = await Promise.all(
      sortedUsers.slice(0, 20).map(async (user) => {
        try {
          const discordUser = await interaction.client.users.fetch(user.id);
          return { ...user, username: discordUser.username };
        } catch (error) {
          return { ...user, username: 'Unknown User' };
        }
      })
    );

    // Create the leaderboard embed
    const embed = new EmbedBuilder()
      .setTitle('Leaderboard')
      .setColor('#0099ff') // Blue color
      .setThumbnail('https://agreeordie.com/wp-content/uploads/2014/08/hokage.jpg')
      .setFooter({ text: 'Page 1 / 2' });

    // Add top 20 users to the embed
let leaderboardText = '';
fetchedUsers.forEach((user, index) => {
  leaderboardText += `\`${index + 1}.\` ${user.username} | \`Lvl${user.level}\`\n`;
});

embed.addFields({
  name: 'Leaf\'s Elite:',
  value: leaderboardText,
  inline: false,
});

    // Send the embed
    await interaction.reply({ embeds: [embed] });
  },
};
