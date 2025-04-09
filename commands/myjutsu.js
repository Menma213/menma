const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myjutsu')
        .setDescription('Display your learned jutsu and current loadout'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        const jutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
        const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const jutsuData = JSON.parse(fs.readFileSync(jutsuPath, 'utf8'));
        const allJutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ 
                content: 'You need to enroll first!', 
                ephemeral: true 
            });
        }

        // Get equipped jutsu from slots
        const equippedJutsu = users[userId].jutsu || {
            slot_1: 'None',
            slot_2: 'None',
            slot_3: 'None',
            slot_4: 'None',
            slot_5: 'None'
        };

        // Get all learned jutsu
        const learnedJutsu = jutsuData[userId]?.usersjutsu || [];

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Jutsu`)
            .setColor('#0099ff')
            .setThumbnail(interaction.user.displayAvatarURL());

        // Add equipped jutsu field
        const slotsField = Object.entries(equippedJutsu)
            .map(([slot, jutsu]) => {
                const slotNum = slot.split('_')[1];
                const jutsuInfo = learnedJutsu.find(j => j.name === jutsu);
                const cost = jutsuInfo ? ` (${jutsuInfo.chakraCost} Chakra)` : '';
                return `**Slot ${slotNum}:** ${jutsu}${cost}`;
            })
            .join('\n');
        
        embed.addFields({ name: 'Equipped Jutsu', value: slotsField || 'No jutsu equipped!' });

        // Add learned jutsu field
        if (learnedJutsu.length > 0) {
            const jutsuList = learnedJutsu
                .map(j => `• ${j.name} - ${j.description}`)
                .join('\n');
            embed.addFields({ name: 'Learned Jutsu', value: jutsuList });
        } else {
            embed.addFields({ name: 'Learned Jutsu', value: 'No jutsu learned yet!' });
        }

        await interaction.reply({ embeds: [embed] });
    }
};