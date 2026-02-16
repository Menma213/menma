/**
 * Custom execution logic for "Shadow Possession".
 * Possesses the enemy and incapacitates them.
 * maintenance is -12 per round.
 */
module.exports = {
    execute: function ({ baseUser, baseTarget, jutsuData, isFirstActivation }) {
        const UPKEEP_COST = 12;

        if (isFirstActivation) {
            // Initial chakra check (Activation Cost: 10 - already deducted by engine if it was in jutsus.json, 
            // but we'll stick to the logic of the script if it handles it)
            // Actually, the engine deducts chakraCost (10) automatically before calling this.

            const analysis = `\n**Possession Analysis:**\nHP: ${Math.round(baseTarget.currentHealth)}/${baseTarget.maxHealth || baseTarget.health}\nChakra: ${baseTarget.chakra}\nPower: ${baseTarget.power}\nDefense: ${baseTarget.defense}`;

            baseTarget.activeEffects = baseTarget.activeEffects || [];
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'possessed',
                duration: 99,
                source: jutsuData.name
            });

            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} extends their shadow and connects with ${baseTarget.name}!\n${baseTarget.name} is possessed!${analysis}`,
                specialEffects: [
                    `${baseTarget.name} is caught in the shadow and cannot move!`,
                    `${baseUser.name} maintains possession (-${UPKEEP_COST} Chakra/turn).`
                ],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        } else {
            // Subsequent rounds: Upkeep logic
            if ((baseUser.chakra || 0) < UPKEEP_COST) {
                // Remove the possessed status from the target
                if (baseTarget.activeEffects) {
                    const possIdx = baseTarget.activeEffects.findIndex(e => e.status === 'possessed' && e.source === jutsuData.name);
                    if (possIdx !== -1) {
                        baseTarget.activeEffects.splice(possIdx, 1);
                    }
                }

                // End the jutsu by setting roundsLeft to 0 in activeCustomRoundJutsus
                if (baseUser.activeCustomRoundJutsus) {
                    const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                    if (selfEntry) selfEntry.roundsLeft = 0;
                }

                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name} can no longer maintain the Shadow Possession!`,
                    specialEffects: [`${baseTarget.name} is released!`],
                    hit: true,
                    jutsuUsed: jutsuData.name
                };
            }

            // Deduct Chakra
            baseUser.chakra -= UPKEEP_COST;

            // Keep Alive
            if (baseUser.activeCustomRoundJutsus) {
                const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                if (selfEntry) {
                    selfEntry.roundsLeft = 99;
                }
            }

            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} is maintaining the Shadow Possession...`,
                specialEffects: [`Chakra: ${baseUser.chakra} (-${UPKEEP_COST})`],
                hit: true,
                jutsuUsed: jutsuData.name
            };
        }
    }
};
