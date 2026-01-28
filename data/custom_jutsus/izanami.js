function execute({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, round }) {
    const result = {
        damage: 0,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuData.name,
        chakraUsed: 0
    };

    if (baseUser.izanamiUsed) {
        result.hit = false;
        result.specialEffects.push("You have already used Izanami.");
        return result;
    }

    // Activate Izanami
    baseUser.izanamiActive = true;
    baseUser.izanamiUsed = true;
    baseUser.izanamiPhase = "starting";
    baseUser.izanamiRound = 0; // Will be incremented in the battle loop
    baseUser.izanamiRecordedMoves = {
        user: [],
        target: []
    };

    result.specialEffects.push(`${baseUser.name} activates Izanami! The fate is being decided...`);
    result.specialEffects.push("Both combatants HP and Chakra are set to INFINITY!");

    return result;
}

module.exports = { execute };
