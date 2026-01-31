// You need to manually require any utilities you use, like 'mathjs'
const math = require('mathjs');

/**
 * Custom execution logic for "A Twin's Sacrifice".
 * This script is fully self-contained and calculates all effects.
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object (damage, specialEffects, etc.).
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} activates ${jutsuData.name}! **The sacrifice is made...**`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- A. COST CALCULATION ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        return {
            ...result,
            description: `${baseUser.name} fails to find the resolve for ${jutsuData.name}.`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- B. DAMAGE CALCULATION (Formula: user.power * 2500 / target.defense) ---
    try {
        const damageValue = 2500 * (Number(effectiveUser.power) || 1) / Math.max(1, (Number(effectiveTarget.defense) || 1));
        const finalDamage = Math.max(1, Math.floor(damageValue));

        // Return damage to engine
        result.damage = finalDamage;
        result.specialEffects.push(`A surge of rage dealt ${finalDamage} damage.`);

    } catch (e) {
        console.error("Error evaluating damage formula in Sacrifice:", e);
    }

    // --- C. DEBUFF APPLICATION (Defense: target.defense * 0.4 for 3 turns) ---
    // Ensure the value is negative for a debuff
    const defenseReduction = -Math.floor(effectiveTarget.defense * 0.4);
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'debuff',
        stats: { 'defense': defenseReduction },
        duration: 3,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name}'s Defense was weakened!`);

    // --- D. BUFF APPLICATION (Power: +10000, Defense: +15000 for 5 turns) ---
    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: { 'power': 10000, 'defense': 15000 },
        duration: 5,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseUser.name} gained a massive Power and Defense boost for 5 turns.`);


    // --- E. CUSTOM REVIVE STATUS APPLICATION ---
    // Add the special "revive" status effect to the user's active effects list
    if (!baseUser.hasRevivedThisBattle) {
        baseUser.activeEffects = baseUser.activeEffects || [];
        baseUser.activeEffects.push({
            type: 'status',
            status: 'revive', // The status key
            duration: 100,
            // engine recognizes heal_amount / amount or healPercent
            heal_amount: Number(baseUser.maxHealth || baseUser.health) || null,
            // keep legacy flag also for compatibility
            revive_to_max_health: true,
            once_per_battle: true,
            source: jutsuData.name
        });

        // Engine-friendly returned effect (common shape: trigger + healPercent / healAmount)
        result.appliedEffects = result.appliedEffects || [];
        result.appliedEffects.push({
            targetId: baseUser.id || baseUser.userId || null, // set id if available
            type: 'revive',
            trigger: 'onDeath',
            healPercent: 1.0,      // 100% heal (also supported by engine now)
            heal_amount: Number(baseUser.maxHealth || baseUser.health) || null,
            once: true,
            duration: 100,
            source: jutsuData.name
        });

        result.specialEffects.push(`**A Twin's Sacrifice** grants ${baseUser.name} a one-time Revive to 100% Health!`);
    } else {
        result.specialEffects.push(`${baseUser.name} has already made their sacrifice and returned once; they cannot be revived again.`);
    }

    return result;
}

module.exports = {
    execute
};