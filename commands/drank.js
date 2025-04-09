const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drank')
        .setDescription('Complete a simple D-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const userPfp = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

        // Ensure the data file exists
        if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Check if the user is enrolled
        if (!users[userId]) {
            return interaction.reply({ 
                content: "❌ **You haven't enrolled yet!** Use `/enroll` to start your journey.", 
                ephemeral: true 
            });
        }

        let player = users[userId];

        // Generate a random mission
        const tasks = [
            "washed all the windows in the Hokage’s office.",
            "helped an elderly villager carry groceries across the market.",
            "caught a runaway cat that had escaped from a shopkeeper.",
            "delivered important messages between village officials.",
            "watered the training grounds before a big Chunin exam test.",
            "helped repair a broken fence in the village outskirts.",
            "retrieved a lost kunai for a Genin in training.",
            "assisted in the academy by sparring with students.",
            "guided a lost child back home safely.",
            "cleaned up the streets after a festival."
        ];
        let taskMessage = tasks[Math.floor(Math.random() * tasks.length)];

        // Rewards scale with level
        let expReward = 100 + Math.floor(player.level * 25);
        let moneyReward = 200 + Math.floor(player.level * 15);

        player.exp += expReward;
        player.money += moneyReward;

        fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

        // Embed Message
        const embed = new EmbedBuilder()
            .setTitle("🛠️ **D-Rank Mission Completed!**")
            .setDescription(`**${username}** just completed a mission! 🎉\n`)
            .addFields(
                { name: "📜 **Task Completed**", value: `> *${taskMessage}*`, inline: false },
                { name: "🏅 **EXP Earned**", value: `+ **${expReward.toLocaleString()}** EXP`, inline: true },
                { name: "💰 **Ryo Earned**", value: `+ **$${moneyReward.toLocaleString()}**`, inline: true },
                { name: "🔹 **Next Steps**", value: "Use `/train` to level up and get stronger!" }
            )
            .setColor("Green")
            .setThumbnail(userPfp)
            .setFooter({ text: "KonohaRPG • D-Rank Missions", iconURL: "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg" })
            .setTimestamp();

        // Send response
        await interaction.reply({ embeds: [embed] });
    }
};