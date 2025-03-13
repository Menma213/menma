const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your ninja profile'),
    
    async execute(interaction) {
        const userId = interaction.user.id;

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply("You haven't enrolled yet! Use `/enroll` to start.");
        }

        const user = users[userId];

        const profileEmbed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle(`Ninja Card: ${interaction.user.username}`)
            .addFields(
                { name: 'Level', value: `${user.level}`, inline: true },
                { name: 'EXP', value: `${user.exp}`, inline: true },
                { name: 'Record', value: ` Wins: ${user.wins} |  Losses: ${user.losses}`, inline: false },
                { name: 'Clan', value: user.clan || 'None', inline: true },
                { name: 'Bloodline', value: user.bloodline || 'Unknown', inline: true },
                { name: 'Rank', value: user.rank || 'Genin', inline: true },
                { name: 'Stats', value: ` Health: ${user.health}\n Power: ${user.power}\n Defense: ${user.defense}\n Chakra: ${user.chakra}`, inline: false },
                { name: 'Jutsu', value: user.jutsu.length > 0 ? user.jutsu.join(', ') : 'None', inline: false },
                { name: 'Money', value: ` **${user.money} Ryo**`, inline: false },
                { name: 'Inventory', value: ` Ramen Coupons: ${user.ramen || 0}`, inline: false }
            );

        await interaction.reply({ embeds: [profileEmbed] });
    }
};
