/**
 * Custom execution logic for "Banana Killer".
 * Forced backflip, absolute damage, and priority override.
 * @param {object} context - The battle context object.
 * @returns {object} The battle result object.
 */
function execute({
    baseUser,
    baseTarget,
    jutsuData
}) {
    // Flag for runBattle to nullify opponent action
    baseTarget.forceBackflip = true;

    // Clear all target immunities and immortality to ensure the "overcome all effects" requirement
    baseTarget.izanamiImmortal = false;
    baseTarget.izanagiActive = false;
    baseTarget.activeEffects = (baseTarget.activeEffects || []).filter(e =>
        !e.status ||
        !e.status.toLowerCase().includes('immortal') &&
        !e.status.toLowerCase().includes('invincible')
    );

    const result = {
        damage: (baseTarget.health || 100) * 99999, // High damage for summary
        heal: 0,
        description: `${baseUser.name} used Banana Killer! ${baseTarget.name} is FORCED to do a backflip!`,
        specialEffects: ["Banana'd!", "Backflip forced!", "Ultimate Priority Override!"],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: Number(jutsuData.chakraCost) || 0
    };

    // Apply absolute damage directly to ensure the kill
    baseTarget.currentHealth = -999999999999999;

    return result;
}

module.exports = { execute };
