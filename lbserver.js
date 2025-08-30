const express = require('express');
const path = require('path');
const fs = require('fs');

// This function now takes the Discord client as an argument.
// This is how the server gets access to the Discord API.
function createLeaderboardServer(discordClient) {
    const app = express();
    const port = process.env.PORT || 3000;

    // Serve static files (like the HTML page) from the same directory
    app.use(express.static(path.join(__dirname)));

    // API endpoint to serve leaderboard data
    app.get('/api/leaderboard', async (req, res) => {
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');

        if (!fs.existsSync(usersPath)) {
            return res.status(500).json({ error: 'User data file not found.' });
        }

        try {
            const data = await fs.promises.readFile(usersPath, 'utf8');
            const users = JSON.parse(data);

            // Filter and sort users, excluding Level 1
            const allUsers = [];
            for (const id in users) {
                const user = users[id];
                if (user && typeof user.level === 'number' && !isNaN(user.level) && user.level > 1) {
                    allUsers.push({ id, ...user });
                }
            }

            allUsers.sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return a.id.localeCompare(b.id);
            });

            const topUsers = allUsers.slice(0, 10);

            // Fetch real usernames and avatars from Discord API
            const finalLeaderboard = await Promise.all(
                topUsers.map(async (user) => {
                    try {
                        const discordUser = await discordClient.users.fetch(user.id);
                        return {
                            ...user,
                            username: discordUser.username,
                            avatarUrl: discordUser.displayAvatarURL({ extension: 'png', size: 128 }),
                        };
                    } catch (e) {
                        console.warn(`Could not fetch user data for ID ${user.id}. Using fallback.`, e.message);
                        return {
                            ...user,
                            username: user.username || 'Unknown Ninja',
                            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
                        };
                    }
                })
            );

            res.json(finalLeaderboard);
        } catch (err) {
            console.error('Error in leaderboard API:', err);
            res.status(500).json({ error: 'Error processing leaderboard data.' });
        }
    });

    // The main route to serve the HTML file
    app.get('/leaderboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'lb.html'));

        
    });

    // Start the server
    const server = app.listen(port, () => {
        console.log(`Leaderboard server listening at http://localhost:${port}/leaderboard`);
    });

    return server;
}

module.exports = createLeaderboardServer;
