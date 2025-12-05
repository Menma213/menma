# 🌨️ The Unlimited Winter - Web Game

A 3D browser-based Naruto RPG built with Three.js, featuring a winter-themed open world.

## 🎮 Features

### Current Implementation (v0.1)
- ✅ **3D Environment**: Fully explorable snowy world with dynamic lighting
- ✅ **Player Controls**: WASD movement, Space to jump, Shift to sprint
- ✅ **Weather System**: Animated snowfall with 1000+ particles
- ✅ **Village**: Simple geometric buildings with snowy roofs
- ✅ **Camera System**: Smooth third-person camera that follows the player
- ✅ **Minimap**: Real-time minimap showing player position and direction
- ✅ **HUD**: Glassmorphism UI with HP, Chakra, and currency display
- ✅ **Discord OAuth**: Login system (requires configuration)

## 🚀 Quick Start

### Local Development

1. **Open the website**:
   ```bash
   # Simply open index.html in your browser
   # Or use a local server:
   npx http-server . -p 8080
   ```

2. **Access the game**:
   - Navigate to `http://localhost:8080` (if using http-server)
   - Or open `index.html` directly in your browser

### Configuration

Edit `js/config.js` to set up:
- Discord OAuth credentials
- Bot API endpoint
- API secret key

```javascript
const CONFIG = {
    DISCORD_CLIENT_ID: 'YOUR_DISCORD_CLIENT_ID',
    API_URL: 'https://your-bot-api.com',
    API_KEY: 'your-api-secret-key'
};
```

## 🎯 Controls

| Key | Action |
|-----|--------|
| <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> | Move |
| <kbd>Space</kbd> | Jump |
| <kbd>Shift</kbd> | Sprint |
| <kbd>E</kbd> | Interact (coming soon) |

## 📁 Project Structure

```
website/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Glassmorphism styling
├── js/
│   ├── config.js       # Configuration
│   ├── player.js       # Player class with controls
│   ├── environment.js  # 3D world generation
│   ├── game.js         # Game loop and rendering
│   └── main.js         # Entry point and initialization
└── README.md           # This file
```

## 🔧 Technical Stack

- **3D Engine**: Three.js r128
- **Rendering**: WebGL with shadow mapping
- **Physics**: Custom gravity and collision
- **UI**: Pure CSS with glassmorphism
- **Authentication**: Discord OAuth 2.0

## 🌐 Deployment

### Cloudflare Pages

1. **Build**: No build step required (static files)
2. **Deploy**:
   ```bash
   # Install Wrangler CLI
   npm install -g wrangler
   
   # Deploy to Cloudflare Pages
   wrangler pages publish website
   ```

3. **Configure**:
   - Set environment variables in Cloudflare dashboard
   - Update `DISCORD_REDIRECT_URI` to your domain

### Alternative Hosting
- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Drag and drop the `website` folder
- **Vercel**: Connect your repository

## 🔌 Bot Integration

The website connects to your Discord bot via REST API:

### Required Bot Endpoints

```javascript
// Get player data
GET /api/player/:userId
Headers: { 'X-API-Key': 'your-secret' }

// Grant rewards
POST /api/reward
Headers: { 'X-API-Key': 'your-secret' }
Body: { userId: string, reward: { ryo: number } }
```

See the main README for bot API setup instructions.

## 🎨 Customization

### Changing Colors

Edit CSS variables in `css/style.css`:

```css
:root {
    --primary-color: #4a90e2;
    --secondary-color: #7b68ee;
    --accent-color: #00d4ff;
}
```

### Adjusting Game Settings

Edit `js/config.js`:

```javascript
PLAYER: {
    SPEED: 5,              // Movement speed
    SPRINT_MULTIPLIER: 1.5, // Sprint speed boost
    JUMP_FORCE: 10         // Jump height
}
```

## 📊 Performance

- **Target FPS**: 60
- **Particle Count**: 1000 snowflakes
- **Shadow Quality**: 2048x2048
- **Recommended**: Modern browser with WebGL 2.0 support

## 🐛 Known Issues

- Player model is currently a cube (placeholder)
- No collision detection with buildings yet
- Discord OAuth requires server-side token exchange
- Minimap doesn't show buildings

## 🚧 Roadmap

See [suggestions.md](../suggestions.md) for the complete feature roadmap.

### Next Steps
- [ ] Replace cube with 3D character model
- [ ] Add collision detection
- [ ] Implement combat system
- [ ] Add multiplayer synchronization
- [ ] Create minigames

## 📝 License

Part of the Menma Discord Bot project.

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

---

**Built with ❄️ by Claude & User**
