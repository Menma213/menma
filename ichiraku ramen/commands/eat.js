const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder for discord.js v14+
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'eat', // Command name
  description: 'Buy bowls using your Ramen Coupons.', // Command description
  async execute(message, args) {
    // Load users.json
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Get the user's data
    const userId = message.author.id;
    const user = users[userId] || { ramen: 0, power: 0, defense: 0, health: 0 }; // Default values if user doesn't exist

    // Check if the user provided a bowl type
    if (!args[0]) {
      return message.channel.send('Please specify a bowl type: `%eat beef <quantity>`, `%eat fish <quantity>`, or `%eat veggie <quantity>`.');
    }

    const bowlType = args[0].toLowerCase(); // Get the bowl type (beef, fish, or veggie)
    const quantity = args[1] ? parseInt(args[1]) : 1; // Get the quantity (default to 1 if not provided)

    // Check if the quantity is valid
    if (isNaN(quantity) || quantity < 1) {
      return message.channel.send('Please provide a valid quantity (e.g., `%eat beef 3`).');
    }

    // Define bowl stats and costs
    const bowls = {
      beef: { power: 15, cost: 1 },
      fish: { defense: 15, cost: 1 },
      veggie: { health: 100, cost: 1 },
    };

    // Check if the bowl type is valid
    if (!bowls[bowlType]) {
      return message.channel.send('Invalid bowl type. Use `%eat beef`, `%eat fish`, or `%eat veggie`.');
    }

    // Calculate total cost
    const totalCost = bowls[bowlType].cost * quantity;

    // Check if the user has enough Ramen Coupons
    if (user.ramen < totalCost) {
      return message.channel.send(`You don't have enough Ramen Coupons to buy ${quantity} ${bowlType} bowl(s).`);
    }

    // Deduct the cost and update user stats
    user.ramen -= totalCost;
    if (bowls[bowlType].power) user.power += bowls[bowlType].power * quantity;
    if (bowls[bowlType].defense) user.defense += bowls[bowlType].defense * quantity;
    if (bowls[bowlType].health) user.health += bowls[bowlType].health * quantity;

    // Save the updated user data
    users[userId] = user;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('Ramen Shop')
      .setDescription(`You bought ${quantity} ${bowlType.charAt(0).toUpperCase() + bowlType.slice(1)} Bowl(s) for ${totalCost} Ramen Coupon(s) 🍜`)
      .addFields(
        { name: 'Stats Increased:', value: `+${bowls[bowlType].power * quantity || bowls[bowlType].defense * quantity || bowls[bowlType].health * quantity} ${bowls[bowlType].power ? 'Power' : bowls[bowlType].defense ? 'Defense' : 'Health'}!`, inline: false }
      )
      .setColor('#006400'); // Green color for the embed

    // Send the embed
    await message.channel.send({ embeds: [embed] });
  },
};