const math = require('mathjs');

/**
 * Custom execution logic for "World Cutting Slash".
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object.
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    jutsuList,
    effectHandlers
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} activates ***World Cutting Slash***! **Scales of Dragon. Repulsion. Twin Meteors.**`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- A. COST CHECK ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.specialEffects.push('Not enough chakra!');
        return result;
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- B. DAMAGE CALCULATION ---
    // Formula: 3000 * user.power / target.defense
    try {
        const formula = "3000 * user.power / target.defense";
        const rawDamage = math.evaluate(formula, {
            user: effectiveUser,
            target: effectiveTarget,
            max: Math.max,
            min: Math.min
        });

        const damage = Math.max(1, Math.floor(rawDamage));
        result.damage = damage;
        // Apply damage directly since scripts handle their own resolution in this version
        baseTarget.currentHealth = Math.max(0, (baseTarget.currentHealth || 0) - damage);

        result.description += `\n **World Cutting Slash!** The slash tears through the dimensions...`;
    } catch (e) {
        console.error("Error in World Cutting Slash damage calculation:", e);
        result.specialEffects.push("The slash failed to tear space correctly.");
    }

    // --- B.5 CLEANSE EFFECT ---
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed && cleansed.length > 0) {
        result.specialEffects.push(`${baseUser.name} cleanses: ${cleansed.join(', ')}`);
    }

    const powerDelta = Math.floor(effectiveUser.power * 20);
    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerDelta
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name}'s Power is multiplied!`);


    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'stun',
        duration: 2,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseTarget.name} is stunned by the dimensional slash!`);

    return result;
}

module.exports = { execute };
