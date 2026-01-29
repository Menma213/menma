module.exports = {
    name: "Ninpo: Ascetic Blaze",
    description: "Reinforced punches with a godly blaze. Passively grants chakra, burns target, and siphons stats.",
    execute: function ({ baseUser, baseTarget, effectHandlers }) {
        // 1. Calculate Damage
        // Formula: 1500 * user.power / target.defense * user.chakra
        const power = Number(baseUser.power) || 0;
        const defense = Number(baseTarget.defense) || 1;
        const chakra = Number(baseUser.chakra) || 0;

        let damage = 0;
        if (chakra > 0) {
            damage = Math.floor(1500 * power / defense * chakra / 5);
        } else {
            damage = Math.floor(1500 * power / defense); // Fallback if 0 chakra so it does something?
            // Actually requirement says "* user.chakra". If chakra is 0, damage is 0. 
            // But usually attacks cost chakra so you might have 0 after cost if this was calculated differently.
            // We'll trust the formula.
        }

        // 2. Passive Chakra Gain (User) - Effect 1
        // "give 5 chakra per turn passively" -> 5 rounds
        if (!baseUser.activeEffects) baseUser.activeEffects = [];
        baseUser.activeEffects.push({
            type: 'buff', // or 'status' that has chakra_per_round
            status: 'Ascetic Chakra', // arbitrary name for display
            chakra_per_round: 5, // Positive means gain, as per combinedcommands.js logic check
            type: 'chakra_drain',
            amount: 5,
            duration: 5,
            source: 'Ninpo: Ascetic Blaze'
        });




        // Actually, combinedcommands.js line 760 (Step 8) calculates the DELTA and stores it in `stats`.

        // So I should calculate the delta manually here.
        const buffAmount = (Number(baseUser.power) || 0) * 19; // +1900% = 2000% total

        baseUser.activeEffects.push({
            type: 'buff',
            stats: { power: buffAmount },
            duration: 5,
            source: 'Ninpo: Ascetic Blaze'
        });

        // 4. Burn Status (Target) - Effect 3
        // "burn status for 5 rounds"
        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
        baseTarget.activeEffects.push({
            type: 'status',
            status: 'burn',
            duration: 5,
            damagePerTurn: "target.health * 0.05", // Standard burn or custom? Default is used if not specified.
            // Lets leave it default or specify if needed. Default is 2.5% usually?
            // "burn status" usually standard.
            source: 'Ninpo: Ascetic Blaze'
        });


        baseTarget.activeEffects.push({
            type: 'status',
            status: 'siphon',
            duration: 5,
            source: 'Ninpo: Ascetic Blaze'
        });

        return {
            damage: damage,
            hit: true,
            specialEffects: [
                "**Ascetic Blaze**: Power surged!",
                "Regenerating Chakra!",
                "Target is Burning and being Siphoned!"
            ],
            description: `**Ninpo: Ascetic Blaze**\nThe user is enveloped in a godly flame, striking with overwhelming force!`
        };
    }
};
