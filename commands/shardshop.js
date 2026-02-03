// --- NEW COMMAND FOR SECRET SHOP (SSSHOP) ---
// This command will be used to manually trigger the secret shop and its cooldown.
// It should only be usable by administrators.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shardshop')
        .setDescription('Manually triggers the secret shop and starts its cooldown.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can use this command

    async execute(interaction) {
        // Ensure the command is run in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
            return;
        }

        // Check if the command is used in the main server
        if (interaction.guildId !== '1381268582595297321') {
            return interaction.reply({ content: 'This command can only be used in the main server.', ephemeral: true });
        }

        // Defer early to avoid "Unknown interaction" if processing takes >3s
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (err) {
            // ignore defer errors; we'll try to reply later via channel fallback
        }

        // helper to safely reply/edit or fallback to channel.send if interaction token is invalid
        async function safeReply(content, opts = {}) {
            const message = { content, ...opts };
            try {
                if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(message);
                } else {
                    return await interaction.reply(message);
                }
            } catch (err) {
                // If interaction is unknown (10062), fallback to channel.send
                if (err?.code === 10062 && interaction.channel) {
                    try { return await interaction.channel.send(message); } catch (inner) { console.error('Fallback send failed:', inner); }
                }
                // rethrow for logging if other errors
                throw err;
            }
        }
        const tradeModule = require('./trade'); // Assuming 'trade.js' is in the same directory

        // Call the spawnThunderbird function (pass guild & channel so it activates where the command was used)
        let spawned;
        try {
            spawned = await tradeModule.spawnThunderbird(interaction.client, interaction.guild.id, interaction.channel.id);
        } catch (err) {
            console.error('Error during spawnThunderbird:', err);
            return safeReply("There was an error executing this command!");
        }

        if (spawned) {
            return safeReply("The secret shop has been activated and a 24-hour cooldown has started!");
        }

        // Check if it's just on cooldown
        const status = tradeModule.getThunderbirdStatus(interaction.guild.id);
        if (status.active) {
            return safeReply("The secret shop is already active!");
        } else if (status.timeUntilNext > 0) {
            const cooldownMinutes = Math.ceil(status.timeUntilNext / (1000 * 60));
            const cooldownHours = Math.floor(cooldownMinutes / 60);
            const remainingMinutes = cooldownMinutes % 60;
            let cooldownMessage = "The secret shop is currently on cooldown.";
            if (cooldownHours > 0) {
                cooldownMessage += ` It will be available in approximately ${cooldownHours} hour${cooldownHours > 1 ? 's' : ''}`;
                if (remainingMinutes > 0) {
                    cooldownMessage += ` and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`;
                } else {
                    cooldownMessage += ".";
                }
            } else if (remainingMinutes > 0) {
                cooldownMessage += ` It will be available in approximately ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`;
            } else {
                cooldownMessage += " Please try again shortly.";
            }
            return safeReply(cooldownMessage);
        } else {
            return safeReply("Failed to activate the secret shop. Please check the console for errors.");
        }
    }
};