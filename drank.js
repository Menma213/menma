const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drank')
        .setDescription('Complete a simple D-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Ensure the data file exists
        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Check if the user is enrolled
        if (!users[userId]) {
            return interaction.reply({ content: "❌ You haven't enrolled yet! Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];

        // Random D-Rank mission messages
        const tasks = [
            "washed some windows.",
            "helped an elderly villager carry groceries.",
            "caught a runaway cat for a villager.",
            "delivered messages across the village.",
            "watered the training grounds."
        ];
        let taskMessage = tasks[Math.floor(Math.random() * tasks.length)];

        // Rewards scale with level
        let expReward = 100 + Math.floor(player.level * 20);
        let moneyReward = 200 + Math.floor(player.level * 10);

        player.exp += expReward;
        player.money += moneyReward;

        fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

        // Construct the exact output
        const response = `**KonohaRPG**\n` +
            `*D-rank Mission*\n\n` +
            `<@${userId}> ${taskMessage}\n` +
            `<@${userId}> have earned **${expReward.toLocaleString()} EXP** and **$${moneyReward.toLocaleString()}**\n\n` +
            `🔹 Use **/train** to level up!`;

        // Send the response
        await interaction.reply({
            content: response,
            ephemeral: false
        });
    }
};
