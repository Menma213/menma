// filepath: c:\Users\HI\Downloads\menma\data\custom_jutsus\susanoSlash.js
function execute({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, round }) {
    const result = { damage: 0, specialEffects: [], hit: true, jutsuUsed: jutsuData.name, chakraUsed: 0 };
    const cost = Number(jutsuData.chakraCost) || 0;
    if (baseUser.chakra < cost) { result.hit = false; result.specialEffects.push('Not enough chakra'); return result; }
    baseUser.chakra -= cost; result.chakraUsed = cost;

    // example formula
    const damage = Math.max(1, Math.floor( (2000 * effectiveUser.power) / Math.max(1, effectiveTarget.defense) ));
    baseTarget.currentHealth = Math.max(0, baseTarget.currentHealth - damage);
    result.damage = damage;
    result.specialEffects.push(`${baseUser.name} performs Susano Slash, dealing ${damage} damage.`);
    return result;
}
module.exports = { execute };
