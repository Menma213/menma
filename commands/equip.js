const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { userMutex } = require('../utils/locks');

const usersPath = path.resolve(__dirname, '../data/users.json');
const jutsuPath = path.resolve(__dirname, '../data/jutsu.json');
const jutsusDefPath = path.resolve(__dirname, '../data/jutsus.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip a Jutsu or a Combo.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What do you want to equip?')
                .setRequired(true)
                .addChoices(
                    { name: 'Jutsu', value: 'jutsu' },
                    { name: 'Combo', value: 'combo' }
                ))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the Jutsu or Combo')
                .setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const type = interaction.options.getString('type');
        const itemName = interaction.options.getString('name');

        try {
            await interaction.deferReply();

            // Load data
            const userJutsuData = JSON.parse(await fs.readFile(jutsuPath, 'utf8'));
            const userData = userJutsuData[userId] || { usersjutsu: ["Attack", "Transformation Jutsu"], combos: [], scrolls: [] };

            if (type === 'jutsu') {
                const userJutsusOwned = [...new Set(userData.usersjutsu || [])];
                const matchedJutsu = userJutsusOwned.find(j => j.toLowerCase() === itemName.toLowerCase());

                if (!matchedJutsu) {
                    return interaction.editReply({ content: `You don't own a jutsu named "**${itemName}**".` });
                }

                // Clan Check
                try {
                    const jutsusDefinitions = JSON.parse(await fs.readFile(jutsusDefPath, 'utf8'));
                    const jutsuDef = jutsusDefinitions[matchedJutsu];
                    if (jutsuDef && jutsuDef.clan) {
                        const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                        const userBloodline = users[userId]?.bloodline;
                        if (userBloodline !== jutsuDef.clan) {
                            return interaction.editReply({
                                content: `This jutsu is exclusive to the **${jutsuDef.clan}** bloodline. Your bloodline is **${userBloodline || 'None'}**.`
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error during clan check:", err);
                }

                if (matchedJutsu === "Attack") {
                    return interaction.editReply({ content: "The basic Attack cannot be moved from Slot 0." });
                }

                // Show Slot Selection
                const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                const currentJutsus = users[userId]?.jutsu || {};

                const slotEmbed = new EmbedBuilder()
                    .setTitle("Equip Jutsu")
                    .setDescription(`Select a slot to equip **${matchedJutsu}**:\n\n` +
                        `Slot 1: \`${currentJutsus.slot_1 || 'Empty'}\`\n` +
                        `Slot 2: \`${currentJutsus.slot_2 || 'Empty'}\`\n` +
                        `Slot 3: \`${currentJutsus.slot_3 || 'Empty'}\`\n` +
                        `Slot 4: \`${currentJutsus.slot_4 || 'Empty'}\`\n` +
                        `Slot 5: \`${currentJutsus.slot_5 || 'Empty'}\``)
                    .setFooter({ text: `Equipping: ${matchedJutsu}` })
                    .setColor("#2b2d31");

                const slotRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`slot_1_${matchedJutsu}`).setLabel('Slot 1').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`slot_2_${matchedJutsu}`).setLabel('Slot 2').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`slot_3_${matchedJutsu}`).setLabel('Slot 3').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`slot_4_${matchedJutsu}`).setLabel('Slot 4').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`slot_5_${matchedJutsu}`).setLabel('Slot 5').setStyle(ButtonStyle.Secondary)
                );

                const response = await interaction.editReply({ embeds: [slotEmbed], components: [slotRow] });

                const collector = response.createMessageComponentCollector({
                    filter: i => i.user.id === userId && i.customId.startsWith('slot_'),
                    time: 60000,
                    max: 1
                });

                collector.on('collect', async i => {
                    const parts = i.customId.split('_');
                    const slotNum = parts[1];
                    const jutsuToEquip = parts.slice(2).join('_');

                    await userMutex.runExclusive(async () => {
                        const usersData = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                        if (!usersData[userId]) throw new Error("User data not found.");
                        if (!usersData[userId].jutsu) usersData[userId].jutsu = { slot_0: "Attack" };

                        usersData[userId].jutsu[`slot_${slotNum}`] = jutsuToEquip;
                        await fs.writeFile(usersPath, JSON.stringify(usersData, null, 2));
                    });

                    await i.update({ content: `Successfully equipped **${jutsuToEquip}** to **Slot ${slotNum}**!`, embeds: [], components: [] });
                });

            } else if (type === 'combo') {
                const userCombosOwned = [...new Set(userData.combos || [])];
                const matchedCombo = userCombosOwned.find(c => c.toLowerCase() === itemName.toLowerCase());

                if (!matchedCombo) {
                    return interaction.editReply({ content: `You don't own a combo named "**${itemName}**".` });
                }

                await userMutex.runExclusive(async () => {
                    const users = JSON.parse(await fs.readFile(usersPath, 'utf8'));
                    if (!users[userId]) throw new Error("User data not found.");
                    users[userId].Combo = matchedCombo;
                    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
                });

                await interaction.editReply({ content: `Successfully equipped combo: **${matchedCombo}**!` });
            }

        } catch (error) {
            console.error(error);
            const msg = error.message || "An error occurred while executing this command.";
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: msg });
            } else {
                await interaction.reply({ content: msg, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};
