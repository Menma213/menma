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

    // --- 1. APPLY 20X POWER AND DEFENSE BOOST ---
    // Delta needed: (20 * stat) - current_stat = 19 * current_stat
    const powerDelta = Math.floor(effectiveUser.power * 19);
    const defenseDelta = Math.floor(effectiveUser.defense * 19);

    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.unshift({
        type: 'buff',
        stats: {
            power: powerDelta,
            defense: defenseDelta
        },
        duration: 3,
        source: jutsuData.name,
        isNew: true
    });

    result.specialEffects.push(`${baseUser.name} transcends reality! Power and Defense increased by 20x!`);

    // --- 2. STEAL ALL GOOD BUFFS ---
    baseTarget.activeEffects = baseTarget.activeEffects || [];

    // Identify beneficial effects: buffs, heals, and helpful statuses
    const buffsToSteal = baseTarget.activeEffects.filter(e =>
        e.type === 'buff' ||
        e.type === 'heal' ||
        (e.type === 'status' && (e.healPerTurn || ['revive', 'haste', 'regeneration', 'shield'].includes(e.status)))
    );

    if (buffsToSteal.length > 0) {
        buffsToSteal.forEach(buff => {
            // Apply stolen buff to user (copy and mark as new)
            baseUser.activeEffects.push({ ...buff, isNew: true });

            // Determine a name for the log message
            let effectLabel = "";
            if (buff.stats) {
                effectLabel = Object.keys(buff.stats).join(', ') + " buff";
            } else {
                effectLabel = buff.status || buff.type;
            }

            result.specialEffects.push(`${baseUser.name} steals ${effectLabel} from ${baseTarget.name}!`);
        });

        // Remove stolen buffs from target
        baseTarget.activeEffects = baseTarget.activeEffects.filter(e => !buffsToSteal.includes(e));
    } else {
        result.specialEffects.push(`${baseTarget.name} had no buffs to steal.`);
    }

    return result;
}

module.exports = { execute };
