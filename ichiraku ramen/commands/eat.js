const { EmbedBuilder, SlashCommandBuilder } = require('discord.js'); // Add SlashCommandBuilder
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eat')
    .setDescription('Buy bowls using your Ramen Coupons.')
    .addStringOption(option =>
      option.setName('bowl')
        .setDescription('Type of bowl: beef, fish, or veggie')
        .setRequired(true)
        .addChoices(
          { name: 'Beef', value: 'beef' },
          { name: 'Fish', value: 'fish' },
          { name: 'Veggie', value: 'veggie' }
        )
    )
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Quantity to buy')
        .setRequired(false)
    ),
  name: 'eat', // Command name
  description: 'Buy bowls using your Ramen Coupons.', // Command description
  async execute(interactionOrMessage, args) {
    // Load users.json
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Get the user's data
    let userId = interactionOrMessage.user.id;
    let user = users[userId] || { ramen: 0, power: 0, defense: 0, health: 0 }; // Default values if user doesn't exist

    // Support both message and interaction
    let bowlType, quantity;
    if (interactionOrMessage.options) {
      // Slash command
      bowlType = interactionOrMessage.options.getString('bowl');
      quantity = interactionOrMessage.options.getInteger('quantity') || 1;
    } else {
      // Prefix command
      bowlType = args[0] ? args[0].toLowerCase() : null;
      quantity = args[1] ? parseInt(args[1]) : 1;
    }

    // Check if the bowl type is valid
    const bowls = {
      beef: { power: 15, cost: 1 },
      fish: { defense: 15, cost: 1 },
      veggie: { health: 100, cost: 1 },
    };

    if (!bowls[bowlType]) {
      if (interactionOrMessage.reply) {
        return interactionOrMessage.reply({ content: 'Invalid bowl type. Use `/eat bowl:<beef|fish|veggie>`.', ephemeral: true });
      } else {
        return interactionOrMessage.channel.send('Invalid bowl type. Use `%eat beef`, `%eat fish`, or `%eat veggie`.');
      }
    }

    // Calculate total cost
    const totalCost = bowls[bowlType].cost * quantity;

    // Check if the user has enough Ramen Coupons
    if (user.ramen < totalCost) {
      if (interactionOrMessage.reply) {
        return interactionOrMessage.reply({ content: `You don't have enough Ramen Coupons to buy ${quantity} ${bowlType} bowl(s).`, ephemeral: true });
      } else {
        return interactionOrMessage.channel.send(`You don't have enough Ramen Coupons to buy ${quantity} ${bowlType} bowl(s).`);
      }
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
    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply({ embeds: [embed], ephemeral: false });
    } else {
      await interactionOrMessage.channel.send({ embeds: [embed] });
    }
  },
};