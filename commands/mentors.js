const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, AttachmentBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Paths
const DATA_PATH = path.join(__dirname, '../../menma/data/users.json');
const MENTORS_PATH = path.join(__dirname, '../../menma/data/mentors.json');
const MENTOR_EXP_PATH = path.join(__dirname, '../../menma/data/mentorexp.json');
const JUTSU_PATH = path.join(__dirname, '../../menma/data/jutsu.json');

// Load data files
async function loadData() {
    const [users, mentors, mentorExp, jutsus] = await Promise.all([
        loadJsonFile(DATA_PATH),
        loadJsonFile(MENTORS_PATH),
        loadJsonFile(MENTOR_EXP_PATH),
        loadJsonFile(JUTSU_PATH)
    ]);
    return { users, mentors, mentorExp, jutsus };
}

async function loadJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

async function saveJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Mentor system')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What do you want to do?')
                .setRequired(true)
                .addChoices(
                    { name: 'list', value: 'list' },
                    { name: 'select', value: 'select' },
                    { name: 'learn', value: 'learn' },
                    { name: 'train', value: 'train' }
                )
        )
        .addStringOption(option =>
            option.setName('mentor')
                .setDescription('Mentor name (required for select)')
                .setRequired(false)
                .setAutocomplete(true)
        ),
    async execute(interaction) {
        const { users, mentors, mentorExp, jutsus } = await loadData();
        const userId = interaction.user.id;
        const player = users[userId] || {};

        if (!player.rank) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const mentorName = interaction.options.getString('mentor');
        const playerRank = player.rank || 'Genin';
        const rankMentors = mentors[playerRank] || {};

        if (action === 'list') {
            const userMentorExp = mentorExp[userId] ? mentorExp[userId].exp : 0;
            const embed = new EmbedBuilder()
                .setTitle(`Available ${playerRank} Mentors`)
                .setDescription(
                    `Use \\\`/mentor action:select mentor:<mentor>\\\` to select a mentor.\n\n` +
                    `**Your Mentor EXP:** ${userMentorExp}\n\n` +
                    `Here are the mentors available for your rank:\n If you don't see any mentors, it's probably because you are not high enough rank yet. Rankup through ranked.`
                )
                .setColor('#0099ff');
            for (const [name, data] of Object.entries(rankMentors)) {
                const jutsuList = data.jutsu.map(j => `• ${j.name} (${j.required_exp} EXP)`).join('\n');
                embed.addFields({
                    name: name,
                    value: `${data.clan ? `Clan: ${data.clan}\n` : ''}${jutsuList}`,
                    inline: true
                });
            }
            embed.setFooter({
                text: "You cannot learn the previous ranks' jutsu once you rank up!"
            });
            return interaction.reply({ embeds: [embed] });
        }

        if (action === 'select') {
            if (!mentorName) {
                return interaction.reply({ content: "Please specify a mentor name.", ephemeral: true });
            }
            const mentorKey = Object.keys(rankMentors).find(
                k => k.toLowerCase() === mentorName.toLowerCase()
            );
            if (!mentorKey) {
                return interaction.reply({ content: "That mentor doesn't exist for your rank.", ephemeral: true });
            }

            player.mentor = mentorKey;
            users[userId] = player;
            await saveJsonFile(DATA_PATH, users);

            return interaction.reply({ content: `You have selected **${mentorKey}** as your mentor!`, ephemeral: true });
        }

        if (action === 'train') {
            const userMentorExp = mentorExp[userId] || { exp: 0, last_train: 0 };
            const now = Date.now();
            const cooldown = 15 * 60 * 1000; // 15 minutes

            if (now - userMentorExp.last_train < cooldown) {
                const remaining = cooldown - (now - userMentorExp.last_train);
                return interaction.reply({ content: `You can train again in ${Math.ceil(remaining / 60000)} minutes.`, ephemeral: true });
            }

            userMentorExp.exp += 10;
            userMentorExp.last_train = now;
            mentorExp[userId] = userMentorExp;
            await saveJsonFile(MENTOR_EXP_PATH, mentorExp);

            return interaction.reply({ content: `You trained and gained 10 mentor EXP! You now have ${userMentorExp.exp} EXP.`, ephemeral: true });
        }

        if (action === 'learn') {
            if (!player.mentor) {
                return interaction.reply({ content: "You don't have a mentor selected. Use /mentor select first.", ephemeral: true });
            }

            const mentorKey = player.mentor;
            const mentorData = rankMentors[mentorKey];

            if (!mentorData) {
                return interaction.reply({ content: "Your current mentor isn't available for your rank anymore.", ephemeral: true });
            }

            const userMentorExp = mentorExp[userId] ? mentorExp[userId].exp : 0;
            const userJutsus = jutsus[userId] ? jutsus[userId].usersjutsu : [];

            const availableJutsu = mentorData.jutsu.filter(j =>
                userMentorExp >= j.required_exp && !userJutsus.includes(j.name)
            );

            if (availableJutsu.length === 0) {
                return interaction.reply({ content: "No jutsus available to learn right now (either not enough EXP or already learned).", ephemeral: true });
            }

            const jutsuToLearn = availableJutsu[0];

            if (!jutsus[userId]) {
                jutsus[userId] = { usersjutsu: [], scrolls: [] };
            }
            jutsus[userId].usersjutsu.push(jutsuToLearn.name);
            await saveJsonFile(JUTSU_PATH, jutsus);

            const userMentorExpData = mentorExp[userId] || { exp: 0, last_train: 0 };
            userMentorExpData.exp -= jutsuToLearn.required_exp;
            mentorExp[userId] = userMentorExpData;
            await saveJsonFile(MENTOR_EXP_PATH, mentorExp);

            interaction.reply({ content: `You've learned **${jutsuToLearn.name}** from ${mentorName}!`, ephemeral: true });
        }
    },
    async autocomplete(interaction) {
        const { mentors } = await loadData();
        const focusedOption = interaction.options.getFocused(true);
        const { users } = await loadData();
        const player = users[interaction.user.id] || {};
        const playerRank = player.rank || 'Genin';

        if (focusedOption.name === 'mentor') {
            const rankMentors = mentors[playerRank] || {};
            const mentorChoices = Object.keys(rankMentors)
                .filter(name => name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .map(name => ({ name, value: name }))
                .slice(0, 25);

            await interaction.respond(mentorChoices);
        }
    }
};