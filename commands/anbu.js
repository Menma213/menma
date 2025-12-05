const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Config ---
const HOKAGE_ROLE_ID = '1381606285577031772';
const ANBU_ROLE_ID = '1382055740268744784';
const playersPath = path.join(__dirname, '..', 'data', 'players.json');
const anbuPath = path.join(__dirname, '..', 'data', 'anbu.json');
const MIN_LEVEL = 100;

// --- File I/O Helpers ---
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

const akatsukiPath = path.join(__dirname, '..', 'data', 'akatsuki.json');

// --- Main Command ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('anbu')
        .setDescription('Learn about the Anbu and begin the initiation quest.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;

        const akatsukiData = readJsonFile(akatsukiPath);
        if (akatsukiData && akatsukiData.members && akatsukiData.members[userId]) {
            return interaction.editReply({
                content: 'You are a rogue ninja, stay away from the black ops!',
                ephemeral: true
            });
        }

        const playersData = readJsonFile(playersPath);
        if (!playersData) {
            return interaction.editReply({ content: "There was an error accessing player data.", ephemeral: true });
        }

        const anbuData = readJsonFile(anbuPath);
        if (!anbuData) {
            return interaction.editReply({ content: "There was an error accessing Anbu data.", ephemeral: true });
        }

        const userLevel = playersData[userId]?.level || 0;
        const anbuMember = anbuData.members && anbuData.members[userId];
        const onQuest = anbuData.quest && anbuData.quest[userId];

        let userStatus = 'Not a member';
        if (anbuMember) {
            userStatus = 'Anbu Member';
        } else if (onQuest) {
            const bRanks = anbuData.quest[userId].brank || 0;
            const dRanks = anbuData.quest[userId].drank || 0;
            userStatus = `On Quest (${bRanks}/10 B-Rank, ${dRanks}/10 D-Rank)`;
        }

        // Find Hokage
        let hokage = 'Not Found';
        try {
            const hokageMember = interaction.guild.members.cache.find(member => member.roles.cache.has(HOKAGE_ROLE_ID));
            if (hokageMember) {
                hokage = hokageMember.user.username;
            }
        } catch (error) {
            console.error("Could not fetch members to find Hokage:", error);
            hokage = 'Unknown';
        }


        const anbuEmbed = new EmbedBuilder()
            .setTitle('The Anbu Black Ops')
            .setColor('#4F545C')
            .setDescription('The Anbu (暗部, Dark Side), short for Ansatsu Senjutsu Tokushu Butai (暗殺戦術特殊部隊, Special Assassination and Tactical Squad), are covert operatives of Konohagakure.')
            .addFields(
                { name: 'Your Status', value: userStatus, inline: true },
                { name: 'Current Hokage', value: hokage, inline: true },
                { name: 'Requirement', value: `Level ${MIN_LEVEL}+`, inline: true },
                { name: 'Mission', value: 'Anbu conduct high-risk missions in enemy territory, facing personal risk to ensure the village\'s safety. They are the protectors of the Leaf, operating from the shadows.' },
                { name: 'Quest', value: 'Complete 10 B-Rank and 10 D-Rank missions to prove your worth.' }
            )
            .setThumbnail('https://static.wikia.nocookie.net/naruto/images/d/d6/Anbu_emblem.svg/revision/latest/scale-to-width-down/1200?cb=20160214001149')
            .setFooter({ text: 'Do you have what it takes to join the shadows?' });

        const canJoin = !anbuMember && !onQuest && userLevel >= MIN_LEVEL;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join_anbu_quest')
                .setLabel('Start Quest')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!canJoin)
        );

        const reply = await interaction.editReply({ embeds: [anbuEmbed], components: [row], ephemeral: true });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'join_anbu_quest',
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const currentAnbuData = readJsonFile(anbuPath);
            if (!currentAnbuData.quest) {
                currentAnbuData.quest = {};
            }
            currentAnbuData.quest[userId] = { brank: 0, drank: 0 };
            fs.writeFileSync(anbuPath, JSON.stringify(currentAnbuData, null, 2));

            await i.followUp({ content: 'You have started the Anbu initiation quest! Complete 10 B-Rank and 10 D-Rank missions.', ephemeral: true });

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_anbu_quest')
                    .setLabel('Quest Started')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            await interaction.editReply({ components: [disabledRow] });
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                const expiredRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_anbu_quest_expired')
                        .setLabel('Expired')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                interaction.editReply({ components: [expiredRow] });
            }
        });
    },
};