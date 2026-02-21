const math = require('mathjs');

module.exports = {
    execute: function ({
        baseUser,
        baseTarget,
        effectiveUser,
        effectiveTarget,
        jutsuData,
        isFirstActivation,
        useOverwhelmingPower
    }) {

        const HEAL_PERCENT = 0.10;
        const POWER_DEFENSE_MULTIPLIER = 75;
        const CHAKRA_COST_PER_ROUND = 10; // permanent cost

        const maxHP = Number(baseUser.maxHealth || baseUser.health || 100);
        const currentHP = Number(baseUser.health || 1);
        const healAmount = Math.floor(maxHP * HEAL_PERCENT);

        baseUser.activeEffects = baseUser.activeEffects || [];
        baseTarget.activeEffects = baseTarget.activeEffects || [];

        let chakra = Number(baseUser.chakra || 0);

        // =====================================================
        // DIVINE IMMORTALITY TRIGGER (HP ≤10%)
        // =====================================================
        if ((currentHP / maxHP <= 0.10) && !baseUser.divineImmortalityTriggered) {

            baseUser.divineImmortalityTriggered = true;
            baseUser.permanentImmortal = true;

            baseUser.activeEffects.push({
                type: 'status',
                status: 'Divine Immortality',
                duration: 999999,
                source: 'Gods Possession',
                negateIncomingDamage: true,
                preventDeath: true,
                cannotBeKilled: true
            });

            return {
                damage: 0,
                heal: 0,
                description: `${baseUser.name}'s mortal body shatters at the brink of death. Divine will replaces their fading soul!`,
                specialEffects: [
                    `Divine Immortality awakened`,
                    `Death permanently transcended`,
                    `All lethal damage nullified`
                ],
                hit: true,
                jutsuUsed: 'Gods Possession'
            };
        }

        // =====================================================
        // FIRST ACTIVATION
        // =====================================================
        if (isFirstActivation) {

            // Remove enemy immortality/immunity
            baseTarget.izanamiImmortal = false;
            baseTarget.izanagiActive = false;
            baseTarget.permanentImmortal = false;
            baseTarget.activeEffects = baseTarget.activeEffects.filter(e => {
                if (!e.status) return true;
                const status = e.status.toLowerCase();
                return !(status.includes('immortal') || status.includes('invincible') || status.includes('immunity'));
            });

            baseTarget.actionNegated = true;
            baseTarget.forceBackflip = true;
            baseTarget.activeEffects.push({ type: 'status', status: 'stun', duration: 1, chance: 100, source: 'Gods Possession' });

            baseUser.activeEffects.push({
                type: 'buff',
                stats: { power: baseUser.power * POWER_DEFENSE_MULTIPLIER, defense: baseUser.defense * POWER_DEFENSE_MULTIPLIER },
                duration: 99,
                source: 'Gods Possession'
            });

            return {
                damage: 0,
                heal: healAmount,
                description: `${baseUser.name} invokes Gods Possession. Heaven descends, all opposing laws shattered.`,
                specialEffects: [
                    `Enemy immortality erased`,
                    `Enemy action negated`,
                    `Power and Defense multiplied`,
                    `Healed ${healAmount} HP`
                ],
                hit: true,
                jutsuUsed: 'Gods Possession'
            };
        }

        // =====================================================
        // PERMANENT CHAKRA DRAIN (10 per round)
        // =====================================================
        chakra = Math.max(0, chakra - CHAKRA_COST_PER_ROUND);
        baseUser.chakra = chakra;

        // =====================================================
        // AUTOMATIC OVERWHELMING POWER AT CHAKRA ≤15
        // =====================================================
        const hasOverride = baseUser.activeEffects.some(e => e.status === 'Overwhelming Power Override');

        if (chakra <= 15 && !hasOverride) {

            baseUser.activeEffects.push({
                type: 'status',
                status: 'Overwhelming Power Override',
                replacesAttack: true,
                replaceWith: 'Overwhelming Power',
                duration: 999999
            });

            baseTarget.actionNegated = true;
            baseTarget.forceBackflip = true;
            baseTarget.activeEffects.push({ type: 'status', status: 'stun', duration: 2, chance: 100, source: 'Overwhelming Power' });

            const currentChakra = Math.max(1, baseUser.chakra);
            const chakraScaling = Math.pow((currentChakra / 3) + 5, 1.8);
            const dominanceScaling = Math.pow(Math.max(1, Number(effectiveUser.power)) / Math.max(1, Number(effectiveTarget.defense)), 1.35);
            const annihilationBase = 2500;
            const finalDamage = Math.floor(annihilationBase * dominanceScaling * chakraScaling);

            const powerDelta = Math.floor(effectiveUser.power * 74);
            const defenseDelta = Math.floor(effectiveUser.defense * 74);

            baseUser.activeEffects.push({ type: 'buff', stats: { power: powerDelta, defense: defenseDelta }, duration: 999999, source: 'Overwhelming Power', isNew: true });
            baseUser.activeEffects.push({ type: 'status', status: 'absolute_immunity', duration: 999999, source: 'Overwhelming Power', ignoreAllNegativeEffects: true, preventDebuffApplication: true });

            // ======= COUNTER/REFLECT =======
            baseUser.activeEffects.push({
                type: 'status',
                status: 'punisher_shield_reflect',
                duration: 999999,
                source: 'Overwhelming Power',
                reflectDamage: true,
                reflectPercentage: 1.0,
                negateIncomingDamage: true
            });

            baseUser.activeEffects.push({
                type: 'status',
                status: 'overwhelming_reversal',
                duration: 999999,
                source: 'Overwhelming Power',
                reflectDamage: true,
                reflectPercentage: 3.0,
                negateIncomingDamage: true,
                reverseDamage: true,
                convertReflectedToHealing: true
            });

            return {
                damage: finalDamage,
                heal: healAmount,
                description: `${baseUser.name} activates Overwhelming Power! Countering and reflection fully enabled.`,
                specialEffects: [
                    `Enemy actions completely negated`,
                    `Overwhelming divine strike released`,
                    `Damage reflected`,
                    `Healed ${healAmount} HP`
                ],
                hit: true,
                jutsuUsed: 'Overwhelming Power'
            };
        }

        // =====================================================
        // NORMAL SUSTAIN
        // =====================================================
        return {
            damage: 0,
            heal: healAmount,
            description: `${baseUser.name}'s divine cultivation continues circulating through body and soul.`,
            specialEffects: [
                `Healed ${healAmount} HP`,
                `-${CHAKRA_COST_PER_ROUND} Chakra`,
                `Chakra remaining: ${baseUser.chakra}`
            ],
            hit: true,
            jutsuUsed: 'Gods Possession'
        };
    }
};