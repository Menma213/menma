const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const akatsukiPath = path.join(__dirname, '..', 'data', 'akatsuki.json');
const anbuPath = path.join(__dirname, '..', 'data', 'anbu.json');
const usersPath = path.join(__dirname, '..', 'data', 'users.json');

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
        .setName('oath')
        .setDescription('Renounce your ties to the Akatsuki and return to the village.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;

        const anbuData = readJsonFile(anbuPath);
        if (anbuData && anbuData.members && anbuData.members[userId]) {
            return interaction.editReply({
                content: 'You are a member of the Anbu. You have no need for this oath.',
                ephemeral: true
            });
        }

        const akatsukiData = readJsonFile(akatsukiPath);
        if (!akatsukiData || !akatsukiData.members || !akatsukiData.members[userId]) {
            return interaction.editReply({ content: 'This path is not for you. Only Akatsuki members can take this oath.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('The Oath of Return')
            .setColor('#FFA500')
            .setDescription('The path of shadows has led you here, but the will of fire still flickers within you. To return to the village, a sacrifice must be made.\n Say these words! `I acknowledge my sins and i wish to return to the village.`')
            .addFields({ name: 'The Sacrifice', value: 'You must sacrifice 10% of your maximum health, a permanent reminder of the path you once walked.' })
            .setFooter({ text: 'The village awaits your decision.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('sacrifice_button')
                .setLabel('Make the Sacrifice')
                .setStyle(ButtonStyle.Danger)
        );

        const reply = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId === 'sacrifice_button',
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            const modal = new ModalBuilder()
                .setCustomId('oath_modal')
                .setTitle('The Oath');

            const oathInput = new TextInputBuilder()
                .setCustomId('oath_input')
                .setLabel('Recite the oath below')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('I acknowledge my sins and i wish to return to the village.')
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(oathInput);
            modal.addComponents(actionRow);

            await i.showModal(modal);

            const filter = (modalInteraction) => modalInteraction.customId === 'oath_modal' && modalInteraction.user.id === i.user.id;
            try {
                const modalInteraction = await i.awaitModalSubmit({ filter, time: 120_000 });
                const oathPhrase = modalInteraction.fields.getTextInputValue('oath_input');
                const requiredPhrase = "I acknowledge my sins and i wish to return to the village.";

                if (oathPhrase.toLowerCase() !== requiredPhrase.toLowerCase()) {
                    return modalInteraction.reply({ content: 'The words are incorrect. The oath was not accepted.', ephemeral: true });
                }

                const usersData = readJsonFile(usersPath);
                const userData = usersData[userId];

                if (!userData || !userData.health) {
                    return modalInteraction.reply({ content: 'Could not find your user data to perform the sacrifice.', ephemeral: true });
                }

                const healthReduction = Math.floor(userData.health * 0.1);
                userData.health -= healthReduction;

                // Re-read akatsuki data to be safe
                const currentAkatsukiData = readJsonFile(akatsukiPath);
                delete currentAkatsukiData.members[userId];

                if (writeJsonFile(usersPath, usersData) && writeJsonFile(akatsukiPath, currentAkatsukiData)) {
                    await modalInteraction.reply({ content: `Your oath has been accepted. You have sacrificed ${healthReduction} health and have been welcomed back to the village.`, ephemeral: true });
                } else {
                    await modalInteraction.reply({ content: 'An error occurred while processing your oath. Please try again later.', ephemeral: true });
                }

            } catch (err) {
                console.error("Oath modal error:", err);
                await i.followUp({ content: 'You took too long to recite the oath. The moment has passed.', ephemeral: true }).catch(() => { });
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => { });
            }
        });
    },
};
