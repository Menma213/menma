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
    // Formula: (2500 * user.power / target.defense) * (user.chakra - 5)
    try {
        const chakraMultiplier = 1 + (currentChakra / 10);
        const baseDamageValue = 500 * (Number(effectiveUser.power) || 1) / Math.max(1, Number(effectiveTarget.defense) || 1);
        const finalDamage = Math.floor(baseDamageValue * chakraMultiplier);

        // DO NOT manually deduct health here; return result.damage so the engine can handle it (avoids double damage)
        result.damage = finalDamage;
        result.specialEffects.push(`Nature's strike dealt ${finalDamage} damage (x${chakraMultiplier.toFixed(1)} chakra multiplier)!`);
    } catch (e) {
        console.error("Error calculating damage in Perfect Sage:", e);
        // Robust fallback calculation
        const chakraMultiplier = 1 + (currentChakra / 10);
        const fallbackDamage = Math.floor((500 * (effectiveUser.power || 1) / Math.max(1, effectiveTarget.defense || 1)) * chakraMultiplier);
        result.damage = fallbackDamage;
    }


    const powerDelta = Math.floor(effectiveUser.power * 19);
    const defenseDelta = Math.floor(effectiveUser.defense * 19);

    if (!baseUser.activeEffects) baseUser.activeEffects = [];


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
    result.specialEffects.push(`${baseUser.name}'s Power and Defense are multiplied!`);

    // --- 5. STATUS IMMUNITY (Cleanse effect for 3 rounds) ---
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
