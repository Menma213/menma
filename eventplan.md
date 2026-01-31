# Shinobi RPG - Rewarded Ads Monetization Event Plan

## Executive Summary
This document outlines a comprehensive, balanced monetization plan for **Shinobi RPG** using Rewarded Ads (Offerwalls) to provide F2P players with additional progression opportunities while maintaining game balance and player satisfaction.

---

## 1. Reward Structure & Balancing (The "Economy")

### 1.1 Currency Payouts

#### Primary Currency (Ryo)
**Based on actual game economy analysis:**
- High-tier A-rank missions (Tier 9): ~500k-2M Ryo per 50-mission run
- Shinobi Shard conversion: 100,000 Ryo = 1 SS (from Thunderbird shop)
- Accessories range: 5,000 SS ($500M) to 75,000 SS ($7.5B)

**Ad Reward Structure:**
- **Per Ad View/Short Survey:** 250,000-500,000 Ryo (2.5-5 SS equivalent)
- **Per Medium Offer (5-10 min):** 1,000,000-2,000,000 Ryo (10-20 SS equivalent)
- **Per Long Offer (15+ min):** 5,000,000-10,000,000 Ryo (50-100 SS equivalent)

**Rationale:** These amounts are meaningful for mid-game players while not trivializing late-game progression. A dedicated ad user could earn ~10-20M Ryo daily, equivalent to 2-4 high-tier A-rank runs.

#### Premium Currency (Shinobi Shards)
- **Per Ad View/Short Survey:** 3-5 SS
- **Per Medium Offer:** 15-25 SS
- **Per Long Offer:** 50-100 SS
- **Daily Ad Streak Bonus:** +25 SS (for 7 consecutive days of ad engagement)

**Rationale:** Direct SS rewards bypass the Ryo conversion and provide immediate value. At 100k per SS, these rewards are substantial but balanced against actual gameplay earning rates.

### 1.2 Rewarded Loot Box Drop Rates

**"Shinobi Fortune Box"** - Available after completing 3 ads in a single day

| Rarity Tier | Drop Rate | Reward Examples |
|-------------|-----------|-----------------|
| Common | 60% | 500,000 Ryo, 5 SS, Basic Healing Items |
| Uncommon | 25% | 1,500,000 Ryo, 15 SS, Uncommon Jutsu Scrolls |
| Rare | 12% | 5,000,000 Ryo, 50 SS, Rare Cosmetic Items, Rare Jutsu |
| Epic | 2.5% | 15,000,000 Ryo, 150 SS, Epic Accessories, Limited Cosmetics |
| Legendary | 0.5% | Exclusive Ad-Only Items (see below), 500 SS, Mythic Scrolls |

**Pity System:** Guaranteed Epic or better reward after 40 consecutive Common/Uncommon drops.

### 1.3 Exclusive Ad-Only Rewards

These items are **only** obtainable through the Rewarded Ads system to drive consistent engagement:

#### 1. **"Advertiser's Fortune Seal" (Accessory)**
- **Effect:** +25% Ryo gain from all sources, +10% SS drop rate from special events
- **Rarity:** Epic
- **Acquisition:** Cumulative reward after completing 100 total ad offers
- **Balance Note:** Significantly boosts economic progression without affecting combat balance, encouraging long-term ad engagement

#### 2. **"Thunderbird's Blessing" (Permanent Buff)**
- **Effect:** Reduces all command cooldowns by 15% (stacks with role bonuses), +5% XP gain
- **Rarity:** Legendary
- **Acquisition:** Available in Shinobi Fortune Box (Legendary tier, 0.5%) OR milestone reward at 500 total completions
- **Balance Note:** Quality-of-life improvement that speeds up progression without creating P2W scenarios

#### 3. **"Gatō's Emergency Fund" (Consumable)**
- **Effect:** Instantly grants 10,000,000 Ryo (single-use item)
- **Rarity:** Epic
- **Acquisition:** Random drop from Medium/Long offers (3% chance)
- **Balance Note:** Equivalent to 100 SS or 2-3 high-tier A-rank runs, valuable but not game-breaking, cannot be stockpiled (max 2)

---

## 2. Implementation Strategy (Discord Specifics)

### 2.1 Command Structure

#### Primary Commands
```
/ads view
- Displays available offerwall link
- Shows current ad completion count for the day
- Displays progress toward exclusive rewards

/ads claim <offer_id>
- Validates offer completion via API
- Distributes rewards to player inventory
- Updates player database with completion timestamp

/ads rewards
- Shows all available ad-exclusive items
- Displays player's progress toward milestone rewards
- Shows current streak bonus status

/ads stats
- Personal ad engagement statistics
- Total Ryo/SS earned from ads
- Lifetime ad completions
```

### 2.2 Database Schema Updates

#### New Table: `ad_completions`
```sql
CREATE TABLE ad_completions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    offer_id VARCHAR(50) NOT NULL,
    offer_type VARCHAR(20), -- 'short', 'medium', 'long'
    ryo_earned INT,
    tokens_earned INT,
    completed_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES players(user_id)
);
```

#### New Table: `ad_milestones`
```sql
CREATE TABLE ad_milestones (
    user_id VARCHAR(20) PRIMARY KEY,
    total_completions INT DEFAULT 0,
    daily_completions INT DEFAULT 0,
    last_completion_date DATE,
    current_streak INT DEFAULT 0,
    lootbox_pity_counter INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES players(user_id)
);
```

#### Updated Table: `players` (add columns)
```sql
ALTER TABLE players ADD COLUMN ad_ss INT DEFAULT 0;
ALTER TABLE players ADD COLUMN has_fortune_seal BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN has_thunderbird_blessing BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN emergency_funds INT DEFAULT 0;
```

