const math = require('mathjs');

/**
 * Custom execution logic for "Full Counter".
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object (damage, specialEffects, etc.).
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
        description: `${baseUser.name} activates ${jutsuData.name}! **Full Counter!**`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- A. CHAKRA COST ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        return {
            ...result,
            description: `${baseUser.name} tries to activate ${jutsuData.name} but lacks the chakra.`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- B. POWER BOOST (20x for 5 rounds) ---
    const powerDelta = Math.floor(effectiveUser.power * 19);

    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerDelta
        },
        duration: 5,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseUser.name}'s power is boosted!`);

    // --- C. STUN ---
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'stun',
        duration: 2,
        chance: 100,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name} is stunned!`);

    // --- D. REFLECT (Same as Punisher Shield) ---
    baseUser.activeEffects.push({
        type: 'status',
        status: 'punisher_shield_reflect',
        duration: 3,
        source: jutsuData.name,
        reflectDamage: true,
        reflectPercentage: 1.0,
        negateIncomingDamage: true
    });
    result.specialEffects.push(`${baseUser.name} prepares to reflect any incoming attack!`);

    return result;
}

module.exports = {
    execute
};
