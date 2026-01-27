/**
 * Custom execution logic for "FLOWING RED SCALE".
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
        description: `${baseUser.name} activates ***FLOWING RED SCALE***! Blood manipulates their body, pushing it beyond limits!`,
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

    // --- B. CLEANSE EFFECT ---
    const cleansed = effectHandlers.cleanse(baseUser);
    if (cleansed.length > 0) {
        result.specialEffects.push(`${baseUser.name} cleansed: ${cleansed.join(', ')}`);
    }

    // --- C. BUFFS (20x Power and Defense) ---
    // Use the effective stats at the moment of activation for the buff calculation
    const powerDelta = Math.floor(effectiveUser.power * 19);
    const defenseDelta = Math.floor(effectiveUser.defense * 19);

    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerDelta,
            defense: defenseDelta
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name}'s Power and Defense are multiplied!`);

    // --- D. IMMUNITY & SIDE EFFECT ---
    // The "Flowing Red Scale" status provides immunity via logic added to combinedcommands.js
    // health_loss_on_expire handles the 15% HP loss side effect
    baseUser.activeEffects.push({
        type: 'status',
        status: 'Flowing Red Scale',
        duration: 3,
        health_loss_on_expire: 0.15,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseUser.name} is now immune to status effects for 3 turns.`);

    // --- E. ENEMY VULNERABILITY ---
    // "Status Vulnerability" multiplies incoming DoT damage by 1.5x via logic added to combinedcommands.js
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'Status Vulnerability',
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });
    result.specialEffects.push(`${baseTarget.name}'s resistance to status effects is decreased!`);

    return result;
}

module.exports = { execute };
