# Monetization Plan for Shinobi RPG: Rewarded Ads

This document outlines a monetization plan for "Shinobi RPG" using rewarded ads. This system is designed to enhance the Free-to-Play (F2P) experience by providing a consistent, low-effort way to earn currency and items, supplementing the high-reward, high-effort activities like A-Rank missions, without disrupting the game's overall balance.

### 1. Reward Structure & Balancing (The "Economy")

#### Rewarded Loot Box: "Shinobi Cache"

Instead of direct currency payouts, players receive a "Shinobi Cache" for watching an ad. This introduces an element of chance and makes the rewards more engaging. The contents of the cache will scale with the player's progression.

*   **Drop Rates:**
    *   **Common (60%):** A variable amount of Ryo.
    *   **Uncommon (25%):** A larger amount of Ryo or a small number of Shinobi Shards.
    *   **Rare (10%):** A random accessory from the accessory shop.
    *   **Epic (4%):** One of the unique cosmetic items listed below.
    *   **Legendary (1%):** A "Scroll of Forbidden Knowledge" which allows learning a random jutsu from the shop.

*   **Shinobi Shards:**
    *   **Value:** Shinobi Shards are a premium currency with significant value, as they can be traded with other players and are sold for a high price in Ryo during special events. Offering them as a rare reward from ads makes them a highly desirable prize for F2P players.

#### Scaling Rewards with Player Progression

To ensure ad rewards remain relevant throughout a player's journey, the amount of Ryo from the "Shinobi Cache" will scale based on the player's highest unlocked travel tier.

*   **Tier 1-3:** 500 - 1,500 Ryo
*   **Tier 4-6:** 1,500 - 3,000 Ryo
*   **Tier 7-9:** 3,000 - 5,000 Ryo

**Rationale:** This scaling ensures that the rewards from ads keep pace with the player's progression and the increasing costs of items and upgrades in the game, making them a consistently useful supplement to income from other activities.

#### Specific Rewards (Exclusive to Shinobi Cache)

These items are cosmetic and provide no in-game advantage, making them desirable without being pay-to-win.

1.  **"Akatsuki's Shadow" Cloak:** A purely cosmetic cloak that gives the player's profile a unique flair.
2.  **"Nine-Tails's Aura" Profile Effect:** A visual effect on the player's profile embed.
3.  **"Sage's Wisdom" Title:** A unique title displayed on the player's profile.

### 2. Implementation Strategy (Discord Specifics)

#### Command Structures

*   **/watchad:**
    *   When a player uses this command, the bot sends a link to an offerwall.
    *   The bot records a timestamp for when the ad was initiated.

*   **/claimreward:**
    *   After a successful ad completion is verified via a callback from the offerwall provider, the bot notifies the player that they can claim their reward.
    *   Using this command will grant the player a "Shinobi Cache".

#### Database Logic

The `players.json` or a new database table should be updated to include:

*   `lastAdWatched`: A timestamp to enforce the frequency cap.
*   `unclaimedRewards`: An array to store pending rewards from completed ads.

```json
"playerID": {
    "money": 10000,
    "level": 5,
    "maxTierUnlocked": 1,
    "lastAdWatched": "2026-01-30T12:00:00Z",
    "unclaimedRewards": ["shinobi_cache_1", "shinobi_cache_2"]
}
```

### 3. User Experience & Frequency Capping

To prevent player burnout and maintain the value of rewards, the following caps are recommended:

*   **Hourly Cap:** 1 ad per hour.
*   **Daily Cap:** 5 ads per day.

This allows dedicated players to earn a significant amount of rewards over time without feeling forced to constantly watch ads.