### 2.3 Security & Validation Logic

1. **Offer Verification:**
   - Integrate with offerwall provider's API (e.g., AdGate Media, OfferToro)
   - Verify completion via webhook callback with signature validation
   - Implement IP fraud detection and duplicate completion prevention

2. **Rate Limiting:**
   - Track completions per user per IP address
   - Flag suspicious patterns (e.g., 10+ completions in 5 minutes)
   - Implement cooldown periods between claims

3. **Reward Distribution:**
   - Use database transactions to ensure atomic reward delivery
   - Log all reward distributions for audit trail
   - Implement rollback mechanism for fraudulent completions

### 2.4 Integration Flow

```
User → /ads view → Bot sends Offerwall Link
User completes offer → Offerwall Provider sends webhook
Webhook → Bot validates signature → Updates ad_completions table
Bot calculates rewards → Updates player inventory → Sends confirmation DM
```

---

## 3. User Experience & Frequency Capping

### 3.1 Optimal Frequency Caps

#### Hourly Limits
- **Maximum 5 ad completions per hour**
- **Cooldown:** 10 minutes between consecutive ad claims

**Rationale:** Prevents spam behavior while allowing engaged players to progress meaningfully.

#### Daily Limits
- **Maximum 20 ad completions per day**
- **Soft Cap at 15:** Rewards reduced by 30% after 15 completions
- **Hard Cap at 20:** No more rewards until daily reset (00:00 UTC)

**Rationale:** Encourages daily engagement without enabling 24/7 grinding that could lead to burnout.

#### Weekly Bonus
- **Streak Bonus:** Complete at least 1 ad per day for 7 consecutive days → Receive "Shinobi Fortune Box" + 250 SS
- **Weekly Cap Reset:** All limits reset every Monday at 00:00 UTC

### 3.2 User Experience Enhancements

#### Notifications & Engagement
- **Daily Reminder:** DM players at their preferred time if they haven't completed any ads that day
- **Streak Warning:** Notify players 2 hours before daily reset if they're on a streak but haven't completed today's ad
- **Milestone Celebrations:** Special embed messages when reaching 25, 50, 100, 250, 500 total completions

#### UI/UX Improvements
- **Progress Bars:** Visual indicators for daily limits and milestone progress
- **Reward Previews:** Show potential rewards before clicking offerwall link
- **Leaderboard:** Optional monthly leaderboard for top ad engagers (with privacy toggle)

### 3.3 Burnout Prevention Measures

1. **Diminishing Returns:** After daily soft cap, clearly communicate reduced rewards
2. **Optional Participation:** Never make ads mandatory for core progression
3. **Variety in Offers:** Rotate offerwall providers to maintain fresh content
4. **Feedback Loop:** Monthly surveys to gauge player satisfaction with ad system

---

## 4. Revenue Projections & KPIs

### 4.1 Target Metrics
- **Daily Active Ad Users (DAAU):** 30% of total DAU
- **Average Completions per DAAU:** 8-12 per day
- **Retention Impact:** +15% 7-day retention for ad-engaged players
- **Revenue per User:** $0.50 - $2.00 per DAAU per day (varies by offerwall)

### 4.2 Success Indicators
- **Engagement Rate:** >25% of F2P players use ads weekly
- **Streak Completion:** >40% of ad users maintain 7-day streaks
- **Fraud Rate:** <5% of total completions flagged as fraudulent
- **Player Satisfaction:** >70% positive feedback in monthly surveys

---

## 5. Rollout Plan

### Phase 1: Beta Testing (Week 1-2)
- Enable ads for 10% of player base
- Monitor completion rates and fraud patterns
- Gather initial feedback via Discord polls

### Phase 2: Soft Launch (Week 3-4)
- Expand to 50% of player base
- Introduce first exclusive reward (Merchant's Lucky Charm)
- Refine frequency caps based on data

### Phase 3: Full Launch (Week 5+)
- Enable for all players
- Launch marketing campaign highlighting ad-exclusive items
- Implement leaderboard and streak bonuses

### Phase 4: Optimization (Ongoing)
- A/B test different reward amounts
- Rotate offerwall providers for best CPM
- Introduce seasonal ad-exclusive events

---

## 6. Risk Mitigation

### Potential Issues & Solutions

| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| Ad Fraud | Revenue loss, unfair advantage | Robust API validation, IP tracking, manual review flags |
| Player Burnout | Reduced engagement | Strict frequency caps, diminishing returns, optional participation |
| Game Balance Issues | P2W perception | Ensure ad rewards are sidegrades/cosmetics, not direct power |
| Technical Failures | Lost rewards, player frustration | Implement retry logic, manual claim system, compensation protocol |
| Low Engagement | Poor revenue | Increase reward value, better UI/UX, exclusive items |

---

## 7. Conclusion

This monetization plan balances F2P player progression with sustainable revenue generation. By offering meaningful rewards through Rewarded Ads while maintaining strict frequency caps and game balance, Shinobi RPG can provide an equitable experience for all players while supporting ongoing development.

**Key Success Factors:**
✅ Non-intrusive, optional ad system  
✅ Exclusive rewards that drive engagement without P2W concerns  
✅ Robust fraud prevention and security measures  
✅ Player-friendly frequency caps to prevent burnout  
✅ Clear communication and transparency about reward structures  

**Next Steps:**
1. Integrate offerwall provider API (recommend AdGate Media or OfferToro)
2. Implement database schema updates
3. Develop `/ads` command suite
4. Create exclusive reward assets (Merchant's Charm, Advertiser's Headband, etc.)
5. Begin Phase 1 beta testing with select players
