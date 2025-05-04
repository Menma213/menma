const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myjutsu')
        .setDescription('Display your learned jutsu and current loadout'),

    async execute(interaction) {
        const userId = interaction.user.id;
        // Define paths (ensure these are correct)
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        // Path to the file listing which jutsus users have learned
        const learnedJutsuListPath = path.resolve(__dirname, '../../menma/data/jutsu.json'); // Assuming this holds learned jutsus per user
        // Path to the master file with details of ALL jutsus
        const allJutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json'); // Master jutsu details

        // --- Load Data ---
        let users = {};
        let learnedJutsuData = {};
        let allJutsus = {};

        try {
            if (fs.existsSync(usersPath)) {
                users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            } else {
                console.error(`users.json not found at ${usersPath}`);
                // Reply directly if essential data is missing
                return interaction.reply({ content: 'Error: User data file not found.', ephemeral: true });
            }

            if (fs.existsSync(learnedJutsuListPath)) {
                learnedJutsuData = JSON.parse(fs.readFileSync(learnedJutsuListPath, 'utf8'));
            } else {
                console.warn(`jutsu.json (learned list) not found at ${learnedJutsuListPath}. Assuming no jutsus learned.`);
                // We can continue, just means users will have no learned jutsus listed from this file
            }

            if (fs.existsSync(allJutsusPath)) {
                allJutsus = JSON.parse(fs.readFileSync(allJutsusPath, 'utf8'));
            } else {
                 console.error(`jutsus.json (master details) not found at ${allJutsusPath}`);
                 return interaction.reply({ content: 'Error: Jutsu details file not found.', ephemeral: true });
            }

        } catch (error) {
            console.error("Error reading or parsing JSON data:", error);
            return interaction.reply({ content: 'Error accessing necessary data files.', ephemeral: true });
        }
        // --- End Load Data ---


        if (!users[userId]) {
            return interaction.reply({
                content: 'You need to enroll first! Use `/enroll`.', // Added hint
                ephemeral: true
            });
        }

        const equippedJutsuSlots = users[userId]?.jutsu || {};

        // --- CORRECTED LINE ---
        // Get the list of learned jutsu *keys* directly from the array
        const learnedJutsuKeys = learnedJutsuData[userId]?.usersjutsu || []; // No .map needed!
        // --- --- --- --- --- ---

        const slotsDescription = Object.entries(equippedJutsuSlots)
            .sort(([slotA], [slotB]) => parseInt(slotA.split('_')[1]) - parseInt(slotB.split('_')[1]))
            .map(([slot, jutsuKey]) => {
                // ... logic to look up jutsuKey in allJutsus ...
                 let jutsuDisplay = `*Empty*`;
                 let costDisplay = '';
                 if (jutsuKey && jutsuKey !== 'None') {
                    const jutsuDetails = allJutsus[jutsuKey];
                    if (jutsuDetails) {
                        jutsuDisplay = jutsuDetails.name ?? jutsuKey;
                        costDisplay = ` (${jutsuDetails.chakraCost ?? '?'} Chakra)`;
                    } else {
                        jutsuDisplay = `${jutsuKey} (*Unknown*)`;
                    }
                 }
                 return `**Slot ${slot}:** ${jutsuDisplay}${costDisplay}`;
            })
            .join('\n');

        let learnedDescription = 'No jutsu learned yet!';
        if (learnedJutsuKeys.length > 0) {
            // Now iterates correctly through ["Transformation Jutsu", "asura", ...]
            learnedDescription = learnedJutsuKeys
                .map(jutsuKey => { // jutsuKey is now the correct string
                    const jutsuDetails = allJutsus[jutsuKey]; // Look up the key
                    if (jutsuDetails) {
                        const name = jutsuDetails.name ?? jutsuKey;
                        const cost = jutsuDetails.chakraCost ?? '?';
                        const desc = jutsuDetails.description ?? 'No description available.';
                        return `• **${name}** (${cost} Chakra)\n   *${desc}*`;
                    } else {
                        return `• ${jutsuKey} (*Unknown*)`; // Handle if key not in master list
                    }
                })
                .join('\n\n');
        }
         if (learnedDescription.length > 1024) {
             learnedDescription = learnedDescription.substring(0, 1021) + '...';
         }

        const pages = {
            equipped: new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Equipped Jutsu')
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription('Currently equipped jutsu in your slots')
                .addFields({ name: 'Equipped Jutsu', value: slotsDescription || 'No slots defined!' }),

            learned: new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Learned Jutsu')
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription('All jutsu you have learned')
                .addFields({ name: 'Learned Jutsu Library', value: learnedDescription })
        };

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('equipped')
                    .setLabel('← ')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('learned')
                    .setLabel('→ ')
                    .setStyle(ButtonStyle.Secondary)
            );

        const response = await interaction.reply({
            embeds: [pages.equipped],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.update({
                embeds: [pages[i.customId]],
                components: [new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('equipped')
                            .setLabel('⬅')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('learned')
                            .setLabel('➡')
                            .setStyle(ButtonStyle.Secondary)
                    )]
            });
        });

        collector.on('end', () => {
            if (response.editable) {
                response.edit({ components: [] }).catch(console.error);
            }
        });
    }
};