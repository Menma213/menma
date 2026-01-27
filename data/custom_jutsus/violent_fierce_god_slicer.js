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
    effectHandlers
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

    // --- 2. MASSIVE DAMAGE (Effect 1) ---
    // Using a high multiplier (4500) for "massive damage"
    const damageFormula = "user.power * 2000 / target.defense";
    let finalDamage = 0;
    try {
        const rawDamage = math.evaluate(damageFormula, {
            user: effectiveUser,
            target: effectiveTarget
        });
        finalDamage = Math.max(1, Math.floor(rawDamage));

        baseTarget.currentHealth = Math.max(0, (baseTarget.currentHealth || 0) - finalDamage);
        result.damage = finalDamage;
        result.description += `\n**Violent Fierce God Slicer** tears through the target for ${finalDamage} damage!`;
    } catch (e) {
        console.error("Error calculating damage for God Slicer:", e);
    }

    // --- 3. CLONES (Effect 3: 4x Power total for 3 turns) ---
    // To reach 4x Power, we add 3x current Power as a buff.
    const clonePowerBuff = Math.floor(effectiveUser.power * 3);
    if (!baseUser.activeEffects) baseUser.activeEffects = [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: { power: clonePowerBuff },
        duration: 3,
        source: "Clones",
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name} creates 3 Clones and attacks the target for ${finalDamage * 3} damage!`);

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
    // Massive bleed (15% of max health per turn)
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'bleed',
        duration: 3,
        damagePerTurn: "target.health * 0.05",
        source: jutsuData.name,
        isNew: true
    });

    // Healing the user based on the bleed damage (Simulated with healPerTurn on user)
    // Since we know the bleed is 15% of total target health, we heal the user for that amount.
    const targetMaxHP = baseTarget.maxHealth || baseTarget.health || 1000;
    const estimatedHeal = Math.floor(targetMaxHP * 0.05);

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
