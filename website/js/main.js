// Main Entry Point
let game = null;

// Loading simulation
function simulateLoading() {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');

    const loadingSteps = [
        { progress: 20, text: 'Loading Three.js...' },
        { progress: 40, text: 'Creating winter world...' },
        { progress: 60, text: 'Generating snowfall...' },
        { progress: 80, text: 'Building Konoha village...' },
        { progress: 100, text: 'Ready!' }
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
        if (currentStep < loadingSteps.length) {
            const step = loadingSteps[currentStep];
            progressBar.style.width = step.progress + '%';
            loadingText.textContent = step.text;
            currentStep++;
        } else {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('game-container').style.display = 'block';
                showLoginPrompt();
            }, 500);
        }
    }, 400);
}

// Show login prompt
function showLoginPrompt() {
    const loginPrompt = document.getElementById('login-prompt');
    loginPrompt.style.display = 'flex';

    // Discord login button
    document.getElementById('discord-login-btn').addEventListener('click', () => {
        loginWithDiscord();
    });

    // Guest play button
    document.getElementById('guest-play-btn').addEventListener('click', () => {
        startGame({ username: 'Guest Ninja', isGuest: true });
    });
}

// Discord OAuth login
function loginWithDiscord() {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
    window.location.href = authUrl;
}

// Handle OAuth callback
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // Exchange code for token (this should be done server-side for security)
        // For now, we'll just start the game
        startGame({ username: 'Discord User', isGuest: false });
    }
}

// Start the game
function startGame(userData) {
    // Hide login prompt
    document.getElementById('login-prompt').style.display = 'none';

    // Update player name
    document.getElementById('player-name').textContent = userData.username;

    // Initialize game
    game = new Game();

    // Load player data if not guest
    if (!userData.isGuest) {
        loadPlayerData();
    }
}

// Load player data from API
async function loadPlayerData() {
    try {
        const userId = localStorage.getItem('discord_id');
        if (!userId) return;

        const response = await fetch(`${CONFIG.API_URL}/api/player/${userId}`, {
            headers: {
                'X-API-Key': CONFIG.API_KEY
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateHUD(data);
        }
    } catch (error) {
        console.error('Failed to load player data:', error);
    }
}

// Update HUD with player data
function updateHUD(playerData) {
    if (playerData.ryo !== undefined) {
        document.getElementById('ryo-amount').textContent = playerData.ryo.toLocaleString();
    }

    // Update other stats as needed
}

// Grant reward (called from minigames)
async function grantReward(reward) {
    try {
        const userId = localStorage.getItem('discord_id');
        if (!userId) {
            console.log('Guest users cannot save rewards');
            return;
        }

        const response = await fetch(`${CONFIG.API_URL}/api/reward`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API_KEY
            },
            body: JSON.stringify({
                userId: userId,
                reward: reward
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Reward granted:', result);
            loadPlayerData(); // Refresh player data
        }
    } catch (error) {
        console.error('Failed to grant reward:', error);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Check if returning from OAuth
    if (window.location.search.includes('code=')) {
        handleOAuthCallback();
    } else {
        simulateLoading();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (game) {
        game.stop();
    }
});
