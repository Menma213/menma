const math = require('mathjs');

/**
 * Custom execution logic for "Iai Chop Form 7: Nichirin".
 * Multiplies power and defense by 20x, cleanses negative effects,
 * and deals damage: 2500 * user.power / target.defense.
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    effectHandlers,
    getEffectiveStats
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: jutsuData.description,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 1. COST CHECK ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.specialEffects.push('Not enough chakra.');
        return result;
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- 2. CLEANSE EFFECT ---
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed && cleansed.length > 0) {
        result.specialEffects.push(`${baseUser.name} cleared negative effects: ${cleansed.join(', ')}`);
    }

    // --- 3. APPLY POWER AND DEFENSE BUFF ---
    // Multiply current power and defense.
    const powerDelta = Math.floor(effectiveUser.power * 19);
    const defenseDelta = Math.floor(effectiveUser.defense * 19);

    baseUser.activeEffects = baseUser.activeEffects || [];
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
    result.specialEffects.push(`Power and defense increased.`);

    // --- 4. RECALCULATE EFFECTIVE STATS WITH BUFF ---
    if (getEffectiveStats) {
        effectiveUser = getEffectiveStats(baseUser);
    }

    // --- 5. DAMAGE CALCULATION ---
    // Formula: 2500 * user.power / target.defense
    try {
        const formula = "2500 * user.power / target.defense";
        const rawDamage = math.evaluate(formula, {
            user: effectiveUser,
            target: effectiveTarget,
            max: Math.max,
            min: Math.min
        });

        const damage = Math.max(1, Math.floor(rawDamage));
        result.damage = damage;

    } catch (e) {
        console.error("Error in Nichirin damage calculation:", e);
        result.specialEffects.push("The attack failed.");
    }

    return result;
}

module.exports = { execute };
