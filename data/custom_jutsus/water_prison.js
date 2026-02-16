/**
 * Custom execution logic for "Water Prison".
 * Traps the enemy indefinitely until the user runs out of chakra.
 * Costs 7 chakra per turn upkeep.
 * Target is trapped in 'drown' status.
 */
module.exports = {
    execute: function ({ baseUser, baseTarget, jutsuData, isFirstActivation }) {
        const UPKEEP_COST = 15;

        if (isFirstActivation) {
            // Initial setup - chakra cost (15) is handled by the engine
            baseTarget.activeEffects = baseTarget.activeEffects || [];

            // Apply Drown Status to Target (lasts until jutsu ends)
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'drown',
                duration: 99,
                damagePerTurn: "target.health * 0.1",
                canAttack: false,
                source: jutsuData.name
            });

            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} traps ${baseTarget.name} in a dense sphere of water!`,
                specialEffects: [
                    `${baseTarget.name} is drowning and cannot move! (-10% HP/turn)`,
                    `${baseUser.name} maintains the prison (-${UPKEEP_COST} Chakra/turn).`
                ],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        } else {
            // Subsequent rounds: Upkeep logic
            const chakraAfterDeduction = Math.max(0, (baseUser.chakra || 0) - UPKEEP_COST);

            // 1. Check if chakra will be depleted
            if ((baseUser.chakra || 0) < UPKEEP_COST) {
                // Remove the drown status from the target
                if (baseTarget.activeEffects) {
                    const drownIdx = baseTarget.activeEffects.findIndex(e => e.status === 'drown' && e.source === jutsuData.name);
                    if (drownIdx !== -1) {
                        baseTarget.activeEffects.splice(drownIdx, 1);
                    }
                }

                // End the jutsu by setting roundsLeft to 0
                if (baseUser.activeCustomRoundJutsus) {
                    const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                    if (selfEntry) selfEntry.roundsLeft = 0;
                }

                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name} can no longer maintain the Water Prison!`,
                    specialEffects: [`${baseTarget.name} is released!`],
                    hit: true,
                    jutsuUsed: jutsuData.name
                };
            }

            // 2. Deduct Chakra
            baseUser.chakra = chakraAfterDeduction;

            // 3. Keep Alive
            if (baseUser.activeCustomRoundJutsus) {
                const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                if (selfEntry) {
                    selfEntry.roundsLeft = 100;
                }
            }

            // 4. Return summary (drown damage is handled by the drown status effect itself in engine)
            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} is maintaining the Water Prison...`,
                specialEffects: [`Chakra: ${baseUser.chakra} (-${UPKEEP_COST})`],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        }
    }
};
