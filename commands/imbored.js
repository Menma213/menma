const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USER_AGENT = 'discord-meme-bot/1.0';

// A function to get a new access token for Reddit's API
async function getRedditAccessToken() {
    const creds = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': REDDIT_USER_AGENT
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    return data.access_token;
}

// A function to get a random post
async function getRandomMeme(accessToken) {
    // We combine the subreddits with a "+" sign
    const res = await fetch('https://oauth.reddit.com/r/naruto+narutomemes+anime/hot?limit=100', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': REDDIT_USER_AGENT
        }
    });
    const data = await res.json();
    const posts = data.data.children
        .map(c => c.data)
        .filter(post => !post.stickied && !post.over_18 && post.post_hint === 'image');
    
    if (posts.length === 0) throw new Error('No posts found.');

    const meme = posts[Math.floor(Math.random() * posts.length)];
    return meme;
}

// The main command module
module.exports = {
    // Change the name and description of the slash command here
    data: new SlashCommandBuilder()
        .setName('imbored')
        .setDescription('Sends a random post from popular anime subreddits.'),
    
    async execute(interaction) {
        await interaction.deferReply();
        try {
            const accessToken = await getRedditAccessToken();
            const meme = await getRandomMeme(accessToken);

            const embed = new EmbedBuilder()
                .setTitle(meme.title)
                .setURL(`https://reddit.com${meme.permalink}`)
                .setImage(meme.url)
                .setColor('Random')
                .setFooter({ text: `👍 ${meme.ups} | 💬 ${meme.num_comments} | r/${meme.subreddit}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            await interaction.editReply('❌ Failed to fetch a post. Please try again later.');
        }
    }
};