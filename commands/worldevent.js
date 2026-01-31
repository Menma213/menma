const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const worldEventPath = path.resolve(__dirname, '../data/worldEvent.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('worldevent')
        .setDescription('Manage global world events (Owner Only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the world event message and enable it')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to display')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable the world event')),
    async execute(interaction) {
        if (interaction.user.id !== '835408109899219004') {
            return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const message = interaction.options.getString('message');
            const eventData = {
                active: true,
                message: message
            };
            fs.writeFileSync(worldEventPath, JSON.stringify(eventData, null, 2));
            await interaction.reply({ content: `World event set: "${message}"\nRunBattle interactions will now display this message.`, ephemeral: true });
        } else if (subcommand === 'disable') {
            const eventData = {
                active: false,
                message: ""
            };
            fs.writeFileSync(worldEventPath, JSON.stringify(eventData, null, 2));
            await interaction.reply({ content: 'World event disabled. Battles can resume.', ephemeral: true });
        }
    },
};
