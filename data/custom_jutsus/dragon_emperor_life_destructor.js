/**
 * Custom execution logic for "Dragon Emperor Life Destructor".
 * Effects:
 * 1. Visual: Plays ryuga-ldrago.mp4
 * 2. Stun: Stuns enemy for 3 turns
 * 3. Burn: Applies Burn DoT
 * 4. Rage: User gains 'rage' status (Power x10 whenever hit)
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
        description: `${baseUser.name} summons the **Ultimate Bey: L-Drago Destructor**! \n` +
            `*"THERE SHALL BE ONLY ONE SUPREME BEY!"* \n` +
            `The air shatters as L-Drago wrenches the very life from ${baseTarget.name}!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 15,
        visualFile: jutsuData.image_url
    };

    // --- 0. COST CALCULATION ---
    const cost = 15;
    if (baseUser.chakra < cost) {
        return {
            ...result,
            description: `${baseUser.name} lacks the supreme willpower to summon L-Drago!`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;

    // --- 1. STUN APPLICATION (3 Turns) ---
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'stun',
        duration: 3,
        canAttack: false,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name} is overwhelmed and STUNNED for 3 turns!`);

    // --- 2. BURN APPLICATION ---
    baseTarget.activeEffects.push({
        type: 'status',
        status: 'burn',
        duration: 3,
        source: jutsuData.name
    });
    result.specialEffects.push(`${baseTarget.name}'s life force is boiling! (Burn applied)`);

    // --- 3. RAGE APPLICATION ---
    baseUser.activeEffects = baseUser.activeEffects || [];
    if (!baseUser.activeEffects.some(e => e.status === 'rage')) {
        baseUser.activeEffects.push({
            type: 'status',
            status: 'rage',
            duration: 5, // Lasts for 5 rounds of chaotic growth
            source: jutsuData.name
        });
        result.specialEffects.push(`**${baseUser.name} has entered a state of SUPREME RAGE!** Incoming damage will now multiply their power exponentially!`);
    }

    return result;
}

module.exports = {
    execute
};
