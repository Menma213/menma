module.exports = {
    name: "Carnage",
    description: "user goes berserk, increasing power and defense.",
    execute: function ({ baseUser, baseTarget, effectHandlers }) {
        // 1. Infinite Healing
        // Ensure maxHealth is a valid number
        const maxHP = Number(baseUser.maxHealth) || 100;
        // Heal to full (and beyond if needed, but full is usually 'infinite health' contextually if it happens every turn)
        baseUser.currentHealth = maxHP;

        // 2. Infinite Revive
        // Apply a revive effect with essentially infinite duration
        // We use the effectHandler's revive helper
        effectHandlers.revive(baseUser, {
            duration: 9999, // Effectively infinite
            heal_amount: "1.0 * user.maxHealth", // Revive to full HP
            once_per_battle: false // Allow multiple revives if somehow killed multiple times
        });

        // 3. Massive Buffs (replicating the 'berserk' nature)
        if (!baseUser.activeEffects) baseUser.activeEffects = [];
        baseUser.activeEffects.push({
            type: 'buff',
            stats: {
                power: 999999999,
                defense: 999999999
            },
            duration: 9999,
            source: 'Carnage'
        });

        // 3b. Infinite Regeneration (Heal per turn)
        baseUser.activeEffects.push({
            type: 'heal', // or 'status'
            status: 'Carnage Regeneration',
            healPerTurn: "user.maxHealth", // Heal to full every turn
            duration: 9999,
            source: 'Carnage'
        });

        // 4. Kill (Massive Damage)
        // We calculate a value that is sure to kill anything
        const damage = 999999999999;

        return {
            damage: damage,
            heal: maxHP, // Reporting the "infinite heal"
            hit: true,
            specialEffects: [
                "**CARNAGE MODE**: Infinite Health & Revive active.",
                "Power and Defense raised to infinity.",
                "Target annihilated."
            ],
            description: `${baseUser.name} embraces **Carnage**, becoming an immortal force of destruction!`
        };
    }
};
