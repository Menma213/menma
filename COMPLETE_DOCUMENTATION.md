# 🍥 MENMA - Complete Project Documentation

> **ShinobiRPG Discord Bot - Ultimate Technical Reference**  
> **Domain:** shinobirpg.online  
> **Project:** Menma213/menma  
> **Last Updated:** December 22, 2025

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Directory Structure](#directory-structure)
4. [Core Bot Files](#core-bot-files)
5. [Commands Reference](#commands-reference)
6. [Data Files & Schemas](#data-files--schemas)
7. [Utility Modules](#utility-modules)
8. [Website Integration](#website-integration)
9. [Battle System](#battle-system)
10. [Event System](#event-system)
11. [Deployment Guide](#deployment-guide)

---

## 🎯 Project Overview

**Menma** is a comprehensive Discord RPG bot based on the Naruto universe. It features:

- **Advanced Battle System**: Turn-based combat with 2400+ jutsus
- **Clan System**: Player clans with territories, wars, and buffs
- **Mission Ranks**: F-Rank through S-Rank missions with scaling rewards
- **Mentor System**: Learn from iconic Naruto characters
- **Bloodline Mechanics**: Uchiha, Hyuga, Uzumaki, Senju, Nara bloodlines
- **Territory Control**: Map-based territory capture system
- **Web Integration**: Story-driven website with OAuth login
- **AI-Powered Story**: Google Gemini AI for dynamic storytelling
- **Tournament System**: Automated PvP tournaments
- **Economy**: Ryo currency, shops, trading, and gambling

---

## 🏗️ Architecture & Technology Stack

### **Core Technologies**

```json
{
  "runtime": "Node.js",
  "framework": "Discord.js v14.19.3",
  "ai": "@google/generative-ai v0.24.1",
  "database": "JSON files + SQLite3",
  "canvas": "canvas v3.2.0 (for image generation)",
  "web": "Express v5.2.1",
  "hosting": "BotHosting.net + Cloudflare Pages"
}
```

### **Key Dependencies**

- **Discord.js**: Bot framework with slash commands
- **Google Generative AI**: AI-powered story generation
- **Canvas**: Dynamic image generation (profiles, leaderboards, battles)
- **Express**: Web server for OAuth and API endpoints
- **SQLite3**: Permanent memory storage
- **Puppeteer**: Browser automation (if needed)
- **Top.gg SDK**: Bot listing integration
- **Async-Mutex**: File locking for concurrent operations

---

## 📁 Directory Structure

```
menma/
├── .agent/                    # AI agent workflows
├── .env                       # Environment variables (DISCORD_TOKEN, API keys)
├── .git/                      # Git repository
├── .vscode/                   # VS Code settings
├── anko/                      # Alternative bot version
├── commands/                  # All slash commands (94 files)
│   ├── events/               # Event-specific commands
│   ├── minigames/            # Minigame commands
│   └── temp/                 # Temporary command storage
├── data/                      # JSON data files (70 files)
│   └── custom_jutsus/        # Player-created jutsus
├── ichiraku ramen/           # Ramen shop feature files
├── node_modules/             # NPM dependencies
├── public/                    # Public assets
├── temp/                      # Temporary files (training images, etc.)
├── tests/                     # Test files
├── tmp/                       # Temporary storage
├── utils/                     # Utility modules (10 files)
├── views/                     # EJS templates
├── website/                   # Web application
│   ├── functions/            # Cloudflare Functions
│   │   ├── api/             # API endpoints
│   │   └── oauth/           # OAuth handlers
│   ├── index.html           # Story page
│   ├── hub.html             # User hub after login
│   ├── style.css            # Styles
│   └── script.js            # Client-side logic
├── bot.js                     # Main bot entry point
├── actualbot.js               # Alternative bot file
├── bothosting.js              # BotHosting.net optimized version
├── webserver.js               # Standalone web server
├── website.js                 # Website integration
├── package.json               # Project dependencies
└── tasks.md                   # Development task list
```

---

## 🤖 Core Bot Files

### **bot.js** (Main Entry Point)

**Purpose**: Initializes the Discord bot, loads commands, registers slash commands, and integrates the web server.

**Key Features**:
- Loads all command files from `/commands`
- Registers slash commands with Discord API
- Sets up event listeners (interactionCreate, guildMemberAdd, messageCreate)
- Integrates Express web server for OAuth
- Auto-starts Forest of Death every 3 hours
- Handles welcome cards for new members

**Environment Variables Required**:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
WEB_PORT=3001
REDIRECT_URI=http://shinobirpg.online/oauth/callback
GEMINI_API_KEY=your_gemini_key
```

**Web Server Endpoints**:
- `GET /` - Serves index.html (story page)
- `GET /login/discord` - Initiates Discord OAuth
- `GET /oauth/callback` - Handles OAuth callback
- `POST /api/complete-story` - Saves story completion
- `POST /api/track-view` - Tracks story views

---

### **actualbot.js** & **bothosting.js**

Alternative bot entry points with slight variations for different hosting environments.

---

## 🎮 Commands Reference

### **Core Battle Commands**

#### **/combinedcommands.js** (3635 lines)
**The heart of the battle system**

**Functions**:
- `runBattle(player1, player2, interaction, battleType, options)` - Main battle engine
- `getEffectiveStats(entity)` - Calculates stats with buffs/debuffs
- `processActiveEffects(combatant)` - Handles DoT, buffs, status effects
- `generateBattleImage(player1, player2, customBgUrl)` - Creates battle visuals
- `applyBloodlineActivation(user, opponent, state)` - Bloodline special abilities

**Effect Handlers**:
- `damage(user, target, formula, effect)` - Damage calculation with dodge mechanics
- `buff(user, statsDefinition)` - Applies stat buffs
- `debuff(target, statsDefinition)` - Applies stat debuffs
- `heal(user, formula)` - Healing effects
- `lifesteal(damage, percentage, user)` - Life steal mechanics
- `revive(combatant, effect)` - Revive mechanics
- `chakraGain(user, formula)` - Chakra restoration
- `auto_kill(currentRound, targetHealth, effect)` - Instant kill conditions
- `status(chance)` - Status effect application
- `calculateDoTDamage(combatant, effect)` - Damage over time

**Status Effects**:
- Stun, Bleed, Burn, Poison, Freeze, Drown, Flinch, Curse

**Bloodlines**:
- **Uchiha**: Sharingan activation (HP < 50%), 3x power/defense, copy jutsu
- **Hyuga**: Byakugan (HP < 40%), chakra drain, 2x accuracy
- **Uzumaki**: Chakra chains (HP < 30%), massive chakra boost
- **Senju**: Wood Release (HP < 35%), healing + defense
- **Nara**: Shadow possession (HP < 45%), stun + strategy

**Battle Types**:
- `pvp` - Player vs Player
- `pve` - Player vs Environment
- `mission` - Mission battles (F/D/B/A/S rank)
- `tournament` - Tournament matches
- `clan_war` - Clan warfare
- `guardian` - Territory guardian challenges
- `raid` - Event raid battles

---

#### **/fight.js**
**Command**: `/fight @user`

Initiates PvP battles between players.

**Features**:
- Challenge system with accept/decline buttons
- Uses `runBattle()` from combinedcommands
- Tracks wins/losses in user stats
- Cooldown system to prevent spam

---

#### **/travel.js** (275 lines)
**Command**: `/travel [view|move|challenge]`

**Subcommands**:

1. **`/travel view`**
   - Shows current location and tier
   - Displays available territories
   - Shows travel requirements

2. **`/travel move <destination>`**
   - Move to different territories
   - Territories: Hidden Leaf, Hidden Sand, Hidden Mist, Hidden Cloud, Hidden Stone, Hidden Rain
   - Unlocks based on tier progression

3. **`/travel challenge`**
   - Challenge territory guardians
   - Requirements: Level-based or mission completion
   - Guardian stats scale with tier
   - Victory unlocks next tier

**Guardian System**:
```javascript
BASE_GUARDIAN_STATS = {
    health: 1000,
    power: 50,
    defense: 30,
    accuracy: 90,
    dodge: 10
}
// Scales by tier multiplier
```

**Data Storage**: `data/territories.json`, `data/players.json`

---

### **Mission Commands**

#### **/frank.js** (F-Rank Missions)
**Command**: `/frank`

**Details**:
- **Cooldown**: 3 seconds
- **Rewards**: 1 EXP, 10-50 Ryo
- **Difficulty**: Very Easy
- **Purpose**: Beginner missions for new players

---

#### **/drank.js** (D-Rank Missions)
**Command**: `/drank`

**Details**:
- **Cooldown**: 10 seconds
- **Rewards**: 10 EXP, 50-150 Ryo
- **Difficulty**: Easy
- **Enemies**: Basic NPCs

---

#### **/brank.js** (B-Rank Missions)
**Command**: `/brank`

**Details**:
- **Cooldown**: 13 seconds
- **Rewards**: 10-30 EXP (random), 100-300 Ryo
- **Difficulty**: Medium
- **Features**: Canvas-generated mission cards

---

#### **/arank.js** (A-Rank Missions)
**Command**: `/arank`

**Details**:
- **Cooldown**: 18 seconds
- **Base Rewards**: 9 EXP per mission
- **Bonus**: Every 5 missions = 1x multiplier
- **Jackpot**: After 50 missions = 3x multiplier
- **Difficulty**: Hard
- **Tracking**: Counts total A-rank completions

---

#### **/srank.js** (S-Rank Missions) (123,241 lines)
**Command**: `/srank <boss>`

**Bosses**:

1. **Haku**
   - **Rewards**: 50 EXP total (25 normal, 25 corrupted form)
   - **Jutsus**: Needle Assault, Ice Prison
   - **Phases**: Normal → Corrupted transformation
   - **Drops**: Haku jutsus

2. **Zabuza**
   - **Rewards**: 60 EXP
   - **Jutsus**: Silent Assassination, Water Dragon
   - **Difficulty**: High
   - **Drops**: Zabuza jutsus

3. **Orochimaru**
   - **Rewards**: 80 EXP
   - **Jutsus**: Serpent's Wrath, Summoning Jutsu
   - **Difficulty**: Very High
   - **Drops**: Orochimaru jutsus

4. **Kurenai** (Multi-phase)
   - **Total Rewards**: 300 EXP
   - **Phases**:
     - Corrupted Orochimaru: 100 EXP
     - Survival Challenge: 100 EXP
     - Kurenai vs Kagami: 100 EXP
   - **Difficulty**: Extreme
   - **Cooldown**: 20 seconds

**Data**: `data/srank.json`, `data/srankBosses.json`

---

#### **/autofrank.js**
**Command**: `/autofrank <duration>`

**Durations**:
- 3 hours: 21,600 EXP
- 6 hours: 43,200 EXP
- 12 hours: 86,400 EXP

**Purchase**: Buy from premium shop with Shinobi Shards
**Mechanism**: Runs F-rank missions automatically in background

---

### **Progression Commands**

#### **/enroll.js** (35,913 lines)
**Command**: `/enroll`

**Purpose**: Character creation and village selection

**Features**:
- Choose starting village (Leaf, Sand, Mist, Cloud, Stone, Rain)
- Initial stats allocation
- Starting jutsus granted
- Creates player profile in `users.json`

**Initial Stats**:
```javascript
{
    health: 100,
    power: 10,
    defense: 10,
    accuracy: 70,
    dodge: 10,
    chakra: 20,
    level: 1,
    exp: 0,
    money: 500
}
```

---

#### **/levelup.js**
**Command**: `/levelup`

**Mechanics**:
- Check if player has enough EXP
- Level up and allocate stat points
- EXP requirement formula: `level * 100`
- Stat points per level: 5

**Stat Options**:
- Health (+10 per point)
- Power (+1 per point)
- Defense (+1 per point)
- Accuracy (+2 per point)
- Dodge (+2 per point)
- Chakra (+5 per point)

---

#### **/rankup.js**
**Command**: `/rankup`

**Ranks**:
1. Academy Student (Level 1)
2. Genin (Level 10)
3. Chuunin (Level 25)
4. Jounin (Level 50)
5. ANBU (Level 75)
6. Sannin (Level 100)
7. Hokage (Level 150)

**Requirements**: Level + possible mission completion

---

#### **/profile.js** (31,437 lines)
**Command**: `/profile [@user]`

**Features**:
- Canvas-generated profile card
- Shows: Level, Rank, Village, Bloodline, Stats, Money, Clan
- Profile themes: Default, Frost, Custom colors
- Displays equipped accessories
- Shows active titles

**Profile Themes**:
- Default
- Frost (Winter event exclusive)
- Custom RGB colors

---

### **Jutsu & Combat Commands**

#### **/learnjutsu.js**
**Command**: `/learnjutsu <jutsu_name>`

**Sources**:
- Mentor training
- Shop purchases
- Mission rewards
- Event rewards
- Scroll missions

**Data**: `data/jutsus.json` (2421 lines, 69KB)

---

#### **/myjutsu.js**
**Command**: `/myjutsu [page]`

**Features**:
- Paginated jutsu list
- Shows: Name, Category, Chakra Cost, Description
- Filter by category
- Shows obtainment method

---

#### **/jutsuinfo.js**
**Command**: `/jutsuinfo <jutsu_name>`

**Displays**:
- Jutsu name and description
- Chakra cost
- Effects (damage, buffs, debuffs, status)
- Category (Genin, Chuunin, Jounin, S-Rank, etc.)
- Obtainment method
- Image/GIF if available

---

#### **/equip.js**
**Command**: `/equip <jutsu_name>`

Equips jutsu to active loadout (max 6 jutsus).

---

#### **/unequip.js**
**Command**: `/unequip <jutsu_name>`

Removes jutsu from active loadout.

---

### **Clan System**

#### **/clan.js** (1042 lines, 52KB)
**Command**: `/clan <subcommand>`

**Subcommands**:

1. **`/clan create <name>`**
   - Cost: 10,000 Ryo
   - Creates new clan
   - Founder becomes leader

2. **`/clan invite @user`**
   - Leader-only
   - Sends clan invitation

3. **`/clan join <clan_name>`**
   - Accept clan invitation
   - Leaves current clan if in one

4. **`/clan leave`**
   - Leave current clan
   - Leader cannot leave (must disband)

5. **`/clan info [clan_name]`**
   - Shows clan details
   - Members list
   - Clan power, tier, treasury

6. **`/clan kick @user`**
   - Leader-only
   - Remove member from clan

7. **`/clan disband`**
   - Leader-only
   - Permanently deletes clan

8. **`/clan bank <add|withdraw> <amount>`**
   - Add Ryo to clan treasury
   - Withdraw (leader-only)
   - Tracks contributions

9. **`/clan buff`**
   - **Cost**: 20,000,000 Ryo (Tier 1)
   - **Effect**: 20x power and defense for all members
   - **Duration**: 99 rounds
   - Applied in battles automatically

10. **`/clan war @opponent`**
    - Challenge another clan member
    - Winner's clan gains power
    - Loser's clan loses power equal to winner's power

11. **`/clan leaderboard`**
    - Shows top 5 clans by power
    - Canvas-generated leaderboard

12. **`/clan contribute <material> <amount>`**
    - Contribute materials to clan
    - Tracks in `clancontributions.json`

**Clan Tiers**:
- Tier 1: 0-1M treasury
- Tier 2: 1M-5M treasury
- Tier 3: 5M-20M treasury
- Tier 4: 20M-50M treasury
- Tier 5: 50M+ treasury

**Data Files**:
- `data/clans.json`
- `data/clantokens.json`
- `data/clancontributions.json`

---

### **Bloodline System**

#### **/bloodline.js** (17,418 lines)
**Command**: `/bloodline [roll|info]`

**Subcommands**:

1. **`/bloodline roll`**
   - **Cost**: 50,000 Ryo
   - **Chances**:
     - Uchiha: 10%
     - Hyuga: 15%
     - Uzumaki: 20%
     - Senju: 25%
     - Nara: 30%
   - One-time roll per player

2. **`/bloodline info`**
   - Shows current bloodline
   - Displays abilities and activation conditions

**Bloodline Abilities**:

**Uchiha (Sharingan)**:
- Activation: HP < 50%
- Effects: 3x power, 3x defense, copy opponent's jutsu
- Visual: Sharingan GIF

**Hyuga (Byakugan)**:
- Activation: HP < 40%
- Effects: 2x accuracy, chakra drain, see through defenses
- Chakra steal cap: 30 chakra max

**Uzumaki (Chakra Chains)**:
- Activation: HP < 30%
- Effects: Massive chakra boost, chakra regeneration
- Bonus: +50 chakra

**Senju (Wood Release)**:
- Activation: HP < 35%
- Effects: Healing, increased defense, vitality
- Heal: 20% max HP per round

**Nara (Shadow Possession)**:
- Activation: HP < 45%
- Effects: Stun opponent, strategic advantage
- Duration: 2 rounds

**Data**: Stored in `users.json` under `bloodline` field

---

### **Economy Commands**

#### **/shop.js** (16,697 lines)
**Command**: `/shop [category]`

**Categories**:

1. **Combo Shop**
   - Jutsu combinations
   - Prices: 5,000 - 50,000 Ryo
   - Data: `data/combos.json`

2. **Premium Shop**
   - Shinobi Shards currency
   - Donator role, VIP perks
   - Auto-frank packages
   - Stat refunds

3. **Event Shop**
   - Seasonal items
   - Christmas tokens
   - Event jutsus
   - Limited edition profile themes

4. **Akatsuki Shop**
   - All combos available simultaneously
   - High-tier combinations
   - Requires Akatsuki membership

5. **ANBU Shop**
   - Exclusive ANBU items
   - Requires ANBU rank

**Display**: Paginated embeds with item details

---

#### **/buy.js** (700 lines, 32KB)
**Command**: `/buy <item>`

**Purchase Types**:

1. **Combo Purchase**
   - Deducts Ryo
   - Adds combo to inventory
   - Logs purchase

2. **Premium Purchase**
   - Uses Shinobi Shards
   - Grants roles (Donator, VIP)
   - Activates auto-frank
   - Auto-equips profile themes

3. **Event Purchase**
   - Uses event tokens (Christmas tokens)
   - Limited-time items

4. **ANBU Purchase**
   - ANBU-exclusive items

**Auto-Frank Mechanism**:
```javascript
durations = {
    '3h': { exp: 21600, price: 600 },
    '6h': { exp: 43200, price: 1400 },
    '12h': { exp: 86400, price: 2000 }
}
```

**Role Management**:
- Schedules role removal after duration
- Persists across bot restarts
- Stored in `players.json`

---

#### **/trade.js** (29,135 lines)
**Command**: `/trade @user`

**Features**:
- Trade Ryo, jutsus, items
- Confirmation system (both parties must accept)
- Prevents scamming with verification
- Logs all trades

**Thunderbird NPC**:
- Random spawn in specific channel
- Trade event tokens for rare items
- Message listener for "thunderbird" keyword

---

#### **/gift.js** (42,875 lines)
**Command**: `/gift @user <amount>`

**Features**:
- Gift Ryo to other players
- Daily gift limit
- Anti-abuse measures
- Logs all gifts

**Data**: `data/gift.json`

---

#### **/rob.js**
**Command**: `/rob @user`

**Mechanics**:
- Chance-based robbery
- Success: Steal 10-30% of target's Ryo
- Failure: Lose Ryo as penalty
- Cooldown: 1 hour

---

### **Mentor System**

#### **/mentors.js**
**Command**: `/mentors [view|train]`

**Available Mentors**:

1. **Naruto**
   - Jutsus: Shadow Clone, Rasengan, Rasenshuriken
   - Ranks: Genin, Chuunin, Jounin

2. **Sasuke**
   - Jutsus: Fireball, Kirin, Lightning techniques
   - Ranks: Genin, Chuunin, Jounin

3. **Sakura**
   - Jutsus: Mystic Palm, Cherry Blossom Impact
   - Ranks: Genin, Chuunin, Jounin

4. **Kakashi**
   - Jutsus: Lightning Blade, Summon Ninken
   - Ranks: Genin, Chuunin, Jounin

5. **Shikamaru**
   - Jutsus: Analysis, Shadow Strangle
   - Ranks: Genin, Chuunin, Jounin

6. **Asuma**
   - Jutsus: Infused Chakra Blade
   - Ranks: Chuunin, Jounin

**Training**:
- Costs Ryo
- Grants mentor EXP
- Unlocks jutsus at rank milestones
- Data: `data/mentors.json`, `data/mentorexp.json`

---

### **Special Organizations**

#### **/akatsuki.js** (12,090 lines)
**Command**: `/akatsuki [join|leave|info]`

**Requirements**:
- Level 100+
- 1,000,000 Ryo entry fee

**Benefits**:
- Access to Akatsuki shop
- Exclusive combos
- Akatsuki role

**Data**: `data/akatsuki.json`

---

#### **/anbu.js**
**Command**: `/anbu [join|leave|info]`

**Requirements**:
- ANBU rank (Level 75+)
- Village loyalty

**Benefits**:
- ANBU shop access
- Exclusive missions
- ANBU role

**Data**: `data/anbu.json`

---

#### **/otsutsuki.js**
**Command**: `/otsutsuki [join|leave|info]`

**Requirements**:
- Level 200+
- Completion of special quest

**Benefits**:
- God-tier abilities
- Exclusive jutsus
- Otsutsuki role

**Cooldowns**: `data/otsutsuki_cooldowns.json`

---

#### **/rogue.js**
**Command**: `/rogue`

**Purpose**: Leave village and become rogue ninja

**Effects**:
- Lose village affiliation
- Cannot participate in village events
- Bounty system activated
- Can be hunted by other players

---

### **Territory & Map System**

#### **/map.js**
**Command**: `/map`

**Features**:
- Displays world map with territories
- Shows control points and ownership
- Clan-controlled territories highlighted
- Canvas-generated map image

**Map Generator**: `utils/mapGenerator.js` (13,078 lines)

**Territories**:
- Hidden Leaf Village
- Hidden Sand Village
- Hidden Mist Village
- Hidden Cloud Village
- Hidden Stone Village
- Hidden Rain Village

**Control Points**:
- Each territory has control points
- Clans capture by winning battles
- Progress bar shows capture percentage

**Data**: `data/territories.json`

---

### **Event Commands**

#### **/event.js** (46,919 lines)
**Command**: `/event`

**Current Event**: Winter Raid Event

**Structure**:

1. **Story Phase**
   - Check if player completed story on website
   - Redirect to shinobirpg.online if not completed
   - Webhook-style embeds for lore

2. **Raid Phase (50 Floors)**
   - 10 unique NPCs across 5 tiers
   - Each tier: NPCs 1-10 repeated with stat scaling
   - Tier multipliers: 1.5x per tier
   - Uses `runBattle()` for combat
   - "Next Floor" button after each win
   - "Retreat" saves progress

3. **Boss Fight (Floor 51): King Kori**
   - **HP**: 500,000,000
   - **Stats**: Dynamic scaling (User stats * 1.1 + base)
   - **Enrage**: HP < 75% unlocks OHKO moves
   - **Jutsus**:
     - Twin Rising Dragons (10% chance)
     - Primary Lotus (5% chance)
     - Needle Assault (10% chance)
     - Planetary Devastation (3% chance, OHKO)
   - **Turn Order**: Boss attacks first (Soulsborne-style)

4. **Rewards**:
   - Christmas Tokens
   - Event jutsus
   - Exclusive profile themes

**Daily Rewards** (Dec 10-25):
- 15-day calendar
- Randomized rewards: EXP, Ramen, Ryo
- Guaranteed Christmas Tokens
- Canvas-generated calendar image

**Event Shop**:
- Crystal Palace jutsu (500 Christmas Tokens)
- Frost profile theme (auto-equips on purchase)
- Event-exclusive jutsus

**Data**: `data/raid_progress.json`, `data/christmas_tokens.json`, `data/christmas_daily.json`

---

#### **/fod.js** (Forest of Death) (19,994 lines)
**Command**: `/fod [join|start|status]`

**Mechanics**:
- Battle royale-style event
- Auto-starts every 3 hours
- Players join during signup period
- Last player standing wins
- Rewards: Massive EXP and Ryo

**Phases**:
1. Signup (10 minutes)
2. Battle (automatic matchmaking)
3. Winner announcement

**Data**: `data/fod.json`

---

#### **/tournament.js** (26,837 lines)
**Command**: `/tournament [create|join|start|bracket]`

**Features**:
- Single/double elimination brackets
- Automated matchmaking
- Canvas-generated bracket visualization
- Prize pools

**Bracket System**: `utils/bracket.js`

**Settings**: `commands/tournament_settings.json`

---

### **AI & Story Commands**

#### **/story.js** (1272 lines, 50KB)
**Command**: `/story <prompt>`

**Features**:

1. **AI Story Generation**
   - Google Gemini AI integration
   - Context-aware responses
   - Permanent memory (SQLite)
   - Chained conversations (5-minute window)

2. **Dynamic Command Creation**
   - AI can create minigame commands
   - Registers commands dynamically
   - Stores in `commands/minigames/`

3. **Data Management Tools**
   - Modify `jutsus.json`
   - Update `users.json`
   - Edit `players.json`
   - Read helper data

4. **Goal Setter**
   - Detects level goal requests
   - Calculates EXP requirements
   - Creates training roadmap

5. **Moderation**
   - Content filtering
   - Prevents abuse
   - Logs violations

**Memory System**:
- **Permanent Memory**: SQLite database (`data/permanent_memory.db`)
- **Temporary Memory**: JSON file (`data/temp_memory.json`)
- **Keyword Search**: Finds relevant memories
- **Auto-cleanup**: Removes old temp memories (5 minutes)

**Prompt Limits**:
- Free users: 5 prompts/day
- Donators: 20 prompts/day
- VIP: Unlimited

**Server Restriction**: Only works in official server (ID: `1381268582595297321`)

**Functions**:
- `createMinigame()` - Creates new minigame command
- `deleteMinigame()` - Removes minigame
- `reloadMinigame()` - Reloads minigame
- `refreshDiscordCommands()` - Updates Discord API
- `registerNewCommand()` - Registers new command
- `moderateMessage()` - Content moderation
- `detectLevelGoalRequest()` - Goal detection
- `savePermanentMemory()` - Saves to SQLite
- `searchMemoryByKeywords()` - Keyword search

**Data Files**:
- `data/permanent_memory.db`
- `data/temp_memory.json`
- `data/chained_conversations.json`
- `data/ai_state.json`
- `data/minigames.txt` (dataset)
- `data/commands_dataset.json`

---

### **Scroll & Quest Commands**

#### **/scroll.js** (54,590 lines)
**Command**: `/scroll <mission_name>`

**Missions**:

1. **Naruto Quest**
   - Multi-phase story
   - Rewards: Asura's Blade of Execution
   - Difficulty: Extreme

2. **Sage Mode Quest**
   - Train with toads
   - Unlock Sage Mode transformation
   - Stat multipliers

3. **Tailed Beast Quest**
   - Capture/befriend tailed beasts
   - Unlock jinchuriki powers

**Features**:
- Story-driven missions
- Multiple phases
- Unique rewards
- One-time completion

---

### **Leaderboard & Stats**

#### **/leaderboard.js** (13,774 lines)
**Command**: `/leaderboard [type]`

**Types**:

1. **Level Leaderboard**
   - Top 10 players by level
   - Shows: Username, Level, EXP

2. **Money Leaderboard**
   - Top 10 richest players
   - Shows: Username, Ryo

3. **Power Leaderboard**
   - Top 10 by power stat
   - Shows: Username, Power

4. **Clan Leaderboard**
   - Top 5 clans by power
   - Canvas-generated with custom design
   - Shows: Clan name, Power, Members

**Canvas Generation**:
- Custom backgrounds
- Player avatars
- Rank badges
- Animated GIFs

**Data**: Reads from `users.json`, `clans.json`

---

### **Utility Commands**

#### **/help.js**
**Command**: `/help [command]`

**Features**:
- Lists all commands
- Shows command details
- Usage examples
- Categorized by type

---

#### **/cooldowns.js**
**Command**: `/cooldowns`

**Displays**:
- Active cooldowns for all commands
- Time remaining
- Next available use

**Data**: `data/cooldowns.json`

---

#### **/inventory.js**
**Command**: `/inventory`

**Shows**:
- Owned jutsus
- Items
- Accessories
- Consumables

**Data**: `data/inventory.json`, `data/userJutsuInventory.json`

---

#### **/accessory.js**
**Command**: `/accessory [equip|unequip|list]`

**Accessories**:
- Cosmetic items
- Stat bonuses
- Visual effects on profile

**Data**: `data/accessories.json`, `data/userAccessory.json`

---

#### **/title.js**
**Command**: `/title [equip|list]`

**Titles**:
- Earned through achievements
- Displayed on profile
- Prestige system

---

### **Admin Commands**

#### **/admincommand101.js**
**Purpose**: Grant items to users

**Usage**: `/admin101 @user <item> <amount>`

---

#### **/admincommand103.js**
**Purpose**: Modify user stats

**Usage**: `/admin103 @user <stat> <value>`

---

#### **/admincommand104.js**
**Purpose**: Reset user data

**Usage**: `/admin104 @user`

---

#### **/admincommand106.js**
**Purpose**: Broadcast announcements

**Usage**: `/admin106 <message>`

---

#### **/admincommand110.js**
**Purpose**: Manage events

**Usage**: `/admin110 <action>`

---

#### **/resetcd.js**
**Purpose**: Reset cooldowns

**Usage**: `/resetcd @user [command]`

---

#### **/ranksetter.js**
**Purpose**: Set player rank

**Usage**: `/ranksetter @user <rank>`

---

#### **/ban-no-jutsu.js**
**Purpose**: Ban users from bot

**Usage**: `/ban-no-jutsu @user`

---

### **Miscellaneous Commands**

#### **/vote.js**
**Command**: `/vote`

**Purpose**: Links to Top.gg voting page

**Rewards**: Bonus Ryo and EXP for voting

---

#### **/invite.js**
**Command**: `/invite`

**Purpose**: Generates bot invite link

**Features**:
- Server count display
- Invite rewards

---

#### **/quiz.js** / **/narutoquiz.js** / **/animequiz.js**
**Commands**: `/quiz`, `/narutoquiz`, `/animequiz`

**Features**:
- Trivia questions
- Rewards for correct answers
- Leaderboards

**Data**: `data/quiz.json`

---

#### **/meme.js**
**Command**: `/meme`

**Purpose**: Generates random Naruto memes

---

#### **/imbored.js**
**Command**: `/imbored`

**Purpose**: Suggests random activities

---

#### **/eat.js**
**Command**: `/eat <food>`

**Foods**:
- Ramen Bowl: Restore health
- Soldier Pill: Restore chakra
- Bento Box: Restore both

**Data**: Consumables in inventory

---

#### **/defense.js**
**Command**: `/defense`

**Purpose**: Temporary defense boost

**Cooldown**: 1 hour

---

#### **/yeet.js**
**Command**: `/yeet @user`

**Purpose**: Fun command to "yeet" users

---

#### **/amoguus.js**
**Command**: `/amoguus`

**Purpose**: Among Us-style minigame

---

#### **/tutorial.js** (44,661 lines)
**Command**: `/tutorial`

**Features**:
- Interactive tutorial for new players
- Step-by-step guide
- Rewards for completion
- Grants starting jutsus

---

#### **/welcome.js**
**Command**: Auto-triggered on member join

**Features**:
- Canvas-generated welcome card
- Shows user avatar and username
- Sends to designated welcome channel

**Config**: `commands/welcome_config.json`

---

### **Council & Election System**

#### **/council.js**
**Command**: `/council [vote|nominate|results]`

**Features**:
- Village council elections
- Nomination system
- Voting period
- Council powers

**Data**: `data/election.json`, `data/pending_votes.json`

---

#### **/appoint.js**
**Command**: `/appoint @user <position>`

**Purpose**: Council leader appoints positions

---

#### **/revoke.js**
**Command**: `/revoke @user <position>`

**Purpose**: Remove appointed positions

---

### **War System**

#### **/war.js** (67,702 lines)
**Command**: `/war [declare|accept|status]`

**Features**:
- Village vs Village wars
- Territory control objectives
- War points system
- Victory conditions

**Phases**:
1. Declaration
2. Preparation (24 hours)
3. Active war (7 days)
4. Resolution

**Rewards**:
- Territory control
- War tokens
- Exclusive items

---

### **Bounty System**

#### **/bounty.js**
**Command**: `/bounty [place|claim|list]`

**Features**:
- Place bounties on players
- Claim bounties by defeating targets
- Bounty leaderboard

**Data**: `data/bounty.json`

---

### **Blueprint & Crafting**

#### **/blueprint.js** / **/bp.js**
**Command**: `/blueprint [craft|list]`

**Features**:
- Craft items from blueprints
- Material requirements
- Unlock new blueprints

**Data**: `data/blueprints.json`, `data/bptiers.json`

---

#### **/shardshop.js**
**Command**: `/shardshop`

**Purpose**: Shop using Shinobi Shards

**Items**:
- Premium items
- Exclusive jutsus
- Rare materials

---

### **Server Management**

#### **/server.js**
**Command**: `/server [info|settings]`

**Features**:
- Server statistics
- Bot configuration
- Role management

---

#### **/serverevent.js**
**Command**: `/serverevent [create|manage]`

**Purpose**: Server-specific events

**Data**: `data/server_events.txt`

---

#### **/setrole.js**
**Command**: `/setrole @user <role>`

**Purpose**: Assign roles based on rank/achievements

---

#### **/shinobikick.js**
**Command**: `/shinobikick @user`

**Purpose**: Kick users from clan/organization

---

### **Testing & Debug Commands**

#### **/testcrank.js**
**Purpose**: Test C-rank missions

---

#### **/tracker.js**
**Command**: `/tracker`

**Purpose**: Track player progress and statistics

---

#### **/gain.js**
**Command**: `/gain <stat> <amount>`

**Purpose**: Debug command for stat testing

---

#### **/refund.js**
**Command**: `/refund`

**Purpose**: Refund stat points

**Cost**: 500 Shinobi Shards

---

---

## 📊 Data Files & Schemas

### **users.json**
**Primary player data storage**

```json
{
  "userId": {
    "id": "string",
    "username": "string",
    "level": "number",
    "exp": "number",
    "money": "number",
    "health": "number",
    "maxHealth": "number",
    "power": "number",
    "defense": "number",
    "accuracy": "number",
    "dodge": "number",
    "chakra": "number",
    "maxChakra": "number",
    "village": "string",
    "rank": "string",
    "bloodline": "string",
    "clan": "string",
    "mentor": "string",
    "mentorExp": "number",
    "equippedJutsus": ["array"],
    "ownedJutsus": ["array"],
    "inventory": {},
    "wins": "number",
    "losses": "number",
    "completedRaidStory": "boolean",
    "storyJutsu": "string",
    "profile_color": "string",
    "title": "string",
    "accessories": ["array"]
  }
}
```

---

### **players.json**
**Extended player data**

```json
{
  "userId": {
    "currentLocation": "string",
    "tier": "number",
    "missions_completed": "number",
    "premium_roles": {
      "donator": { "expiresAt": "timestamp" },
      "vip": { "expiresAt": "timestamp" }
    },
    "autofrank": {
      "active": "boolean",
      "expiresAt": "timestamp",
      "duration": "string"
    }
  }
}
```

---

### **jutsus.json** (2421 lines)
**All jutsu definitions**

```json
{
  "Jutsu Name": {
    "name": "string",
    "description": "string",
    "info": "string",
    "chakraCost": "number",
    "category": "string",
    "obtainment": "string",
    "image_url": "string (optional)",
    "effects": [
      {
        "type": "damage|buff|debuff|heal|status|chakra_gain",
        "formula": "string (math expression)",
        "stats": { "stat": "formula" },
        "duration": "number",
        "chance": "number",
        "status": "stun|bleed|burn|poison|freeze",
        "damagePerTurn": "formula"
      }
    ],
    "roundBased": "boolean (optional)",
    "roundEffects": {
      "round_number": {
        "description": "string",
        "effects": ["array"]
      }
    }
  }
}
```

**Example Jutsu**:
```json
{
  "Rasengan": {
    "name": "Rasengan",
    "description": "Gathers chakra in palm and attacks",
    "info": "Naruto's trademark move",
    "chakraCost": 3,
    "category": "Jounin",
    "obtainment": "obtained from naruto at jounin rank",
    "image_url": "https://example.com/rasengan.gif",
    "effects": [
      {
        "type": "damage",
        "formula": "2010 * user.power / target.defense"
      }
    ]
  }
}
```

---

### **clans.json**
```json
{
  "clanName": {
    "name": "string",
    "leader": "userId",
    "members": ["userId array"],
    "power": "number",
    "tier": "number",
    "treasury": "number",
    "createdAt": "timestamp",
    "buffs": {
      "active": "boolean",
      "expiresAt": "timestamp"
    }
  }
}
```

---

### **territories.json**
```json
{
  "territoryName": {
    "name": "string",
    "tier": "number",
    "controlPoints": "number",
    "maxControlPoints": "number",
    "controlledBy": "clanName",
    "guardian": {
      "name": "string",
      "health": "number",
      "power": "number",
      "defense": "number",
      "accuracy": "number",
      "dodge": "number"
    }
  }
}
```

---

### **combos.json**
```json
{
  "comboName": {
    "name": "string",
    "jutsus": ["jutsu1", "jutsu2", "jutsu3"],
    "price": "number",
    "description": "string"
  }
}
```

---

### **blueprints.json**
```json
{
  "blueprintName": {
    "name": "string",
    "materials": {
      "material1": "amount",
      "material2": "amount"
    },
    "result": "item",
    "tier": "number"
  }
}
```

---

### **guardians.json**
```json
{
  "guardianName": {
    "name": "string",
    "tier": "number",
    "health": "number",
    "power": "number",
    "defense": "number",
    "accuracy": "number",
    "dodge": "number",
    "jutsus": ["array"],
    "description": "string"
  }
}
```

---

### **effects.json**
**Status effect configurations**

```json
{
  "stun": {
    "name": "Stun",
    "description": "Cannot act",
    "emoji": "😵"
  },
  "bleed": {
    "name": "Bleed",
    "description": "Damage over time",
    "emoji": "🩸",
    "damagePercent": 0.1
  }
}
```

---

### **requirements.json**
**Rank/mission requirements**

```json
{
  "Genin": { "level": 10 },
  "Chuunin": { "level": 25 },
  "Jounin": { "level": 50 }
}
```

---

### **mentors.json**
```json
{
  "mentorName": {
    "name": "string",
    "jutsus": {
      "Genin": ["jutsu1"],
      "Chuunin": ["jutsu2"],
      "Jounin": ["jutsu3"]
    },
    "trainingCost": "number"
  }
}
```

---

### **cooldowns.json**
**Active cooldowns**

```json
{
  "userId": {
    "commandName": "timestamp"
  }
}
```

---

### **event_rewards.json**
```json
{
  "eventName": {
    "rewards": {
      "exp": "number",
      "money": "number",
      "items": ["array"]
    }
  }
}
```

---

### **christmas_tokens.json**
```json
{
  "userId": "amount"
}
```

---

### **raid_progress.json**
```json
{
  "userId": {
    "currentFloor": "number",
    "completed": "boolean"
  }
}
```

---

### **permanent_memory.db** (SQLite)
**AI memory storage**

**Schema**:
```sql
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_text TEXT NOT NULL,
    keywords TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);
```

---

### **second_brain.sqlite** (SQLite)
**Secondary AI memory**

---

### **commands_dataset.json**
**AI training data for commands**

---

### **helper.json**
**Helper data for AI**

---

### **goalsetter.json**
**Player goal tracking**

```json
{
  "userId": {
    "targetLevel": "number",
    "currentLevel": "number",
    "expNeeded": "number",
    "roadmap": ["array"]
  }
}
```

---

## 🛠️ Utility Modules

### **utils/battleUtils.js**
**Battle helper functions**

**Functions**:
- `calculateDamage(attacker, defender, jutsu)`
- `applyStatusEffect(target, effect)`
- `checkDodge(attacker, defender)`
- `calculateCritical(attacker)`

---

### **utils/mapGenerator.js** (13,078 lines)
**Generates territory maps**

**Functions**:
- `generateMap(territories, clans)`
- `drawTerritory(ctx, territory, x, y)`
- `drawControlPoints(ctx, territory)`
- `addClanMarkers(ctx, clans)`

**Canvas Operations**:
- Territory shapes
- Control point rings
- Clan emblems
- Progress bars

---

### **utils/mapPositioningHelper.js** (10,576 lines)
**Map positioning calculations**

**Functions**:
- `calculateTerritoryPosition(territoryName)`
- `getAdjacentTerritories(territory)`
- `calculateDistance(pos1, pos2)`

---

### **utils/materialUtils.js**
**Material management**

**Functions**:
- `addMaterial(userId, material, amount)`
- `removeMaterial(userId, material, amount)`
- `getMaterials(userId)`
- `hasMaterials(userId, requirements)`

**Data**: Reads/writes to `data/inventory.json`

---

### **utils/playersdata.js**
**Player data helpers**

**Functions**:
- `getPlayer(userId)`
- `updatePlayer(userId, data)`
- `createPlayer(userId, initialData)`
- `deletePlayer(userId)`

---

### **utils/locks.js**
**File locking for concurrent access**

**Functions**:
- `acquireLock(filePath)`
- `releaseLock(filePath)`

**Uses**: `proper-lockfile` package

---

### **utils/bracket.js**
**Tournament bracket generation**

**Functions**:
- `generateBracket(players, type)`
- `advanceWinner(bracket, matchId, winnerId)`
- `drawBracket(bracket)` - Canvas visualization

---

### **utils/code_analyzer.js**
**Code analysis for AI**

**Functions**:
- `analyzeCode(code)`
- `extractFunctions(code)`
- `findDependencies(code)`

---

## 🌐 Website Integration

### **Website Structure**

```
website/
├── index.html          # Story/lore page
├── hub.html            # User hub after login
├── style.css           # Styles
├── script.js           # Client-side logic
├── bridge_game.js      # Minigame integration
├── functions/
│   ├── api/
│   │   ├── complete-story.js    # Story completion API
│   │   └── track-view.js        # View tracking API
│   └── oauth/
│       └── callback.js          # OAuth callback handler
└── _routes.json        # Cloudflare routing
```

---

### **index.html** (Story Page)

**Features**:
- Winter event lore
- Interactive story panels
- Kakashi dialogue
- Raid castle introduction
- Discord login button

**Flow**:
1. User reads story
2. Clicks "Continue" through panels
3. Reaches end: "Raid the Castle"
4. Logs in with Discord
5. Story completion saved to `users.json`

---

### **hub.html** (User Hub)

**Features**:
- Welcome message with Discord username
- Avatar display
- "Continue Story" button (launches `/event` in Discord)
- User stats display

**Query Parameters**:
- `username` - Discord username
- `discord_id` - Discord user ID
- `avatar` - Discord avatar hash

---

### **functions/api/complete-story.js**

**Cloudflare Function**

**Endpoint**: `POST /api/complete-story`

**Request Body**:
```json
{
  "userId": "string",
  "storyId": "string",
  "jutsuChosen": "string (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Story progress saved."
}
```

**Action**: Sets `completedRaidStory: true` in `users.json`

---

### **functions/api/track-view.js**

**Endpoint**: `POST /api/track-view`

**Request Body**:
```json
{
  "userId": "string"
}
```

**Action**: Adds user to `korilore.json` viewers list

---

### **functions/oauth/callback.js**

**Endpoint**: `GET /oauth/callback?code=<auth_code>`

**Flow**:
1. Receives authorization code from Discord
2. Exchanges code for access token
3. Fetches user data from Discord API
4. Redirects to `hub.html` with user data

---

### **Cloudflare Pages Deployment**

**Build Settings**:
- Framework: None (static site)
- Build command: (none)
- Build output: `/website`

**Environment Variables**:
```
CLIENT_ID=<discord_client_id>
CLIENT_SECRET=<discord_client_secret>
REDIRECT_URI=https://shinobirpg.online/oauth/callback
```

**Custom Domain**: shinobirpg.online

**DNS Settings** (GoDaddy):
- Type: CNAME
- Name: @
- Value: <cloudflare_pages_url>

---

## ⚔️ Battle System Deep Dive

### **Battle Flow**

1. **Initialization**
   - Load player stats
   - Apply clan buffs
   - Check bloodline activation
   - Generate battle image

2. **Turn Loop**
   - Display moves embed
   - Player selects jutsu
   - Calculate chakra cost
   - Process effects
   - Apply damage
   - Check status effects
   - Update battle image
   - Check win condition

3. **Resolution**
   - Determine winner
   - Calculate rewards
   - Update player stats
   - Save to database

---

### **Damage Calculation**

**Formula**:
```javascript
baseDamage = formula_result // e.g., "2010 * user.power / target.defense"
effectiveStats = getEffectiveStats(user) // includes buffs
dodgeChance = target.dodge / (target.dodge + 100)
if (Math.random() < dodgeChance) {
    damage = 0 // Dodged
} else {
    damage = baseDamage
}
```

---

### **Buff/Debuff System**

**Buff Application**:
```javascript
buff: {
    stats: {
        power: "user.power * 5", // Multiplier
        defense: "user.defense + 50" // Additive
    },
    duration: 3 // Rounds
}
```

**Debuff Application**:
```javascript
debuff: {
    stats: {
        power: "-target.power * 0.5", // Reduce by 50%
        defense: -10 // Subtract 10
    },
    duration: 2
}
```

---

### **Status Effects**

**Stun**:
- Cannot act for duration
- Skips turn

**Bleed**:
- Damage over time: `target.health * damagePercent`
- Applied at turn start

**Burn**:
- Similar to bleed
- Fire-based

**Poison**:
- DoT with increasing damage
- Stackable

**Freeze**:
- Stun + defense reduction

**Drown**:
- High DoT
- Chakra drain

---

### **Bloodline Activation**

**Trigger Conditions**:
```javascript
if (user.bloodline === "Uchiha" && user.health < user.maxHealth * 0.5) {
    activateSharingan(user, opponent)
}
```

**Sharingan Effects**:
- 3x power
- 3x defense
- Copy last opponent jutsu
- Visual: Sharingan GIF overlay

---

### **Combo System**

**Combo Detection**:
```javascript
if (lastThreeJutsus === ["jutsu1", "jutsu2", "jutsu3"]) {
    triggerCombo("ComboName")
}
```

**Combo Effects**:
- Bonus damage
- Special animations
- Unique effects

---

## 🎊 Event System

### **Event Types**

1. **Seasonal Events**
   - Winter Raid
   - Summer Festival
   - Halloween Special

2. **Server Events**
   - Forest of Death (auto every 3 hours)
   - Tournaments
   - Clan Wars

3. **Limited-Time Events**
   - Double EXP weekends
   - Special boss spawns

---

### **Event Rewards**

**Reward Types**:
- EXP
- Ryo
- Event tokens (Christmas tokens, etc.)
- Exclusive jutsus
- Profile themes
- Titles
- Accessories

**Reward Distribution**:
```javascript
rewards = {
    exp: calculateExpReward(event, player),
    money: calculateMoneyReward(event, player),
    items: getEventItems(event)
}
updatePlayer(userId, rewards)
```

---

## 🚀 Deployment Guide

### **BotHosting.net Setup**

1. **Upload Files**:
   - Upload entire `menma` directory
   - Exclude `node_modules` (will be installed)

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Environment Variables**:
   - Dashboard → Environment Variables
   - Add all `.env` variables

4. **Start Bot**:
   ```bash
   node bothosting.js
   ```

5. **Auto-Restart**:
   - Enable in dashboard
   - Bot restarts on crash

---

### **Cloudflare Pages (Website)**

1. **Connect GitHub**:
   - Link repository
   - Select `website` directory

2. **Build Settings**:
   - Framework: None
   - Build output: `/website`

3. **Environment Variables**:
   - Add Discord OAuth credentials

4. **Deploy**:
   - Automatic on push to main branch

5. **Custom Domain**:
   - Add `shinobirpg.online`
   - Update DNS (CNAME to Cloudflare)

---

### **GoDaddy DNS Configuration**

**CNAME Record**:
```
Type: CNAME
Name: @
Value: <cloudflare_pages_url>
TTL: 600
```

**Verification**:
```bash
nslookup shinobirpg.online
```

---

## 📝 Development Workflow

### **Adding New Command**

1. Create file in `/commands/<commandname>.js`
2. Use template:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Description'),
    async execute(interaction) {
        // Command logic
    }
};
```
3. Bot auto-loads on restart
4. Slash command registers automatically

---

### **Adding New Jutsu**

1. Edit `data/jutsus.json`
2. Add jutsu object:
```json
{
  "Jutsu Name": {
    "name": "Jutsu Name",
    "description": "...",
    "chakraCost": 5,
    "category": "Genin",
    "obtainment": "...",
    "effects": [...]
  }
}
```
3. No restart needed (hot-reloaded)

---

### **Testing**

1. **Local Testing**:
   ```bash
   node bot.js
   ```

2. **Test Server**:
   - Create private Discord server
   - Invite bot
   - Test commands

3. **Debug Mode**:
   - Enable console logging
   - Check `error.txt`

---

## 🔧 Troubleshooting

### **Common Issues**

**Bot Not Responding**:
- Check token in `.env`
- Verify bot has permissions
- Check console for errors

**Commands Not Registering**:
- Wait 1 hour for Discord cache
- Force refresh: Restart bot
- Check `CLIENT_ID` in `.env`

**Database Errors**:
- Check file permissions
- Verify JSON syntax
- Use file locks for concurrent access

**OAuth Failing**:
- Verify `REDIRECT_URI` matches exactly
- Check `CLIENT_SECRET`
- Ensure HTTPS (Cloudflare)

---

## 📚 Additional Resources

### **Documentation Files**

- `tasks.md` - Development task list
- `suggestions.md` - Feature suggestions
- `checks.md` - Quality checks
- `networks.md` - Network architecture
- `valuation.md` - Project valuation

---

### **External Links**

- **Discord.js Docs**: https://discord.js.org
- **Google Gemini AI**: https://ai.google.dev
- **Cloudflare Pages**: https://pages.cloudflare.com
- **Top.gg**: https://top.gg

---

## 🎯 Key Statistics

- **Total Commands**: 94
- **Total Jutsus**: 2400+
- **Total Lines of Code**: ~500,000+
- **Data Files**: 70
- **Utility Modules**: 10
- **Supported Players**: Unlimited
- **Active Servers**: Multiple

---

## 🏆 Credits

**Developer**: Menma213  
**Project**: ShinobiRPG Discord Bot  
**Domain**: shinobirpg.online  
**Repository**: Menma213/menma  

---

**END OF DOCUMENTATION**

*This documentation covers every command, system, and feature in the Menma project. For specific implementation details, refer to the source code files.*
