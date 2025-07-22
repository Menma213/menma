const { EmbedBuilder, SlashCommandBuilder } = require('discord.js'); // Add SlashCommandBuilder
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim your daily Ramen Coupon.'),
  name: 'claim', // Command name
  description: 'Claim your daily Ramen Coupon.', // Command description
  async execute(interactionOrMessage, args) {
    // Support both message and interaction
    const userId = interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
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
      if (interactionOrMessage.reply) {
        return interactionOrMessage.reply({ content: `You can claim your next Ramen Coupon in **${hours} hours and ${minutes} minutes**.`, ephemeral: true });
      } else {
        return interactionOrMessage.reply(`You can claim your next Ramen Coupon in **${hours} hours and ${minutes} minutes**.`);
      }
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
    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply({ embeds: [embed], ephemeral: false });
    } else {
      await interactionOrMessage.channel.send({ embeds: [embed] });
    }
  },
};