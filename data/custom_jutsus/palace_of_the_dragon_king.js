module.exports = {
    execute: function ({ baseUser, baseTarget, jutsuData }) {
        baseTarget.activeEffects = baseTarget.activeEffects || [];
        baseTarget.activeEffects.push({
            type: 'status',
            status: 'stun',
            duration: 100,
            source: jutsuData.name,
            isNew: true
        });

        return {
            damage: 0,
            description: `${baseUser.name} uses Palace of the Dragon King! ${baseTarget.name} is trapped in an infinite stun!`,
            specialEffects: [`${baseTarget.name} is stunned for 100 rounds!`],
            hit: true,
            jutsuUsed: "Palace of the dragon king"
        };
    }
};
