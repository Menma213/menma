function execute({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, round }) {
    const result = {
        damage: 0,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) {
        result.hit = false;
        result.specialEffects.push('Not enough chakra');
        return result;
    }
    baseUser.chakra -= cost;
    result.chakraUsed = cost;

    // Add power and defense buffs
    const powerBuff = 40000; // Example value
    const defenseBuff = 40000; // Example value

    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: { power: powerBuff },
        duration: 3,
        source: jutsuData.name
    });
    baseUser.activeEffects.push({
        type: 'buff',
        stats: { defense: defenseBuff },
        duration: 3,
        source: jutsuData.name
    });

    result.specialEffects.push(`${baseUser.name} gains a boost in power and defense!`);

    // Steal buffs from target
    baseTarget.activeEffects = baseTarget.activeEffects || [];
    const buffsToSteal = baseTarget.activeEffects.filter(e => e.type === 'buff');
    baseTarget.activeEffects = baseTarget.activeEffects.filter(e => e.type !== 'buff');

    if (buffsToSteal.length > 0) {
        baseUser.activeEffects.push(...buffsToSteal);
        buffsToSteal.forEach(buff => {
            const buffName = Object.keys(buff.stats).join(', ');
            result.specialEffects.push(`${baseUser.name} steals ${buffName} from ${baseTarget.name}!`);
        });
    }

    return result;
}

module.exports = { execute };
