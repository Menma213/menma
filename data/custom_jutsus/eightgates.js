const getEightGatesBuff = (gateLevel) => {
    switch (gateLevel) {
        case 1:
            return { power: 2000, defense: 1000 };
        case 2:
            return { power: 4000, defense: 2000 };
        case 3:
            return { power: 6000, defense: 3000 };
        case 4:
            return { power: 8000, defense: 4000 };
        case 5:
            return { power: 10000, defense: 5000 };
        case 6:
            return { power: 15000, defense: 7500 };
        case 7:
            return { power: 20000, defense: 10000 };
        default:
            return { power: 0, defense: 0 };
    }
};

const getGateName = (gateLevel) => {
    const gateNames = [
        "The Gate of Opening",
        "The Gate of Healing",
        "The Gate of Life",
        "The Gate of Pain",
        "The Gate of Limit",
        "The Gate of View",
        "The Gate of Wonder",
        "The Gate of Death"
    ];
    return gateNames[gateLevel - 1] || "Unknown Gate";
};

module.exports.execute = ({
    baseUser,
    baseTarget,
    effectiveUser,
    effectiveTarget,
    jutsuData,
    round,
    isFirstActivation
}) => {
    let eightGatesLevel = baseUser.eightGatesLevel || 0;

    if (eightGatesLevel >= 7) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} is already at the 7th gate and cannot open another!`,
            specialEffects: ["Maximum gate reached!"],
            hit: false,
            jutsuUsed: "Eight Gates"
        };
    }

    // Increment the gate level
    eightGatesLevel++;
    baseUser.eightGatesLevel = eightGatesLevel;

    const buff = getEightGatesBuff(eightGatesLevel);
    const gateName = getGateName(eightGatesLevel);
    const cost = 20;
    const healthCost = Math.floor(baseUser.health * (cost / 100));

    // Apply buff
    baseUser.activeEffects = baseUser.activeEffects || [];
    baseUser.activeEffects.push({
        type: 'buff',
        stats: buff,
        duration: 99, 
        source: 'Eight Gates'
    });

    return {
        damage: 0,
        heal: 0,
        description: `${baseUser.name} opens ${gateName}! Their power surges!`,
        specialEffects: [
            `Opened Gate ${eightGatesLevel}: ${gateName}`,
            `+${buff.power} Power`,
            `+${buff.defense} Defense`,
            `-${healthCost} Health`
        ],
        hit: true,
        jutsuUsed: "Eight Gates"
    };
};
