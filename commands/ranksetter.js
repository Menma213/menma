const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const USERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/users.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranksetter')
        .setDescription('Temporarily set your rank to Genin, Chuunin, or Jounin.')
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('Choose your rank')
                .setRequired(true)
                .addChoices(
                    { name: 'Genin', value: 'Genin' },
                    { name: 'Chuunin', value: 'Chuunin' },
                    { name: 'Jounin', value: 'Jounin' }
                )
        ),
    async execute(interaction) {
        const userId = interaction.user.id;
        const chosenRank = interaction.options.getString('rank');
        let usersData = {};

        if (fs.existsSync(USERS_FILE_PATH)) {
            usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf8'));
        }

        if (!usersData[userId]) {
            usersData[userId] = {};
        }

        usersData[userId].rank = chosenRank;

        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(usersData, null, 2));

        await interaction.reply({
            content: `Your rank has been set to **${chosenRank}**.`,
            ephemeral: true
        });
    }
};
