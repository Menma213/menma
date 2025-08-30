# Rank.top SDK

Official module for interacting with the Rank.top API.

## Installation

```bash
npm install @rank-top/sdk
```

## Usage

### Basic Setup

```javascript
import { RankTopClient } from '@rank-top/sdk';

// Initialize the client
const rankTop = new RankTopClient({
  apiKey: 'YOUR_API_KEY',
});
```

### Autoposter

The SDK includes an autoposter that automatically updates your bot statistics on Rank.top.

```javascript
import { Client, GatewayIntentBits } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Start posting stats automatically
rankTop.startAutopost({
  client: client, // Your Discord client instance
  authorization: 'BOT_AUTHORIZATION_TOKEN',
});
```

**Note:** The autoposter currently only works with a discord.js client. You may need to use our API directly if you are using a different framework.

### Events

The client uses event emitters for autoposter status:

```javascript
// Listen for successful stats posting
rankTop.on('autoposter/posted', (stats) => {
  console.log('Stats posted successfully:', stats);
});

// Listen for errors
rankTop.on('autoposter/error', (error) => {
  console.error('Error posting stats:', error);
});

// Listen for when autoposter is stopped
rankTop.on('autoposter/stopped', () => {
  console.log('Autoposter has been stopped');
});
```

## API Reference

### RankTopClient

The main client for interacting with the Rank.top API.

#### Constructor

```javascript
new RankTopClient({ apiKey: string, baseURL?: string })
```

#### Methods

- `startAutopost(config: AutoposterConfig, disableStats?: DisableStats): Promise<void>` - Starts the autoposter
- `stopAutopost(): void` - Stops the autoposter

#### Events

- `autoposter/posted` - Emitted when stats are successfully posted
- `autoposter/error` - Emitted when an error occurs during posting
- `autoposter/stopped` - Emitted when the autoposter is stopped
```
