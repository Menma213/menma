// Import the necessary modules
const Topgg = require("@top-gg/sdk");
const express = require("express");
const Discord = require("discord.js");

// Replace with your actual values
const BOT_TOKEN = "MTM1MTI1ODk3NzAxODgzOTA0MQ.GIl3Ky.QSgFF26iO69vuW21rdgu9Sdq5l4gd5crEqA0lQ";
const TOPGG_WEBHOOK_AUTH = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJib3QiOiJ0cnVlIiwiaWQiOiIxMzUxMjU4OTc3MDE4ODM5MDQxIiwiaWF0IjoiMTc1MzA5MTExOCJ9.6sZ_g4omjO0BgCzw1RZIooH74QZWY1VwBwZwIjxRO0M";
const WEBHOOK_PORT = 5000;
// Initialize Discord Client
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent
    ]
});

// Create an Express app and a Top.gg webhook instance
const app = express();
const webhook = new Topgg.Webhook(TOPGG_WEBHOOK_AUTH);

// Start the Express server
app.listen(WEBHOOK_PORT, () => {
    console.log(`Webhook server listening on port ${WEBHOOK_PORT}`);
});

// Define the webhook endpoint
app.post("/dblwebhook", webhook.listener(async (vote) => {
    // The 'vote' object contains all the information about the vote.
    const user_id = vote.user;
    const is_weekend = vote.isWeekend;

    console.log(`Received a vote from user ID: ${user_id}`);
    
    // Fetch the Discord user object
    const user = await client.users.fetch(user_id);
    
    if (user) {
        // --- This is where you add your reward logic ---
        
        // Example: Send a DM to the user
        // await user.send(`Thanks for voting for my bot! Your support is awesome!`);
        
        // Example: Add a user to a database and give them a reward
        // Example: Check for the weekend bonus
        if (is_weekend) {
            console.log(`${user.username} voted on the weekend!`);
            // Give a special bonus here
        }
        
    } else {
        console.log("User not found on Discord.");
    }
}));

// Run your bot
client.login(BOT_TOKEN);

// Usage:
// 1. Install dependencies: npm install @top-gg/sdk express discord.js
// 2. Run: node api.js
// This will automatically listen for votes on your bot via the Top.gg webhook and allow you to reward users accordingly.

// Note: Make sure to replace placeholder tokens with your actual values before running the bot.