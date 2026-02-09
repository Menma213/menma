module.exports = {
    execute: function ({ baseUser, baseTarget, round, jutsuData }) {
        // Round 1 (Initial Cast)
        if (!round || round === 1) {
            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} casts Planetary Devastation! A gravity sphere forms around ${baseTarget.name}, pulling debris!`,
                hit: true,
                jutsuUsed: jutsuData.name,
                specialEffects: [`Planetary Devastation Initialized (Round 1/10)`]
            };
        }

        // Rounds 2-9 (Crushing with increasing damage)
        if (round < 10) {
            const baseDamage = 500;
            const damage = baseDamage * round; // Damage increases each round

            return {
                damage: damage,
                heal: 0,
                description: `The Planetary Devastation crushes ${baseTarget.name} with immense gravitational force!`,
                hit: true,
                jutsuUsed: jutsuData.name,
                specialEffects: [
                    `Planetary Devastation (Round ${round}/10)`,
                    `Gravitational Crush: ${damage} damage!`
                ]
            };
        }

        // Round 10+ (Detonation - Instant Kill)
        return {
            damage: 999999999, // Massive damage ensures kill
            heal: 0,
            description: `The Planetary Devastation is complete! The sphere IMPLODES with cataclysmic force, obliterating ${baseTarget.name}!`,
            hit: true,
            jutsuUsed: jutsuData.name,
            specialEffects: [
                "PLANETARY DEVASTATION: DETONATION",
                "INSTANT KILL",
                "COMPLETE ANNIHILATION"
            ]
        };
    }
};
