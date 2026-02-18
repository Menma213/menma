# ⚔️ Battle Engine Plans: The "Hard Counter" System

**Objective:** Implement a robust "Rock-Paper-Scissors" style counter system for all battle effects, ensuring every mechanic has a clear, strategic answer without feeling forced.

## 1. 🎯 The Core Philosophy
A "Hard Counter" completely negotiates or significantly mitigates a specific threat.
- **Preventative:** Buffs/Items that stop an effect *before* it happens (e.g., Immunity).
- **Reactive:** Actions that remove or reversal an effect *after* it happens (e.g., Cleanse).
- **Bypass:** Mechanics that ignore defenses (e.g., Pierce).

---

## 2. 🛡️ The Counter Web (Comprehensive)

| Threat | The Hard Counter | Why It Works | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Crowd Control (CC)**<br>*(Stun, Flinch, Drown, Possessed, Zap)* | **Status Immunity (Tenacity)**<br>**Cleanse** | **Immunity:** Prevents application entirely.<br>**Cleanse:** Removes active effects (requires ally/item). | ❌ Missing `status_immunity` buff.<br>✅ `cleanse` exists. |
| **Damage over Time (DoT)**<br>*(Bleed, Poison, Burn, Curse, Darkness)* | **Regeneration (HoT)**<br>**Cleanse** | **Regen:** Out-heals the tick damage.<br>**Cleanse:** Removes the source. | ✅ `heal_per_turn` exists.<br>✅ `cleanse` exists. |
| **Stat Debuffs**<br>*(Weakness, Fragility, Frost)* | **Stat Buffs**<br>**Cleanse** | **Buffs:** Overwrite/offset negatives.<br>**Cleanse:** Removes `debuff` types. | ✅ Both exist. |
| **Stat Buffs**<br>*(Power Up, Defense Up, Speed Up)* | **Despair (Strip)** | **Strip:** Removes all positive `buff` effects from target. | ❌ Missing `strip_buffs` effect type. |
| **Evasion / Dodge**<br>*(Hidden Mist, High Agility)* | **Sure Hit / Tracking** | **Tracking:** Ignores evasion checks completely. | ❌ Missing `ignore_dodge` flag. |
| **Invulnerability**<br>*(Izanami, Yata Mirror)* | **Execution (Pierce)** | **Pierce:** Deals damage through `invuln` states or `damage_reduction`. | ❌ Missing `pierce` flag. |
| **Reflection / Counter**<br>*(Wheel of Fate, Mirror Coat)* | **Uncounterable** | **Uncounterable:** Attacks that cannot be reflected. | ❌ Missing `ignore_reflection` flag. |
| **Healing**<br>*(Medical Ninjutsu, Lifesteal)* | **Grievous Wounds (Anti-Heal)** | **Anti-Heal:** Reduces incoming healing by X% (e.g., 50% or 100%). | ❌ Missing `heal_block` status. |
| **Chakra Drain**<br>*(Genjutsu, Aburame bugs)* | **Chakra Lock (Infinite)** | **Lock:** Prevents chakra reduction effects. | ❌ Missing `chakra_lock` status. |
| **One-Shot (OHKO)**<br>*(Reaper Death Seal)* | **Guts / Revive** | **Guts:** Survives with 1 HP. | ✅ `revive` exists (needs fix).<br>❌ Missing `guts` passive. |

---

## 3. 🛠️ Implementation Plan (Step-by-Step)

### Phase 1: The "Buff/Debuff" Expansion (Easy Wins)

1.  **Enhance `cleanse`:**
    -   Ensure it removes `status` (stun, etc.) AND `debuff` types.
    -   *Current:* It processes a hardcoded list.
    -   *Upgrade:* It should check `effect.isNegative` or rely on strict types.

2.  **Add `strip_buffs` Effect Type:**
    -   **Action:** Create a new case in `applyEffect`.
    -   **Logic:** Filter target's `activeEffects` to remove `type === 'buff'` and positive statuses (e.g., `regen`).
    -   **Use Case:** Jutsus like "Vacuum Release" or specific Genjutsu.

3.  **Add `heal_block` Status:**
    -   **Action:** Add a check in `effectHandlers.heal`.
    -   **Logic:** `if (target.activeEffects.includes('heal_block')) healAmount *= 0.5;`
    -   **Use Case:** Poison-style attacks or Cursed Seals.

### Phase 2: The "Mechanic" Flags (Logic Updates)

4.  **Implement `ignore_dodge`:**
    -   **Location:** `effectHandlers.damage`.
    -   **Logic:** `if (effect.ignore_dodge) hitChance = 100;`
    -   **Use Case:** Amaterasu (Visual prowess shouldn't miss).

5.  **Implement `status_immunity`:**
    -   **Location:** `effectHandlers.status`.
    -   **Logic:** Check `target.activeEffects` for `status_immunity`. If present, return early.
    -   **Use Case:** Tailed Beast Cloaks or Sage Mode.

### Phase 3: The "Special" Counters (Complex)

6.  **`guts` (Survival):**
    -   **Location:** `effectHandlers.damage` (end of calculation).
    -   **Logic:** `if (damage >= currentHealth && activeEffects.includes('guts')) { damage = currentHealth - 1; }`
    -   **Use Case:** Determination / Will of Fire passives.

---

## 4. 📝 Example Jutsu Updates (JSON Data)

**Example: "Truth-Seeking Orb" (The Ultimate Counter)**
```json
{
  "name": "Truth-Seeking Orb",
  "effects": [
    { "type": "damage", "formula": "..." },
    { "type": "strip_buffs" },
    { "type": "status", "status": "heal_block", "duration": 2 }
  ],
  "flags": ["ignore_dodge", "pierce"]
}
```

**Example: "Amaterasu" (Unavoidable Burn)**
```json
{
  "name": "Amaterasu",
  "effects": [
    { "type": "status", "status": "burn_eternal", "damagePerTurn": "..." }
  ],
  "flags": ["ignore_dodge", "ignore_reflection"]
}
```

**Example: "Creation Rebirth" (Ultimate Sustain)**
```json
{
  "name": "Creation Rebirth",
  "effects": [
    { "type": "heal", "formula": "..." },
    { "type": "status", "status": "status_immunity", "duration": 3 }
  ]
}
```

## 5. ⚠️ Implementation Details (Code Snippets)

### `strip_buffs` Logic
```javascript
case 'strip_buffs': {
    const targetEntity = effect.applyToTarget ? target : user;
    const initialCount = targetEntity.activeEffects.length;
    targetEntity.activeEffects = targetEntity.activeEffects.filter(e => 
        e.type !== 'buff' && !e.isPositive
    );
    const removedCount = initialCount - targetEntity.activeEffects.length;
    if (result.specialEffects && removedCount > 0) {
        result.specialEffects.push(`${targetEntity.name}'s buffs were stripped!`);
    }
    return { type: 'strip_buffs', value: removedCount };
}
```

### `heal_block` Logic (Inside `effectHandlers.heal`)
```javascript
heal: (combatant, amountFormula) => {
    let healAmount = math.evaluate(amountFormula, ...);
    
    // Check for Anti-Heal
    const antiHeal = combatant.activeEffects?.find(e => e.status === 'heal_block');
    if (antiHeal) {
        healAmount = Math.floor(healAmount * 0.5); // 50% reduction
        // Or pure block: healAmount = 0;
    }
    return healAmount;
}
```
