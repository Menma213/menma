const math = require('mathjs');

/**
 * Custom execution logic for "Punisher Shield".
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object (damage, specialEffects, etc.).
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    jutsuList // Added to access other jutsu data if needed
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} activates ${jutsuData.name}! **It's Futile!**`,
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
            description: `${baseUser.name} tries to activate ${jutsuData.name} but lacks the chakra.`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- B. SPIN KICK DAMAGE CALCULATION ---
    try {
        const formula = "5000 * user.power / target.defense";
        const damageValue = math.evaluate(formula, {
            'user': effectiveUser,
            'target': effectiveTarget
        });

        const finalDamage = Math.max(1, Math.floor(damageValue));
        baseTarget.currentHealth = Math.max(0, baseTarget.currentHealth - finalDamage);
        result.damage += finalDamage;
        result.specialEffects.push(`${baseUser.name}'s sharp spin kick deals ${finalDamage} damage.`);

    } catch (e) {
        console.error("Error evaluating spin kick damage formula in custom script:", e);
        result.specialEffects.push("Spin kick damage calculation failed.");
    }

    // --- C. BURN EFFECT APPLICATION ---
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'burn',
        duration: 3, // 3 rounds
        chance: 100,
        damagePerTurn: "target.health * 0.10", // 0.10 percent burn
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name} is engulfed in flames, taking burn damage for 3 rounds.`);

    // --- D. REFLECT EFFECT APPLICATION (for 1 turn) ---
    // This effect will be applied to the user. When the user is attacked,
    // the incoming damage will be negated, and a portion will be reflected.
    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'status', // Using status to indicate a special state
        status: 'punisher_shield_reflect', // Custom status to identify this effect
        duration: 3, // Lasts for 3 turns
        source: jutsuData.name,
        // Custom properties to be handled by the main battle loop
        reflectDamage: true,
        reflectPercentage: 1.0, // Reflect 100% of incoming damage
        negateIncomingDamage: true // User takes no damage
    });
    result.specialEffects.push(`${baseUser.name} activates a divine barrier, ready to reflect incoming attacks!`);

    return result;
}

module.exports = {
    execute
};