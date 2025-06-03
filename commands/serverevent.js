const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const electionPath = path.resolve(__dirname, '../../menma/data/election.json');
const candidatesPath = path.resolve(__dirname, '../../menma/data/candidates.json');
const HOKAGE_ROLE_ID = '1349278752944947240'; // <-- Replace with your actual Hokage role ID
const OWNER_IDS = ['835408109899219004', '961918563382362122']; // Replace with your Discord user IDs

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
        .setName('serverevent')
        .setDescription('Start a server event')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of event')
                .setRequired(true)
                .addChoices(
                    { name: 'hokage', value: 'hokage' },
                    { name: 'war', value: 'war' }
                )
        ),
    async execute(interaction) {
        // Owner/admin check
        if (!OWNER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const eventType = interaction.options.getString('type');
        if (eventType === 'war') {
            return interaction.reply({ content: "Coming soon!", ephemeral: false });
        }

        // Hokage election event
        const channel = interaction.channel;
        const candidates = getCandidates();
        if (candidates.length === 0) {
            return interaction.reply({ content: "No candidates found. Please add candidates to candidates.json.", ephemeral: true });
        }

        // Election countdown: 1 minute (for testing)
        let countdown = 60; // seconds
        const updateInterval = 10; // 10 seconds for faster updates during testing
        const embed = new EmbedBuilder()
            .setTitle("Hokage Election Countdown")
            .setDescription(`The Hokage Election begins in <t:${Math.floor(Date.now()/1000)+countdown}:R>`)
            .setColor('#FFD700');
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Save election state
        saveElectionData({
            phase: "countdown",
            startTimestamp: Date.now(),
            electionChannel: channel.id,
            candidates: candidates,
            votes: {},
            voters: []
        });

        // Countdown updater
        let interval = setInterval(async () => {
            countdown -= updateInterval;
            if (countdown > 0) {
                await msg.edit({
                    embeds: [
                        EmbedBuilder.from(embed)
                            .setDescription(`The Hokage Election begins in <t:${Math.floor(Date.now()/1000)+countdown}:R>`)
                    ]
                });
            }
        }, updateInterval * 1000);

        // End countdown after 1 minute (testing)
        setTimeout(async () => {
            clearInterval(interval);
            // Election phase
            const electionData = getElectionData();
            electionData.phase = "voting";
            electionData.votingStart = Date.now();
            saveElectionData(electionData);

            const voteEmbed = new EmbedBuilder()
                .setTitle("The Election of the Hokage begins! Cast your vote now!")
                .setDescription(
                    "Candidates:\n" +
                    candidates.map((c, i) => `**${i+1}. ${c.name}** (<@${c.id}>)`).join('\n')
                )
                .setFooter({ text: "Elect a worthy hokage to protect your village from the Akatsuki" })
                .setColor('#FFD700');
            await msg.edit({
                content: `***ELECTION BEGINS***`,
                embeds: [voteEmbed]
            });

            // End voting after 2 minutes (testing)
            setTimeout(async () => {
                const electionData = getElectionData();
                if (electionData.phase !== "voting") return;
                electionData.phase = "ended";
                saveElectionData(electionData);

                // Tally votes
                const votes = electionData.votes || {};
                const leaderboard = {};
                for (const voter in votes) {
                    const votedId = votes[voter];
                    leaderboard[votedId] = (leaderboard[votedId] || 0) + 1;
                }
                // Map candidate id to candidate object for display
                const candidateMap = {};
                candidates.forEach(c => { candidateMap[c.id] = c; });

                const sorted = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
                const totalVoters = Object.keys(votes).length;
                let resultText = sorted.length
                    ? sorted.map(([id, count], i) => {
                        const c = candidateMap[id];
                        return `**${i+1}. ${c ? c.name : id}** (<@${id}>) - ${count} votes`;
                    }).join('\n')
                    : "No votes were cast.";

                // Announce Hokage
                let winnerId = sorted[0]?.[0];
                let winnerObj = winnerId ? candidateMap[winnerId] : null;
                let winnerMention = winnerObj ? `<@${winnerObj.id}>` : null;
                if (winnerId && winnerObj) {
                    // Always fetch the member from the guild, then add the role (Carl-bot style)
                    const guild = interaction.guild;
                    try {
                        const member = await guild.members.fetch(winnerId);
                        if (member && !member.roles.cache.has(HOKAGE_ROLE_ID)) {
                            await member.roles.add(HOKAGE_ROLE_ID, "Elected as Hokage");
                        }
                    } catch (err) {
                        // Optionally log error or notify admins
                    }
                }
                await channel.send({
                    content: winnerObj ? `:tada: The new Hokage is **${winnerObj.name}**! ${winnerMention} :tada:` : "No Hokage was elected.",
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Hokage Election Results")
                            .setDescription(
                                `Total voters: **${totalVoters}**\n\n${resultText}`
                            )
                            .setColor('#FFD700')
                    ]
                });
            }, 2 * 60 * 1000); // 2 minutes
        }, 60 * 1000); // 1 minute
    }
};
