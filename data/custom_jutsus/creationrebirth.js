module.exports = {
    execute: function ({ baseUser, jutsuData, isFirstActivation }) {
        const COST_PER_ROUND = 9;
        const maxHP = Number(baseUser.maxHealth || baseUser.health || 100);
        // Heal 30% of Max HP (capped by engine at Max HP)
        const healAmount = Math.floor(maxHP * 0.30);

        if (isFirstActivation) {
            // First activation: System handles the initial chakraCost (5).
            // We just apply the initial heal and the system sets up the round-based entry.
            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name} activates Creation Rebirth!`,
                specialEffects: [`Healed ${healAmount} HP`],
                hit: true
            };
        } else {
            // Subsequent rounds: Upkeep logic

            // 1. Check Chakra
            if ((baseUser.chakra || 0) <= 0) {
                // End the jutsu by setting roundsLeft to 0
                if (baseUser.activeCustomRoundJutsus) {
                    const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                    if (selfEntry) selfEntry.roundsLeft = 0;
                }
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name}'s Creation Rebirth ends due to lack of chakra.`,
                    specialEffects: ["Creation Rebirth Deactivated (Low Chakra)"],
                    hit: true
                };
            }

            // 2. Deduct Chakra
            baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - COST_PER_ROUND);

            // 3. Keep Alive (Infinite Duration simulation)
            if (baseUser.activeCustomRoundJutsus) {
                const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                if (selfEntry) {
                    // Set to > 1 so that after the decrement in combinedcommands.js it remains active
                    selfEntry.roundsLeft = 10;
                }
            }

            // 4. Heal
            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name}'s Creation Rebirth regenerates health!`,
                specialEffects: [`Healed ${healAmount} HP (-${COST_PER_ROUND} Chakra)`],
                hit: true
            };
        }
    }
};
