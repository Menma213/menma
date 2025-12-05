// Game Configuration
const CONFIG = {
    // Discord OAuth (Replace with your actual values)
    DISCORD_CLIENT_ID: 'YOUR_DISCORD_CLIENT_ID',
    DISCORD_REDIRECT_URI: window.location.origin + '/callback',

    // API Configuration
    API_URL: 'http://localhost:3000', // Change to your bot API URL
    API_KEY: 'your-api-secret-key',

    // Game Settings
    PLAYER: {
        SPEED: 5,
        SPRINT_MULTIPLIER: 1.5,
        JUMP_FORCE: 10,
        SIZE: 1
    },

    WORLD: {
        SIZE: 100,
        SNOW_PARTICLES: 1000
    },

    CAMERA: {
        FOV: 75,
        NEAR: 0.1,
        FAR: 1000,
        OFFSET: { x: 0, y: 5, z: 10 }
    }
};
