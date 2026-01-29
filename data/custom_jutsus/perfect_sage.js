const math = require('mathjs');

/**
 * Custom execution logic for "Perfect Sage".
 * Multiplies power and defense by 20x, applies a 3-round cleanse (immunity),
 * and deals damage scaling with the user's chakra.
 * 
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object.
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    effectHandlers
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} enters ***Perfect Sage Mode***! Natural energy surges through their body!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 1. COST CHECK & DEDUCTION ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.description = `${baseUser.name} tried to enter Perfect Sage Mode but lacked the chakra!`;
        result.specialEffects.push('Not enough chakra!');
        return result;
    }

    // We use the chakra value BEFORE deduction for the damage formula
    const currentChakra = baseUser.chakra;

    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- 2. CLEANSE EFFECT ---
    // Immediate cleanse of all negative statuses and debuffs
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed && cleansed.length > 0) {
        result.specialEffects.push(`${baseUser.name} cleansed: ${cleansed.join(', ')}`);
    }

    // --- 3. DAMAGE CALCULATION ---
    // Formula: 1000 * user.power / target.defense * log10(user.chakra)
    try {
        const damageFormula = `(1000 * ${effectiveUser.power} / ${Math.max(1, effectiveTarget.defense)}) * Math.log10(${currentChakra})`;
        const rawDamage = math.evaluate(damageFormula);
        const finalDamage = Math.max(1, Math.floor(rawDamage));

        // Apply damage to target's current health
        const targetCurrentHP = (baseTarget.currentHealth !== undefined && baseTarget.currentHealth !== null)
            ? baseTarget.currentHealth
            : (baseTarget.health || 0);

        baseTarget.currentHealth = Math.max(0, targetCurrentHP - finalDamage);
        result.damage = finalDamage;
        result.specialEffects.push(`Nature's strike dealt ${finalDamage} damage (scaled by ${currentChakra} Chakra)!`);
    } catch (e) {
        console.error("Error calculating damage in Perfect Sage:", e);
        // Robust fallback calculation
        const fallbackDamage = Math.floor((1000 * (effectiveUser.power || 1) / Math.max(1, effectiveTarget.defense || 1)) * Math.log10(currentChakra));
        baseTarget.currentHealth = Math.max(0, (baseTarget.currentHealth || baseTarget.health || 0) - fallbackDamage);
        result.damage = fallbackDamage;
    }

    // --- 4. BUFFS (5x Power and Defense) ---
    // Engine treats numeric stat values as additive deltas.
    // To achieve a 5x multiplier, we add (Stat * 4).
    const powerDelta = Math.floor(effectiveUser.power * 4);
    const defenseDelta = Math.floor(effectiveUser.defense * 4);

    if (!baseUser.activeEffects) baseUser.activeEffects = [];

    // Apply the 5x Buff for 3 rounds
    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerDelta,
            defense: defenseDelta
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name}'s Power and Defense are multiplied by 5x for 3 rounds!`);

    // --- 5. STATUS IMMUNITY (Cleanse effect for 3 rounds) ---
    // This status name must be registered in combinedcommands.js immunity logic
    baseUser.activeEffects.push({
        type: 'status',
        status: 'Perfect Sage',
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name} is now immune to status effects for 3 rounds!`);

    return result;
}

module.exports = { execute };
