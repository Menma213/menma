const math = require('mathjs');

/**
 * Custom execution logic for "Indra's Arrow".
 * Cleanse all negative effects for 3 rounds, add 50 accuracy for 3 rounds, 
 * deal damage based on chakra and reduce enemy defense by 20%.
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
    effectHandlers,
    getEffectiveStats
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} draws the ultimate bow of the Susanoo... **Indra's Arrow!**`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- A. COST CHECK ---
    const cost = Number(jutsuData.chakraCost) || 15;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.specialEffects.push('Not enough chakra!');
        return result;
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- B. CLEANSE NEGATIVE EFFECTS ---
    // Cleanses immediately
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed && cleansed.length > 0) {
        result.specialEffects.push(`${baseUser.name} cleanses: ${cleansed.join(', ')}`);
    }

    // --- C. APPLY IMMUNITY, ACCURACY, AND POWER BUFF ---
    baseUser.activeEffects = baseUser.activeEffects || [];

    // Immunity status (handled in combinedcommands.js via 'Indra\'s Arrow' status name)
    baseUser.activeEffects.push({
        type: 'status',
        status: 'Indra\'s Arrow',
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name} gains status immunity for 3 rounds!`);

    // Accuracy Buff (+50)
    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            accuracy: 50
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name}'s Accuracy is increased!`);

    // Power Buff (10x)
    // We calculate 9x of current effective power to add to the base, resulting in 10x total.
    const powerBoost = Math.floor(effectiveUser.power * 9);
    // Remove existing power buffs to ensure 10x doesn't stack incorrectly or get ignored
    baseUser.activeEffects = baseUser.activeEffects.filter(e => !(e.type === 'buff' && e.stats && e.stats.power));

    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerBoost
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name}'s Power is increased by 10x for 3 rounds!`);

    // --- D. REDUCE ENEMY DEFENSE BY 20% ---
    // We apply this before damage calculation to make the arrow hit harder
    const defenseReduction = -Math.floor(effectiveTarget.defense * 0.10);
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'debuff',
        stats: {
            defense: defenseReduction
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseTarget.name}'s Defense is reduced!`);

    // --- E. RECALCULATE STATS FOR ACCURATE DAMAGE ---
    if (getEffectiveStats) {
        effectiveUser = getEffectiveStats(baseUser);
        effectiveTarget = getEffectiveStats(baseTarget);
    }


    const remainingChakra = baseUser.chakra || 0;
    const power = Number(effectiveUser.power) || 1;
    const defense = Number(effectiveTarget.defense) || 1;

    // Ensure a minimum multiplier if chakra is low
    const chakraMultiplier = Math.max(1, remainingChakra / 5);
    const damageMultiplier = 2500;

    const damage = Math.floor(damageMultiplier * (power / defense) * chakraMultiplier);
    result.damage = damage;

    // Apply damage directly
    baseTarget.currentHealth = Math.max(0, (baseTarget.currentHealth || 0) - damage);

    result.description += `\n**The arrow of absolute lightning shatters the atmosphere!** Dealt ${damage} damage to ${baseTarget.name}!`;

    return result;
}

module.exports = { execute };
