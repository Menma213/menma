# 📜 Comprehensive Project Review & Roadmap: "Menma/Shinobi" to "Universal Anime RPG"

## 1. ⚔️ Battle Engine Overhaul (`combinedcommands.js`)
The current battle engine is heavily hardcoded for specific Naruto-themed interactions. To support "All Anime" and remove "BS" mechanics, we need a massive refactor.

### 🗑️ "BS Features" & Hardcoded Interactions to Remove
The following logic overrides standard game rules and creates confusing/unfair moments. These should be removed in favor of a standardized system.
*   **Arbitrary Hardcoded One-Shots:**
    *   *Found:* `if (baseTarget.name === 'King Kori' && jutsuName === 'Fireball Jutsu')` -> Deals nearly infinite damage.
    *   *Fix:* Remove completely. Damage should be calculated by stats vs stats, elements vs elements. No secret hardcoded instant kills.
*   **Specific Jutsu Hardcoding:**
    *   *Found:* Logic for `Perfect Susanoo`, `Izanami`, `Gyakuten no Horu`, `Susano Slash` is written directly inside the main `executeJutsu` loop.
    *   *Fix:* Move these special behaviors into the `custom_jutsus` scripts or a `StatusEffect` class. The main engine should just say `effect.trigger()`, it shouldn't know what "Susanoo" is.
*   **Random "BS" Status Effects:**
    *   *Found:* `stumble` causes self-damage & turn skip (30% chance).
    *   *Found:* `zap` causes 35% stun chance.
    *   *Fix:* Standardize these. "Stun" should be 100% or 0% based on resistance. Losing a turn due to RNG *after* the attack hit feels bad. Change `stumble` to just Accuracy Down.
*   **Stat/Health "Cheats":**
    *   *Found:* Code implicitly handling `revive` and `immortality` with specific flags like `izanamiImmortal`.
    *   *Fix:* Create a unified `Invulnerability` status effect with a duration.

### 🔧 Core Battle System Fixes
*   **Issue:** Buffs/Debuffs applying "next turn".
    *   *Fix:* Ensure the `effectHandlers.buff/debuff` returns a value that is *immediately* added to `effectiveUser` / `effectiveTarget` stats for the remainder of the current calculation.
*   **Issue:** Round-based logic is fragmented.
    *   *Fix:* Centralize specific "Round Start" and "Round End" event triggers. All DoTs (damage over time) and countdowns should happen strictly at "Round End".
*   **Issue:** Stacking Effects.
    *   *Fix:* Implement "Effect Groups". A player cannot have two buffs of Group "AttackUp" active. Valid groups: `Attack_Buff`, `Defense_Buff`, `Special_State`. New buff overwrites old one.

---

## 2. 🌍 Expansion to "All Anime"
Moving from *Shinobi RPG* to a *Multiverse RPG*.

### 🏗️ Structural Changes
*   **Rename "Jutsu" to "Ability" or "Skill":**
    *   `jutsus.json` -> `skills.json`.
    *   Fields like `chakra` should be renamed to a generic `energy` or `mana`.
*   **Faction/Origin System (Instead of Bloodlines):**
    *   Replace `bloodline` with `origin`.
    *   *Origins:* `Shinobi` (uses Chakra), `Saiyan` (uses Ki), `Sorcerer` (uses Cursed Energy), `Pirate` (uses Haki/Stamina).
    *   *Mechanic:* Each Origin has a passive perk (e.g., Saiyans get +Attack when low HP; Shinobi get +Dodge).
*   **Card/Character Data:**
    *   Use `top100anime_characters.json` as the base.
    *   **Action:** Write a script to convert this raw list into game-compatible Objects with generated stats based on their "Power Level" in lore (manually adjusted tiers).

---

## 3. 🏪 Economy & Shop Overhaul (New Player Friendly)
The current shop favors veterans with stockpiled currency.

### 🛍️ Shop Rework Suggestions
*   **The "Starter" Banner:**
    *   *Problem:* New players see expensive items they can't afford.
    *   *Solution:* A permanent banner valid for the first 7 days of an account. 50% discount on first 10 summons. Guaranteed 'A-Rank' equivalent character on first pull.
*   **Currency Conversion:**
    *   Allow converting "Activity Points" (from chatting/activity, see below) into basic summoning currency.
*   **Rotation Logic:**
    *   Instead of one shop for everyone, have Tiers (Genin/Bronze Shop, Chunin/Silver Shop).
    *   Bronze Shop sells essential weak items for very cheap (Ryo), allowing new players to fill slots immediately.

### 💤 New Feature: Idle Grinding (Training Grounds)
*   **Concept:** Players can send their characters to "Train" while they are offline.
*   **Mechanic:** `/train [duration] [location]`.
    *   *Dojo:* XP Gain.
    *   *Mines:* Ryo/Materials Gain.
    *   *Meditation:* Energy/Chakra Max Cap increase.
*   **Implementation:** Simple timestamp check. `StarTime` saved in DB. On `claim`, calculate `(Now - StartTime) * Rate`. Cap at 8 or 12 hours.

---

## 4. 📈 Player Retention & Acquisition

### 🎣 Acquisition (Getting Players)
*   **Referral Code System:** `/refer [friend]`. slightly boosts both players (e.g., 5000 Ryo + 1 Summon Ticket).
*   **Public Server Listing:** If the bot is public, ensure strictly "Anime RPG" branding, not just Naruto. "Collect Goku, Naruto, and Luffy in one team."

### 🔗 Retention (Keeping Players)
*   **Daily Login Streaks (Exponential):**
    *   Day 1: 1000 Ryo
    *   Day 7: 1 Summon Ticket + 10k Ryo
    *   Day 30: Random 'S-Rank' Item.
    *   *Key:* Checking streaks encourages daily interaction.
*   **Global World Boss (Raids):**
    *   A boss with 1,000,000 HP spawns for the whole server.
    *   Every player can attack once per hour.
    *   Rewards based on *participation* (did you hit it?), not just *top damage*, ensuring newbies get loot too.
*   **"Sensei" System (Mentorship):**
    *   High-level player links with Low-level player.
    *   If Low-level player levels up, High-level player gets "Mentor Tokens" (cosmetic shop currency).
    *   Encourages vets to help newbies.



---

## 5. 🔮 Future Roadmap Items
1.  **Guilds / Crews:** Joint bank account, guild base building (resource dump).
2.  **Territory War:** Guilds fighting for control of "nodes" (e.g., Hidden Leaf Village, Wano Kuni) which give passive tax income.
3.  **Achievement System:** "Deal 100k damage total" -> Reward: Title "Heavy Hitter".
4.  **Anime Trivia Minigames:** Use `animequiz.js` logic to drop random "Loot boxes" in chat for answering correctly first.
