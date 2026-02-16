const math = require('mathjs');

/**
 * Custom execution logic for "TAILED BEAST ART: VERMILLION PULSE".
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
        description: `${baseUser.name} fuels their technique with their own life force, unleashing the **Vermillion Pulse**!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    // --- 1. ACTIVATION COST ---
    // Take 40% of CURRENT health as activation cost
    const currentHP = baseUser.currentHealth || baseUser.health || 0;
    const hpCost = Math.floor(currentHP * 0.4);

    if (baseUser.currentHealth !== undefined) baseUser.currentHealth -= hpCost;
    if (baseUser.health !== undefined) baseUser.health -= hpCost;

    result.specialEffects.push(`Paid HP as activation cost.`);

    // --- 2. CHAKRA GAIN ---
    // Give 15 chakra
    baseUser.chakra = (baseUser.chakra || 0) + 15;
    result.specialEffects.push(`Chakra surged!`);

    // --- 3. BUFFS ---
    // Buff power and defense by 20x (dont display numbers)
    if (!baseUser.activeEffects) baseUser.activeEffects = [];

    const powerBuff = Math.floor(effectiveUser.power * 20);
    const defenseBuff = Math.floor(effectiveUser.defense * 20);

    baseUser.activeEffects.push({
        type: 'buff',
        stats: {
            power: powerBuff,
            defense: defenseBuff
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });

    result.specialEffects.push(`Power and Defense massively increased!`);

    // --- 4. DAMAGE CALCULATION ---
    // Formula: 2500 * user.power / target.defense
    // We use the BUFFED power for this immediate attack
    const buffedPower = effectiveUser.power + powerBuff;
    const damageFormula = "2500 * user.power / target.defense";
    let calculatedDamage = 0;

    try {
        const rawDamage = math.evaluate(damageFormula, {
            user: { ...effectiveUser, power: buffedPower },
            target: effectiveTarget
        });
        calculatedDamage = Math.max(1, Math.floor(rawDamage));
    } catch (e) {
        console.error("Error calculating damage for Vermillion Pulse:", e);
        calculatedDamage = 1;
    }

    result.damage = calculatedDamage;
    result.description += `\n**Vermillion Pulse** strikes with devastating force!`;

    return result;
}

module.exports = { execute };
