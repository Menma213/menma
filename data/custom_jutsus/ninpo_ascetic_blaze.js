module.exports = {
    name: "Ninpo: Ascetic Blaze",
    description: "Reinforced punches with a godly blaze. Passively grants chakra, burns target, and siphons stats.",
    execute: function ({ baseUser, baseTarget, effectiveUser, effectiveTarget, effectHandlers, getEffectiveStats, jutsuData }) {
        const result = {
            damage: 0,
            hit: true,
            specialEffects: [],
            description: jutsuData.description,
            jutsuUsed: jutsuData.name
        };

        if (!baseUser.activeEffects) baseUser.activeEffects = [];
        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];

        // --- CHECK FOR DUPLICATES ---
        const alreadyHasBuff = baseUser.activeEffects.some(e => e.source === jutsuData.name);

        if (alreadyHasBuff) {
            result.specialEffects.push(`${baseUser.name} already has this active.`);
        } else {
            // 2. Passive Chakra Gain (User)
            baseUser.activeEffects.push({
                type: 'chakra_drain',
                amount: 5,
                duration: 5,
                source: jutsuData.name,
                isNew: true
            });

            // 3. Power Buff (User)
            const buffAmount = (Number(baseUser.power) || 0) * 19;
            baseUser.activeEffects.push({
                type: 'buff',
                stats: { power: buffAmount },
                duration: 5,
                source: jutsuData.name,
                isNew: true
            });

            // 4. Burn Status (Target)
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'burn',
                duration: 5,
                damagePerTurn: "target.health * 0.05",
                source: jutsuData.name,
                isNew: true
            });

            // 5. Siphon Status (Target)
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'siphon',
                duration: 5,
                source: jutsuData.name,
                isNew: true
            });

            result.specialEffects.push("Chakra and power increased.");
            result.specialEffects.push("Target is burning.");

            // --- APPLY BUFFS IMMEDIATELY ---
            if (typeof getEffectiveStats === 'function') {
                Object.assign(effectiveUser, getEffectiveStats(baseUser));
                Object.assign(effectiveTarget, getEffectiveStats(baseTarget));
            }
        }

        // 1. Calculate Damage using EFFECTIVE stats
        const power = Number(effectiveUser.power) || Number(baseUser.power) || 0;
        const defense = Number(effectiveTarget.defense) || Number(baseTarget.defense) || 1;
        const chakra = Number(effectiveUser.chakra) || Number(baseUser.chakra) || 0;

        if (chakra > 0) {
            result.damage = Math.floor(2500 * power / defense * chakra / 5);
        } else {
            result.damage = Math.floor(2500 * power / defense);
        }

        return result;
    }
};
