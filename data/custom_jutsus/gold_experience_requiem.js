/**
 * Custom execution logic for "Gold Experience Requiem".
 * This jutsu provides:
 * 1. A one-time revive to 100% Health (Sacrifice.js style).
 * 2. Status immunity for 3 rounds (via the GER status).
 * 3. +10 Chakra Gain.
 * Cost: 40% of the user's Max Health.
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
        description: `${baseUser.name} activates ***Gold Experience Requiem***!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 1. HP COST CALCULATION ---
    // The user requested a 45% Max Health cost.
    const maxHealth = Number(baseUser.maxHealth || baseUser.health) || 1000;
    const hpCost = Math.floor(maxHealth * 0.40);

    // Deduct HP cost
    const currentHP = (baseUser.currentHealth !== undefined && baseUser.currentHealth !== null)
        ? baseUser.currentHealth
        : (baseUser.health || 0);

    baseUser.currentHealth = currentHP - hpCost;

    // --- 2. CHAKRA GAIN (+10) ---
    baseUser.chakra = (baseUser.chakra || 0) + 10;
    result.specialEffects.push(`Gained +10 Chakra!`);

    // --- 3. CLEANSE EFFECT ---
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed && cleansed.length > 0) {
        result.specialEffects.push(`Cleansed negative effects: ${cleansed.join(', ')}`);
    }

    // --- 4. STATUS IMMUNITY (3 Rounds) ---
    if (!baseUser.activeEffects) baseUser.activeEffects = [];
    baseUser.activeEffects.push({
        type: 'status',
        status: 'Gold Experience Requiem',
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`Status immunity granted for 3 rounds!`);

    // --- 5. REVIVE STATUS APPLICATION (Sacrifice.js style) ---
    // Persistent revive status
    if (!baseUser.hasRevivedThisBattle) {
        baseUser.activeEffects.push({
            type: 'status',
            status: 'revive',
            duration: 99,
            heal_amount: maxHealth,
            revive_to_max_health: true,
            once_per_battle: true,
            source: jutsuData.name
        });

        // Immediate engine notification
        result.appliedEffects = result.appliedEffects || [];
        result.appliedEffects.push({
            targetId: baseUser.id || baseUser.userId || null,
            type: 'revive',
            trigger: 'onDeath',
            healPercent: 0.5,
            heal_amount: maxHealth,
            once: true,
            duration: 99,
            source: jutsuData.name
        });

        result.specialEffects.push(`**Endless Life:** ${baseUser.name} will revive to half HP if defeated!`);
    } else {
        result.specialEffects.push(`**Endless Life:** ${baseUser.name} has already revived this battle and cannot do it again.`);
    }

    return result;
}

module.exports = { execute };
