# ⚔️ "Combined Commands" Battle Engine Documentation
*Analysis of `commands/combinedcommands.js` specific to the `runBattle` system.*

## 1. 🏗️ Engine Architecture Overview
The battle engine is a **status-based, turn-based loop** contained primarily within the `runBattle` async function. It manages state using a global `activeBattles` Map and handles multiplayer interactions via Discord Message Component Collectors.

### Key Components
*   **State Management:** `activeBattles` (Map) stores ongoing sessions.
*   **Main Loop:** `runBattle` function iterates endlessly until a win/loss condition is met.
*   **Action Resolution:** `executeJutsu` calculates the outcome of a single move.
*   **Effect System:** `effectHandlers` processes damage, buffs, debuffs, and status logic.
*   **AI:** `npcChooseMove` decides actions for non-player opponents.

---

## 2. 🔄 The Battle Loop (Step-by-Step)

The engine follows this precise sequence for every round:

1.  **Round Initialization:**
    *   Round counter increments.
    *   **Effect Processing:** `effectHandlers.processActiveEffects()` is called for all entities.
        *   Applies DoT (Damage over Time) damage.
        *   Applies HoT (Heal over Time).
        *   Applies Chakra auto-gain/drain.
        *   Checks for `stun`, `flinch`, `drown` to determine if a player skips their turn.
    *   **Custom Script Processing:** Checks `activeCustomRoundJutsus` (e.g., Planetary Devastation) and executes their round-specific logic.
    *   **Izanami Logic:** Hardcoded checks for "Recording", "Immortal", and "Flow" phases.
    *   **Cooldowns:** Decrements cooldowns (e.g., Perfect Susanoo).

2.  **Input Phase:**
    *   Server generates a **Battle Image** (`generateBattleImage`) combining player avatars and background.
    *   Sends an Embed with interactive Buttons (`createMovesEmbed`).
    *   **Waits** for user input via `createMessageComponentCollector` (75s timeout).
    *   *Sub-Loop:* If multiple players are on one team (Multiplayer), it iterates through them sequentially to get actions.

3.  **Action Resolution Phase:**
    *   **Awakening:** If "Awaken" is clicked, sets `pendingBloodline` flag and asks for a follow-up jutsu.
    *   **Move Selection:** Calls `getJutsuByButton` to resolve the chosen move.
    *   **Jutsu Execution:** Calls `executeJutsu(user, target, ...)`:
        *   Validates Chakra/HP costs.
        *   Sorts effects by `effectPriority` (Buffs apply before Damage).
        *   Calculates Damage/Healing using `mathjs` formulas.
        *   Applies Status Effects (RNG based).
        *   Handles "BS" Hardcoded overrides (e.g., King Kori insta-kill).
    
4.  **End of Round:**
    *   **Summary Generation:** Creates a `Battle Summary` embed listing damage dealt, effects applied, and funny flavor text.
    *   **Win Condition Check:** If `currentHealth <= 0`:
        *   Checks `tryApplyRevive` (Izanami, Resurrection items).
        *   If no revive, declares winner.
    *   **Cleanup:** `checkDurationAndRemove` decrements effect durations and removes expired buffs/debuffs.

---

## 3. ✨ The Effect System & Counters
The current system relies on `effectHandlers` to process a list of effect objects.

### 📊 Effect Prority
To ensure math works correctly (e.g., increasing Attack *before* dealing Damage), effects are sorted:
1.  `remove_buffs` (Strip buffs first)
2.  `cleanse` (Remove statuses)
3.  `buff` / `debuff` (Modify stats)
4.  `status` (Apply conditions like Stun)
5.  `damage` / `heal` (Final output)
6.  `instantKill` (End of chain)

### 🛡️ Proposed "Hard Counter" System
Each mechanic currently lacks a consistent, intentional counter. Here is the *Comprehensive Effect Web* we need to implement to balance the engine:

