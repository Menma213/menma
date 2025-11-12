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

    // --- B. DAMAGE CALCULATION (Formula: user.power * 4000 / target.defense) ---
    // Note: You must use the effective stats for damage calc.
    try {
        const formula = "user.power * 5000 / target.defense";
        const damageValue = math.evaluate(formula, {
            'user': effectiveUser,
            'target': effectiveTarget
        });
        
        // Assume damage calculation always hits unless you add custom hit/miss logic
        const finalDamage = Math.max(1, Math.floor(damageValue)); // Ensure at least 1 damage
        
        // Apply damage to the target's base health object
        baseTarget.currentHealth = Math.max(0, baseTarget.currentHealth - finalDamage);
        result.damage = finalDamage;
        result.specialEffects.push(`A surge of rage dealt ${finalDamage} damage.`);

    } catch (e) {
        console.error("Error evaluating damage formula in custom script:", e);
    }
    
    // --- C. DEBUFF APPLICATION (Defense: target.defense * 0.4 for 3 turns) ---
    const defenseDebuff = Math.floor(effectiveTarget.defense * 0.4);
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'debuff',
        stats: { 'defense': defenseDebuff }, // Apply the raw value of the stat change
        duration: 3,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name}'s Defense was weakened by ${defenseDebuff} for 3 turns.`);

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

return result;
}

module.exports = {
    execute
};