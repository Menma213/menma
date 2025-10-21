const express = require('express');
const { fetch } = require('undici');
const path = require('path');
const fs = require('fs').promises;
// Important: Replace these with your actual Client ID and Secret
const CLIENT_ID = '1351258977018839041'; 
const CLIENT_SECRET = '4ybhv8q9wQPjZUiVW2kASinNvtL69gVU';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

const app = express();
const PORT = 3000;

// Explicitly serve the main HTML file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The route that initiates the Discord OAuth2 flow
app.get('/login/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// The OAuth2 callback route. This is where Discord redirects the user after authorization.
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('No authorization code provided.');
    }

    try {
        // Debug: Log credentials and redirect_uri for troubleshooting
        console.log('Exchanging token with:', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET ? '[REDACTED]' : '[MISSING]',
            redirect_uri: REDIRECT_URI,
            code
        });

        // Step 1: Exchange the authorization code for an access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Error exchanging token:', tokenData);
            return res.status(500).send(`Discord API Error: ${tokenData.error_description}`);
        }

        const { access_token } = tokenData;

        // Step 2: Use the access token to fetch the user's Discord info
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const userData = await userResponse.json();
        const userId = userData.id;

        // Step 3: Read the users.json file from the specified path
        const userStatsPath = 'C:\\Users\\HI\\Downloads\\menma\\data\\users.json';
        let usersDB;

        try {
            const data = await fs.readFile(userStatsPath, 'utf8');
            usersDB = JSON.parse(data);
        } catch (fileError) {
            console.error(`Error reading or parsing ${userStatsPath}:`, fileError);
            return res.status(500).send('Error loading user database.');
        }

        // Step 4: Find the user's stats
        const userStats = usersDB[userId];

        if (!userStats) {
            return res.status(404).send(`User with ID ${userId} not found in database.`);
        }

        // Send a temporary success page or redirect with the data
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <script>
                    localStorage.setItem('discord_user_id', '${userId}');
                    window.location.href = '/';
                </script>
            </head>
            <body></body>
            </html>
        `);

    } catch (error) {
        console.error('OAuth flow failed:', error);
        res.status(500).send('An error occurred during authentication.');
    }
});

app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const userStatsPath = 'C:\\Users\\HI\\Downloads\\menma\\data\\users.json';

    try {
        const data = await fs.readFile(userStatsPath, 'utf8');
        const usersDB = JSON.parse(data);

        const userStats = usersDB[userId];
        if (userStats) {
            res.json(userStats);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Failed to read user data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
