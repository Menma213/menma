const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const altJutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json'); // fallback if named differently

// IDs of users allowed to use this command
const allowedUsers = ['961918563382362122', '835408109899219004']; // Replace 'user1' and 'user2' with actual user IDs

// --- Helper: safe JSON read/write to avoid crashes on malformed/missing files ---
function safeReadJson(filePath) {
	// Return {} if file missing or JSON invalid
	if (!fs.existsSync(filePath)) return {};
	try {
		const text = fs.readFileSync(filePath, 'utf8') || '{}';
		return JSON.parse(text);
	} catch (err) {
		console.error(`Failed to read/parse JSON ${filePath}:`, err);
		return {};
	}
}
function safeWriteJson(filePath, data) {
	try {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	} catch (err) {
		console.error(`Failed to write JSON ${filePath}:`, err);
	}
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yeet')
        .setDescription('Deletes a user profile from the database.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user whose profile you want to delete.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const executorId = interaction.user.id;

        // Check if the executor is allowed to use this command
        if (!allowedUsers.includes(executorId)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('target');
        const userId = targetUser.id;

        try {
            // Load files safely
            let users = safeReadJson(usersPath);
            let players = safeReadJson(playersPath);
            let jutsus = safeReadJson(jutsusPath);
            let altJutsu = safeReadJson(altJutsuPath);

            // Track deletions
            const deletedParts = [];

            // Delete from users.json if present
            if (users && Object.prototype.hasOwnProperty.call(users, userId)) {
                delete users[userId];
                safeWriteJson(usersPath, users);
                deletedParts.push('users.json');
            }

            // Delete from players.json if present
            if (players && Object.prototype.hasOwnProperty.call(players, userId)) {
                delete players[userId];
                safeWriteJson(playersPath, players);
                deletedParts.push('players.json');
            }

            // Delete from jutsus.json if present
            if (jutsus && Object.prototype.hasOwnProperty.call(jutsus, userId)) {
                delete jutsus[userId];
                safeWriteJson(jutsusPath, jutsus);
                deletedParts.push(path.basename(jutsusPath));
            }

            // Delete from fallback jutsu.json if present
            if (altJutsu && Object.prototype.hasOwnProperty.call(altJutsu, userId)) {
                delete altJutsu[userId];
                safeWriteJson(altJutsuPath, altJutsu);
                deletedParts.push(path.basename(altJutsuPath));
            }

            // Respond according to what was removed
            if (deletedParts.length === 0) {
                await interaction.reply({
                    content: `ℹ️ No data found for <@${userId}> in users.json, players.json, jutsus.json or jutsu.json.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `✅ Deleted data for <@${userId}> from: ${deletedParts.join(', ')}.`,
                    ephemeral: false
                });
            }
        } catch (err) {
            console.error('Error in /yeet command:', err);
            await interaction.reply({
                content: `❌ An error occurred while attempting to delete data for <@${userId}>.`,
                ephemeral: true
            });
        }
    }
};