| Effect Type | Description | **The Hard Counter** | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Direct Damage** | Standard HP reduction. | **Invulnerability / Block** | Partial (Izanami/Susanoo hardcoded). Needs generic `Block` effect. |
| **DoT (Burn/Poison)** | Damage every round. | **Regen / Cleanse** | Exists (`cleanse` effect). |
| **Buff (Stat Up)** | Increases stats (Power/Def). | **Dispel (Strip)** | Exists logic for `remove_buffs`, needs to be more accessible. |
| **Debuff (Stat Down)** | Decreases stats. | **Cleanse / Immunity** | Exists `cleanse` |
| **Stun / Flinch** | Skips turn. | **Tenacity / Unstoppable** | **MISSING.** Need a `status_immunity` buff. |
| **Evasion (Dodge)** | Avoids attacks. | **Sure Hit / Tracking** | **MISSING.** Need `ignore_dodge` flag on jutsus. |
| **Invulnerability** | Takes 0 damage. | **Pierce / Execution** | **MISSING.** Need `pierce_invuln` flag. |
| **Chakra Drain** | Removes resource. | **Chakra Seal / Infinite** | **MISSING.** Need `prevent_drain` buff. |
| **Healing** | Restores HP. | **Grievous Wounds** | **MISSING.** Need `heal_block` status (reduce healing by X%). |
| **One-Shot (OHKO)** | Instant death. | **Guts / Revive** | Partial (`revive` exists but is buggy). |

---

## 4. 🚨 Critique: Problems & "BS" Mechanics

### ❌ 1. Hardcoded Spaghetti Logic
The engine is littered with `if (name === 'X')` checks, making it impossible to scale to "All Anime" without rewriting the core engine every time.
*   **Problem:** `if (baseTarget.name === 'King Kori' && jutsuName === 'Fireball Jutsu')` (Line 1987).
*   **Problem:** `if (jutsuName === 'Gyakuten no Horu' && ... Perfect Susanoo Active)` (Line 1902).
*   **Fix:** Move ALL specific logic into the **Data Files** (`jutsus.json`, `custom_jutsus/`). The engine should never know the name of a jutsu. It should only check flags like `cost_reduction_if_status: "Perfect Susanoo"`.

### ❌ 2. Unfair RNG (The "BS")
*   **Stumble:** 30% chance to damage SELF and skip turn. This feels terrible for players.
*   **Zap:** 35% chance to Stun per turn.
*   **Crit:** Hardcoded 1.25x multiplier.
*   **Fix:**
    *   Remove self-damage RNG.
    *   Standardize "Stun" to be resisted by a `Tenacity` stat, not pure random chance.

### ❌ 3. "Next Turn" Application Bug
*   **Problem:** Currently, some buffs apply to the `user` object but might not reflect in the `effectiveUser` object used for the *current* damage calculation if the update order is wrong.
*   **Fix:** `executeJutsu` needs to recalculate `effectiveUser` immediately after applying a buff, *before* calculating damage.

### ❌ 4. Revive Bugs
*   **Problem:** `tryApplyRevive` calculates heal amount using complex formulas that often fail or return `NaN`.
*   **Fix:** Simplify Revive to: `Set HP to X% of Max`. Remove complex formula parsing for this specific critical mechanic.

---

## 5. 🛠️ Refactoring Roadmap (The Plan)

1.  **Strict Typing:** Convert `activeEffects` into a standardized Class structure to prevent `undefined` properties.
2.  **Modularize Logic:** Extract `Izanami`, `Susanoo`, and `Bloodline` logic out of `combinedcommands.js` and into `utils/battleMechanics.js`.
3.  **Implement Counter Flags:** Add `ignore_dodge`, `pierce`, and `anti_heal` fields to the Jutsu Schema.
4.  **Universal Stat Calculation:** Create a single `calculateStats(entity)` function that runs every time a modifier changes, guaranteeing stats are always fresh.
