/**
 * Custom execution logic for "Pee Pee Poo Poo".
 * A troll jutsu that kills the user instantly.
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object.
 */
function execute({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    jutsuList,
    effectHandlers
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} does a pee pee poo poo and dies instantly!`,
        specialEffects: ["Pee Pee Poo Poo DEATH!", "Self-Destruction complete."],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: Number(jutsuData.chakraCost) || 0
    };

    // Deduct chakra
    baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - result.chakraUsed);

    // Set HP to -999999
    baseUser.currentHealth = -999999;

    return result;
}

module.exports = { execute };
