/**
 * Custom Jutsu: Four Violet Flames Formation
 * 
 * Effects:
 * 1. Applies 'stumble' status to target for 2 turns (30% chance to self-damage and skip turn).
 * 2. Increases User Defense by 1000x for 2 turns.
 * 3. Decreases User Power by 99% for 2 turns.
 */

module.exports = {
    execute({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, round, isFirstActivation }) {
        const result = {
            damage: 0,
            heal: 0,
            description: jutsuData.description?.replace(/user/gi, baseUser.name) || `${baseUser.name} produces a massive purple barrier!`,
            specialEffects: [],
            hit: true,
            jutsuUsed: jutsuData.name,
            chakraUsed: 0,
            visualFile: jutsuData.image_url
        };

        // 1. Subtract Chakra
        const cost = jutsuData.chakraCost || 20;
        if (baseUser.chakra < cost) {
            return {
                ...result,
                description: `${baseUser.name} tried to form the barrier but lacked the chakra!`,
                specialEffects: ['Not enough chakra!'],
                hit: false
            };
        }
        baseUser.chakra -= cost;
        result.chakraUsed = cost;

        // 2. Apply Stumble Status to Target
        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
        baseTarget.activeEffects.push({
            type: 'status',
            status: 'stumble',
            duration: 2,
            source: jutsuData.name
        });
        result.specialEffects.push(`${baseTarget.name} stumbles and attacks themself`);

        // 3. Apply Multiplicative-like Buffs to User
        if (!baseUser.activeEffects) baseUser.activeEffects = [];

        // Increase Defense by 1000x (effectively adding 999x current defense)
        const defBoost = Math.floor(effectiveUser.defense * 999);
        baseUser.activeEffects.push({
            type: 'buff',
            stats: { defense: defBoost },
            duration: 3,
            source: jutsuData.name
        });

        // Decrease Power by 99% (effectively subtracting 99% of current power)
        const powerReduction = -Math.floor(effectiveUser.power * 0.99);
        baseUser.activeEffects.push({
            type: 'debuff',
            stats: { power: powerReduction },
            duration: 2,
            source: jutsuData.name
        });

        result.specialEffects.push(`${baseUser.name}'s defense becomes impenetrable, but their power vanishes.`);

        return result;
    }
};
