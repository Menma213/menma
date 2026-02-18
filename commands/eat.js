const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { userMutex } = require('../utils/locks');

// Define the Channel ID where the command is allowed
const ICHIRAKU_RAMEN_CHANNEL_ID = '1381269932427317339';

const playersPath = path.resolve(__dirname, '../data/players.json');
const usersPath = path.resolve(__dirname, '../data/users.json');

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
    name: 'eat',
    description: 'Buy bowls using your Ramen Coupons.',
    async execute(interactionOrMessage, args) {
        const isSlashCommand = interactionOrMessage.isCommand?.();

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

        let userId = isSlashCommand ? interactionOrMessage.user.id : interactionOrMessage.author.id;

        let bowlType, quantity;
        if (isSlashCommand) {
            bowlType = interactionOrMessage.options.getString('bowl');
            quantity = interactionOrMessage.options.getInteger('quantity') || 1;
        } else {
            bowlType = args[0] ? args[0].toLowerCase() : null;
            quantity = args[1] ? parseInt(args[1]) : 1;
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            const invalidQuantityMessage = 'Quantity must be a positive integer (1 or greater).';
            if (isSlashCommand) {
                return interactionOrMessage.reply({ content: invalidQuantityMessage, ephemeral: true });
            } else {
                return interactionOrMessage.channel.send(invalidQuantityMessage);
            }
        }

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

        const totalCost = bowls[bowlType].cost * quantity;

        try {
            if (isSlashCommand) await interactionOrMessage.deferReply();

            let result = await userMutex.runExclusive(async () => {
                const playersData = JSON.parse(await fs.readFile(playersPath, 'utf8').catch(() => "{}"));
                const usersData = JSON.parse(await fs.readFile(usersPath, 'utf8').catch(() => "{}"));

                if (!playersData[userId]) playersData[userId] = {};
                if (!usersData[userId]) usersData[userId] = { ramen: 0, power: 0, defense: 0, health: 0 };

                let ramenCoupons = Number(playersData[userId].ramen) || 0;

                if (ramenCoupons < totalCost) {
                    return { success: false, message: `You don't have enough Ramen Coupons to buy ${quantity} ${bowlType} bowl(s).` };
                }

                // Deduct from players.json
                playersData[userId].ramen = ramenCoupons - totalCost;

                // Update users.json
                let user = usersData[userId];
                user.ramen = (Number(user.ramen) || 0) - totalCost;
                if (bowls[bowlType].power) user.power = (Number(user.power) || 0) + bowls[bowlType].power * quantity;
                if (bowls[bowlType].defense) user.defense = (Number(user.defense) || 0) + bowls[bowlType].defense * quantity;
                if (bowls[bowlType].health) user.health = (Number(user.health) || 0) + bowls[bowlType].health * quantity;

                await fs.writeFile(playersPath, JSON.stringify(playersData, null, 2));
                await fs.writeFile(usersPath, JSON.stringify(usersData, null, 2));

                return { success: true };
            });

            if (!result.success) {
                if (isSlashCommand) {
                    return interactionOrMessage.editReply({ content: result.message });
                } else {
                    return interactionOrMessage.channel.send(result.message);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('Ramen Shop')
                .setDescription(`You bought ${quantity} ${bowlType.charAt(0).toUpperCase() + bowlType.slice(1)} Bowl(s) for ${totalCost} Ramen Coupon(s) 🍜`)
                .addFields(
                    { name: 'Stats Increased:', value: `+${bowls[bowlType].power * quantity || bowls[bowlType].defense * quantity || bowls[bowlType].health * quantity} ${bowls[bowlType].power ? 'Power' : bowls[bowlType].defense ? 'Defense' : 'Health'}!`, inline: false }
                )
                .setColor('#006400');

            if (isSlashCommand) {
                await interactionOrMessage.editReply({ embeds: [embed] });
            } else {
                await interactionOrMessage.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error("Error in eat command:", error);
            const errorMessage = "An error occurred while processing your request.";
            if (isSlashCommand) {
                if (interactionOrMessage.deferred) {
                    await interactionOrMessage.editReply({ content: errorMessage });
                } else {
                    await interactionOrMessage.reply({ content: errorMessage, ephemeral: true });
                }
            } else {
                await interactionOrMessage.channel.send(errorMessage);
            }
        }
    },
};