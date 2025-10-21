const { SlashCommandBuilder, ActivityType } = require('discord.js');

// !!! IMPORTANT: REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL DISCORD USER ID !!!
// This ID is the ONLY one allowed to execute this command.
const ADMIN_USER_ID = '835408109899219004';

module.exports = {
    // Define the slash command using the name 'setbotstatus' for clarity and function.
    data: new SlashCommandBuilder()
        .setName('setbotstatus')
        .setDescription('ADMIN ONLY: Sets the custom status/presence for the bot.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of activity (e.g., Playing, Watching, Listening).')
                .setRequired(true)
                // Discord.js uses numeric values for ActivityType, so we map the names to those values.
                .addChoices(
                    { name: 'Playing', value: String(ActivityType.Playing) },
                    { name: 'Watching', value: String(ActivityType.Watching) },
                    { name: 'Listening', value: String(ActivityType.Listening) },
                    { name: 'Competing', value: String(ActivityType.Competing) },
                    { name: 'Currently', value: String(ActivityType.Custom) }
                ))
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text of the custom status (e.g., "with 10,000 users").')
                .setRequired(true)),

    async execute(interaction) {
        // --- 1. Admin ID Check ---
        // Verify that the user executing the command is the defined ADMIN_USER_ID.
        if (interaction.user.id !== ADMIN_USER_ID) {
            // Log unauthorized access attempt to console for security
            console.log(`Unauthorized attempt to use setbotstatus by user: ${interaction.user.tag} (${interaction.user.id})`);
            return interaction.reply({
                content: ' **Permission Denied:** This command is restricted to the bot owner only.',
                ephemeral: true // Ensures only the user who ran the command sees the error
            });
        }

        // Defer reply so the bot has time to process the status change
        await interaction.deferReply({ ephemeral: true });

        // --- 2. Get Options ---
        // Get the activity type (converted to an integer) and the status text.
        const activityType = parseInt(interaction.options.getString('type'), 10);
        const activityText = interaction.options.getString('text');

        // Map ActivityType integer back to its name for reply
        let typeName = 'Unknown';
        switch (activityType) {
            case ActivityType.Playing: typeName = 'Playing'; break;
            case ActivityType.Watching: typeName = 'Watching'; break;
            case ActivityType.Listening: typeName = 'Listening'; break;
            case ActivityType.Competing: typeName = 'Competing'; break;
            case ActivityType.Custom: typeName = 'Currently'; break;
        }


        // --- 3. Set Bot Presence ---
        try {
            // Set the bot's presence (status and activity)
            await interaction.client.user.setActivity(activityText, { type: activityType });

            await interaction.editReply({
                content: `Bot status successfully updated to: **${typeName} ${activityText}**`
            });
        } catch (error) {
            console.error('Failed to set bot status:', error);
            await interaction.editReply({
                content: 'An error occurred while trying to set the bot\'s status. Check console logs for error details.'
            });
        }
    },
};
