# Accuracy Stat Fix - Implementation Summary

## Problem
The `accuracy` stat was being permanently stored in `users.json` and `e.json` when accessories were equipped. This caused the stored accuracy value to become the player's base accuracy, instead of adding to the intended base accuracy of 60 defined in `combinedcommands.js`.

### Example of the Bug:
- Base accuracy should be: **60**
- Uchiha Necklace bonus: **+10**
- **Expected**: Player has 70 accuracy in battle (60 base + 10 from accessory)
- **Actual (before fix)**: Player has 10 accuracy in battle (stored value overrides base)

## Solution Implemented

### 1. Modified `accessory.js` (3 locations)
**Prevented accuracy from being added to user data:**

#### Location 1: Equip - Unequip Current Item (Lines 101-109)
```javascript
// a) Unequip current item first
if (userAcc.equipped && userAcc.bonusStats) {
    for (const [stat, value] of Object.entries(userAcc.bonusStats)) {
        // Skip accuracy - it should only be calculated dynamically in battle
        if (stat === 'accuracy') continue;
        userData[stat] = (userData[stat] || 0) - value;
    }
}
```

#### Location 2: Equip - Apply New Item (Lines 110-116)
```javascript
// b) Equip new item
const newBonusStats = accessoryToEquip.stats || {};
for (const [stat, value] of Object.entries(newBonusStats)) {
    // Skip accuracy - it should only be calculated dynamically in battle
    if (stat === 'accuracy') continue;
    userData[stat] = (userData[stat] || 0) + value;
}
```

#### Location 3: Unequip Command (Lines 137-143)
```javascript
// --- Stat Change Logic ---
if (userAcc.bonusStats) {
    for (const [stat, value] of Object.entries(userAcc.bonusStats)) {
        // Skip accuracy - it should only be calculated dynamically in battle
        if (stat === 'accuracy') continue;
        userData[stat] = (userData[stat] || 0) - value;
    }
}
```

### 2. Modified `combinedcommands.js` - `getEffectiveStats()` function (Line 1039)
**Changed to always use base accuracy of 60, never reading from entity data:**

```javascript
const baseStats = {
    power: Number(entity.power) || 10,
    defense: Number(entity.defense) || 10,
    health: Number(entity.health) || 100,
    currentHealth: (entity.currentHealth !== undefined && entity.currentHealth !== null) ? Number(entity.currentHealth) : Number(entity.health || 100),
    chakra: Number(entity.chakra) || 10,
    accuracy: 60, // Base accuracy - always 60, never read from entity
    dodge: Number(entity.dodge) || 0,
    adaptedTechniques: entity.adaptedTechniques || {},
    activeEffects: entity.activeEffects || []
};
```

**Before:** `accuracy: Number(entity.accuracy) || 80`  
**After:** `accuracy: 60, // Base accuracy - always 60, never read from entity`

### 3. Created `clean_accuracy.js` cleanup script
**Removed all existing accuracy fields from user data:**
- Cleaned `users.json` - removed accuracy from all users
- Cleaned `e.json` - removed accuracy from all users
- Created automatic backups before modification

## How It Works Now

### Accuracy Calculation Flow:
1. **Base Accuracy**: Always starts at 60 (defined in `combinedcommands.js`)
2. **Accessory Bonuses**: Added dynamically during battle via `getEffectiveStats()`
   - Reads from `entity.equipped_accessories` (lines 1048-1061)
   - Adds accessory stats including accuracy bonuses
3. **Effect Modifiers**: Applied from active effects (lines 1084-1086)
4. **Final Clamping**: Accuracy clamped between 5-100 (line 1114)

### Example Calculation:
```javascript
// Player with Uchiha Necklace equipped
Base: 60
+ Uchiha Necklace: +10
= Final Accuracy: 70
```

### Accessories with Accuracy Bonuses:
- **Uchiha Necklace**: +10 accuracy
- **Goku's Pole**: +5 accuracy  
- **Pocket Watch**: +10 accuracy

## Files Modified
1. ✅ `commands/accessory.js` - Filters out accuracy stat from being stored
2. ✅ `commands/combinedcommands.js` - Uses base accuracy of 60
3. ✅ `data/users.json` - Cleaned (accuracy fields removed)
4. ✅ `data/e.json` - Cleaned (accuracy fields removed)
5. ✅ `clean_accuracy.js` - Cleanup script created

## Testing Recommendations
1. Equip an accessory with accuracy (e.g., Uchiha Necklace)
2. Check `users.json` - should NOT have accuracy field
3. Start a battle - accuracy should be 70 (60 base + 10 from accessory)
4. Unequip the accessory
5. Start another battle - accuracy should be 60 (base only)

## Notes
- The `userAccessory.json` file still stores `bonusStats.accuracy` for tracking purposes
- This is fine because it's only used to display what bonuses the accessory provides
- The actual accuracy calculation ignores stored values and always starts from base 60
