const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder for discord.js v14+
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'claim', // Command name
  description: 'Claim your daily Ramen Coupon.', // Command description
  async execute(message, args) {
    // Load users.json
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Get the user's data
    const userId = message.author.id;
    const user = users[userId] || { ramen: 0, lastClaim: null, nextClaim: null }; // Default values if user doesn't exist

    // Check if the user is on cooldown
    const now = new Date();
    const nextClaim = user.nextClaim ? new Date(user.nextClaim) : null;

    if (nextClaim && now < nextClaim) {
      // Calculate remaining cooldown time
      const remainingTime = nextClaim - now;
      const hours = Math.floor(remainingTime / (60 * 60 * 1000));
      const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));

      // Send cooldown message
      return message.reply(`You can claim your next Ramen Coupon in **${hours} hours and ${minutes} minutes**.`);
    }

    // Update user's data
    user.ramen = (user.ramen || 0) + 1; // Add 1 Ramen Coupon
    user.lastClaim = now.toISOString(); // Set the last claim time
    user.nextClaim = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Set the next claim time (24 hours later)

    // Save the updated user data
    users[userId] = user;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('Claim!')
      .setDescription('You claimed `1 Ramen Coupon!` 🍜')
      .setColor('#006400'); // Dark green color for the embed

    // Send the embed
    await message.channel.send({ embeds: [embed] });
  },
};