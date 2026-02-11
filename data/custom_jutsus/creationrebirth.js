module.exports = {
    execute: function ({ baseUser, jutsuData, isFirstActivation }) {
        const COST_PER_ROUND = 10;
        const maxHP = Number(baseUser.maxHealth || baseUser.health || 100);
        // Heal 30% of Max HP (capped by engine at Max HP)
        const healAmount = Math.floor(maxHP * 0.30);

        if (isFirstActivation) {
            // First activation: System handles the initial chakraCost (5).
            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name} activates Creation Rebirth!`,
                specialEffects: [`Healed ${healAmount} HP`],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        } else {
            // Subsequent rounds: Upkeep logic
            const chakraAfterDeduction = Math.max(0, (baseUser.chakra || 0) - COST_PER_ROUND);

            // 1. Check if chakra will be depleted
            if ((baseUser.chakra || 0) < COST_PER_ROUND) {
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
                    hit: true,
                    jutsuUsed: jutsuData.name
                };
            }

            // 2. Deduct Chakra
            baseUser.chakra = chakraAfterDeduction;

            // 3. Keep Alive (Infinite Duration simulation)
            if (baseUser.activeCustomRoundJutsus) {
                const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                if (selfEntry) {
                    // Set to 10 so it stays active
                    selfEntry.roundsLeft = 10;
                }
            }

            // 4. Heal
            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name}'s Creation Rebirth regenerates health!`,
                specialEffects: [
                    `Healed ${healAmount} HP`,
                    `Chakra: ${baseUser.chakra} (-${COST_PER_ROUND})`
                ],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        }
    }
};
