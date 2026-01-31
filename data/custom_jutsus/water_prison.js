/**
 * Custom execution logic for "Water Prison".
 * Traps the enemy indefinitely until the user runs out of chakra (simulated by high duration).
 * Costs 7 chakra per turn.
 * Target loses 10% HP per round and cannot act.
 */
module.exports = {
    execute: function ({ baseUser, baseTarget, jutsuData }) {
        // Initial chakra check
        if ((baseUser.chakra || 0) < 7) {
            return {
                hit: false,
                damage: 0,
                description: `${baseUser.name} failed to form the Water Prison (Not enough chakra)!`,
                specialEffects: ["Not enough chakra!"],
                jutsuUsed: jutsuData.name
            };
        }

        const result = {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} traps ${baseTarget.name} in a dense sphere of water!`,
            specialEffects: [],
            hit: true,
            jutsuUsed: jutsuData.name,
            chakraUsed: 7
        };

        // Deduct initial cost manually since we are in a custom script
        baseUser.chakra -= 7;

        // Apply Drown Status to Target
        // "indefinitely" -> duration 99
        // "lose -10% per round" -> damagePerTurn
        // "cannot do anything" -> canAttack: false (detected by battle logic)
        baseTarget.activeEffects = baseTarget.activeEffects || [];
        baseTarget.activeEffects.push({
            type: 'status',
            status: 'drown',
            duration: 99,
            damagePerTurn: "target.health * 0.1",
            canAttack: false,
            source: jutsuData.name
        });

        // Apply Chakra Drain to User to simulate upkeep cost
        // "costs 7 chakra per turn"
        baseUser.activeEffects = baseUser.activeEffects || [];
        baseUser.activeEffects.push({
            type: 'chakra_drain',
            amount: 7,
            duration: 99,
            source: jutsuData.name
        });

        result.specialEffects.push(`${baseTarget.name} is drowning and cannot move! (-10% HP/turn)`);
        result.specialEffects.push(`${baseUser.name} must maintain the prison (-7 Chakra/turn).`);

        return result;
    }
};
