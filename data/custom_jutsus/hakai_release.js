const math = require('mathjs');

/**
 * Custom execution logic for "Hakai Release".
 * Effects:
 * 1. Damage: 2500 * user.power / target.defense
 * 2. Revive: Grants user a 100% HP revive (once per battle)
 * 3. Zap: 35% stun chance and DoT damage for 3 turns
 * 
 * Chakra Cost: 15
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
        description: `${baseUser.name} unleashes **Hakai Release**! Godly energy consumes the battlefield!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 0. COST CALCULATION ---
    const cost = Number(jutsuData.chakraCost) || 15;
    if (baseUser.chakra < cost) {
        return {
            ...result,
            description: `${baseUser.name} fails to summon the godly energy needed for **Hakai Release**.`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- 1. DAMAGE CALCULATION ---
    try {
        const formula = "2500 * user.power / target.defense";
        const damageValue = math.evaluate(formula, {
            'user': effectiveUser,
            'target': effectiveTarget
        });

        const finalDamage = Math.max(1, Math.floor(damageValue));

        // DO NOT manually deduct health; return result.damage to engine
        result.damage = finalDamage;
        result.description += `\n**Direct Erase:** Dealing ${finalDamage} pure destruction damage!`;

    } catch (e) {
        console.error("Error in Hakai Release damage calc:", e);
    }

    // --- 2. REVIVE APPLICATION ---
    baseUser.activeEffects = baseUser.activeEffects || [];
    // Only apply if not already active to avoid stacking
    if (!baseUser.activeEffects.some(e => e.type === 'status' && e.status === 'revive')) {
        baseUser.activeEffects.push({
            type: 'status',
            status: 'revive',
            duration: 99,
            heal_amount: Number(baseUser.maxHealth || baseUser.health) || 100,
            revive_to_max_health: true,
            once_per_battle: true,
            source: jutsuData.name
        });
        result.specialEffects.push(`${baseUser.name} is imbued with Godly Resilience! (Revive Active)`);
    }

    // --- 3. ZAP STATUS APPLICATION ---
    // Stun logic (35% chance) is processed by the engine each turn
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'zap',
        duration: 3,
        damagePerTurn: "target.health * 0.08", // 8% DoT
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name} was hit by **ZAP**! They take 8% DoT and may be paralyzed.`);

    return result;
}

module.exports = {
    execute
};
