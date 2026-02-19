const path = require('path');
const fs = require('fs');

module.exports = {
    execute: function ({ baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuData, effectHandlers, jutsuList }) {
        const targetJutsus = Object.values(baseTarget.jutsu || {}).filter(j => j && j !== 'None' && j !== 'Attack');

        if (targetJutsus.length === 0) {
            return {
                damage: 0,
                description: `${baseUser.name} tries to steal a jutsu, but ${baseTarget.name} has none to steal!`,
                hit: true,
                jutsuUsed: "Attack"
            };
        }

        const stolenJutsuName = targetJutsus[Math.floor(Math.random() * targetJutsus.length)];
        const stolenJutsuData = jutsuList[stolenJutsuName];

        if (!stolenJutsuData) {
            return {
                damage: 0,
                description: `${baseUser.name} failed to manifest the stolen jutsu: ${stolenJutsuName}`,
                hit: false
            };
        }

        let result = {
            description: `${baseUser.name} uses **Urashiki Jutsu Steal** and replicates **${stolenJutsuName}**!`,
            hit: true,
            jutsuUsed: stolenJutsuName,
            specialEffects: [`Stolen: ${stolenJutsuName}`],
            damage: 0,
            heal: 0,
            effects: []
        };

        // Check if the stolen jutsu is a custom script
        if (stolenJutsuData.scriptFile) {
            try {
                const scriptPath = path.join(__dirname, stolenJutsuData.scriptFile);
                if (fs.existsSync(scriptPath)) {
                    const customModule = require(scriptPath);
                    if (typeof customModule.execute === 'function') {
                        const customRes = customModule.execute({
                            baseUser,
                            baseTarget,
                            effectiveUser,
                            effectiveTarget,
                            jutsuData: stolenJutsuData,
                            effectHandlers,
                            jutsuList,
                            round: 1, // Assume round 1 for stolen activation
                            isFirstActivation: true
                        });

                        // Merge findings
                        if (customRes.damage) result.damage = (result.damage || 0) + customRes.damage;
                        if (customRes.heal) result.heal = (result.heal || 0) + customRes.heal;
                        if (customRes.description) result.description += "\n" + customRes.description;
                        if (customRes.specialEffects) result.specialEffects.push(...customRes.specialEffects);
                        if (customRes.effects) result.effects.push(...customRes.effects);
                        result.hit = customRes.hit !== undefined ? customRes.hit : true;
                    }
                }
            } catch (err) {
                console.error(`Error executing stolen custom jutsu ${stolenJutsuName}:`, err);
            }
        } else {
            // It's a standard jutsu, return effects for executeJutsu to process
            result.effects = JSON.parse(JSON.stringify(stolenJutsuData.effects || []));
        }

        return result;
    }
};
