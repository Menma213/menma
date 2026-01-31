/**
 * Custom execution logic for "Praise Jashin".
 * Grants the user a one-time revive at 50% HP.
 */
module.exports = {
    execute: function ({ baseUser, jutsuData }) {
        const result = {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} performs a ritual to Praise Jashin!`,
            specialEffects: [],
            hit: true,
            jutsuUsed: jutsuData.name,
            chakraUsed: 0
        };

        const maxHealth = baseUser.maxHealth || baseUser.health || 100;

        // Add revive effect to activeEffects (for display/logic checks)
        baseUser.activeEffects = baseUser.activeEffects || [];

        // Remove existing revive if any to prevent weird stacking, or just push a new one. 
        // Usually revive is one-time use.

        baseUser.activeEffects.push({
            type: 'status',
            status: 'revive',
            duration: 99, // Long duration
            heal_amount: Math.floor(maxHealth * 0.5),
            revive_to_max_health: false,
            once_per_battle: true,
            source: jutsuData.name
        });

        // Add to result.appliedEffects so the main battler knows to register the trigger
        result.appliedEffects = result.appliedEffects || [];
        result.appliedEffects.push({
            targetId: baseUser.id || baseUser.userId || null,
            type: 'revive',
            trigger: 'onDeath',
            healPercent: 0.5,
            heal_amount: Math.floor(maxHealth * 0.5),
            once: true,
            duration: 99,
            source: jutsuData.name
        });

        result.specialEffects.push(`**Jashin's Blessing:** ${baseUser.name} gains a revive at 50% HP!`);

        return result;
    }
};
