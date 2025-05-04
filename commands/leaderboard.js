const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top users by level as an image.'),

    async execute(interaction) {
        // ***** DEFER REPLY *****
        await interaction.deferReply();

        try {
            // --- Load users.json ---
            const usersPath = path.resolve(__dirname, '..', 'data', 'users.json'); // Corrected path assumption
            if (!fs.existsSync(usersPath)) {
                return interaction.editReply({ content: 'Error: User data file not found.', ephemeral: true });
            }
            const usersData = fs.readFileSync(usersPath, 'utf8');
            let users;
            try {
                users = JSON.parse(usersData);
            } catch (err) {
                console.error("Failed to parse users.json:", err);
                return interaction.editReply({ content: 'Error reading user data.', ephemeral: true });
            }
            // --- ---

            // --- Process and Sort Users ---
            const sortedUsers = Object.entries(users)
                .map(([id, user]) => ({ id, ...user }))
                // Filter out entries without a valid level
                .filter(user => user && typeof user.level === 'number' && !isNaN(user.level))
                // Sort by level (descending)
                .sort((a, b) => b.level - a.level);

            const topUsersCount = 30; // Number of users to display
            const topUsers = sortedUsers.slice(0, topUsersCount);
            // --- ---

            // --- Fetch Discord User Details (Username/Avatar) ---
            const fetchedUsers = await Promise.all(
                topUsers.map(async (user) => {
                    try {
                        const discordUser = await interaction.client.users.fetch(user.id);
                        // Fetch avatar URL, provide a default if needed
                        const avatarUrl = discordUser.displayAvatarURL({ format: 'png', size: 128 });
                        return { ...user, username: discordUser.username, avatarUrl };
                    } catch (error) {
                         // Handle users not found (e.g., left Discord)
                         console.warn(`Could not fetch user ${user.id}:`, error.message);
                        return { ...user, username: 'Unknown User', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' }; // Default avatar
                    }
                })
            );
            // --- ---

            // --- Generate Leaderboard Image ---
            const imagePath = await generateLeaderboardImage(fetchedUsers);
            // --- ---

            // --- Send Image ---
            const attachment = new AttachmentBuilder(imagePath);
            await interaction.editReply({ files: [attachment] });
            
            // Clean up the image file after sending
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting leaderboard image:", err);
            });
            // --- ---

        } catch (error) {
            console.error('Error executing leaderboard command:', error);
            await interaction.editReply({ content: 'An error occurred while generating the leaderboard.', ephemeral: true });
        }
    },
};

// --- Puppeteer Image Generation Function ---
async function generateLeaderboardImage(leaderboardData) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Common args for server environments
        // headless: 'new' // Use the new headless mode if compatible
    });
    const page = await browser.newPage();

    // Calculate dynamic height or use a fixed large height
    const itemHeight = 45; // Approximate height per user row
    const headerHeight = 250; // Approximate height for the #1 user header
    const padding = 40;
    const calculatedHeight = headerHeight + (leaderboardData.length * itemHeight) + padding;
    const width = 800;
    const height = Math.max(600, calculatedHeight); // Minimum height

    await page.setViewport({ width: width, height: height });

    const topUser = leaderboardData.length > 0 ? leaderboardData[0] : null;

    // --- HTML Content ---
    const htmlContent = `
        <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'); /* Example Font */

                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Roboto', sans-serif;
                    background-color: #1a1a1a; /* Dark background */
                    color: #e0e0e0; /* Light text */
                    width: ${width}px;
                    height: ${height}px;
                }
                .leaderboard-card {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(145deg, #232526, #414345); /* Dark gradient */
                    border-radius: 15px; /* Keep rounded corners if desired */
                    box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                    padding: 20px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #f8d56b; /* Gold accent */
                }
                .header .title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #f8d56b; /* Gold title */
                    margin-bottom: 15px;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.5);
                }
                .top-avatar {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    border: 4px solid #f8d56b; /* Gold border */
                    margin: 0 auto 10px auto;
                    object-fit: cover;
                    display: block; /* Center image */
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                }
                .header .username {
                    font-size: 20px;
                    font-weight: bold;
                    color: #fff;
                }
                .leaderboard-list {
                    flex-grow: 1; /* Takes remaining space */
                    overflow-y: auto; /* Allows scrolling if content exceeds height */
                    padding-right: 10px; /* Space for scrollbar */
                }
                .list-item {
                    display: flex;
                    align-items: center;
                    background-color: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    padding: 10px 15px;
                    margin-bottom: 10px;
                    border-left: 4px solid #f8d56b; /* Gold accent */
                    gap: 15px; /* Spacing between elements */
                }
                 .list-item:nth-child(1) { border-left-color: #FFD700; } /* Gold */
                 .list-item:nth-child(2) { border-left-color: #C0C0C0; } /* Silver */
                 .list-item:nth-child(3) { border-left-color: #CD7F32; } /* Bronze */

                .rank {
                    font-size: 18px;
                    font-weight: bold;
                    color: #f8d56b;
                    min-width: 30px; /* Ensure rank number aligns */
                    text-align: right;
                }
                .user-info {
                    display: flex;
                    align-items: center;
                    flex-grow: 1;
                    gap: 10px;
                }
                 .list-avatar {
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .username {
                    font-size: 18px;
                    color: #fff;
                    flex-grow: 1; /* Takes available space */
                     white-space: nowrap;
                     overflow: hidden;
                     text-overflow: ellipsis;
                }
                .level {
                    font-size: 16px;
                    font-weight: bold;
                    color: #aaa;
                    background-color: rgba(0,0,0,0.2);
                    padding: 3px 8px;
                    border-radius: 5px;
                }
                 /* Scrollbar styling (optional) */
                .leaderboard-list::-webkit-scrollbar {
                    width: 8px;
                }
                .leaderboard-list::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                    border-radius: 4px;
                }
                .leaderboard-list::-webkit-scrollbar-thumb {
                    background-color: rgba(248, 213, 107, 0.5); /* Semi-transparent gold */
                    border-radius: 4px;
                }
                .leaderboard-list::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(248, 213, 107, 0.8);
                }
            </style>
        </head>
        <body>
            <div class="leaderboard-card">
                <div class="header">
                    <div class="title">Strongest In The World</div>
                    ${topUser ? `
                        <img src="${topUser.avatarUrl}" class="top-avatar" alt="Top User Avatar">
                        <div class="username">${topUser.username} (Lvl ${topUser.level || '?'})</div>
                    ` : `<div>No users found</div>`}
                </div>
                <div class="leaderboard-list">
                    ${leaderboardData.map((user, index) => `
                        <div class="list-item">
                            <span class="rank">${index + 1}.</span>
                            <div class="user-info">
                                <img src="${user.avatarUrl}" class="list-avatar" alt="Avatar">
                                <span class="username">${user.username}</span>
                            </div>
                            <span class="level">Lvl ${user.level || '?'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `;
    // --- ---

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' }); // Wait for fonts/images potentially

    const imagePath = path.join(__dirname, `../temp/leaderboard_${Date.now()}.png`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(imagePath);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    await page.screenshot({ path: imagePath });
    await browser.close();
    
    return imagePath;
}