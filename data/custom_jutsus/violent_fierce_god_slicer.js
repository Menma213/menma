const math = require('mathjs');

/**
 * Custom execution logic for "Violent Fierce God Slicer".
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
        description: `${baseUser.name} concentrates their aura, forming a pink and black scythe! "If you feel nothing from this attack... then you're already dead."`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 1. COST CHECK ---
    const cost = Number(jutsuData.chakraCost) || 15;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.description = `${baseUser.name} failed to manifest the God Slicer due to insufficient chakra!`;
        result.specialEffects.push('Not enough chakra!');
        return result;
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- 2. BASE DAMAGE CALCULATION ---
    // Using a high multiplier (2000) for "massive damage"
    const damageFormula = "user.power * 2000 / target.defense";
    let baseDamage = 0;
    try {
        const rawDamage = math.evaluate(damageFormula, {
            user: effectiveUser,
            target: effectiveTarget
        });
        baseDamage = Math.max(1, Math.floor(rawDamage));
    } catch (e) {
        console.error("Error calculating damage for God Slicer:", e);
        baseDamage = 1;
    }

    // --- 3. CLONES (3 clones each deal equal damage) ---
    // Each clone deals the same damage as the base attack
    const clone1Damage = baseDamage;
    const clone2Damage = baseDamage;
    const clone3Damage = baseDamage;
    const totalDamage = baseDamage + clone1Damage + clone2Damage + clone3Damage;

    // Apply total damage to target
    baseTarget.currentHealth = Math.max(0, (baseTarget.currentHealth || 0) - totalDamage);
    result.damage = totalDamage;

    result.description += `\n**Violent Fierce God Slicer** tears through the target!`;
    result.specialEffects.push(`${baseUser.name} deals ${baseDamage} damage!`);
    result.specialEffects.push(`Clone 1 deals: ${clone1Damage} damage!`);
    result.specialEffects.push(`Clone 2 deals: ${clone2Damage} damage!`);
    result.specialEffects.push(`Clone 3 deals: ${clone3Damage} damage!`);

    // --- 4. DEFENSE DEBUFF (Effect 4: Max debuff) ---
    const defenseReduction = -Math.floor(effectiveTarget.defense * 0.05);
    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
    baseTarget.activeEffects.push({
        type: 'debuff',
        stats: { defense: defenseReduction },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseTarget.name}'s defense is reduced!`);

    // --- 5. MASSIVE BLEEDING & HEAL (Effect 2: 3 rounds) ---

    baseTarget.activeEffects.push({
        type: 'status',
        status: 'bleed',
        duration: 3,
        damagePerTurn: "target.health * 0.05",
        source: jutsuData.name,
        isNew: true
    });

    // Healing the user based on the bleed damage (Simulated with healPerTurn on user)
    // Since we know the bleed is 5% of current target health, we heal the user for that amount.
    const targetCurrentHP = baseTarget.currentHealth || baseTarget.health || 1000;
    const estimatedHeal = Math.floor(targetCurrentHP * 0.05);

    baseUser.activeEffects.push({
        type: 'status',
        status: 'Godly Scythe',
        duration: 3,
        healPerTurn: `${estimatedHeal}`, // Flat heal per turn
        source: jutsuData.name,
        isNew: true
    });

    result.specialEffects.push(`${baseTarget.name} is bleeding!`);

    return result;
}

module.exports = { execute };
