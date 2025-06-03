const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const electionPath = path.resolve(__dirname, '../../menma/data/election.json');
const candidatesPath = path.resolve(__dirname, '../../menma/data/candidates.json');

function getCandidates() {
    if (!fs.existsSync(candidatesPath)) return [];
    return JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
}

function getElectionData() {
    if (!fs.existsSync(electionPath)) return {};
    return JSON.parse(fs.readFileSync(electionPath, 'utf8'));
}

function saveElectionData(data) {
    fs.writeFileSync(electionPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for the Hokage candidate')
        .addStringOption(option =>
            option.setName('candidate')
                .setDescription('Name of the candidate')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const candidates = getCandidates();
        const focused = interaction.options.getFocused();
        const filtered = candidates.filter(c =>
            c.name.toLowerCase().includes(focused.toLowerCase()) ||
            c.id === focused
        );
        await interaction.respond(
            filtered.map(c => ({ name: `${c.name} (${c.id})`, value: c.name }))
        );
    },
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const candidateInput = interaction.options.getString('candidate');
        const candidates = getCandidates();
        // Accept both name and id (case-insensitive)
        const candidateObj = candidates.find(c =>
            c.id === candidateInput ||
            c.name.toLowerCase() === candidateInput.toLowerCase()
        );
        if (!candidateObj) {
            return interaction.reply({ content: "Invalid candidate.", ephemeral: true });
        }
        const electionData = getElectionData();
        if (electionData.phase !== "voting") {
            return interaction.reply({ content: "Election hasn't begun yet.", ephemeral: true });
        }
        if (electionData.votes && electionData.votes[userId]) {
            return interaction.reply({ content: "You have already voted.", ephemeral: true });
        }
        electionData.votes = electionData.votes || {};
        electionData.votes[userId] = candidateObj.id;
        electionData.voters = electionData.voters || [];
        electionData.voters.push({ id: userId, username, candidate: candidateObj.id });
        saveElectionData(electionData);
        await interaction.reply(`Your vote for **${candidateObj.name}** has been cast!`);
    }
};
