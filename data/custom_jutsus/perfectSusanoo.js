// You need to manually require any utilities you use, like 'mathjs'
const math = require('mathjs'); 

/**
 * Custom execution logic for "Perfect Susanoo".
 * This script is fully self-contained and calculates all effects.
 * @param {object} context - The battle context object.
 * @param {object} context.baseUser - The user's mutable combatant object.
 * @param {object} context.baseTarget - The target's mutable combatant object.
 * @param {object} context.effectiveUser - The user's effective stats (for calculations).
 * @param {object} context.effectiveTarget - The target's effective stats (for calculations).
 * @param {object} context.jutsuData - The jutsu's data from jutsus.json.
 * @param {number} context.round - The current battle round.
 * @param {boolean} context.isFirstActivation - True if this is the first time the jutsu is activated in the battle.
 * @returns {object} The battle result object (damage, specialEffects, etc.).
 */
function execute({ 
    baseUser, 
    baseTarget, 
    effectiveUser, 
    effectiveTarget, 
    jutsuData,
    round,
    isFirstActivation
}) {
    const result = {
        damage: 0,
        heal: 0,
        description: jutsuData.description || `${baseUser.name} uses ${jutsuData.name}!`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0,
        roundBasedEffects: []
    };

    // --- 1. Chakra Cost ---
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        return {
            ...result,
            description: `${baseUser.name} doesn't have enough chakra for ${jutsuData.name}.`,
            specialEffects: ["Not enough Chakra!"],
            hit: false,
        };
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // --- 2. Apply "Perfect Susanoo Active" status to user ---
    // This status is crucial for other parts of the system (like Susano Slash and Gyakuten no Horu cost reduction)
    baseUser.activeEffects = baseUser.activeEffects || [];
    const existingSusanooActive = baseUser.activeEffects.find(e => e.type === 'status' && e.status === 'Perfect Susanoo Active');

    if (!existingSusanooActive) {
        baseUser.activeEffects.push({
            type: 'status',
            status: 'Perfect Susanoo Active',
            duration: 3, // Duration as defined in jutsus.json
            source: jutsuData.name,
            // mark that when active this status replaces the user's normal attack
            replacesAttack: true,
            replaceWith: 'Susano Slash', // name/key of the jutsu that should be used instead of normal attack
            removeBuffsPerRound: true, // Add this line for persistent buff removal
            cooldownStatus: { status: 'Perfect Susanoo Cooldown', duration: 2 } // Add this line for cooldown
        });
        result.specialEffects.push(`${baseUser.name} activates Perfect Susanoo!`);
    } else {
        // If already active, refresh duration
        existingSusanooActive.duration = 3;
        result.specialEffects.push(`${baseUser.name}'s Perfect Susanoo remains active!`);
    }




    // --- 5. Cooldown ---
    // The cooldown for Perfect Susanoo is 2 rounds after its 3-round duration.
    // This means a "Perfect Susanoo Cooldown" status should be applied when the "Perfect Susanoo Active" status wears off.
    // This is typically handled by the main effect processing loop in combinedcommands.js,
    // so we just need to ensure the "Perfect Susanoo Active" status has the correct duration.
    // The duration is set to 3 above, so the main loop should handle its expiration and subsequent cooldown.
    // If not, we would add a 'Perfect Susanoo Cooldown' status here with a duration of 2,
    // triggered when 'Perfect Susanoo Active' expires.

    return result;
}

module.exports = {
    execute
};
