const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const anbuPath = path.join(__dirname, '..', 'data', 'anbu.json');
const usersPath = path.join(__dirname, '..', 'data', 'users.json');
const ANBU_ROLE_ID = '1382055740268744784';

function readJsonFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Error reading or parsing ${filePath}:`, e);
            return null;
        }
    }
    return {};
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`Error writing to ${filePath}:`, e);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resign')
        .setDescription('Resign from the Anbu Black Ops and return to being a normal shinobi.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;

        const anbuData = readJsonFile(anbuPath);
        if (!anbuData || !anbuData.members || !anbuData.members[userId]) {
            return interaction.editReply({
                content: 'You are not a member of the Anbu Black Ops.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Resignation from the Shadows')
            .setColor('#CCCCCC') // Grey/Silver
            .setDescription('You have served the village from the shadows, but now you wish to walk in the light once more. This decision is final.\n Write this text to confirm your resignation `I have served in the shadows, now I walk in the light.`')
            .addFields({ name: 'The Cost', value: 'To leave the Anbu, you must sacrifice 10% of your maximum health as a vow of secrecy.' })
            .setFooter({ text: 'The village honors your service.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('resign_button')
                .setLabel('resign')
                .setStyle(ButtonStyle.Danger) // Red for a serious action
        );

        const reply = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId === 'resign_button',
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            const modal = new ModalBuilder()
                .setCustomId('resign_modal')
                .setTitle('Resignation Oath');

            const oathInput = new TextInputBuilder()
                .setCustomId('oath_input')
                .setLabel('Recite the oath below')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('I have served in the shadows, now I walk in the light.')
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(oathInput);
            modal.addComponents(actionRow);

            await i.showModal(modal);

            const filter = (modalInteraction) => modalInteraction.customId === 'resign_modal' && modalInteraction.user.id === i.user.id;
            try {
                const modalInteraction = await i.awaitModalSubmit({ filter, time: 120_000 });
                const oathPhrase = modalInteraction.fields.getTextInputValue('oath_input');
                const requiredPhrase = "I have served in the shadows, now I walk in the light.";

                if (oathPhrase.toLowerCase().trim().replace(/[.,]/g, '') !== requiredPhrase.toLowerCase().trim().replace(/[.,]/g, '')) {
                    // Loose matching for punctuation
                    return modalInteraction.reply({ content: 'The words are incorrect. Your resignation was not accepted.', ephemeral: true });
                }

                const usersData = readJsonFile(usersPath);
                const userData = usersData[userId];

                if (!userData || !userData.health) {
                    return modalInteraction.reply({ content: 'Could not find your user data to perform the sacrifice.', ephemeral: true });
                }

                // Apply penalty
                const healthReduction = Math.floor(userData.health * 0.1);
                userData.health -= healthReduction;

                // Update occupation if it was just 'Anbu' to 'Village' (or keep if it's something else unique, but usually it's Village)
                if (userData.occupation === 'Anbu') {
                    userData.occupation = 'Village';
                }
                // If they had a specific role like "Spy", remove it
                if (userData.role) {
                    delete userData.role;
                }

                // Remove from Anbu data
                const currentAnbuData = readJsonFile(anbuPath);
                if (currentAnbuData.members && currentAnbuData.members[userId]) {
                    delete currentAnbuData.members[userId];
                }

                if (writeJsonFile(usersPath, usersData) && writeJsonFile(anbuPath, currentAnbuData)) {
                    // Try to remove the role
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        if (member.roles.cache.has(ANBU_ROLE_ID)) {
                            await member.roles.remove(ANBU_ROLE_ID);
                        }
                        await modalInteraction.reply({ content: `Your resignation has been accepted. You have handed in your mask, sacrificed ${healthReduction} health, and returned to the village as a normal shinobi.`, ephemeral: true });
                    } catch (roleError) {
                        console.error("Error removing role:", roleError);
                        await modalInteraction.reply({ content: `Your resignation has been accepted and data updated, but I couldn't remove your Discord role. Please ask an admin to remove the Anbu role clearly.`, ephemeral: true });
                    }
                } else {
                    await modalInteraction.reply({ content: 'An error occurred while processing your resignation. Please try again later.', ephemeral: true });
                }

            } catch (err) {
                console.error("Resign modal error:", err);
                if (!i.replied && !i.deferred) {
                    await i.followUp({ content: 'You took too long to recite the oath.', ephemeral: true }).catch(() => { });
                }
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => { });
            }
        });
    },
};
