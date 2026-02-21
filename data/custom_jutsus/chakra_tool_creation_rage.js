module.exports = {
    execute: function ({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, effectHandlers }) {
        const trueDamage = Math.floor((baseTarget.maxHealth || baseTarget.health || 100) * 0.60);
        const scalingDamage = Math.floor(15000 * effectiveUser.power / effectiveTarget.defense);
        const totalDamage = trueDamage + scalingDamage;

        return {
            damage: totalDamage,
            description: `${baseUser.name} uses Chakra Tool Creation! Dealing ${trueDamage} true damage and ${scalingDamage} scaling damage!`,
            specialEffects: [
                `True Damage: ${trueDamage}`,
                `Scaling Damage: ${scalingDamage}`
            ],
            hit: true,
            jutsuUsed: jutsuData.name
        };
    }
};
