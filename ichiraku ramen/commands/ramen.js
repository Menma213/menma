const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder for discord.js v14+
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ramen', // Command name for prefix
  description: 'Displays the ramen menu and your available coupons.', // Optional description
  async execute(message, args) { // Prefix command handler
    // Load users.json
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Get the user's data
    const userId = message.author.id;
    const user = users[userId] || { ramen: 0 }; // Default to 0 if user doesn't exist

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('Menu')
      .setDescription('Commands are:\n`%eat beef 1`\n`%eat veggie 1`\n`%eat fish 1`')
      .addFields(
        // Bowls side by side
        { name: 'Beef Bowl', value: '+15 Power', inline: true },
        { name: 'Veggie Bowl', value: '+100 Health', inline: true },
        { name: 'Fish Bowl', value: '+15 Defense', inline: true },
        // Ramen Coupons below the bowls
        { name: '`1 Ramen Coupon`', value: '', inline: true },
        { name: '`1 Ramen Coupon`', value: '', inline: true },
        { name: '`1 Ramen Coupon`', value: '', inline: true },


        // User's coupons and claim reminder
        { name: 'Your coupons:', value: `${user.ramen}`, inline: false },
        { name: 'Claim a coupon daily with:', value: '`%claim!`', inline: false }
      )
      .setThumbnail('https://cdn.discordapp.com/attachments/1351292647343394920/1351294108173602980/90d0fb1ebf720644654bddbbe90972bb.png?ex=67d9da35&is=67d888b5&hm=616bea0c8b6d4b209f081d69cbe34c62d1826fb89d980c40083de1f7574ae758&')
      .setColor('#006400'); // Dark green color for the embed

    // Send the embed
    await message.channel.send({ embeds: [embed] });
  },
};