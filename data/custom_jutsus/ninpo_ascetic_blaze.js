module.exports = {
    name: "Ninpo: Ascetic Blaze",
    description: "Reinforced punches with a godly blaze. Passively grants chakra, burns target, and siphons stats.",
    execute: function ({ baseUser, baseTarget, effectiveUser, effectiveTarget, effectHandlers, getEffectiveStats }) {
        const result = {
            damage: 0,
            hit: true,
            specialEffects: [],
            description: `**Ninpo: Ascetic Blaze**\nThe user is enveloped in a godly flame, striking with overwhelming force!`
        };

        if (!baseUser.activeEffects) baseUser.activeEffects = [];
        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];

        // --- CHECK FOR DUPLICATES ---
        // This prevents the "CRAZY numbers" by ensuring the buff isn't applied multiple times.
        const alreadyHasBuff = baseUser.activeEffects.some(e => e.source === 'Ninpo: Ascetic Blaze');

        if (alreadyHasBuff) {
            result.specialEffects.push(`${baseUser.name} already had this buff active!`);
            // We skip adding the effects if they already exist, as requested.
        } else {
            // 2. Passive Chakra Gain (User)
            baseUser.activeEffects.push({
                type: 'chakra_drain',
                amount: 5,
                duration: 5,
                source: 'Ninpo: Ascetic Blaze',
                isNew: true
            });

            // 3. Power Buff (User)
            // Rule: Limit every single effect to one only.
            // Formula: +1900% power = 2000% total (20x)
            const buffAmount = (Number(baseUser.power) || 0) * 19;
            baseUser.activeEffects.push({
                type: 'buff',
                stats: { power: buffAmount },
                duration: 5,
                source: 'Ninpo: Ascetic Blaze',
                isNew: true
            });

            // 4. Burn Status (Target)
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'burn',
                duration: 5,
                damagePerTurn: "target.health * 0.05",
                source: 'Ninpo: Ascetic Blaze',
                isNew: true
            });

            // 5. Siphon Status (Target)
            baseTarget.activeEffects.push({
                type: 'status',
                status: 'siphon',
                duration: 5,
                source: 'Ninpo: Ascetic Blaze',
                isNew: true
            });

            result.specialEffects.push("**Ascetic Blaze**: Power surged!");
            result.specialEffects.push("Regenerating Chakra!");
            result.specialEffects.push("Target is Burning and being Siphoned!");

            // --- APPLY BUFFS IMMEDIATELY ---
            // Recalculate effective stats so that the damage calculation BELOW uses the new power.
            // This satisfies the requirement: "Buffs should be applied the round user NOT the round after"
            if (typeof getEffectiveStats === 'function') {
                Object.assign(effectiveUser, getEffectiveStats(baseUser));
                Object.assign(effectiveTarget, getEffectiveStats(baseTarget));
            }
        }

        // 1. Calculate Damage using EFFECTIVE stats (which now include the buff)
        const power = Number(effectiveUser.power) || Number(baseUser.power) || 0;
        const defense = Number(effectiveTarget.defense) || Number(baseTarget.defense) || 1;
        const chakra = Number(effectiveUser.chakra) || Number(baseUser.chakra) || 0;

        if (chakra > 0) {
            // Result will be much higher now because 'power' is boosted by 20x
            result.damage = Math.floor(2500 * power / defense * chakra / 5);
        } else {
            result.damage = Math.floor(2500 * power / defense);
        }

        return result;
    }
};
