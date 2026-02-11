module.exports = {
    execute: function (params) {
        const { baseUser, baseTarget, type, action, roundNum } = params;

        // Type: 'setup' -> When the jutsu is first used
        if (type === 'setup' || !type) {
            baseTarget.activeEffects = baseTarget.activeEffects || [];

            // Add the trap as a hidden effect
            baseTarget.activeEffects.push({
                type: 'raiders_trap',
                status: 'raiders_tower_trap',
                duration: 10,
                source: baseUser.userId
            });

            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} sets up a Raiders Tower trap!`,
                specialEffects: ["A mysterious trap has been set..."],
                hit: true
            };
        }

        // Type: 'process' -> Checked every turn in the battle loop
        if (type === 'process') {
            const effects = baseUser.activeEffects || [];

            // 1. Check if player has the trap and is trying to act (not resting)
            const trapIdx = effects.findIndex(e => e.status === 'raiders_tower_trap');
            const isTryingToAct = !action.isRest && !action.fled;

            if (trapIdx !== -1 && isTryingToAct) {
                // Remove the trap
                baseUser.activeEffects.splice(trapIdx, 1);

                // Add the debt (they MUST rest next round)
                baseUser.activeEffects.push({
                    type: 'raiders_debt',
                    status: 'raiders_tower_debt',
                    duration: 2,
                    triggeredInRound: roundNum
                });

                // Add to action's special effects so it shows in round summary
                action.specialEffects = action.specialEffects || [];
                action.specialEffects.push(`${baseUser.name} triggered a Raiders Tower trap!`);
            }

            // 2. Check if player has debt and failed to rest
            const debtIdx = effects.findIndex(e => e.status === 'raiders_tower_debt');
            if (debtIdx !== -1) {
                const debt = effects[debtIdx];

                // Check if this is a round AFTER the trap was triggered
                if (debt.triggeredInRound !== undefined && roundNum > debt.triggeredInRound) {
                    if (!action.isRest) {
                        // PENALTY: Instant death
                        baseUser.currentHealth = -10000000;

                        // Block ALL revives and bypass immortality
                        baseUser.hasRevivedThisBattle = true;
                        baseUser.izanamiUsed = true;
                        baseUser.izanamiImmortal = false;
                        baseUser.izanamiActive = false;
                        baseUser.customImmortal = false;

                        // Override the action to show the penalty
                        action.damage = 0;
                        action.heal = 0;
                        action.description = `**ONE POPPED** ${baseUser.name} has been eliminated!`;
                        action.specialEffects = action.specialEffects || [];
                        action.specialEffects.push("Raiders Tower Penalty: Instant Death");
                    }

                    // Clear the debt after checking (whether they rested or not)
                    baseUser.activeEffects.splice(debtIdx, 1);
                }
            }

            return {};
        }
    }
};
