module.exports = {
    execute: function ({ baseUser, jutsuData, isFirstActivation }) {
        const CHAKRA_COST_PER_ROUND = 15;
        const HEAL_PERCENT = 0.08; // 8% per round
        const POWER_DEFENSE_MULTIPLIER = 75;
        const CHAKRA_THRESHOLD = 4;

        const maxHP = Number(baseUser.maxHealth || baseUser.health || 100);
        const healAmount = Math.floor(maxHP * HEAL_PERCENT);

        if (isFirstActivation) {
            // First activation: Apply initial buffs
            baseUser.activeEffects = baseUser.activeEffects || [];

            // Add power and defense buffs (99 rounds)
            baseUser.activeEffects.push({
                type: 'buff',
                stats: {
                    power: baseUser.power * POWER_DEFENSE_MULTIPLIER,
                    defense: baseUser.defense * POWER_DEFENSE_MULTIPLIER
                },
                duration: 99,
                source: 'Ikari'
            });

            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name} activates Ikari! Overwhelming power surges through them!`,
                specialEffects: [
                    `Healed ${healAmount} HP`,
                    `Power and Defense boosted!`
                ],
                hit: true,
                jutsuUsed: 'Ikari'
            };
        } else {
            // Subsequent rounds: Upkeep logic

            // Check if already restricted (Chakra depleted phase)
            const isRestricted = baseUser.activeEffects?.some(e => e.status === 'Ikari Restriction');

            if (isRestricted) {
                // Keep the jutsu alive for passive regen
                if (baseUser.activeCustomRoundJutsus) {
                    const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                    if (selfEntry) selfEntry.roundsLeft = 100;
                }

                return {
                    damage: 0,
                    heal: healAmount,
                    description: `${baseUser.name}'s Ikari maintains passive health regeneration!`,
                    specialEffects: [
                        `Healed ${healAmount} HP (Passive Regen)`
                    ],
                    hit: true,
                    jutsuUsed: 'Ikari'
                };
            }

            // 1. Check if chakra WILL BE at or below threshold AFTER deduction
            const chakraAfterDeduction = Math.max(0, (baseUser.chakra || 0) - CHAKRA_COST_PER_ROUND);

            if (chakraAfterDeduction <= CHAKRA_THRESHOLD) {
                // Add restriction FIRST (before deducting chakra) so it takes effect immediately
                baseUser.activeEffects = baseUser.activeEffects || [];
                const alreadyRestricted = baseUser.activeEffects.some(e => e.status === 'Ikari Restriction');
                if (!alreadyRestricted) {
                    baseUser.activeEffects.push({
                        type: 'status',
                        status: 'Ikari Restriction',
                        replacesAttack: true,
                        replaceWith: 'Full Power Strike',
                        duration: 999
                    });
                }

                // Deduct final chakra
                baseUser.chakra = chakraAfterDeduction;

                // Keep the jutsu alive for passive regen!
                if (baseUser.activeCustomRoundJutsus) {
                    const selfEntry = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuData.name);
                    if (selfEntry) selfEntry.roundsLeft = 100;
                }

                return {
                    damage: 0,
                    heal: healAmount,
                    description: `${baseUser.name}'s Ikari pushes to its limit! Chakra depleted.`,
                    specialEffects: [
                        "Ikari Limit Reached (Chakra Depleted)",
                        `Healed ${healAmount} HP`,
                        "⚠️ Only Full Power Strike available!"
                    ],
                    hit: true,
                    jutsuUsed: 'Ikari'
                };
            }

            // 2. Normal operation: Deduct Chakra
            baseUser.chakra = chakraAfterDeduction;

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
                description: `${baseUser.name}'s Ikari regenerates health!`,
                specialEffects: [
                    `Healed ${healAmount} HP (-${CHAKRA_COST_PER_ROUND} Chakra)`,
                    `Chakra: ${baseUser.chakra}`
                ],
                hit: true,
                jutsuUsed: 'Ikari'
            };
        }
    }
};
