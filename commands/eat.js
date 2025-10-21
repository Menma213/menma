const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Define the Channel ID where the command is allowed
// IMPORTANT: Replace 'YOUR_ICHIRAKU_RAMEN_CHANNEL_ID_HERE' with the actual ID of your Ichiraku Ramen channel!
const ICHIRAKU_RAMEN_CHANNEL_ID = '1381269932427317339'; 

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
    name: 'eat', // Command name (for legacy handler)
    description: 'Buy bowls using your Ramen Coupons.', // Command description (for legacy handler)
    async execute(interactionOrMessage, args) {
        // Determine if it's a Slash Command Interaction or a Message
        const isSlashCommand = interactionOrMessage.isCommand?.(); 

        // --- Channel ID Check ---
        // Ensure it's a guild channel before checking ID
        if (!interactionOrMessage.guild) {
            const dmMessage = "This command can only be used in a server channel.";
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: dmMessage, ephemeral: true });
            } else {
                return interactionOrMessage.reply(dmMessage);
            }
        }

        const channelId = interactionOrMessage.channel.id;
        if (channelId !== ICHIRAKU_RAMEN_CHANNEL_ID) {
            const forbiddenChannelMessage = "This command can only be used in Ichiraku Ramen!";
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: forbiddenChannelMessage, ephemeral: true });
            } else {
                return interactionOrMessage.reply(forbiddenChannelMessage);
            }
        }
        // --- End Channel ID Check ---

        // Get the user's ID
        let userId = interactionOrMessage.user.id;

        // Load players.json for ramen deduction
        const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
        let players = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : {};
        if (!players[userId]) players[userId] = {};
        // Use ramen from players.json
        let ramenCoupons = Number(players[userId].ramen) || 0;

        // Load users.json
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        
        // Ensure users.json exists, if not, create it
        if (!fs.existsSync(usersPath)) {
            fs.writeFileSync(usersPath, JSON.stringify({}, null, 2));
        }

        let users;
        try {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        } catch (error) {
            console.error("Error reading or parsing users.json:", error);
            const errorMessage = "An error occurred while reading user data. Please try again later.";
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: errorMessage, ephemeral: true });
            } else {
                return interactionOrMessage.reply(errorMessage);
            }
        }

        // Get the user's data
        let user = users[userId] || { ramen: 0, power: 0, defense: 0, health: 0 }; // Default values if user doesn't exist

        let bowlType, quantity;
        if (isSlashCommand) { // Use isSlashCommand for clarity
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
            veggie: { health: 10, cost: 1 },
        };

        if (!bowls[bowlType]) {
            const invalidBowlMessage = isSlashCommand 
                ? 'Invalid bowl type. Use `/eat bowl:<beef|fish|veggie>`.'
                : 'Invalid bowl type. Use `%eat beef`, `%eat fish`, or `%eat veggie`.';
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: invalidBowlMessage, ephemeral: true });
            } else {
                return interactionOrMessage.channel.send(invalidBowlMessage);
            }
        }

        // Calculate total cost
        const totalCost = bowls[bowlType].cost * quantity;

        // Check if the user has enough Ramen Coupons
        if (ramenCoupons < totalCost) {
            const insufficientRamenMessage = `You don't have enough Ramen Coupons to buy ${quantity} ${bowlType} bowl(s).`;
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: insufficientRamenMessage, ephemeral: true });
            } else {
                return interactionOrMessage.channel.send(insufficientRamenMessage);
            }
        }

        // Deduct the cost from players.json
        players[userId].ramen = ramenCoupons - totalCost;
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

        // Update user stats in users.json
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
        if (isSlashCommand) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: false });
        } else {
            await interactionOrMessage.channel.send({ embeds: [embed] });
        }
    },
};