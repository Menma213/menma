/**
 * Custom execution logic for "Shadow Possession Jutsu".
 * Possesses the enemy and makes them copy the user's moves.
 * It is essentially a stun but the reskin is that it displays (with 0 damage) whatever user does.
 * Activation cost is 10 chakra.
 * Upkeep cost is 5 chakra per turn.
 */
module.exports = {
    execute: function ({ baseUser, baseTarget, jutsuData }) {
        // Initial chakra check (Activation Cost: 10)
        if ((baseUser.chakra || 0) < 10) {
            return {
                hit: false,
                damage: 0,
                description: `${baseUser.name} failed to perform Shadow Possession Jutsu (Not enough chakra)!`,
                specialEffects: ["Not enough chakra!"],
                jutsuUsed: jutsuData.name
            };
        }

        const result = {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} extends their shadow and connects with ${baseTarget.name}!`,
            specialEffects: [],
            hit: true,
            jutsuUsed: jutsuData.name,
            chakraUsed: 10
        };

        // Deduct initial activation cost manually
        baseUser.chakra -= 10;

        // Apply Shadow Possession Status to Target
        // This status triggers the "copy" logic in combinedcommands.js
        baseTarget.activeEffects = baseTarget.activeEffects || [];
        baseTarget.activeEffects.push({
            type: 'status',
            status: 'shadow_possession',
            duration: 99, // Indefinite until broken or out of chakra
            source: `${baseUser.userId}-${jutsuData.name}` // Include source ID for the copy logic
        });

        // Apply Chakra Drain to User to simulate upkeep cost
        // "5 chakra per turn"
        baseUser.activeEffects = baseUser.activeEffects || [];
        baseUser.activeEffects.push({
            type: 'chakra_drain',
            amount: 5,
            duration: 99,
            source: jutsuData.name
        });

        result.specialEffects.push(`${baseTarget.name} is caught in the shadow!`);
        result.specialEffects.push(`${baseUser.name} must maintain the possession (-5 Chakra/turn).`);

        return result;
    }
};
