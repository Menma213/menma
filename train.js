const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('train')
        .setDescription('Train to increase your stats (Costs 1,000 Ryo)'),
    
    async execute(interaction) {
        const userId = interaction.user.id;

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply("You haven't enrolled yet! Use `/enroll` to start.");
        }

        let player = users[userId];

        if (player.money < 1000) {
            return interaction.reply("You don't have enough Ryo to train! You need at least **1,000 Ryo**.");
        }

        // Deduct training cost
        player.money -= 1000;

        // Scale stat gains based on level
        let levelMultiplier = player.level * 0.1; // Increases gains as level rises
        player.exp += 100 + Math.floor(50 * levelMultiplier);
        player.level += 1;
        player.power += Math.floor(10 * levelMultiplier);
        player.defense += Math.floor(8 * levelMultiplier);
        player.chakra += Math.floor(5 * levelMultiplier);

        fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

        interaction.reply(`You trained hard and leveled up!  
- **Level:** ${player.level}  
- **EXP:** ${player.exp}  
- **Power:** +${Math.floor(10 * levelMultiplier)}  
- **Defense:** +${Math.floor(8 * levelMultiplier)}  
- **Chakra:** +${Math.floor(5 * levelMultiplier)}  
- **Remaining Money:** ${player.money} Ryo`);
    }
};
