const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Bot config
const BOT_ID = '1351258977018839041'; // Replace with your bot's top.gg ID
const TOPGG_TOKEN = process.env.TOPGG_TOKEN; // Set your top.gg API token in env
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

// Helper to check vote status
async function hasVoted(userId) {
    if (!TOPGG_TOKEN) return false;
    const url = `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`;
    const res = await fetch(url, {
        headers: { Authorization: TOPGG_TOKEN }
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.voted === 1;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crank')
        .setDescription('Vote for the bot on top.gg and get rewards!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }

        // Voting link
        const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

        // Check vote status
        let voted = false;
        try {
            voted = await hasVoted(userId);
        } catch (e) {
            voted = false;
        }

        if (voted) {
            // Give rewards if not already claimed today
            const now = Date.now();
            if (!users[userId].lastCrankReward || now - users[userId].lastCrankReward > 12 * 60 * 60 * 1000) {
                users[userId].ramen = (users[userId].ramen || 0) + 25;
                users[userId].money = (users[userId].money || 0) + 10000;
                users[userId].exp = (users[userId].exp || 0) + 1;
                users[userId].lastCrankReward = now;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Thank you for voting!')
                            .setDescription('You have received:\n **25 ramen**\n **10,000 money**\n **1 exp**')
                            .setColor(0x00FF00)
                            .setURL(voteUrl)
                    ],
                    content: `You voted for the bot! [Vote again here](${voteUrl}) (every 12h for rewards)`,
                    ephemeral: false
                });
            } else {
                return interaction.reply({
                    content: `You already claimed your vote reward in the last 12 hours! [Vote again here](${voteUrl})`,
                    ephemeral: true
                });
            }
        } else {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Vote for the bot!')
                        .setDescription('Vote for the bot on top.gg and get:\n **25 ramen**\n **10,000 money**\n **1 exp**\n\n[Click here to vote](' + voteUrl + ')')
                        .setColor(0x0099FF)
                        .setURL(voteUrl)
                ],
                content: `After voting, run \`/crank\` again to claim your reward!`,
                ephemeral: true
            });
        }
    }
};
