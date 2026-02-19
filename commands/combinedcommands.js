const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fetch = globalThis.fetch || require('node-fetch');

// Helper function to get buffer from fetch response (works with both node-fetch and built-in fetch)
async function getBufferFromResponse(response) {
    if (response.buffer && typeof response.buffer === 'function') {
        // node-fetch v2
        return await response.buffer();
    } else if (response.arrayBuffer && typeof response.arrayBuffer === 'function') {
        // Built-in fetch (Node 18+)
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } else {
        throw new Error('Unable to get buffer from response');
    }
}

const { BLOODLINES } = require('./bloodline.js');
// const { runMemorySequence } = require('../utils/memory.js'); // DISABLED - Causing battle failures
const activeBattles = new Map(); // Exported for multiplayer commands

// =======================================================================================
// GLOBAL MODELS, CONSTANTS, AND UTILITIES
// =======================================================================================

// --- File Paths ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');
const imagesPath = path.resolve(__dirname, '../../menma/images');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const effectsConfigPath = path.resolve(__dirname, '../../menma/data/effects.json');
const customJutsusPath = path.resolve(__dirname, '../../menma/data/custom_jutsus');
const raidProgressPath = path.resolve(__dirname, '../../menma/data/raid_progress.json');
const korilorePath = path.resolve(__dirname, '../../menma/data/korilore.json');
const userAccessoryPath = path.resolve(__dirname, '../../menma/data/userAccessory.json');


const LOG_CHANNEL_ID = "1381278641144467637";


// --- Emojis ---
const EMOJIS = {
    buff: "<:buff:1364946947055816856>",
    debuff: "<:debuff:1368242212374188062>",
    stun: "<:stun:1368243608695738399>",
    heal: "<:heal:1368243632045297766>",
    bleed: "<:bleed:1368243924346605608>",
    flinch: "<:flinch:1368243647711023124>",
    curse: "<:curse:1368243540978827294>",
    frost: "❄️",
    poison: "<:poison:1432367626566238229>",
    status: "<:status:1368243589498540092>"
};
const COMBO_EMOJI_FILLED = "[X]";
const COMBO_EMOJI_EMPTY = "[ ]";
const EFFECT_PRIORITY = {
    'remove_buffs': 0,
    'cleanse': 1,
    'buff': 2,
    'debuff': 2,
    'status': 3,
    'chakra_drain': 4,
    'chakra_gain': 4,
    'damage': 10,
    'heal': 10,
    'instantKill': 11,
    'OHKO': 11,
    'ohko': 11,
    'lifesteal_max_hp': 12
};

// --- Data Loading ---
let jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};
let comboList = fs.existsSync(combosPath) ? JSON.parse(fs.readFileSync(combosPath, 'utf8')) : {};
let effectsConfig = fs.existsSync(effectsConfigPath) ? JSON.parse(fs.readFileSync(effectsConfigPath, 'utf8')) : {};

// --- Enhanced Effect Handlers ---
const effectHandlers = {
    lifestealMaxHP(user, target, percentage) {
        if (target.izanamiImmortal) return 0;
        const amount = Math.floor((target.maxHealth || target.health || 100) * (percentage / 100));
        target.currentHealth = (target.currentHealth || 0) - amount;
        user.currentHealth = (user.currentHealth || 0) + amount;
        return amount;
    },
    /**
     * Calculates damage with improved dodge mechanics
     */
    damage: (user, target, formula, effect = {}) => {
        try {
            // OHKO Logic
            if (formula === '1 * target.health') {
                return Number(target.health) || 100; // Returns full health as damage
            }

            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 100,
                    currentHealth: (user.currentHealth !== undefined && user.currentHealth !== null) ? Number(user.currentHealth) : Number(user.health || 100),
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 80
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 100,
                    currentHealth: (target.currentHealth !== undefined && target.currentHealth !== null) ? Number(target.currentHealth) : Number(target.health || 100),
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0
                },
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => e.type === 'status' && ['stun', 'flinch', 'drown', 'possessed'].includes(e.status)),
                max: Math.max,
                min: Math.min,
                random: Math.random
            };

            // NEW: Linear Hit Chance formula as requested: hit = accuracy - dodge
            const finalAccuracy = (Number(context.user.accuracy) || 80) + (effect.accuracyBonus || 0);
            let targetDodge = Number(context.target.dodge) || 0;

            let hitChance = finalAccuracy - targetDodge;

            // Situational bonuses
            if (context.hasHiddenMist) hitChance -= 15; // Harder to hit in mist
            if (context.isTargetIncapacitated) hitChance += 30; // Easier to hit if stunned/incapacitated

            // Clamp hit chance between 0 and 100
            hitChance = Math.max(0, Math.min(100, hitChance));

            const hits = Math.random() * 100 <= hitChance;
            if (!hits) return { damage: 0, hit: false, wasDodged: true };

            const rawDamage = math.evaluate(formula, context);
            let damage = Math.floor(rawDamage);
            let isCrit = false;

            // Crit Logic
            if (effect.critChance) {
                if (Math.random() * 100 <= effect.critChance) {
                    isCrit = true;
                    // message says 25% more damage, so 1.25 multiplier
                    const multiplier = effect.critMultiplier || 1.25;
                    damage = Math.floor(damage * multiplier);
                }
            }

            let reflectedDamage = 0;
            let reflectionMessage = null;
            let adaptationNullified = false; // Flag for special embed

            // Adaptation Logic: Reduce damage if target is adapting
            if (effect.jutsuName && target.activeEffects?.some(e => e.status === 'Wheel of Fate Adaptation')) {
                target.adaptedTechniques = target.adaptedTechniques || {};
                const hitsEndured = target.adaptedTechniques[effect.jutsuName] || 0;

                // Calculate adaptation percentage
                // 1st hit: 1 - (0 * 0.33) = 1.0 (100%)
                // 2nd hit: 1 - (1 * 0.33) = 0.67 (67%)
                // 3rd hit: 1 - (2 * 0.33) = 0.34 (34%)
                // 4th+ hit: 1 - (3 * 0.33) = 0.01 -> clamped to 0
                const adaptationMultiplier = Math.max(0, 1 - (hitsEndured * 0.33));
                const adaptationPercent = Math.round(adaptationMultiplier * 100);

                // Apply damage reduction
                const originalDamage = damage;
                damage = Math.floor(damage * adaptationMultiplier);

                // Check if adaptation fully nullified the damage
                if (originalDamage > 0 && damage === 0) {
                    adaptationNullified = true;
                }

                // Reflection Logic: After first hit (when adaptation starts working)
                if (hitsEndured > 0 && damage > 0) {
                    let reflectionPercent = 0;

                    // Determine reflection percentage based on adaptation level (raised minimum to 50%)
                    if (adaptationPercent <= 0) {
                        reflectionPercent = 0.80; // 80% reflection at 0% damage (fully adapted)
                    } else if (adaptationPercent <= 33) {
                        reflectionPercent = 0.65; // 65% reflection at 33% damage
                    } else if (adaptationPercent <= 66) {
                        reflectionPercent = 0.50; // 50% reflection at 66% damage
                    }

                    if (reflectionPercent > 0) {
                        reflectedDamage = Math.floor(damage * reflectionPercent);
                        const reflectPercentDisplay = Math.round(reflectionPercent * 100);
                        // Use the actual name properties from user/target objects
                        const userName = user?.name || 'Attacker';
                        const targetName = target?.name || 'Defender';
                        reflectionMessage = `${targetName} reflected ${reflectedDamage} damage (${reflectPercentDisplay}%) back to ${userName}!`;
                    }
                }

                // Increment adaptation for next time
                target.adaptedTechniques[effect.jutsuName] = hitsEndured + 1;
            }

            return { damage, hit: true, wasDodged: false, reflectedDamage, reflectionMessage, adaptationNullified, isCrit };
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return { damage: 0, hit: false, wasDodged: false, adaptationNullified: false };
        }
    },

    /**
     * Applies buff effects. String formulas calculate the final stat value, while numbers are treated as additive deltas.
     */
    buff: (user, statsDefinition) => {
        const changes = {};
        const context = { user: { ...user }, max: Math.max, min: Math.min };
        if (!statsDefinition || typeof statsDefinition !== 'object') return changes;

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                let value;
                if (typeof formulaOrValue === 'string') {
                    const evaluated = math.evaluate(formulaOrValue, context);
                    const baseValue = Number(user[stat]) || 0;
                    value = evaluated - baseValue;
                } else {
                    value = Number(formulaOrValue);
                }

                if (!Number.isFinite(value)) {
                    continue;
                }
                // store as a numeric delta to be added onto base stat
                changes[stat] = value;
            } catch (err) {
                console.error('Error evaluating buff stat:', stat, formulaOrValue, err);
            }
        }
        return changes;
    },
    /**
    * Random effect selection
    */
    random: (effectsArray) => {
        if (!Array.isArray(effectsArray) || effectsArray.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * effectsArray.length);
        return effectsArray[randomIndex];
    },


    /**
     * Applies debuff effects. String formulas calculate the final stat value, while numbers are treated as subtractive deltas.
     */
    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = {
            target: { ...target },
            max: Math.max,
            min: Math.min
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                let value;
                if (typeof formulaOrValue === 'string') {
                    // Check if formula starts with a negative sign (explicit reduction)
                    const isExplicitNegative = formulaOrValue.trim().startsWith('-');

                    const evaluated = math.evaluate(formulaOrValue, context);
                    const baseValue = Number(target[stat]) || 0;

                    if (isExplicitNegative) {
                        // Formula like "-target.power * 0.5" already represents the delta
                        value = evaluated;
                    } else {
                        // Formula like "target.defense * 0.25" represents the final value
                        // Calculate the delta (will be negative for reductions)
                        value = evaluated - baseValue;
                    }
                } else {
                    // For numbers, assume it's the amount to subtract
                    value = -Math.abs(Number(formulaOrValue));
                }

                if (!Number.isFinite(value)) {
                    continue;
                }

                changes[stat] = value;

            } catch (err) {
                console.error(`Debuff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },
    /**
      * Revive effect handler
      */
    revive: (combatant, effect = {}) => {
        try {
            const duration = Number(effect.duration) || 1;
            const healFormula = (typeof effect.heal_amount === 'string' || typeof effect.heal_amount === 'number')
                ? effect.heal_amount
                : (effect.amount || 0);
            const oncePerBattle = !!effect.once_per_battle;

            // Add revive status to combatant
            combatant.activeEffects = combatant.activeEffects || [];
            combatant.activeEffects.push({
                type: 'status', // store as status to be compatible with other logic
                status: 'revive',
                duration: duration,
                heal_amount: healFormula,
                once_per_battle: oncePerBattle,
                source: 'revive_effect'
            });

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Cleanses all negative effects on a combatant.
     */
    cleanse: (combatant) => {
        if (!combatant.activeEffects || !Array.isArray(combatant.activeEffects)) return [];

        const negativeStatuses = ['stun', 'flinch', 'drown', 'possessed', 'bleed', 'poison', 'burn', 'curse', 'frost', 'shadow_possession', 'mist', 'blind', 'confuse', 'stumble'];
        const cleansedNames = [];

        combatant.activeEffects = combatant.activeEffects.filter(effect => {
            const isDebuff = effect.type === 'debuff';
            const isNegativeStatus = effect.type === 'status' && negativeStatuses.includes(effect.status);
            const isExplicitlyNegative = effect.isNegative === true;

            if (isDebuff || isNegativeStatus || isExplicitlyNegative) {
                const name = isDebuff ? `Debuff (${Object.keys(effect.stats || {}).join(', ')})` : (effect.status ? effect.status.charAt(0).toUpperCase() + effect.status.slice(1) : effect.type);
                cleansedNames.push(name);
                return false; // Remove
            }
            return true; // Keep
        });

        return [...new Set(cleansedNames)]; // Return unique names
    },


    /**
     * Enhanced lifesteal effect
     */
    lifesteal: (damage, percentage, user) => {
        try {
            const dmg = Math.max(0, Number(damage) || 0);
            const pct = Number(percentage) || 0;
            // at least 1 HP when a lifesteal triggers on positive damage
            const heal = Math.max(1, Math.floor(dmg * pct / 100));
            if (user) {
                user.currentHealth = (Number(user.currentHealth) || Number(user.health) || 0) + heal;
                // Note: we intentionally do NOT clamp currentHealth here so negative-HP behavior is preserved elsewhere
            }
            return heal;
        } catch (err) {
            console.error("lifesteal handler error:", err);
            return 0;
        }
    },
    // ...existing code...

    /**
     * Healing effects
     */
    heal: (user, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.maxHealth || user.health) || 100,
                    maxHealth: Number(user.maxHealth || user.health) || 100,
                    currentHealth: (user.currentHealth !== undefined && user.currentHealth !== null) ? Number(user.currentHealth) : Number(user.health || 100),
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 80
                },
                max: Math.max,
                min: Math.min
            };

            const healAmount = Math.floor(math.evaluate(formula, context));

            // Cap healing so it doesn't exceed max HP
            const currentHP = user.currentHealth || 0;
            const maxHP = user.maxHealth || user.health || 0;

            if (currentHP + healAmount > maxHP) {
                return Math.max(0, maxHP - currentHP);
            }

            return healAmount;
        } catch (err) {
            console.error(`Heal formula error: ${formula}`, err);
            return 0;
        }
    },

    /**
     * Chakra manipulation effects
     */
    chakraGain: (user, formula) => {
        try {
            if (typeof formula !== 'string' || !formula.trim()) {
                throw new Error('Invalid chakra gain formula');
            }
            const context = {
                user: { ...user },
                max: Math.max,
                min: Math.min
            };
            return Math.floor(math.evaluate(formula, context));
        } catch (err) {
            console.error(`Chakra gain formula error: ${formula}`, err);
            return 0;
        }
    },
    /**
     * Auto-kill under specific conditions
     */
    auto_kill: (currentRound, targetHealth, effect) => {
        if (effect.onRound && currentRound === effect.onRound) {
            return true;
        }
        if (effect.healthThreshold) {
            try {
                const threshold = Math.floor(math.evaluate(effect.healthThreshold, {
                    target: { health: targetHealth },
                    max: Math.max,
                    min: Math.min
                }));
                return targetHealth <= threshold;
            } catch (err) {
                console.error(`Auto-kill threshold formula error: ${effect.healthThreshold}`, err);
            }
        }
        return false;
    },

    /**
     * Status effect application with chance
     */
    status: (chance, target = {}, statusName) => {
        // Adaptation Immunity (except for the adaptation status itself)
        if (statusName !== 'Wheel of Fate Adaptation' && target.activeEffects?.some(e => e.status === 'Wheel of Fate Adaptation')) {
            return false;
        }
        if (target.activeEffects?.some(e => e.status === 'Flowing Red Scale' || e.status === 'Perfect Sage' || e.status === 'Gold Experience Requiem' || e.status === 'Indra\'s Arrow')) {
            return false;
        }
        return Math.random() * 100 <= chance;
    },

    /**
     * Instant kill with chance
     */
    instantKill: (chance) => {
        if (chance <= 0) return false;
        if (chance > 1) return Math.random() * 100 <= chance;
        return Math.random() <= chance;
    },

    /**
     * Enhanced DoT calculation with source stats consideration
     */
    calculateDoTDamage: (combatant, effect) => {
        const context = {
            target: {
                health: Number(combatant.health) || 0,
                currentHealth: (combatant.currentHealth !== undefined) ? Number(combatant.currentHealth) : Number(combatant.health || 0),
                defense: Number(combatant.defense) || 1,
            },
            user: {
                power: Number(effect.sourcePower) || 0,
                accuracy: Number(effect.sourceAccuracy) || 80
            },
            max: Math.max,
            min: Math.min
        };

        let dotDamage = 0;
        if (effect.damagePerTurn) {
            try {
                dotDamage = Math.floor(math.evaluate(effect.damagePerTurn, context));
            } catch (err) {
                console.error(`DoT formula error for ${effect.status}: ${effect.damagePerTurn}`, err);
                dotDamage = 0;
            }
        } else {
            // Fallback to default DoT based on status type
            const defaultMultipliers = {
                bleed: 0.03,
                poison: 0.02,
                burn: 0.025,
                drown: 0.1,
                curse: 0.035,
                zap: 0.03
            };

            const multiplier = defaultMultipliers[effect.status] || 0.03;
            dotDamage = Math.floor((Number(combatant.health) || 100) * multiplier);
        }

        // Apply vulnerability multipliers (e.g. Flowing Red Scale side effect on enemy)
        if (combatant.activeEffects?.some(e => e.status === 'Status Vulnerability')) {
            dotDamage = Math.floor(dotDamage * 1.5);
        }

        return dotDamage;
    },

    /**
     * Comprehensive effect processing at turn start
     */
    // ...existing code...
    processActiveEffects: (combatant) => {
        const result = {
            damage: 0,
            chakraDrain: 0,
            specialEffects: [],
            hasStunOrFlinch: false
        };

        if (!combatant.activeEffects || combatant.activeEffects.length === 0) return result;

        const remainingEffects = [];

        combatant.activeEffects.forEach((effect) => {
            // Check for turn-skipping statuses
            if (['stun', 'flinch', 'stumble', 'possessed', 'drown', 'zap'].includes(effect.status)) {
                if (effect.status === 'stumble') {
                    // Stumble has a 30% chance to self-damage and skip turn
                    if (Math.random() < 0.30) {
                        const currentHp = Number(combatant.currentHealth || combatant.health || 0);
                        const selfDamage = Math.floor(currentHp * (0.03 + Math.random() * 0.01)); // 3-4% of current HP
                        combatant.currentHealth -= selfDamage;
                        result.hasStunOrFlinch = true;
                        result.damage += selfDamage;
                        result.specialEffects.push(`${combatant.name} stumbles and attacks themselves for ${selfDamage}!`);
                    }
                } else if (effect.status === 'zap') {
                    // Zap has a 35% chance to stun per turn
                    if (Math.random() < 0.35) {
                        result.hasStunOrFlinch = true;
                        result.specialEffects.push(`${combatant.name} is paralyzed by ZAP and can't move!`);
                    }
                } else {
                    result.hasStunOrFlinch = true;
                }
            }

            // Frost status: display active text
            if (effect.type === 'status' && effect.status === 'frost') {
                result.specialEffects.push(`${EMOJIS.frost} ${combatant.name} is frosted! Their power and defense are reduced.`);
            }

            // Handle Damage-over-Time effects
            const isDoTEffect = ['bleed', 'poison', 'burn', 'drown', 'curse', 'darkness', 'zap', 'siphon'].includes(effect.status);
            if (isDoTEffect) {
                let dotDamage;
                // Custom logic for darkness
                if (effect.status === 'darkness') {
                    const currentHp = (combatant.currentHealth !== undefined) ? Number(combatant.currentHealth) : Number(combatant.health || 100);
                    if (effect.duration > 1) {
                        dotDamage = Math.floor(currentHp * 0.05);
                        // Apply vulnerability if present
                        if (combatant.activeEffects?.some(e => e.status === 'Status Vulnerability')) {
                            dotDamage = Math.floor(dotDamage * 1.5);
                        }
                        result.specialEffects.push(`${combatant.name} is consumed by Darkness! Taking ${dotDamage} damage.`);
                    } else {
                        dotDamage = Math.floor(currentHp * 0.20);
                        // Apply vulnerability if present
                        if (combatant.activeEffects?.some(e => e.status === 'Status Vulnerability')) {
                            dotDamage = Math.floor(dotDamage * 1.5);
                        }
                        result.specialEffects.push(`**DARKNESS ERUPTS!** ${combatant.name} takes a burst of ${dotDamage} damage!`);
                    }
                } else if (effect.status === 'siphon') {
                    const currentHp = Number(combatant.currentHealth) || 0;
                    const currentDefense = Number(combatant.defense) || 0;

                    dotDamage = Math.floor(currentHp * 0.10);
                    const defDrain = Math.floor(currentDefense * 0.10);

                    combatant.defense = Math.max(0, currentDefense - defDrain);
                    result.specialEffects.push(`${combatant.name} is being siphoned! Lost ${dotDamage} HP and ${defDrain} Defense!`);
                } else {
                    dotDamage = effectHandlers.calculateDoTDamage(combatant, effect);
                    result.specialEffects.push(`${combatant.name} is ${effect.status}, taking ${dotDamage} damage.`);
                }

                if (!combatant.izanamiImmortal) {
                    combatant.currentHealth = combatant.currentHealth - dotDamage;
                    result.damage += dotDamage;
                } else {
                    dotDamage = 0;
                    result.specialEffects.push(`${combatant.name} is IMMORTAL! No damage taken from ${effect.status}.`);
                }
            }

            // Handle healing over time
            if (effect.healPerTurn) {
                const healAmount = Math.floor(math.evaluate(effect.healPerTurn, {
                    target: combatant,
                    max: Math.max,
                    min: Math.min
                }));

                const maxHP = combatant.maxHealth || combatant.health || 0;
                const currentHP = combatant.currentHealth || 0;
                const actualHeal = Math.min(healAmount, Math.max(0, maxHP - currentHP));

                combatant.currentHealth = currentHP + actualHeal;
                result.specialEffects.push(`${combatant.name} heals ${actualHeal} HP from ${effect.status}.`);
            }

            // In processActiveEffects, add these cases:
            if (effect.chakra_per_round) {
                try {
                    const amount = typeof effect.chakra_per_round === 'number'
                        ? effect.chakra_per_round
                        : Math.floor(math.evaluate(effect.chakra_per_round, {
                            user: combatant,
                            max: Math.max,
                            min: Math.min
                        }));
                    combatant.chakra = Math.max(0, (combatant.chakra || 0) - Math.abs(amount));
                    result.chakraDrain += Math.abs(amount);
                    result.specialEffects.push(`${combatant.name} lost ${Math.abs(amount)} Chakra (per-round cost).`);
                } catch (err) {
                    console.error('Error evaluating chakra_per_round:', err);
                }
            }

            if (effect.health_per_round) {
                try {
                    const amount = typeof effect.health_per_round === 'number'
                        ? effect.health_per_round
                        : Math.floor(math.evaluate(effect.health_per_round, {
                            user: combatant,
                            max: Math.max,
                            min: Math.min
                        }));
                    if (!combatant.izanamiImmortal) {
                        combatant.currentHealth = combatant.currentHealth - Math.abs(amount);
                        result.damage += Math.abs(amount);
                    } else {
                        result.specialEffects.push(`${combatant.name} is IMMORTAL! No damage taken.`);
                    }
                    result.specialEffects.push(`${combatant.name} lost ${Math.abs(amount)} HP (per-round cost).`);
                } catch (err) {
                    console.error('Error evaluating health_per_round:', err);
                }
            }

            if (effect.type === 'heal' && effect.heal_amount) {
                try {
                    let healAmount;
                    if (typeof effect.heal_amount === 'number') {
                        healAmount = effect.heal_amount;
                    } else {
                        healAmount = Math.floor(math.evaluate(effect.heal_amount, {
                            user: combatant,
                            max: Math.max,
                            min: Math.min
                        }));
                    }
                    combatant.currentHealth = Math.min(combatant.maxHealth || combatant.health, combatant.currentHealth + healAmount);
                    result.specialEffects.push(`${combatant.name} healed ${healAmount} HP from passive effects.`);
                } catch (err) {
                    console.error('Error in bloodline passive heal:', err);
                }
            }


            // Handle chakra drain/gain legacy entry
            if (effect.type === 'chakra_drain') {
                const amount = effect.amount || 0;
                combatant.chakra = Math.max(0, combatant.chakra + amount);
                result.chakraDrain += amount;
                const action = amount < 0 ? 'drain' : 'gain';
                result.specialEffects.push(`${combatant.name} experiences a chakra ${action} of ${Math.abs(amount)}.`);
            }

            // Do NOT decrement duration here. We do it in checkDurationAndRemove.
            // Just filter out expired ones if any somehow got here
            if (effect.duration > 0) {
                remainingEffects.push(effect);
            }
        });

        combatant.activeEffects = remainingEffects;
        return result;
    },

    /**
     * Decrements duration of active effects and removes expired ones.
     * Should be called AFTER the combatant actively takes a turn.
     */
    checkDurationAndRemove: (combatant) => {
        if (!combatant.activeEffects || combatant.activeEffects.length === 0) return [];

        const removedEffects = [];
        const active = [];

        combatant.activeEffects.forEach(effect => {
            // If the effect was JUST added this round, don't decrement it yet
            // This ensures 1-turn buffs actually last for a turn
            if (effect.isNew) {
                effect.isNew = false; // It's no longer new for the next check
                active.push(effect);
            } else {
                effect.duration--;
                if (effect.duration > 0) {
                    active.push(effect);
                } else {
                    removedEffects.push(effect);
                    if (effect.status === 'revive') {
                        combatant.specialStatuses = combatant.specialStatuses?.filter(s => s !== 'revive') || [];
                    }
                    // Handle health loss on expire (Side Effects)
                    if (effect.health_loss_on_expire) {
                        try {
                            const maxHp = Number(combatant.maxHealth || combatant.health || 0);
                            const loss = Math.floor(maxHp * effect.health_loss_on_expire);
                            combatant.currentHealth = (combatant.currentHealth || 0) - loss;
                            const msg = `**Side effect:** ${combatant.name} loses ${loss} HP (${Math.round(effect.health_loss_on_expire * 100)}% of base HP)!`;
                            // We'll push this to a temporary array to be included in the return
                            effect._expireMessage = msg;
                        } catch (err) {
                            console.error('Error applying health_loss_on_expire:', err);
                        }
                    }
                }
            }
        });

        combatant.activeEffects = active;
        return removedEffects.map(e => e._expireMessage || `${combatant.name}'s ${e.status || e.type} effect has worn off.`);
    }
}
const applyEffect = (effect, user, target, effectiveUser, effectiveTarget, result, jutsuName, effectHandlers, applyDamageImmediately = false) => {
    try {
        switch (effect.type) {
            case 'damage': {
                const damageEffect = { ...effect, jutsuName: jutsuName };
                const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, damageEffect);

                if (damageResult.adaptationNullified) {
                    result.adaptationEmbed = true;
                }

                if (damageResult.hit && damageResult.damage > 0) {
                    let dmg = damageResult.damage;

                    // IZANAMI IMMORTALITY CHECK
                    if (target.izanamiImmortal) {
                        if (result.specialEffects) result.specialEffects.push(`${target.name} is IMMORTAL! No damage taken.`);
                        dmg = 0;
                    }

                    result.damage += dmg;

                    if (applyDamageImmediately && dmg > 0) {
                        // Ensure currentHealth is treated correctly if starting from undefined (falling back to stats)
                        const current = (target.currentHealth !== undefined && target.currentHealth !== null) ? target.currentHealth : (target.health || 0);

                        target.currentHealth = Math.max(0, current - dmg);
                    }

                    if (damageResult.isCrit) result.isCrit = true;
                    if (result.specialEffects) {
                        result.specialEffects.push(`Dealt ${Math.round(dmg)} damage${damageResult.isCrit ? ' (CRITICAL!)' : ''}`);
                    }

                    if (effect.lifesteal_percent) {
                        const lifestealHeal = effectHandlers.lifesteal(dmg, effect.lifesteal_percent, user);
                        if (lifestealHeal > 0) {
                            result.lifesteal = (result.lifesteal || 0) + lifestealHeal;
                            if (result.specialEffects) result.specialEffects.push(`Lifesteal: Healed ${lifestealHeal} HP`);
                        }
                    }

                    if (damageResult.reflectedDamage && damageResult.reflectedDamage > 0) {
                        user.currentHealth = (user.currentHealth || 0) - damageResult.reflectedDamage;
                        result.reflectedDamageMessage = damageResult.reflectionMessage;
                    }
                } else if (!damageResult.hit) {
                    if (result.specialEffects) result.specialEffects.push('Attack missed!');
                    result.hit = false;
                }
                break;
            }
            case 'buff': {
                const statsToApply = Object.keys(effect.stats || effect.statsDefinition || {});
                const alreadyHasBuff = (user.activeEffects || []).some(e =>
                    e.type === 'buff' && Object.keys(e.stats || {}).some(s => statsToApply.includes(s))
                );

                if (alreadyHasBuff) {
                    if (result.specialEffects) result.specialEffects.push(`${user.name} already had this buff active!`);
                    return;
                }

                const buffChanges = effectHandlers.buff(user, effect.stats || effect.statsDefinition);
                user.activeEffects = user.activeEffects || [];
                user.activeEffects.push({
                    type: 'buff',
                    stats: buffChanges,
                    duration: effect.duration || 1,
                    source: jutsuName,
                    isNew: true
                });
                if (result.specialEffects) result.specialEffects.push(`Applied buff: ${Object.keys(buffChanges).join(', ')}`);
                Object.assign(effectiveUser, getEffectiveStats(user));
                return { type: 'buff', value: buffChanges };
            }
            case 'debuff': {
                const targetImmunities = (target.immunities || []).map(String);
                if (targetImmunities.includes('debuff') || targetImmunities.includes('all')) {
                    if (result.specialEffects) result.specialEffects.push(`${target.name} is immune to stat drops!`);
                    return;
                }

                const statsToApply = Object.keys(effect.stats || effect.statsDefinition || {});
                const alreadyHasDebuff = (target.activeEffects || []).some(e =>
                    e.type === 'debuff' && Object.keys(e.stats || {}).some(s => statsToApply.includes(s))
                );

                if (alreadyHasDebuff) {
                    if (result.specialEffects) result.specialEffects.push(`${target.name} already had this debuff active!`);
                    return;
                }

                const debuffChanges = effectHandlers.debuff(target, effect.stats || effect.statsDefinition);
                target.activeEffects = target.activeEffects || [];
                target.activeEffects.push({
                    type: 'debuff',
                    stats: debuffChanges,
                    duration: effect.duration || 1,
                    source: jutsuName,
                    isNew: true
                });
                if (result.specialEffects) result.specialEffects.push(`Applied debuff: ${Object.keys(debuffChanges).join(', ')}`);
                Object.assign(effectiveTarget, getEffectiveStats(target));
                return { type: 'debuff', value: debuffChanges };
            }
            case 'heal': {
                const healAmount = effectHandlers.heal(user, effect.formula || effect.amount || "0");
                const potentialHealth = (user.currentHealth || 0) + healAmount;
                if (potentialHealth > 0) {
                    user.currentHealth = potentialHealth;
                    result.heal += healAmount;
                    if (result.specialEffects) result.specialEffects.push(`Healed ${healAmount} HP`);
                    return { type: 'heal', value: healAmount };
                } else {
                    if (result.specialEffects) result.specialEffects.push(`Heal failed - damage was lethal!`);
                }
                break;
            }
            case 'status': {
                const targetEntity = effect.applyToUser ? user : target;
                const targetEffective = effect.applyToUser ? effectiveUser : effectiveTarget;

                const targetImmunities = (targetEntity.immunities || []).map(String);
                if (effect.status && (targetImmunities.includes(effect.status) || targetImmunities.includes('all'))) {
                    if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} is immune to ${effect.status}.`);
                    break;
                }

                if (effectHandlers.status(effect.chance ?? 100, targetEntity, effect.status)) {
                    targetEntity.activeEffects = targetEntity.activeEffects || [];
                    const existingStatusIndex = targetEntity.activeEffects.findIndex(
                        e => e.type === 'status' && e.status === effect.status
                    );
                    const canStack = effect.can_stack === true;

                    if (existingStatusIndex !== -1 && effect.status !== 'stun') {
                        if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} already had this effect active!`);
                        return;
                    } else {
                        const stored = {
                            type: 'status',
                            status: effect.status,
                            duration: effect.duration || 1,
                            damagePerTurn: effect.damagePerTurn ?? effect.damagePerTurnFormula ?? null,
                            healPerTurn: effect.healPerTurn ?? null,
                            chakra_per_round: effect.chakra_per_round,
                            health_per_round: effect.health_per_round,
                            source: jutsuName,
                            can_stack: canStack,
                            isNew: true
                        };
                        targetEntity.activeEffects.push(stored);
                        if (result.specialEffects) result.specialEffects.push(`Applied ${effect.status} to ${targetEntity.name}`);
                    }
                    return { type: 'status', value: effect.status };
                } else {
                    if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} resisted ${effect.status}`);
                }
                break;
            }
            case 'cleanse': {
                const targetEntity = effect.applyToTarget ? target : user;
                const cleansed = effectHandlers.cleanse(targetEntity);
                if (cleansed.length > 0) {
                    if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} cleanses: ${cleansed.join(', ')}`);
                }
                Object.assign(effect.applyToTarget ? effectiveTarget : effectiveUser, getEffectiveStats(targetEntity));
                return { type: 'cleanse', value: cleansed };
            }
            case 'chakra_drain': {
                const targetEntity = effect.applyToUser ? user : target;
                const targetImmunities = (targetEntity.immunities || []).map(String);
                if (targetImmunities.includes('chakra_drain') || targetImmunities.includes('all')) {
                    if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} is immune to chakra drain!`);
                    return;
                }

                const amount = Number(effect.amount) || 0;
                if (effect.duration) {
                    targetEntity.activeEffects = targetEntity.activeEffects || [];
                    const alreadyHasDrain = (targetEntity.activeEffects || []).some(e =>
                        e.type === 'chakra_drain' && (e.source === jutsuName || e.source === 'chakra_drain_effect')
                    );
                    if (alreadyHasDrain) {
                        if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} already had this chakra drain active!`);
                        return;
                    }

                    targetEntity.activeEffects.push({
                        type: 'chakra_drain',
                        amount: amount,
                        duration: effect.duration,
                        source: jutsuName,
                        isNew: true
                    });
                    if (result.specialEffects) result.specialEffects.push(`Applied Chakra Drain`);
                } else {
                    const actualDrain = Math.min(target.chakra || 0, Math.abs(amount));
                    target.chakra = Math.max(0, (target.chakra || 0) - actualDrain);
                    user.chakra = Math.min(999, (user.chakra || 0) + actualDrain);
                    if (result.specialEffects) result.specialEffects.push(`Drained ${actualDrain} Chakra!`);
                }
                return { type: 'chakra_drain', value: amount };
            }
            case 'chakra_gain': {
                const chakraGain = effectHandlers.chakraGain(effectiveUser, effect.formula || effect.amount || "0");
                user.chakra = Math.min(999, (user.chakra || 0) + chakraGain);
                if (result.specialEffects) result.specialEffects.push(`Gained ${chakraGain} Chakra`);
                return { type: 'chakra_gain', value: chakraGain };
            }
            case 'instantKill':
            case 'OHKO':
            case 'ohko': {
                const targetEntity = effect.applyToUser ? user : target;
                if (effectHandlers.instantKill(effect.chance)) {
                    targetEntity.currentHealth = 0;
                    if (result.specialEffects) result.specialEffects.push(`${targetEntity.name} was instantly killed!`);
                    return { type: 'instantKill', value: true };
                }
                break;
            }
            case 'lifesteal_max_hp': {
                const percentage = Number(effect.percentage) || 0;
                const stolen = effectHandlers.lifestealMaxHP(user, target, percentage);
                if (result.specialEffects) result.specialEffects.push(`Life Drainer: Stole ${stolen} HP from target (20% Max HP)!`);
                return { type: 'lifesteal_max_hp', value: stolen };
            }
            default:
                break;
        }
    } catch (err) {
        console.error(`Error processing ${effect.type} effect:`, err);
    }
    return null;
};
// --- Utility Functions ---

/**
 * Formats cooldown time
 */
function getCooldownString(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

/**
 * Safely retrieve a numeric field from an object given multiple possible key names.
 * Returns the first numeric value found (converted to Number), otherwise returns the provided fallback.
 */
function getNumericField(obj = {}, keys = [], fallback = 0) {
    if (!obj || !Array.isArray(keys)) return fallback;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (val === null || val === undefined) continue;
            const num = Number(val);
            if (!Number.isNaN(num)) return num;
        }
    }
    return fallback;
}

/**
 * Bloodline system constants
 */
const BLOODLINE_GIFS = {
    Uchiha: "https://giffiles.alphacoders.com/125/125975.gif",
    Hyuga: "https://media.tenor.com/_-VIS8Dz7G0AAAAM/youridb-crypto.gif",
    Uzumaki: "https://i.pinimg.com/originals/63/8e/d1/638ed104fabbdc2ceca6965ea5d28e2b.gif",
    Senju: "https://i.namu.wiki/i/2xdVtn3GJw6UT1Hk2YBvN8e_gqy-VATq0-gsTr6p20ZPX54JAWeWQthstFSEpWjWB6itpvvurkOCM8_du9LkQQ.gif",
    Nara: "https://media.tenor.com/KyyQbu1wd_oAAAAM/anime-naruto.gif"
};

const BLOODLINE_NAMES = {
    Uchiha: "Sharingan",
    Hyuga: "Byakugan",
    Uzumaki: "Uzumaki Will",
    Senju: "Hyper Regeneration",
    Nara: "Battle IQ"
};

const BLOODLINE_DEPARTMENTS = {
    Uchiha: "A crimson aura flickers in your eyes.",
    Hyuga: "Your veins bulge as your vision sharpens.",
    Uzumaki: "A spiral of energy wells up from deep within.",
    Senju: "Your body pulses with ancient vitality.",
    Nara: "Your mind sharpens, calculating every move."
};

/**
 * Calculates effective stats considering active effects
 */
function getEffectiveStats(entity) {
    const accessoriesPath = path.resolve(__dirname, '../data/accessories.json');
    const accessories = JSON.parse(fs.readFileSync(accessoriesPath, 'utf8'));

    const baseStats = {
        power: Number(entity.power) || 10,
        defense: Number(entity.defense) || 10,
        health: Number(entity.health) || 100,
        currentHealth: (entity.currentHealth !== undefined && entity.currentHealth !== null) ? Number(entity.currentHealth) : Number(entity.health || 100),
        chakra: Number(entity.chakra) || 10,
        accuracy: Number(entity.accuracy) || 80, // Read base accuracy from entity or default to 80
        dodge: Number(entity.dodge) || 0,
        adaptedTechniques: entity.adaptedTechniques || {},
        activeEffects: entity.activeEffects || []
    };

    const effectiveStats = { ...baseStats };

    if (entity.equipped_accessories) {
        entity.equipped_accessories.forEach(accessoryName => {
            const accessory = accessories.find(acc => acc.name === accessoryName);
            if (accessory) {
                if (accessory.stats) {
                    for (const stat in accessory.stats) {
                        effectiveStats[stat] = (effectiveStats[stat] || 0) + accessory.stats[stat];
                    }
                }
                if (accessory.multipliers) {
                    for (const stat in accessory.multipliers) {
                        effectiveStats[stat] = (effectiveStats[stat] || 0) * accessory.multipliers[stat];
                    }
                }
            }
        });
    }

    const appliedStats = new Set();
    const appliedStatuses = new Set();

    (entity.activeEffects || []).forEach(effect => {
        // Apply buff/debuff numeric deltas produced by effectHandlers.buff/debuff
        if ((effect.type === 'buff' || effect.type === 'debuff') && effect.stats && typeof effect.stats === 'object') {
            for (const [stat, value] of Object.entries(effect.stats)) {
                if (appliedStats.has(stat)) continue; // Limit to one buff/debuff per stat
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                    effectiveStats[stat] = (effectiveStats[stat] || 0) + numeric;
                    appliedStats.add(stat);
                }
            }
        }

        // Status effect modifiers
        if (effect.type === 'status') {
            if (appliedStatuses.has(effect.status)) return;
            appliedStatuses.add(effect.status);

            // Frost status: reduces power and defense by 15%
            if (effect.status === 'frost') {
                effectiveStats.power = Math.floor(effectiveStats.power * 0.85);
                effectiveStats.defense = Math.floor(effectiveStats.defense * 0.85);
            }

            if (effect.dodge) {
                effectiveStats.dodge = (effectiveStats.dodge || 0) + Number(effect.dodge);
            }
            if (effect.accuracyModifier) {
                effectiveStats.accuracy = (effectiveStats.accuracy || 0) + Number(effect.accuracyModifier);
            }
        }
    });

    // Ensure minimum values
    effectiveStats.power = Math.max(1, effectiveStats.power);
    effectiveStats.defense = Math.max(1, effectiveStats.defense);
    effectiveStats.accuracy = Math.max(5, Math.min(100, effectiveStats.accuracy));
    effectiveStats.dodge = Math.max(0, effectiveStats.dodge);

    // Role Buffs
    if (entity.roles && Array.isArray(entity.roles)) {
        // Legendary / Sannin Role
        if (entity.roles.includes('1389263702141964388')) {
            effectiveStats.power = Math.floor(effectiveStats.power * 1.5);
            effectiveStats.defense = Math.floor(effectiveStats.defense * 1.5);
            effectiveStats.health = Math.floor(effectiveStats.health * 1.5);
            // Ensure maxHealth scales too if it's used for clamping
            if (effectiveStats.maxHealth) effectiveStats.maxHealth = Math.floor(effectiveStats.maxHealth * 1.5);
        }
        // Hokage Role
        if (entity.roles.includes('1381606285577031772')) {
            effectiveStats.power = Math.floor(effectiveStats.power * 2.0);
            effectiveStats.defense = Math.floor(effectiveStats.defense * 2.0);
            effectiveStats.health = Math.floor(effectiveStats.health * 2.0);
            if (effectiveStats.maxHealth) effectiveStats.maxHealth = Math.floor(effectiveStats.maxHealth * 2.0);
        }
    }

    return effectiveStats;
}
/* ---------- NEW: Bloodline helpers ---------- */
function bloodlineCanActivate(player, state, opponent) {
    if (!player || !player.bloodline) return false;
    if (!state) return false;
    if (state.used) return false;

    const hp = Number(player.currentHealth || 0);
    const maxHp = Number(player.maxHealth || player.health || 100);
    const chakra = Number(player.chakra || 0);

    switch (player.bloodline) {
        case "Senju":
            // Activation: can be activated when hp <= 50%
            return hp <= maxHp * 0.5;
        case "Uzumaki":
            // Activation: hp <= 50% AND low chakra
            return hp <= maxHp * 0.5;
        case "Hyuga":
            // Activation: enough chakra and enemy has chakra
            return chakra >= 30 && (opponent?.chakra || 0) > 0;
        case "Uchiha":
            // Activation: hp <= 50%
            return hp <= maxHp * 0.5;
        case "Nara":
            // Activation: chakra >= 30
            return chakra >= 30;
        default:
            return false;
    }
}
function applyBloodlineActivation(user, opponent, state) {
    // Returns an array of messages/specialEffects describing what happened.
    if (!user || !user.bloodline || !state || state.used) return [];

    const msgs = [];
    switch (user.bloodline) {
        case "Senju": {
            const maxHp = Number(user.maxHealth || user.health || 100);
            const healAmount = Math.floor(maxHp * 0.5);
            user.currentHealth = Math.min(maxHp, (user.currentHealth || 0) + healAmount);
            msgs.push(`${user.name} awakens Senju: Hyper Regeneration heals ${healAmount} HP!`);
            // Senju awakening is an instant big heal only (no multi-turn state)
            state.used = true;
            break;
        }
        case "Uzumaki": {
            // Set chakra to at least 15 and apply stun+defense debuff to opponent for 2 turns
            user.chakra = Math.max(user.chakra || 0, 15);
            if (opponent) {
                opponent.activeEffects = opponent.activeEffects || [];
                const alreadyStunned = opponent.activeEffects.some(e => e.status === 'stun');
                if (!alreadyStunned) {
                    opponent.activeEffects.push({
                        type: 'status',
                        status: 'stun',
                        duration: 2,
                        source: `${user.userId}-UzumakiAwaken`
                    });
                }
                const alreadyDebuffed = opponent.activeEffects.some(e => e.type === 'debuff' && e.stats?.defense);
                if (!alreadyDebuffed) {
                    opponent.activeEffects.push({
                        type: 'debuff',
                        stats: { defense: -Math.floor((opponent.defense || 1) * 0.6) },
                        duration: 2,
                        source: `${user.userId}-UzumakiAwaken`
                    });
                }
                msgs.push(`${user.name} awakens Uzumaki: Sealing Chains stun and reduce ${opponent.name}'s defense!`);
            } else {
                msgs.push(`${user.name} awakens Uzumaki Will!`);
            }
            state.used = true;
            state.active = true;
            state.roundsLeft = 2;
            break;
        }
        case "Hyuga": {
            // Drain up to 5 chakra immediately and grant to user (or drain all on full activation)
            const drained = Math.min(opponent?.chakra || 0, 5);
            if (opponent) opponent.chakra = Math.max(0, (opponent.chakra || 0) - drained);
            user.chakra = Math.min(999, (user.chakra || 0) + drained);
            msgs.push(`${user.name} awakens Byakugan: drains ${drained} chakra from ${opponent?.name || 'the foe'}!`);
            // If this is the full activation (requirement), drain all
            if ((user.chakra || 0) >= 20 && opponent) {
                const allDrain = Math.min(opponent.chakra, 30);
                user.chakra = Math.min(999, user.chakra + allDrain);
                opponent.chakra = Math.max(0, opponent.chakra - allDrain);
                msgs.push(`${user.name} performs Byakugan's full drain and steals ${allDrain} chakra!`);
            }
            state.used = true;
            state.active = true;
            state.roundsLeft = 1;
            break;
        }
        case "Uchiha": {
            // Activate multi-turn defensive susanoo-like state and stun opponent for 2 rounds
            if (opponent) {
                opponent.activeEffects = opponent.activeEffects || [];
                const alreadyStunned = opponent.activeEffects.some(e => e.status === 'stun');
                if (!alreadyStunned) {
                    opponent.activeEffects.push({
                        type: 'status',
                        status: 'stun',
                        duration: 2,
                        source: `${user.userId}-UchihaAwaken`
                    });
                }
            }
            user.activeEffects = user.activeEffects || [];
            const alreadyBuffed = user.activeEffects.some(e => e.type === 'buff' && e.stats?.defense);
            if (!alreadyBuffed) {
                user.activeEffects.push({
                    type: 'buff',
                    stats: { defense: Math.floor((user.defense || 1) * 5) },
                    duration: 2,
                    source: `${user.userId}-bloodline-awaken`
                });
            }
            msgs.push(`${user.name} awakens Sharingan: mighty protective surge and ${opponent?.name || 'the foe'} is stunned!`);
            state.used = true;
            state.active = true;
            state.roundsLeft = 2;
            break;
        }
        case "Nara": {
            // Force opponent to copy user's actions for 2 rounds
            if (opponent) {
                opponent.activeEffects = opponent.activeEffects || [];
                opponent.activeEffects.push({
                    type: 'status',
                    status: 'stun',
                    duration: 2,
                    // store the awakener's userId so copy logic can find who to copy
                    source: `${user.userId}-NaraAwaken`
                });
                msgs.push(`${user.name} awakens Battle IQ: ${opponent.name} is now possessed!`);
            } else {
                msgs.push(`${user.name} awakens Battle IQ!`);
            }
            state.used = true;
            state.active = true;
            state.roundsLeft = 2;
            break;
        }
        default:
            msgs.push(`${user.name} attempted to awaken an unknown bloodline.`);
            state.used = true;
            break;
    }
    // Clear the pending flag if present
    if (user.pendingBloodline) delete user.pendingBloodline;
    return msgs;
}

/**
 * Generates battle image
 */
async function generateBattleImage(player1, player2, customBgUrl = null) {
    const isMultiplayer = player1.subPlayers && player1.subPlayers.length > 1;

    const width = 800;
    const height = isMultiplayer ? 500 : 400; // Increase height only for multiplayer
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    let bgImg;
    try {
        if (customBgUrl) {
            bgImg = await loadImage(customBgUrl);
        } else {
            bgImg = await loadImage('https://i.pinimg.com/736x/33/b5/1c/33b51cb039533fb6b5ba96315da7985c.jpg');
        }
        ctx.drawImage(bgImg, 0, 0, width, height);
    } catch {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
    }

    // Rounded rectangle helper
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // Standard Solo/NPC Layout Constants
    const stdCharW = 150, stdCharH = 150;
    const stdP1Y = 120, stdP2Y = 120;
    const stdBarY = 280;

    const p1X = 50;
    const p2X = width - 50 - stdCharW; // 600

    const nameY = 80;
    const nameH = 28, barH = 22;

    // Load and draw avatars
    const loadAndDrawAvatar = async (player, x, y, w, h) => {
        let avatarUrl;
        // Prefer explicit full-image URLs (NPC images). If player.image exists but is NOT a full URL,
        // fall back to the discord avatar hash (player.avatar) to build the CDN URL.
        if (player.image && typeof player.image === 'string' && /^https?:\/\//i.test(player.image)) {
            avatarUrl = player.image;
        } else if (player.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${player.userId || player.id}/${player.avatar}.png?size=256`;
        } else if (player.image && typeof player.image === 'string') {
            // In case stored.image contains a hash (legacy), try to use it as avatar hash
            avatarUrl = `https://cdn.discordapp.com/avatars/${player.userId || player.id}/${player.image}.png?size=256`;
        } else {
            const defaultAvatarNumber = parseInt(player.discriminator || '0') % 5;
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }

        try {
            let buffer;
            let img;
            let loadSuccess = false;

            // Attempt 1: Direct Fetch
            try {
                const response = await fetch(avatarUrl);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                buffer = await getBufferFromResponse(response);

                // Try to load the image
                try {
                    img = await loadImage(buffer);
                    loadSuccess = true;
                } catch (loadErr) {
                    // Image loaded but can't be parsed (e.g., WebP)
                    console.log(`Direct load failed for ${player.name}: ${loadErr.message}`);
                }
            } catch (fetchErr) {
                console.log(`Direct fetch failed for ${player.name}: ${fetchErr.message}`);
            }

            // Attempt 2: Wikia Format Fix (if load failed and it's a Wikia URL)
            if (!loadSuccess && avatarUrl.includes('wikia.nocookie.net') && !avatarUrl.includes('format=png')) {
                try {
                    const separator = avatarUrl.includes('?') ? '&' : '?';
                    const newUrl = `${avatarUrl}${separator}format=png`;
                    console.log(`Retrying Wikia with format=png: ${newUrl}`);
                    const response = await fetch(newUrl);
                    if (response.ok) {
                        buffer = await getBufferFromResponse(response);
                        img = await loadImage(buffer);
                        loadSuccess = true;
                    }
                } catch (e) {
                    console.log(`Wikia format fix failed: ${e.message}`);
                }
            }

            // Attempt 3: DuckDuckGo Proxy (if still not loaded)
            if (!loadSuccess) {
                try {
                    const proxyUrl = `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(avatarUrl)}`;
                    console.log(`Retrying with DDG proxy: ${proxyUrl}`);
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        buffer = await getBufferFromResponse(response);
                        img = await loadImage(buffer);
                        loadSuccess = true;
                    }
                } catch (e) {
                    console.log(`DDG proxy failed: ${e.message}`);
                }
            }

            // If still not loaded, throw error
            if (!loadSuccess || !img) {
                throw new Error("Failed to load image from all sources");
            }

            // Draw the successfully loaded image
            ctx.save();
            roundRect(ctx, x, y, w, h, 10);
            ctx.clip();
            ctx.drawImage(img, x, y, w, h);
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#6e1515";
            roundRect(ctx, x, y, w, h, 10);
            ctx.stroke();

        } catch (err) {
            console.warn(`Error loading avatar for ${player.name}: ${err.message}. Using fallback.`);
            try {
                // Fallback to a generic ninja silhouette or question mark
                const fallbackUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
                // Even for fallback, use fetch->buffer to be safe
                const response = await fetch(fallbackUrl);
                const buffer = await getBufferFromResponse(response);
                const img = await loadImage(buffer);

                ctx.save();
                roundRect(ctx, x, y, w, h, 10);
                ctx.clip();
                ctx.drawImage(img, x, y, w, h);
                ctx.restore();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#6e1515";
                roundRect(ctx, x, y, w, h, 10);
                ctx.stroke();
            } catch (e) {
                console.error("Failed to load fallback avatar:", e);
                // Draw a simple colored rect if even fallback fails
                ctx.fillStyle = "#555";
                roundRect(ctx, x, y, w, h, 10);
                ctx.fill();
                ctx.strokeStyle = "#6e1515";
                ctx.stroke();
            }
        }
    };

    // Draw Player 2 (NPC) - ALWAYS use standard layout
    await loadAndDrawAvatar(player2, p2X, stdP2Y, stdCharW, stdCharH);

    // Draw Player 1 (Team or Solo)
    let p1BarYPosition = stdBarY;

    if (isMultiplayer) {
        // Multiplayer Layout: Stack 2 players
        const teamSize = player1.subPlayers.length; // Should be <= 2
        const avSize = 100; // Smaller size for stack
        const gap = 15;
        const startY = 100; // Start slightly higher than 120 to fit stack

        for (let i = 0; i < teamSize; i++) {
            const sp = player1.subPlayers[i];
            const yPos = startY + (i * (avSize + gap));
            // Limit to 2 for safety based on user req
            if (i < 2) {
                await loadAndDrawAvatar(sp, p1X, yPos, avSize, avSize);
            }
        }
        // Place HP bar below the stack. 
        // 2 players: 100 + 100 + 15 = 215 height used. Start Y 100 => Ends 315.
        // Bar at 330.
        p1BarYPosition = 330;

    } else {
        // Solo Layout: Use standard
        await loadAndDrawAvatar(player1, p1X, stdP1Y, stdCharW, stdCharH);
        p1BarYPosition = stdBarY;
    }

    // Name tags
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const drawNameTag = (name, x, y, w) => {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#000";
        roundRect(ctx, x, y, w, nameH, 5);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText(name, x + w / 2, y + nameH / 2);
        ctx.shadowBlur = 0;
    };

    if (isMultiplayer) {
        drawNameTag("Team", p1X, nameY, 100); // Width 100 matches avatar
    } else {
        drawNameTag(player1.name, p1X, nameY, stdCharW);
    }

    // NPC Name Tag
    drawNameTag(player2.name, p2X, nameY, stdCharW);

    // Health bars
    const drawHealthBar = (player, x, y, w, isPlayer1 = true) => {
        let currentHealth = player.currentHealth;
        let maxHealth = player.maxHealth || player.health || 100;



        const healthPercent = Math.max(currentHealth / maxHealth, 0);

        ctx.save();
        ctx.fillStyle = "#333";
        roundRect(ctx, x, y, w, barH, 5);
        ctx.fill();
        ctx.fillStyle = isPlayer1 ? "#4CAF50" : "#ff4444";
        roundRect(ctx, x, y, w * healthPercent, barH, 5);
        ctx.fill();

        // Health text
        ctx.fillStyle = "#fff";
        ctx.font = "13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.restore();
    };

    // Draw P1 Bar (Custom Y for multi, Std Y for solo)
    const p1BarWidth = isMultiplayer ? 100 : stdCharW; // Match avatar width
    drawHealthBar(player1, p1X, p1BarYPosition, p1BarWidth, true);

    // Draw P2 Bar (NPC - Always Std Y)
    drawHealthBar(player2, p2X, stdBarY, stdCharW, false);

    // VS text
    ctx.save();
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("VS", width / 2, height / 2);
    ctx.restore();

    // Save image
    if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
    }
    const filename = `battle_${player1.userId || player1.id}_${player2.userId || player2.id}_${Date.now()}.png`;
    const fullPath = path.join(imagesPath, filename);
    const out = fs.createWriteStream(fullPath);
    const stream = canvas.createPNGStream();

    await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
    });

    return fullPath;
}

/**
 * Creates moves selection embed
 */
function createMovesEmbed(player, roundNum) {



    const embed = new EmbedBuilder()
        .setTitle(`${player.name}`)
        .setColor('#006400')
        .setDescription(
            `${player.name}, it is your turn!\nUse buttons to make a choice.\n\n`
        );

    let availableJutsusForDisplay = Object.entries(player.jutsu)
        .filter(([_, jutsu]) => {
            if (jutsu === 'None') return false;
            // Life Drainer Lock: only allow Attack
            if (player.activeEffects?.some(e => e.status === 'Life Drainer Active')) {
                return jutsu === 'Attack';
            }
            // Ikari Restriction: only allow Attack when chakra depleted
            if (player.activeEffects?.some(e => e.status === 'Ikari Restriction')) {
                return jutsu === 'Attack';
            }
            if (jutsu === 'Attack' && player.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Active')) {
                return false;
            }
            if (player.bannedJutsus && player.bannedJutsus.includes(jutsu)) return false;
            return true;
        })
        .map(([key, jutsuName]) => {
            let finalName = jutsuName;
            if (jutsuName === 'Attack') {
                const replacer = player.activeEffects?.find(e => e.replacesAttack && e.replaceWith);
                if (replacer) finalName = replacer.replaceWith;
            }
            return { key, name: finalName, data: jutsuList[finalName] };
        });

    // Add Susano Slash as an extra option if Perfect Susanoo is active
    if (player.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Active')) {

        availableJutsusForDisplay.push({
            key: 'susano_slash',
            name: 'Susano Slash',
            data: jutsuList['Susano Slash']
        });
    }



    embed.setDescription(
        embed.data.description +
        availableJutsusForDisplay
            .map(({ key, name, data }, index) => {
                return `${index + 1}: ${data?.name || name}${data?.chakraCost ? ` (${data.chakraCost} Chakra)` : ''}`;
            })
            .join('\n') +
        `\n\n[😴] to focus your chakra.\n[❌] to flee from battle.\n\nChakra: ${player.chakra}`
    );

    const jutsuButtons = availableJutsusForDisplay
        .map(({ key, name, data }, index) => {
            let isDisabled = false;

            // Disable Perfect Susanoo if on cooldown
            if (name === 'Perfect Susanoo' && player.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Cooldown')) {
                isDisabled = true;

            }

            const chakraCost = data?.chakraCost || 0;
            if ((typeof player.chakra === "number" ? player.chakra : 0) < chakraCost) {
                isDisabled = true;
            }

            // Disable Izanami if used or disabled by pocket watch
            if (name === 'Izanami' && (player.izanamiUsed || player.izanamiDisabled)) {
                isDisabled = true;
            }

            return new ButtonBuilder()
                .setCustomId(`move${index + 1}-${player.userId || player.id}-${roundNum}`)
                .setLabel(`${index + 1}`)
                .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(isDisabled);
        });

    const rows = [];
    // Add up to 5 jutsu buttons in the first row
    if (jutsuButtons.length > 0) {
        const row1 = new ActionRowBuilder();
        jutsuButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
        rows.push(row1);
    }

    // Add remaining jutsu buttons (if any) and rest/flee buttons in the second row
    const row2 = new ActionRowBuilder();
    if (jutsuButtons.length > 5) {
        row2.addComponents(jutsuButtons[5]);
    }

    // --- NEW: Awaken / Bloodline button ---
    if (player.bloodline) {
        // Get configured emoji if present
        let bloodlineEmoji = BLOODLINES[player.bloodline] && BLOODLINES[player.bloodline].emoji ? BLOODLINES[player.bloodline].emoji : null;
        // If the stored emoji is missing, in :name: format (custom shortname) or otherwise not suitable,
        // fall back to a safe Unicode glyph to avoid Discord API errors.
        if (typeof bloodlineEmoji !== 'string' || /^:[^:\s]+:$/.test(bloodlineEmoji) || bloodlineEmoji.trim() === '') {
            bloodlineEmoji = '🔺'; // safe Unicode fallback
        }
        const awakeDisabled = !player.canActivateBloodline;
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`awaken-${player.userId || player.id}-${roundNum}`)
                .setEmoji(bloodlineEmoji)
                .setStyle(awakeDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(awakeDisabled)
        );
    }

    row2.addComponents(
        new ButtonBuilder()
            .setCustomId(`rest-${player.userId || player.id}-${roundNum}`)
            .setLabel('😴')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`flee-${player.userId || player.id}-${roundNum}`)
            .setLabel('❌')
            .setStyle(ButtonStyle.Primary)
    );
    rows.push(row2);

    return { embed, components: rows.slice(0, 5) }; // Discord limits to 5 action rows
}
/**
 * Extracts jutsu name from button ID
 */
function getJutsuByButton(buttonId, player) {

    const match = buttonId.match(/^move(\d+)-/);
    if (!match) {

        return null;
    }

    const idx = parseInt(match[1], 10) - 1;


    let availableJutsusForDisplay = Object.entries(player.jutsu || {})
        .filter(([_, jutsu]) => {
            if (jutsu === 'None') return false;
            // Ikari Restriction: only allow Attack when chakra depleted
            if (player.activeEffects?.some(e => e.status === 'Ikari Restriction') && jutsu !== 'Attack') {
                return false;
            }
            // Life Drainer: only allow Attack
            if (player.activeEffects?.some(e => e.status === 'Life Drainer Active') && jutsu !== 'Attack') {
                return false;
            }
            if (jutsu === 'Attack' && player.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Active')) {
                return false;
            }
            return true;
        })
        .map(([key, jutsuName]) => {
            let finalName = jutsuName;
            if (jutsuName === 'Attack') {
                const replacer = player.activeEffects?.find(e => e.replacesAttack && e.replaceWith);
                if (replacer) finalName = replacer.replaceWith;
            }
            return { key, name: finalName, data: jutsuList[finalName] };
        });

    // Add Susano Slash as an extra option if Perfect Susanoo is active
    if (player.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Active')) {
        availableJutsusForDisplay.push({
            key: 'susano_slash',
            name: 'Susano Slash',
            data: jutsuList['Susano Slash']
        });
    }


    const selectedJutsuName = availableJutsusForDisplay[idx]?.name || null;

    return selectedJutsuName;
}

/**
 * Processes rest/flee actions
 */
async function processPlayerMove(customId, basePlayer) {
    const action = customId.split('-')[0];

    if (action === 'rest') {
        basePlayer.chakra = Math.min(basePlayer.chakra + 1, 999);
        return {
            damage: 0,
            heal: 0,
            description: `${basePlayer.name} focused chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }

    if (action === 'flee') {
        return { fled: true };
    }

    return { damage: 0, heal: 0, description: "Invalid action.", hit: false };
}
function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, round = 1, isFirstActivation = false) {
    if (jutsuName === 'Attack') {
        const userEffects = baseUser.activeEffects || [];
        const replacer = userEffects.find(e => e.replacesAttack && e.replaceWith);
        if (replacer) {
            const replaceName = replacer.replaceWith;
            const replacementJutsu = jutsuList[replaceName];
            if (replacementJutsu) {
                // Execute the replacement jutsu instead of the normal attack.
                return executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, replaceName, false);
            }
        }
    }



    // If Perfect Susanoo is active, replace 'Attack' with 'Susano Slash'
    // This logic is now handled by createMovesEmbed and getJutsuByButton for button display
    // and will be handled by the jutsuName passed here if the Susano Slash button was clicked.

    const jutsu = jutsuList[jutsuName];

    if (jutsu && jutsu.scriptFile) {
        try {
            const customScriptFile = path.join(customJutsusPath, jutsu.scriptFile);

            // 1. Dynamically load the module
            const customJutsuModule = require(customScriptFile);

            if (typeof customJutsuModule.execute === 'function') {
                // 2. Execute the self-contained script
                const customResult = customJutsuModule.execute({
                    baseUser, // Pass mutable objects (where changes are saved)
                    baseTarget, // Pass mutable objects
                    effectiveUser, // Pass pre-calculated stats (for calculations)
                    effectiveTarget, // Pass pre-calculated stats (for calculations)
                    jutsuData: jutsu,
                    round,
                    isFirstActivation,
                    jutsuList,
                    effectHandlers,
                    getEffectiveStats // Pass function to recalculate stats mid-execution
                });

                // 3. Return the result directly
                const finalResult = customResult;

                // If the custom jutsu is round-based, add it to the activeCustomRoundJutsus
                // Only add on first activation to avoid duplicates
                if (jutsu.roundBased && isFirstActivation) {
                    baseUser.activeCustomRoundJutsus = baseUser.activeCustomRoundJutsus || [];
                    // Check if not already active
                    const alreadyActive = baseUser.activeCustomRoundJutsus.find(j => j.name === jutsuName);
                    if (!alreadyActive) {
                        baseUser.activeCustomRoundJutsus.push({
                            name: jutsuName,
                            scriptFile: jutsu.scriptFile,
                            roundsLeft: (jutsu.duration || 3) - 1, // Subtract 1 since round 1 just happened
                            currentRound: 1
                        });
                    }
                }
                if (finalResult && finalResult.effects && Array.isArray(finalResult.effects)) {
                    finalResult.effects.forEach(effect => {
                        applyEffect(effect, baseUser, baseTarget, effectiveUser, effectiveTarget, finalResult, jutsuName, effectHandlers, false);
                    });
                }
                return finalResult;
            } else {
                console.error(`Custom script ${jutsu.scriptFile} does not export an 'execute' function.`);
            }
        } catch (error) {
            console.error(`Error loading or executing custom jutsu script: ${jutsu.scriptFile}`, error);
            // Fallback result for a failed custom script execution
            return {
                damage: 0,
                heal: 0,
                description: `Error executing custom jutsu: ${jutsuName}`,
                specialEffects: ["Jutsu failed!"],
                hit: false,
                jutsuUsed: jutsuName
            };
        }
    }

    if (!jutsu) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} attempted unknown jutsu: ${jutsuName}`,
            specialEffects: ["Jutsu failed!"],
            hit: false,
            jutsuUsed: jutsuName
        };
    }

    // --- NEW: Perfect Susanoo logic ---
    if (jutsuName === 'Perfect Susanoo' && (round === 1 || isFirstActivation)) {
        // Clear all debuffs from the USER upon activation
        const initialCount = (baseUser.activeEffects || []).length;
        baseUser.activeEffects = (baseUser.activeEffects || []).filter(e => e.type !== 'debuff');
        const finalCount = (baseUser.activeEffects || []).length;
        if (initialCount > finalCount) {
            result.specialEffects.push(`${baseUser.name} cleansed all debuffs with Perfect Susanoo!`);
        }
    }
    // The original code had a misplaced `baseTarget.activeEffects = baseTarget.activeEffects.filter(e => e.type !== 'debuff');`
    // and `if (debuffsRemoved.length > 0)` block here.
    // The instruction implies this block should be removed or replaced by the new Perfect Susanoo logic.
    // Assuming the new Perfect Susanoo logic is for the *user* (baseUser) and not target.

    const result = {
        damage: 0,
        heal: 0,
        description: jutsu.description || `${baseUser.name} used ${jutsu.name}`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuName,
        roundBasedDesc: "",
        lethalDamageCheckNeeded: false,
        lifesteal: 0,
        chakraUsed: 0,
        roundBasedEffects: [],
        adaptationEmbed: false,
        isCrit: false
    };

    // --- NEW: Handle immediate 'remove_buffs' effect for target if present in jutsu.effects ---

    const effectsArray = Array.isArray(jutsu.effects) ? jutsu.effects : (jutsu.effects ? [jutsu.effects] : []);
    if (effectsArray.some(e => e.type === 'remove_buffs')) {
        baseTarget.activeEffects = baseTarget.activeEffects || [];
        const buffsRemoved = baseTarget.activeEffects.filter(e => e.type === 'buff');
        baseTarget.activeEffects = baseTarget.activeEffects.filter(e => e.type !== 'buff');
        if (buffsRemoved.length > 0) {
            result.specialEffects.push(`${baseTarget.name}'s buffs were removed!`);
        }
    }

    // Process active effects at turn start
    const userEffects = effectHandlers.processActiveEffects(baseUser);
    const targetEffects = effectHandlers.processActiveEffects(baseTarget);

    result.specialEffects.push(...userEffects.specialEffects);
    result.specialEffects.push(...targetEffects.specialEffects);


    // Check resource costs
    const cost = jutsu.chakraCost || 0;
    const costType = jutsu.chakraCostType || 'chakra';

    let actualCost = 0;
    let canAfford = false;




    switch (costType) {
        case 'chakra':
            actualCost = Number(cost) || 0;

            // Apply 50% cost reduction for 'Gyakuten no Horu' if 'Perfect Susanoo' is active
            if (jutsuName === 'Gyakuten no Horu' && baseUser.activeEffects?.some(e => e.type === 'status' && e.status === 'Perfect Susanoo Active')) {

                actualCost = Math.floor(actualCost * 0.5);
                result.specialEffects.push(`Perfect Susanoo reduces Gyakuten no Horu chakra cost by 50%!`);

            }
            canAfford = (baseUser.chakra || 0) >= actualCost;
            break;
        case 'percent_chakra':
            {
                // allow specifying percent in chakraCost (e.g. 30 means 30%)
                const pct = Number(cost) || 30;
                actualCost = Math.floor((baseUser.chakra || 0) * (pct / 100));
                canAfford = (baseUser.chakra || 0) >= actualCost && actualCost > 0;
            }
            break;
        case 'all_chakra':
            actualCost = baseUser.chakra || 0;
            canAfford = actualCost > 0;
            break;
        case 'health':
            actualCost = Number(cost) || 0;
            canAfford = (baseUser.currentHealth || 0) >= actualCost; // allow equal
            break;
        case 'percent_health':
            {
                const pct = Number(cost) || 30;
                const maxHp = Number(baseUser.maxHealth || baseUser.health || 0);
                actualCost = Math.floor(maxHp * (pct / 100));
                canAfford = (baseUser.currentHealth || 0) >= actualCost;
            }
            break;
        case 'chakra_per_round':
            // This is handled in processActiveEffects
            actualCost = 0; // No immediate cost
            canAfford = true;
            break;
        case 'health_per_round':
            // This is handled in processActiveEffects  
            actualCost = 0; // No immediate cost
            canAfford = true;
            break;
        default:
            console.warn(`Unknown cost type: ${costType}`);
            canAfford = false;
    }



    if (!canAfford) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
            specialEffects: ["Not enough chakra!"],
            hit: false,
            jutsuUsed: jutsuName
        };
    }

    // Deduct costs
    if (costType === 'health' || costType === 'percent_health') {
        baseUser.currentHealth = (baseUser.currentHealth || 0) - actualCost;
        result.specialEffects.push(`-${actualCost} Health was consumed to use ${jutsu.name}.`);
    } else {
        baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - actualCost);
        result.chakraUsed = actualCost;
    }
    // Insert/update just before the final `return result;` in executeJutsu:
    if (baseUser && baseUser.bloodline === 'Senju' && result.damage > 0) {
        try {
            const healBy = effectHandlers.lifesteal(result.damage, 8, baseUser); // 8% lifesteal
            if (healBy > 0) {
                result.lifesteal = (result.lifesteal || 0) + healBy;
                result.specialEffects = result.specialEffects || [];
                result.specialEffects.push(`Senju passive: healed ${healBy} HP (8% lifesteal).`);
            }
        } catch (err) {
            console.error('Error applying Senju lifesteal:', err);
        }
    }


    // Apply immediate effects with RANDOM EFFECTS HANDLING
    // Apply immediate effects with ENHANCED RANDOM EFFECTS HANDLING
    if (baseTarget.name === 'King Kori' && jutsuName === 'Fireball Jutsu') {
        const killDmg = 9000000000000000000000000;
        result.damage += killDmg;
        result.specialEffects.push(`**CRITICAL WEAKNESS!** King Kori melts instantly from the ${jutsuName}!`);
    }

    // --- PROCESS JUTSU EFFECTS ---
    let effectsToProcess = [];
    if (Array.isArray(jutsu.effects)) {
        effectsToProcess = jutsu.effects;
    }

    // Handle Round-Based activation (Round 1)
    if (jutsu.roundBased && jutsu.roundEffects) {
        let roundEffect = null;
        for (const key of Object.keys(jutsu.roundEffects)) {
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(Number);
                if (round >= start && round <= end) {
                    roundEffect = jutsu.roundEffects[key];
                    break;
                }
            } else if (parseInt(key) === round) {
                roundEffect = jutsu.roundEffects[key];
                break;
            }
        }
        if (roundEffect && Array.isArray(roundEffect.effects)) {
            effectsToProcess = effectsToProcess.concat(roundEffect.effects);
        }
        // Legacy roundEffect keys
        if (roundEffect) {
            if (roundEffect.damage) effectsToProcess.push({ type: 'damage', ...roundEffect.damage });
            if (roundEffect.heal) effectsToProcess.push({ type: 'heal', ...roundEffect.heal });
            if (roundEffect.status) effectsToProcess.push({ type: 'status', status: roundEffect.status, duration: roundEffect.duration || 1 });
            if (roundEffect.buff) effectsToProcess.push({ type: 'buff', stats: roundEffect.buff.stats, duration: roundEffect.duration || 1 });
            if (roundEffect.debuff) effectsToProcess.push({ type: 'debuff', stats: roundEffect.debuff.stats, duration: roundEffect.duration || 1 });
            if (roundEffect.chakra_gain) effectsToProcess.push({ type: 'chakra_gain', ...roundEffect.chakra_gain });
        }
    }

    // Random effects handling
    if (jutsu.random) {
        const availablePool = jutsu.randomeffects || effectsToProcess;
        if (Array.isArray(availablePool) && availablePool.length > 0) {
            effectsToProcess = [availablePool[Math.floor(Math.random() * availablePool.length)]];
        }
    }



    const sortedEffects = [...effectsToProcess].sort((a, b) => {
        const pA = EFFECT_PRIORITY[a.type] ?? 5;
        const pB = EFFECT_PRIORITY[b.type] ?? 5;
        return pA - pB;
    });

    sortedEffects.forEach(effect => {
        applyEffect(effect, baseUser, baseTarget, effectiveUser, effectiveTarget, result, jutsuName, effectHandlers, false);
    });

    return result;
}
/**
 * Creates battle summary embed
 */
function createBattleSummary(
    player1Action, player2Action, player1, player2, roundNum,
    comboCompleted1, comboDamageText1, comboCompleted2, comboDamageText2,
    player1RoundBasedSummaries = [], player2RoundBasedSummaries = []
) {
    // Helper to get effect emojis for an entity
    const getEffectEmojis = (entity) => {
        const emojis = [];
        (entity.activeEffects || []).forEach(effect => {
            if (effect.type === 'buff') emojis.push(EMOJIS.buff);
            if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
            if (effect.type === 'status') {
                if (EMOJIS[effect.status]) {
                    emojis.push(EMOJIS[effect.status]);
                } else {
                    emojis.push(EMOJIS.status);
                }
            }
        });
        return emojis.length ? `[${emojis.join('')}]` : '';
    };

    // Helper to format jutsu descriptions, especially for multi-round jutsus
    const formatJutsuDescription = (jutsuName, roundNumber, user, target) => {
        // Check if this is a rest action (jutsuName will be null for rest)
        if (!jutsuName || jutsuName === 'rest') {
            return `${user.name} rested and gained +1 chakra`;
        }

        const jutsu = jutsuList[jutsuName];
        if (!jutsu) {
            // Check for stun/flinch/drown status effect
            const statusEffect = (user.activeEffects || []).find(e =>
                e.type === 'status' && ['stun', 'flinch', 'drown'].includes(e.status)
            );
            if (statusEffect) {
                switch (statusEffect.status) {
                    case 'stun': return `${user.name} is stunned and can't move!`;
                    case 'flinch': return `${user.name} flinched!`;
                    case 'drown': return `${user.name} is drowning and can't act!`;
                    default: return `${user.name} is incapacitated!`;
                }
            }
            return `${user.name} used an unknown jutsu.`;
        }

        let finalDescription = jutsu.description;

        // Handle multi-round jutsu descriptions
        if (jutsu.roundBased && jutsu.roundEffects) {
            for (const roundKey in jutsu.roundEffects) {
                if (roundKey.includes('-')) {
                    const [start, end] = roundKey.split('-').map(Number);
                    if (roundNumber >= start && roundNumber <= end) {
                        finalDescription = jutsu.roundEffects[roundKey].description;
                        break;
                    }
                } else if (parseInt(roundKey) === roundNumber) {
                    finalDescription = jutsu.roundEffects[roundKey].description;
                    break;
                }
            }
        }

        // Replace dynamic keywords
        if (finalDescription) {
            finalDescription = finalDescription
                .replace(/\buser\b/gi, user.name)
                .replace(/\btarget\b/gi, target.name);
        }

        return finalDescription || jutsu.description;
    };

    // Helper to get combo progress text
    const getComboProgressText = (user, comboCompleted) => {
        if (player2.isNpc || comboCompleted || !user.comboState?.combo) return "";

        const combo = user.comboState.combo;
        const usedJutsus = user.comboState.usedJutsus || new Set();
        const remainingJutsus = combo.requiredJutsus.filter(jutsu => !usedJutsus.has(jutsu));
        const progressBar = `${COMBO_EMOJI_FILLED.repeat(usedJutsus.size)}${COMBO_EMOJI_EMPTY.repeat(remainingJutsus.length)}`;
        return `\nCombo Progress: ${progressBar} (${Math.round((usedJutsus.size / combo.requiredJutsus.length) * 100)}%)`;
    };

    // Helper to check for active status effects that prevent action
    const getStatusEffectMessage = (entity) => {
        const statusEffect = (entity.activeEffects || []).find(e =>
            e.type === 'status' && e.canAttack === false
        );
        if (statusEffect) {
            switch (statusEffect.status) {
                case 'stun': return `${entity.name} is stunned and can't move!`;
                case 'flinch': return `${entity.name} flinched!`;
                case 'drown': return `${entity.name} is drowning and can't act!`;
                default: return `${entity.name} is incapacitated!`;
            }
        }
        return null;
    };

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400');

    // Player 1 Details (User)
    let p1MaxHealth = player1.maxHealth || player1.health || 100;
    let p1Health = Math.round(
        Math.max(
            -999999999999,
            Math.min(
                p1MaxHealth,
                (typeof player1.currentHealth === "number" ? player1.currentHealth : player1.health || 0)
            )
        )
    );
    let p1Chakra = 0;
    if (player1.subPlayers && player1.subPlayers.length > 0) {
        p1Chakra = Math.round(player1.subPlayers.reduce((acc, p) => acc + (p.chakra || 0), 0));
    } else {
        p1Chakra = Math.round(player1.chakra || 0);
    }
    const p1EffectEmojis = getEffectEmojis(player1);
    const p2EffectEmojis = getEffectEmojis(player2);

    // Status effect override for player1
    let p1StatusMsg;
    const naraStunEffectP1 = (player1.activeEffects || []).find(e =>
        e.type === 'status' && e.status === 'stun' && e.source === `${player2.userId}-NaraAwaken`
    );
    if (naraStunEffectP1) {
        p1StatusMsg = `${player1.name} is possessed and can't move!`;
    } else {
        p1StatusMsg = getStatusEffectMessage(player1);
    }
    let p1Description;
    if (p1StatusMsg && (!player1Action.jutsuUsed || player1Action.isStatusEffect)) {
        p1Description = p1StatusMsg;
    } else if (player1Action.isRest) {
        p1Chakra = Math.min((p1Chakra || 0) + 1, 999);
        p1Description = player1Action.description;
    } else if (player1Action.fled) {
        p1Description = `${player1.name} fled from battle!`;
    } else {
        p1Description = formatJutsuDescription(player1Action.jutsuUsed, roundNum, player1, player2);
    }

    if (player1Action.damage) {
        p1Description += ` for ${Math.round(player1Action.damage)} damage${player1Action.isCrit ? ' **(CRITICAL HIT!)**' : ''}!`;
    } else if (player1Action.heal) {
        p1Description += ` for ${Math.round(player1Action.heal)} HP!`;
    } else if (!player1Action.isRest && !player1Action.fled && !p1StatusMsg) {
        p1Description += '...!';
    }

    // Display lifesteal if present
    if (player1Action.lifesteal && player1Action.lifesteal > 0) {
        p1Description += `\n${EMOJIS.heal} **Lifesteala:** Recovered ${Math.round(player1Action.lifesteal)} HP!`;
    }

    if (comboCompleted1) {
        p1Description += comboDamageText1;
    }

    // Player 2 Details (User or NPC)
    let p2MaxHealth = player2.maxHealth || player2.health || 100;
    let p2Health = Math.round(
        Math.max(
            -999999999999,
            Math.min(
                p2MaxHealth,
                (typeof player2.currentHealth === "number" ? player2.currentHealth : player2.health || 0)
            )
        )
    );
    let p2Chakra = Math.round(player2.chakra || 0);

    // Status effect override for player2
    let p2StatusMsg;
    const naraStunEffectP2 = (player2.activeEffects || []).find(e =>
        e.type === 'status' && e.status === 'stun' && e.source === `${player1.userId}-NaraAwaken`
    );
    if (naraStunEffectP2) {
        p2StatusMsg = `${player2.name} is possessed and can't act!`;
    } else {
        p2StatusMsg = getStatusEffectMessage(player2);
    }
    let p2Description;
    if (p2StatusMsg && (!player2Action.jutsuUsed || player2Action.isStatusEffect)) {
        p2Description = p2StatusMsg;
    } else if (player2Action.isRest) {
        p2Chakra = Math.min((p2Chakra || 0) + 1, 999);
        p2Description = player2Action.description;
    } else if (player2Action.fled) {
        p2Description = `${player2.name} fled from battle!`;
    } else {
        p2Description = formatJutsuDescription(player2Action.jutsuUsed, roundNum, player2, player1);
    }

    if (player2Action.damage) {
        p2Description += ` for ${Math.round(player2Action.damage)} damage${player2Action.isCrit ? ' **(CRITICAL HIT!)**' : ''}!`;
    } else if (player2Action.heal) {
        p2Description += ` for ${Math.round(player2Action.heal)} HP!`;
    } else if (!player2Action.isRest && !player2Action.fled && !p2StatusMsg) {
        p2Description += '...!';
    }

    // Display lifesteal if present
    if (player2Action.lifesteal && player2Action.lifesteal > 0) {
        p2Description += `\n${EMOJIS.heal} **Lifesteal:** Recovered ${Math.round(player2Action.lifesteal)} HP!`;
    }

    if (comboCompleted2) {
        p2Description += comboDamageText2;
    }

    // Display overrides for Izanami Infinity
    const isAnyIzanamiRecording = (player1.izanamiPhase === "recording" || player2.izanamiPhase === "recording");
    let p1HealthDisplay = isAnyIzanamiRecording ? "∞" : p1Health;
    let p1ChakraDisplay = isAnyIzanamiRecording ? "∞" : p1Chakra;
    let p2HealthDisplay = isAnyIzanamiRecording ? "∞" : p2Health;
    let p2ChakraDisplay = isAnyIzanamiRecording ? "∞" : p2Chakra;

    // Add fields for better organization
    embed.addFields(
        {
            name: `${player1.name} ${p1EffectEmojis}`,
            value: `${p1Description}\n\n**HP:** ${p1HealthDisplay}\n**Chakra:** ${p1ChakraDisplay}`,
            inline: true
        },
        {
            name: `${player2.name} ${p2EffectEmojis}`,
            value: `${p2Description}\n\n**HP:** **${p2HealthDisplay}**\n**Chakra:** **${p2ChakraDisplay}**`,
            inline: true
        }
    );

    // --- NEW: Handle ongoing status effects with damage/heal values ---
    const activeStatusEffects = [];
    [player1, player2].forEach(p => {
        (p.activeEffects || []).forEach(effect => {
            if (effect.type === 'status') {
                let extraInfo = '';
                if (typeof effect.damagePerTurn === "number" && !isNaN(effect.damagePerTurn)) {
                    extraInfo = ` (takes **${Math.round(effect.damagePerTurn)}** damage)`;
                } else if (typeof effect.healPerTurn === "number" && !isNaN(effect.healPerTurn)) {
                    extraInfo = ` (heals **${Math.round(effect.healPerTurn)}** HP)`;
                }

                const statusName = effect.status.charAt(0).toUpperCase() + effect.status.slice(1);
                activeStatusEffects.push(`${p.name} is affected by **${statusName}**!${extraInfo}`);
            }
        });
    });

    if (player1Action.reflectedDamageMessage) {
        activeStatusEffects.push(player1Action.reflectedDamageMessage);
    }
    if (player2Action.reflectedDamageMessage) {
        activeStatusEffects.push(player2Action.reflectedDamageMessage);
    }
    if (activeStatusEffects.length > 0) {
        embed.addFields({
            name: 'Ongoing Effects',
            value: activeStatusEffects.join('\n'),
            inline: false
        });
    }

    // Handle round-based summaries from active jutsus
    const roundBasedSummaries = [];
    // Process player 1's effects
    player1RoundBasedSummaries.forEach(s => {
        let text = s.desc.replace(/\buser\b/gi, player1.name).replace(/\btarget\b/gi, player2.name);
        if (s.effects && s.effects.length > 0) {
            s.effects.forEach(effect => {
                if (effect.type === 'damage' && effect.value) {
                    text += ` (Dealt ${Math.round(effect.value)} damage)`;
                } else if (effect.type === 'heal' && effect.value) {
                    text += ` (Healed for ${Math.round(effect.value)} HP)`;
                }
            });
        }
        roundBasedSummaries.push(`*${text}*`);
    });

    // Special effects from actions
    const actionDetails = [];
    if (player1Action.specialEffects && player1Action.specialEffects.length > 0) {
        player1Action.specialEffects.forEach(effect => {
            if (typeof effect === 'string' && effect.trim()) {
                actionDetails.push(`**${player1.name}:** ${effect}`);
            }
        });
    }
    if (player2Action.specialEffects && player2Action.specialEffects.length > 0) {
        player2Action.specialEffects.forEach(effect => {
            if (typeof effect === 'string' && effect.trim()) {
                actionDetails.push(`**${player2.name}:** ${effect}`);
            }
        });
    }

    if (actionDetails.length > 0) {
        embed.addFields({
            name: 'Action Details',
            value: actionDetails.join('\n').substring(0, 1024),
            inline: false
        });
    }

    // Process player 2's effects
    player2RoundBasedSummaries.forEach(s => {
        let text = s.desc.replace(/\buser\b/gi, player2.name).replace(/\btarget\b/gi, player1.name);
        if (s.effects && s.effects.length > 0) {
            s.effects.forEach(effect => {
                if (effect.type === 'damage' && effect.value) {
                    text += ` (Dealt ${Math.round(effect.value)} damage)`;
                } else if (effect.type === 'heal' && effect.value) {
                    text += ` (Healed for ${Math.round(effect.value)} HP)`;
                }
            });
        }
        roundBasedSummaries.push(`*${text}*`);
    });

    if (roundBasedSummaries.length > 0) {
        embed.addFields({
            name: 'Round Effects',
            value: roundBasedSummaries.join('\n'),
            inline: false
        });
    }

    // Add combo progress if applicable
    const comboProgressText1 = getComboProgressText(player1, comboCompleted1);
    if (comboProgressText1) {
        embed.addFields({ name: 'Your Combo', value: comboProgressText1, inline: false });
    }

    const comboProgressText2 = getComboProgressText(player2, comboCompleted2);
    if (comboProgressText2) {
        embed.addFields({ name: 'Opponent Combo', value: comboProgressText2, inline: false });
    }

    // Handle image and custom background logic
    let imageUrl = null;
    let customBgUrl = null;
    if (player1Action.jutsuUsed && jutsuList[player1Action.jutsuUsed]) {
        const jutsu = jutsuList[player1Action.jutsuUsed];
        if (jutsu.image_url) {
            imageUrl = jutsu.image_url;
        }
        if (jutsu.custombackground && jutsu.custombackground.round === roundNum) {
            customBgUrl = jutsu.custombackground.url;
        }
    }
    if (player2Action.jutsuUsed && jutsuList[player2Action.jutsuUsed]) {
        const jutsu = jutsuList[player2Action.jutsuUsed];
        if (jutsu.image_url) {
            imageUrl = jutsu.image_url;
        }
        if (jutsu.custombackground && jutsu.custombackground.round === roundNum) {
            customBgUrl = jutsu.custombackground.url;
        }
    }

    if (customBgUrl) {
        embed.setImage(customBgUrl);
    } else if (imageUrl) {
        embed.setImage(imageUrl);
    }

    return embed;
}
/**
 * Enhanced NPC AI with smarter move selection
 */
function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer) {
    // Check for status effects that prevent action - USE ACTIVE EFFECTS (INSTANT)
    const statusEffect = (baseNpc.activeEffects || []).find(e =>
        e.type === 'status' && ['stun', 'flinch', 'drown', 'possessed'].includes(e.status)
    );

    if (statusEffect) {
        let statusMsg = "";
        switch (statusEffect.status) {
            case 'stun': statusMsg = `${baseNpc.name} is stunned and can't move!`; break;
            case 'flinch': statusMsg = `${baseNpc.name} flinched and couldn't act!`; break;
            case 'drown': statusMsg = `${baseNpc.name} is drowning and can't act!`; break;
            case 'possessed': statusMsg = `${baseNpc.name} is possessed and can't act!`; break;
            default: statusMsg = `${baseNpc.name} is confused!`;
        }

        return {
            damage: 0,
            heal: 0,
            description: statusMsg,
            specialEffects: [statusEffect.status.charAt(0).toUpperCase() + statusEffect.status.slice(1) + " active"],
            hit: false,
            isStatusEffect: true,
            jutsuUsed: null
        };
    }

    // Get available jutsus
    const npcJutsuArr = Array.isArray(baseNpc.jutsu) ?
        baseNpc.jutsu :
        Object.values(baseNpc.jutsu || {});

    const availableJutsus = npcJutsuArr.filter(jName => {
        const jutsu = jutsuList[jName];
        return jutsu && (jutsu.chakraCost || 0) <= (baseNpc.chakra || 0);
    });

    // Smart jutsu selection
    let selectedJutsu;

    if (availableJutsus.length === 0) {
        // Rest if no jutsus available
        baseNpc.chakra = Math.min((baseNpc.chakra || 0) + 1, 999);
        return {
            damage: 0,
            heal: 0,
            description: `${baseNpc.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }

    // AI Strategy: Prioritize based on situation
    const playerHealthPercent = basePlayer.currentHealth / basePlayer.health;
    const npcHealthPercent = baseNpc.currentHealth / baseNpc.health;

    // If low health, prioritize healing or defensive jutsus
    if (npcHealthPercent < 0.3) {
        const healingJutsus = availableJutsus.filter(jName => {
            const jutsu = jutsuList[jName];
            return jutsu.effects?.some(e => e.type === 'heal') ||
                jutsu.effects?.some(e => e.type === 'buff' && e.stats?.defense);
        });
        if (healingJutsus.length > 0) {
            selectedJutsu = healingJutsus[Math.floor(Math.random() * healingJutsus.length)];
        }
    }

    // If player is low, prioritize finishing moves
    if (!selectedJutsu && playerHealthPercent < 0.2) {
        const highDamageJutsus = availableJutsus.filter(jName => {
            const jutsu = jutsuList[jName];
            return jutsu.effects?.some(e => e.type === 'damage') ||
                jutsu.effects?.some(e => e.type === 'auto_kill');
        });
        if (highDamageJutsus.length > 0) {
            selectedJutsu = highDamageJutsus[Math.floor(Math.random() * highDamageJutsus.length)];
        }
    }

    // Default: random selection from available
    if (!selectedJutsu) {
        selectedJutsu = availableJutsus[Math.floor(Math.random() * availableJutsus.length)];
    }

    // Execute selected jutsu
    const jutsu = jutsuList[selectedJutsu];
    if (jutsu?.roundBased && !baseNpc.activeRoundJutsus?.[selectedJutsu]) {
        // TODO: activeJutsus is currently shared. This is simplified.
        const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, selectedJutsu, 1, true);
        if (!result.hit && result.specialEffects?.includes("Not enough chakra!")) {
            return result;
        }
        baseNpc.activeRoundJutsus = baseNpc.activeRoundJutsus || {};
        baseNpc.activeRoundJutsus[selectedJutsu] = { round: 1 }; // Shared tracking for now
        result.isRoundActivation = true;
        result.jutsuUsed = selectedJutsu;
        return result;
    }

    const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, selectedJutsu);
    result.jutsuUsed = selectedJutsu;

    return result;
}
// --- B-Rank NPCs Database ---
const BRANK_NPCS = [
    {
        name: "Bandit",
        image: "https://i.postimg.cc/GmhQvT79/image.png",
        baseHealth: 0.2,
        basePower: 0.3,
        baseDefense: 0.3,
        accuracy: 80,
        dodge: 0,
        jutsu: ["Transformation Jutsu"]
    }
];
/**
 * Handles the main battle loop for any two participants (user vs user, user vs NPC).
 * This function encapsulates the turn-based combat, effect application, and summary generation.
 * @param {object} interaction - The Discord interaction object.
 * @param {string} player1Id - The ID of the first player (always a user).
 * @param {string} player2Id - The ID of the second player (user or NPC_name).
 * @param {string} battleType - Type of battle (e.g., 'brank', 'arank', 'ranked', 'fight').
 */

/**
 * Helper function to apply damage, checking for reflection effects.
 * @param {object} attacker - The entity dealing damage.
 * @param {object} defender - The entity receiving damage.
 * @param {number} damageAmount - The amount of damage to apply.
 * @param {object} actionResult - The action result object to add special effects messages.
 */
function applyDamageWithReflection(attacker, defender, damageAmount, actionResult) {
    if (damageAmount <= 0) return;

    // --- Rage Effect ---
    if (defender.activeEffects?.some(e => e.status === 'rage')) {
        defender.power = Math.floor((defender.power || 10) * 10);
        actionResult.specialEffects = actionResult.specialEffects || [];
        actionResult.specialEffects.push(`**RAGE!** ${defender.name}'s power grows 10x stronger from the hit!`);
    }

    const attackName = actionResult.jutsuUsed || actionResult.comboUsed || "Attack";

    const reflectEffectIndex = (defender.activeEffects || []).findIndex(
        e => e.type === 'status' && e.status === 'punisher_shield_reflect'
    );

    if (reflectEffectIndex !== -1) {
        const initialDefenderHealth = defender.currentHealth;
        let tookOverwhelmingDamage = false;

        // Check if damage is overwhelming (breaks the shield)
        if (damageAmount > initialDefenderHealth) {
            tookOverwhelmingDamage = true;
            // Shield breaks: Defender takes full damage, Attacker takes NONE
            if (!defender.izanamiImmortal) {
                defender.currentHealth = defender.currentHealth - damageAmount;
            } else {
                actionResult.specialEffects = actionResult.specialEffects || [];
                actionResult.specialEffects.push(`${defender.name} is IMMORTAL! Shield shatter damage nullified.`);
            }
        } else {
            // Shield holds: Attacker takes the damage
            if (!attacker.izanamiImmortal) {
                attacker.currentHealth = attacker.currentHealth - damageAmount;
            } else {
                actionResult.specialEffects = actionResult.specialEffects || [];
                actionResult.specialEffects.push(`${attacker.name} is IMMORTAL! Reflected damage nullified.`);
            }
            // Defender heals (absorbs the hit) - capped at max HP handled by health assignment usually, ensuring no overheal loop logic here
            const maxHP = defender.maxHealth || defender.health || 0;
            defender.currentHealth = Math.min(maxHP, defender.currentHealth + damageAmount);
        }

        let reflectMsg = "";
        if (tookOverwhelmingDamage) {
            reflectMsg = `${defender.name}'s Shield SHATTERS from the overwhelming force! They take ${damageAmount} damage and fail to reflect!`;
        } else {
            reflectMsg = `${defender.name}'s Shield reflects ${damageAmount} damage back to ${attacker.name} and heals them!`;
        }

        actionResult.specialEffects = actionResult.specialEffects || [];
        actionResult.specialEffects.push(reflectMsg);
        actionResult.reflectedDamageMessage = reflectMsg;

        defender.activeEffects.splice(reflectEffectIndex, 1);
        return;
    }

    // Adaptation Tracking & Reflection
    if (defender.activeEffects?.some(e => e.status === 'Wheel of Fate Adaptation')) {
        defender.adaptedTechniques = defender.adaptedTechniques || {};
        const hits = defender.adaptedTechniques[attackName] || 0;

        // If already fully adapted (4+ hits), reflect 50% and take no damage
        if (hits >= 4) {
            const reflectedDmg = Math.floor(damageAmount * 0.5);
            if (!attacker.izanamiImmortal) {
                attacker.currentHealth -= reflectedDmg;
            }
            actionResult.specialEffects = actionResult.specialEffects || [];
            actionResult.specialEffects.push(`**ADAPTED!** ${defender.name} has fully adapted to ${attackName}. ${attacker.name} took ${attacker.izanamiImmortal ? 0 : reflectedDmg} reflected damage!`);
            actionResult.reflectedDamageMessage = `**ADAPTED!** ${defender.name} fully adapted: ${attacker.name} took ${attacker.izanamiImmortal ? 0 : reflectedDmg} reflected damage!`;
            return; // No damage to defender
        }

        // Damage reduction logic for Combos
        if (actionResult.comboUsed) {
            const adaptationMultiplier = Math.max(0, 1 - (hits * 0.33));
            damageAmount = Math.floor(damageAmount * adaptationMultiplier);

            // Increment hit count for combos here
            defender.adaptedTechniques[attackName] = hits + 1;

            // Feedback for combos
            let tierMsg = "";
            if (hits === 0) tierMsg = "The wheel turns... Adaptation begins!";
            else if (hits === 1) tierMsg = "The wheel turns... Adaptation deepening!";
            else if (hits === 2) tierMsg = "The wheel turns... Adaptation almost complete!";
            else if (hits === 3) tierMsg = "The wheel turns... Adaptation complete!";
            if (tierMsg) {
                actionResult.specialEffects = actionResult.specialEffects || [];
                actionResult.specialEffects.push(tierMsg);
            }
        }
    }

    // --- Rage Effect ---
    if (defender.activeEffects?.some(e => e.status === 'rage')) {
        defender.power = Math.floor((defender.power || 10) * 10);
        actionResult.specialEffects = actionResult.specialEffects || [];
        actionResult.specialEffects.push(`**RAGE!** ${defender.name}'s power grows 10x stronger from the hit!`);
    }

    // Default: No reflection or partial adaptation: defender takes damage
    if (!defender.izanamiImmortal) {
        defender.currentHealth = defender.currentHealth - damageAmount;
    } else {
        actionResult.specialEffects = actionResult.specialEffects || [];
        actionResult.specialEffects.push(`${defender.name} is IMMORTAL! Damage nullified.`);
    }
}



// --- Role Buff Helper ---
function applyRoleBuffs(player, member, roundBasedSummaries) {
    if (!member || !member.roles) return;

    // Sannin Role (20% heal)
    if (member.roles.cache.has('1447257818796265633')) {
        const recover = Math.floor((player.maxHealth || 100) * 0.20);
        player.currentHealth = Math.min(player.maxHealth, player.currentHealth + recover);
        if (roundBasedSummaries) {
            roundBasedSummaries.push({ desc: `${EMOJIS.heal} **Sannin's Vitality**: ${player.name} restored ${recover} HP (20%)` });
        }
    }

    // Hokage Role (50% heal)
    if (member.roles.cache.has('1381606285577031772')) {
        const recover = Math.floor((player.maxHealth || 100) * 0.50);
        player.currentHealth = Math.min(player.maxHealth, player.currentHealth + recover);
        if (roundBasedSummaries) {
            roundBasedSummaries.push({ desc: `${EMOJIS.heal} **Hokage's Will**: ${player.name} restored ${recover} HP (50%)` });
        }
    }
}

async function handleMatchEnd(battleChannel, winner, loser, users, roundNum, damageStats, battleType) {
    // This is a dummy function to prevent the bot from crashing.
}

async function handleFlee(battleChannel, player, opponent, users, roundNum, damageStats, battleType, isPlayer2NPC, client) {
    await battleChannel.send(`${player.name} fled from the battle!`);

    if (isPlayer2NPC) {
        return;
    }

    if (battleType === 'ranked') { // Only log if PvP ranked
        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send(`[RANKED] ${player.name} (${player.userId}) fled from the match against ${opponent.name} (${opponent.userId})`);
            }
        } catch (e) { }
        await handleMatchEnd(battleChannel, opponent, player, users, roundNum, {
            winner: { dealt: damageStats.winnerDealt, taken: damageStats.winnerTaken },
            loser: { dealt: damageStats.loserDealt, taken: damageStats.loserTaken }
        }, battleType); // Opponent wins by default
    }
}

// Accept npcTemplate as an optional parameter for custom NPCs (like Hokage Trials)
async function runBattle(interaction, player1Id, player2Id, battleType, npcTemplate = null, mode = 'friendly', isRaidBoss = false, player1Override = null) {
    // --- WORLD EVENT CHECK ---
    const worldEventPath = path.resolve(__dirname, '../data/worldEvent.json');
    if (fs.existsSync(worldEventPath)) {
        try {
            const eventData = JSON.parse(fs.readFileSync(worldEventPath, 'utf8'));
            if (eventData.active && eventData.message) {
                // Check if interaction is deferred or replied
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: eventData.message, embeds: [], components: [] });
                } else {
                    await interaction.reply({ content: eventData.message, ephemeral: true });
                }
                return;
            }
        } catch (e) { console.error("Error reading world event:", e); }
    }

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // MEMORY SEQUENCE REMOVED - Was causing battles to fail for new players
    // TODO: Re-implement memory sequence with proper battle result handling

    // Load players.json (levels and persistent player stats)
    const PLAYERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/players.json');
    const playersData = fs.existsSync(PLAYERS_FILE_PATH) ? JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8')) : {};
    const userAccessoryData = fs.existsSync(userAccessoryPath) ? JSON.parse(fs.readFileSync(userAccessoryPath, 'utf8')) : {};

    const client = interaction.client; // Get client from interaction
    // Initialize player1 (always a user)
    const player1User = await client.users.fetch(player1Id);
    // Fetch member for roles
    const player1Member = interaction.guild ? await interaction.guild.members.fetch(player1Id).catch(() => null) : null;

    const player1Data = users[player1Id] || {};
    let player1;
    if (player1Override) {
        player1 = {
            ...player1Override,
            userId: player1Id,
            name: player1Override.name || player1User.username,
            avatar: player1User.avatar,
            discriminator: player1User.discriminator,
            subPlayers: [player1Override],
            roles: player1Member ? player1Member.roles.cache.map(r => r.id) : []
        };
        player1.subPlayers = [player1];
    } else {
        player1 = {
            ...player1Data,
            userId: player1Id,
            name: player1User.username,
            avatar: player1User.avatar,
            discriminator: player1User.discriminator,
            // Initialize health, power, defense, etc. from top-level or 'backup'
            health: Number(player1Data.health ?? player1Data.backup?.health) || 100,
            currentHealth: Number(player1Data.health ?? player1Data.backup?.health) || 100,
            power: Number(player1Data.power ?? player1Data.backup?.power) || 10,
            defense: Number(player1Data.defense ?? player1Data.backup?.defense) || 10,
            chakra: Number(player1Data.chakra ?? player1Data.backup?.chakra) || 10,
            activeEffects: Array.isArray(player1Data.activeEffects) ? player1Data.activeEffects.slice() : [],
            accuracy: Number(player1Data.accuracy ?? player1Data.backup?.accuracy) || 80, // Base accuracy is 80
            dodge: Number(player1Data.dodge ?? player1Data.backup?.dodge) || 0, // Base dodge is 0
            jutsu: users[player1Id].jutsu || {},
            maxHealth: Number(player1Data.health ?? player1Data.backup?.health) || 100, // Store max health for healing calculations
            comboState: users[player1Id].Combo && comboList[users[player1Id].Combo] ? { combo: comboList[users[player1Id].Combo], usedJutsus: new Set() } : null,
            // Use level from players.json (fallback to users.json or default 1)
            level: (playersData[player1Id] && typeof playersData[player1Id].level === 'number') ? playersData[player1Id].level : (users[player1Id] && users[player1Id].level ? users[player1Id].level : 1),
            activeCustomRoundJutsus: [],
            roles: player1Member ? player1Member.roles.cache.map(r => r.id) : [],
            equippedAccessory: userAccessoryData[player1Id]?.equipped || null,
            accessoryInventory: userAccessoryData[player1Id]?.inventory || []
        };
        player1.subPlayers = [player1];
    }
    // Initialize player2 (user or NPC)
    let player2;
    const isPlayer2NPC = player2Id.startsWith('NPC_');
    const player2Member = !isPlayer2NPC && interaction.guild ? await interaction.guild.members.fetch(player2Id).catch(() => null) : null;
    let npcData = null;
    if (isPlayer2NPC) {
        const npcName = player2Id.replace('NPC_', '');
        // Use npcTemplate for trials, else use database for brank/arank/ranked
        if (npcTemplate) {
            npcData = { ...npcTemplate };
        } else if (battleType === 'brank') {
            npcData = BRANK_NPCS.find(npc => npc.name === npcName) || BRANK_NPCS[0];
        } else if (battleType === 'arank') {
            npcData = ARANK_NPCS.find(npc => npc.name === npcName) || ARANK_NPCS[Math.floor(Math.random() * ARANK_NPCS.length)];
        } else {
            npcData = { // Fallback NPC
                name: "Rogue Ninja",
                image: "https://static.wikia.nocookie.net/naruto/images/3/3f/Thug.png/revision/latest?cb=20181118072602",
                health: 100,
                power: 50,
                defense: 30,
                accuracy: 80,
                dodge: 10,
                jutsu: ["Attack"]
            };
        }
        if (!npcData) {
            console.error(`NPC data not found for ${npcName}. Using fallback.`);
            npcData = { // Fallback NPC
                name: "Rogue Ninja",
                image: "https://static.wikia.nocookie.net/naruto/images/3/3f/Thug.png/revision/latest?cb=20181118072602",
                health: 100,
                power: 50,
                defense: 30,
                accuracy: 80,
                dodge: 10,
                jutsu: ["Attack"]
            };
        }
        player2 = {
            ...npcData,
            userId: player2Id,
            name: npcData.name,
            statsType: npcData.statsType || 'scalable',
            immunities: Array.isArray(npcData.immunities) ? npcData.immunities.slice() : [],
            // If fixed, prefer explicit health/currentHealth/power/defense; fall back to baseHealth/basePower/baseDefense
            health: (npcData.statsType === 'fixed')
                ? Number(npcData.health ?? npcData.baseHealth ?? npcData.maxHealth) || 0
                : Math.floor((player1.maxHealth || player1.health) * (npcData.baseHealth !== undefined ? npcData.baseHealth : 1)) || 0,
            currentHealth: (npcData.statsType === 'fixed')
                ? (Number(npcData.currentHealth ?? npcData.health ?? npcData.baseHealth) || Number(npcData.health ?? npcData.baseHealth) || 0)
                : Math.floor((player1.health) * (npcData.baseHealth !== undefined ? npcData.baseHealth : 1)) || 0,
            power: (npcData.statsType === 'fixed')
                ? Number(npcData.power ?? npcData.basePower) || 0
                : Math.floor(player1.power * (npcData.basePower !== undefined ? npcData.basePower : 1)) || 0,
            defense: (npcData.statsType === 'fixed')
                ? Number(npcData.defense ?? npcData.baseDefense) || 0
                : Math.floor(player1.defense * (npcData.baseDefense !== undefined ? npcData.baseDefense : 1)) || 0,
            accuracy: Number(npcData.accuracy) || 80, // Base accuracy is 80
            dodge: Number(npcData.dodge) || 0, // Base dodge is 0
            chakra: Number(npcData.chakra ?? npcData.Chakra) || 1000,
            activeEffects: Array.isArray(npcData.activeEffects) ? npcData.activeEffects.slice() : [], // Initialize once
            jutsu: (function () {
                if (Array.isArray(npcData.jutsu)) {
                    return Object.fromEntries(npcData.jutsu.map((j, i) => [i, j]));
                }
                if (npcData.jutsu && typeof npcData.jutsu === 'object') {
                    return npcData.jutsu;
                }
                if (typeof npcData.jutsu === 'string') {
                    return { 0: npcData.jutsu };
                }
                return { 0: 'Attack' };
            })(),
            activeCustomRoundJutsus: []
        };

        // --- Raid Boss Deidara Persistent HP Logic ---
        if (isRaidBoss && player2.name === 'Deidara') {
            const raidBossPath = path.resolve(__dirname, '../../menma/data/deidara_raid.json');
            let raidData = { currentHP: 5000000000 };
            try {
                if (fs.existsSync(raidBossPath)) {
                    raidData = JSON.parse(fs.readFileSync(raidBossPath, 'utf8'));
                } else {
                    fs.writeFileSync(raidBossPath, JSON.stringify(raidData, null, 2));
                }
            } catch (e) {
                console.error("Error loading Deidara raid HP:", e);
            }
            player2.health = 5000000000;
            player2.maxHealth = 5000000000;
            player2.currentHealth = raidData.currentHP;

            // Set stats as requested
            player2.power = 20000000;
            player2.defense = 20000000;
            player2.accuracy = 100;
            player2.dodge = 50;
        }
        // ...existing code...
        // ...existing code...
    } else {
        const player2User = await client.users.fetch(player2Id);
        const stored = users[player2Id] || {};

        // CRITICAL FIX: Use player2's actual stats from users.json
        player2 = {
            ...stored,
            userId: player2Id,
            name: stored.name || player2User.username,
            avatar: player2User.avatar,
            discriminator: stored.discriminator || player2User.discriminator,
            // Use player2's own stats (top-level or backup)
            health: Number(stored.health ?? stored.backup?.health) || 100,
            currentHealth: Number(stored.health ?? stored.backup?.health) || 100,
            maxHealth: Number(stored.health ?? stored.backup?.health) || 100,
            power: Number(stored.power ?? stored.backup?.power) || 10,
            defense: Number(stored.defense ?? stored.backup?.defense) || 10,
            accuracy: Number(stored.accuracy ?? stored.backup?.accuracy) || 80, // Base accuracy is 80
            dodge: Number(stored.dodge ?? stored.backup?.dodge) || 0, // Base dodge is 0
            chakra: Number(stored.chakra ?? stored.backup?.chakra) || 10,
            activeEffects: Array.isArray(stored.activeEffects) ? stored.activeEffects.slice() : [], // Initialize once
            jutsu: stored.jutsu || { 0: 'Attack' },
            comboState: stored.Combo && comboList[stored.Combo] ? { combo: comboList[stored.Combo], usedJutsus: new Set() } : null,
            level: (playersData[player2Id] && typeof playersData[player2Id].level === 'number') ? playersData[player2Id].level : (stored.level || 1),
            bloodline: stored.bloodline,
            // Prefer a real image URL only if provided in stored.image; otherwise keep image null and use avatar hash
            image: stored.image,
            id: player2Id, // Add id field for compatibility
            activeCustomRoundJutsus: [],
            roles: player2Member ? player2Member.roles.cache.map(r => r.id) : [],
            equippedAccessory: userAccessoryData[player2Id]?.equipped || null,
            accessoryInventory: userAccessoryData[player2Id]?.inventory || []
        };

        if (!player2.activeEffects) player2.activeEffects = [];

        // --- FRIENDLY MODE PRESET ---
        if (mode === 'friendly_preset') {
            const presetStats = {
                health: 15000,
                maxHealth: 15000,
                currentHealth: 15000,
                power: 15000,
                defense: 15000
            };
            Object.assign(player1, presetStats);
            Object.assign(player2, presetStats);
        }
        if (!player2.jutsu) player2.jutsu = { 0: 'Attack' };

    }
    // ...existing code...
    // --- BLOODLINE STATE ---
    const bloodlineState = {
        [player1.userId]: { active: false, roundsLeft: 0, used: false },
        [player2.userId]: { active: false, roundsLeft: 0, used: false }
    };

    // --- ROUND-BASED JUTSU STATE ---
    let player1ActiveJutsus = {};
    let player2ActiveJutsus = {};
    let player1RoundBasedSummaries = [];
    let player2RoundBasedSummaries = [];

    let roundNum = 0;
    let battleActive = true;
    let totalDamageDealt1 = 0;
    let totalDamageTaken1 = 0;
    let totalDamageDealt2 = 0;
    let totalDamageTaken2 = 0;

    let battleChannel = interaction.channel;
    let battleResult = null;
    // Register Battle
    if (interaction.id) {
        // Fix: Cleanup previous battles for this user in this channel
        // This ensures commands like /multiplayer grab the CURRENT battle, not a stale one.
        for (const [id, state] of activeBattles.entries()) {
            if (state.player1 && state.player1.userId === player1Id && state.channel && state.channel.id === interaction.channel.id) {
                if (state.collector && !state.collector.ended) {
                    try { state.collector.stop('replaced'); } catch (e) { }
                }
                activeBattles.delete(id);
            }
        }

        activeBattles.set(interaction.id, {
            player1,
            player2,
            battleType,
            channel: interaction.channel,
            collector: null,
            newPlayersQueue: []
        });
    }

    // Passive chakra regen at the start of each round
    try {
        while (battleActive) {
            // Check for new players joining
            if (interaction.id && activeBattles.has(interaction.id)) {
                const battleState = activeBattles.get(interaction.id);
                if (battleState.newPlayersQueue && battleState.newPlayersQueue.length > 0) {
                    const newUsers = battleState.newPlayersQueue;
                    battleState.newPlayersQueue = []; // Clear queue

                    for (const newUser of newUsers) {
                        // Check if already in
                        if (player1.subPlayers.find(p => p.userId === newUser.id)) continue;

                        // Fetch User Data
                        const memberData = users[newUser.id] || {};
                        const newPlayerData = {
                            ...memberData,
                            userId: newUser.id,
                            name: newUser.username,
                            avatar: newUser.avatar,
                            discriminator: newUser.discriminator,
                            health: Number(memberData.health) || 100,
                            currentHealth: Number(memberData.health) || 100,
                            maxHealth: Number(memberData.health) || 100,
                            power: Number(memberData.power) || 10,
                            defense: Number(memberData.defense) || 10,
                            chakra: Number(memberData.chakra) || 10,
                            activeEffects: [],
                            accuracy: 80,
                            dodge: 0,
                            jutsu: memberData.jutsu || {},
                            comboState: null,
                            level: (playersData[newUser.id] && playersData[newUser.id].level) || 1,
                            activeCustomRoundJutsus: [],
                            roles: []
                        };

                        player1.subPlayers.push(newPlayerData);

                        // Combined Stats Logic
                        player1.maxHealth = (player1.maxHealth || player1.health) + (newPlayerData.maxHealth || newPlayerData.health);
                        player1.health = (player1.health || 100) + (newPlayerData.health || 100);
                        player1.currentHealth = (player1.currentHealth || player1.health) + (newPlayerData.currentHealth || newPlayerData.health);
                        player1.power = (player1.power || 10) + (newPlayerData.power || 10);
                        player1.defense = (player1.defense || 10) + (newPlayerData.defense || 10);
                        player1.chakra = (player1.chakra || 10) + (newPlayerData.chakra || 10);

                        // Init bloodline state
                        bloodlineState[newUser.id] = { active: false, roundsLeft: 0, used: false };
                    }

                    await battleChannel.send({
                        embeds: [new EmbedBuilder().setDescription(`**${player1.name} has summoned their allies!**`).setColor('#006400')]
                    });
                }
            }





            player1.chakra = Math.min(player1.chakra + 2, 999);
            player2.chakra = Math.min(player2.chakra + 2, 999);

            // Use centralized processor so chakra_per_round / health_per_round / DoT / status messages are applied
            [player1, player2].forEach(entity => {
                const res = effectHandlers.processActiveEffects(entity);
                if (res.damage) {
                    if (!entity.izanamiImmortal) {
                        entity.currentHealth = (entity.currentHealth || 0) - res.damage;
                    } else {
                        // Damage already nullified in processActiveEffects but we can add a check here for safety
                    }
                }
                if (res.chakraDrain) {
                    entity.chakra = Math.max(0, (entity.chakra || 0) - res.chakraDrain);
                }
                // Append any special messages to round summaries
                const summaries = (res.specialEffects || []).map(s => ({ desc: s }));
                if (entity.userId === player1.userId) player1RoundBasedSummaries.push(...summaries);
                else player2RoundBasedSummaries.push(...summaries);

                // Handle Perfect Susanoo cooldown
                const psActiveIndex = (entity.activeEffects || []).findIndex(e => e.type === 'status' && e.status === 'Perfect Susanoo Active');
                if (psActiveIndex !== -1 && entity.activeEffects[psActiveIndex].duration <= 0) {
                    entity.activeEffects.splice(psActiveIndex, 1); // Remove active effect
                    entity.activeEffects.push({
                        type: 'status',
                        status: 'Perfect Susanoo Cooldown',
                        duration: 2, // 2 rounds cooldown
                        source: 'Perfect Susanoo'
                    });
                    if (entity.userId === player1.userId) player1RoundBasedSummaries.push({ desc: `${entity.name}'s Perfect Susanoo has ended and is now on cooldown!` });
                    else player2RoundBasedSummaries.push({ desc: `${entity.name}'s Perfect Susanoo has ended and is now on cooldown!` });
                }
            });

            // Role-based regeneration
            if (player1Member) applyRoleBuffs(player1, player1Member, player1RoundBasedSummaries);
            if (player2Member) applyRoleBuffs(player2, player2Member, player2RoundBasedSummaries);

            // Helper to check and apply revive if someone drops to zero
            const tryApplyRevive = (combatant) => {
                if (!combatant || (combatant.currentHealth || 0) > 0) return false;

                // --- IZANAMI LAST RESORT ---
                const hasIzanami = Object.values(combatant.jutsu || {}).some(j => j === 'Izanami');
                if (hasIzanami && !combatant.izanamiUsed && !combatant.hasRevivedThisBattle) {
                    combatant.currentHealth = 1;
                    effectHandlers.cleanse(combatant);
                    combatant.izanamiUsed = true;
                    combatant.hasRevivedThisBattle = true;

                    // Set life drainer mode
                    combatant.activeEffects = combatant.activeEffects || [];
                    combatant.activeEffects.push({
                        type: 'status',
                        status: 'Life Drainer Active',
                        replacesAttack: true,
                        replaceWith: 'Life Drainer',
                        duration: 999
                    });

                    return { type: 'izanami' };
                }

                // Check if player has already revived in this battle
                if (combatant.hasRevivedThisBattle) {
                    return false;
                }

                const idx = (combatant.activeEffects || []).findIndex(e => ((e.type === 'status' && e.status === 'revive') || e.type === 'revive'));
                if (idx === -1) return false;
                const effect = combatant.activeEffects[idx];
                // determine heal amount
                let healAmount = 0;
                try {
                    if (typeof effect.heal_amount === 'number') healAmount = effect.heal_amount;
                    else if (typeof effect.heal_amount === 'string' && effect.heal_amount.trim()) {
                        healAmount = Math.floor(math.evaluate(effect.heal_amount, {
                            user: combatant,
                            max: Math.max,
                            min: Math.min
                        }));
                    } else if (typeof effect.amount === 'number') healAmount = effect.amount;
                    else if (effect.revive_to_max_health) {
                        healAmount = Number(combatant.maxHealth || combatant.health || 100);
                    } else if (typeof effect.healPercent === 'number') {
                        // healPercent can be 1.0 for 100% or 100 for 100
                        const pct = effect.healPercent > 1 ? (effect.healPercent / 100) : effect.healPercent;
                        healAmount = Math.floor((combatant.maxHealth || combatant.health || 100) * (pct || 0));
                    }
                } catch (err) {
                    console.error('Revive heal formula error:', err);
                    healAmount = Number(effect.heal_amount) || Number(effect.amount) || 0;
                }
                if (healAmount <= 0) healAmount = Math.max(1, Math.floor((combatant.maxHealth || combatant.health || 100) * 0.25));
                combatant.currentHealth = Math.min(Number(combatant.maxHealth || combatant.health || 100), healAmount);

                // Set flag to prevent future revives in this battle
                combatant.hasRevivedThisBattle = true;

                // Remove or consume revive
                if (effect.once_per_battle) {
                    // mark consumed by removing effect
                    combatant.activeEffects.splice(idx, 1);
                } else {
                    // if duration exists we'll let normal duration decrement remove it later; otherwise remove
                    if (!effect.duration) combatant.activeEffects.splice(idx, 1);
                }
                return true;
            };
            // Attempt to revive if someone would otherwise die
            if (player1.currentHealth <= 0) {
                const revived = tryApplyRevive(player1);
                if (revived) {
                    if (revived.type === 'izanami') {
                        const izanamiRevive = new EmbedBuilder()
                            .setTitle('**IZANAMI: LAST RESORT**')
                            .setDescription(`${player1.name}'s death triggered Izanami! They return at 1 HP, cleansed of all ailments, and enter **LIFE DRAINER** mode!`)
                            .setColor(0x000000)
                            .setImage('https://media.tenor.com/_7iTq0Z3SjMAAAAM/itachi-izanami.gif');
                        await battleChannel.send({ embeds: [izanamiRevive] });
                    } else {
                        const reviveEmbed = new EmbedBuilder()
                            .setTitle('**NOT YET!**')
                            .setDescription(`${player1.name} was revived and returned to the battle!`)
                            .setColor(0xFF0000)
                            .setImage('https://media.tenor.com/6Z6Vn2K1C5kAAAAM/goku-transform.gif');
                        await battleChannel.send({ embeds: [reviveEmbed] });
                    }
                }
            }
            if (player2.currentHealth <= 0) {
                const revived = tryApplyRevive(player2);
                if (revived) {
                    if (revived.type === 'izanami') {
                        const izanamiRevive = new EmbedBuilder()
                            .setTitle('**IZANAMI: LAST RESORT**')
                            .setDescription(`${player2.name}'s death triggered Izanami! They return at 1 HP, cleansed of all ailments, and enter **LIFE DRAINER** mode!`)
                            .setColor(0x000000)
                            .setImage('https://media.tenor.com/_7iTq0Z3SjMAAAAM/itachi-izanami.gif');
                        await battleChannel.send({ embeds: [izanamiRevive] });
                    } else {
                        const reviveEmbed = new EmbedBuilder()
                            .setTitle('**NOT YET!**')
                            .setDescription(`${player2.name} was revived and returned to the battle!`)
                            .setColor(0xFF0000)
                            .setImage('https://media.tenor.com/6Z6Vn2K1C5kAAAAM/goku-transform.gif');
                        await battleChannel.send({ embeds: [reviveEmbed] });
                    }
                }
            }

            // ...existing code continues...
            player1.chakra = Math.min(player1.chakra + 2, 999);
            player2.chakra = Math.min(player2.chakra + 2, 999);
            // --- Apply and Update Effects (Buffs, Debuffs, Statuses) ---
            // Snapshot effects at round start to ensure simultaneous turn resolution
            // (Prevents P1's moves from incapacitating P2 in the same round)
            player1.roundStartEffects = JSON.parse(JSON.stringify(player1.activeEffects || []));
            player2.roundStartEffects = JSON.parse(JSON.stringify(player2.activeEffects || []));

            // Process recurring effects (Bleed, Poison, Burn, etc.)
            [player1, player2].forEach(p => {
                const effectResult = effectHandlers.processActiveEffects(p);
                if (effectResult.hasStunOrFlinch) {
                    p.roundStartEffects = p.roundStartEffects || [];
                    // Add a transient stun status to the snapshot so move-selection skips them
                    p.roundStartEffects.push({ type: 'status', status: 'stun', source: 'Active Status' });
                }
                if (effectResult.specialEffects.length > 0) {
                    const summaryArray = (p.userId === player1.userId) ? player1RoundBasedSummaries : player2RoundBasedSummaries;
                    effectResult.specialEffects.forEach(msg => {
                        summaryArray.push({ desc: msg });
                    });
                }
            });

            // --- Bloodline Logic ---
            for (const player of [player1, player2]) {
                const opponent = player.userId === player1.userId ? player2 : player1;
                const state = bloodlineState[player.userId];
                if (!player || !player.bloodline) continue;

                // Ensure state exists
                if (!state) bloodlineState[player.userId] = { active: false, roundsLeft: 0, used: false };

                // Passive effects (applied every round)
                switch (player.bloodline) {
                    // ...existing code...
                    case "Senju": {
                        // Passive: heals 1% of max HP each round (minimum 1)
                        const maxHp = Number(player.maxHealth || player.health || 100);
                        const healAmount = Math.max(1, Math.floor(maxHp * 0.01)); // 1% per round
                        player.currentHealth = (Number(player.currentHealth) || Number(player.health) || 0) + healAmount;
                        (player._roundMessages = player._roundMessages || []).push(`${player.name}'s Hyper Regeneration heals ${healAmount} HP (passive).`);
                        // Passive: 8% life-steal each round — drains 8% of opponent max HP and heals the user for same amount (min 1)
                        try {
                            const opponentMax = Number(opponent?.maxHealth || opponent?.health || 100);
                            const stealAmount = Math.max(1, Math.floor(opponentMax * 0.08)); // 8% of opponent max HP

                            // Apply drain to opponent and heal to player (clamped)
                            if (opponent) {
                                opponent.currentHealth = (opponent.currentHealth || opponent.health || 0) - stealAmount;
                            }
                            const maxHp = Number(player.maxHealth || player.health || 100);
                            player.currentHealth = Math.min(maxHp, (Number(player.currentHealth) || 0) + stealAmount);

                            (player._roundMessages = player._roundMessages || []).push(
                                `${player.name}'s Hyper Regeneration steals ${stealAmount} HP (${Math.round(8)}%) from ${opponent?.name || 'the foe'} and heals ${stealAmount} HP (passive).`
                            );
                            if (opponent) {
                                (opponent._roundMessages = opponent._roundMessages || []).push(
                                    `${opponent.name} lost ${stealAmount} HP to ${player.name}'s Hyper Regeneration.`
                                );
                            }
                        } catch (err) {
                            console.error('Error applying Senju passive lifesteal:', err);
                        }
                        break;
                    }

                    case "Uzumaki": {
                        // Passive: restores 10% of max HP each round
                        const maxHp = Number(player.maxHealth || player.health || 100);
                        const healAmount = Math.max(1, Math.floor(maxHp * 0.10));
                        player.currentHealth = Math.min(maxHp, (player.currentHealth || 0) + healAmount);
                        (player._roundMessages = player._roundMessages || []).push(`${player.name}'s Uzumaki Will restores ${healAmount} HP (passive).`);
                        break;
                    }
                    case "Hyuga": {
                        // Passive: steal up to 5 chakra from opponent each round
                        // NERF: Reduced from 5 to 3, then to 1
                        const steal = Math.min(1, Math.max(0, Number(opponent?.chakra || 0)));
                        if (steal > 0) {
                            opponent.chakra = Math.max(0, (opponent.chakra || 0) - steal);
                            player.chakra = Math.min(999, (player.chakra || 0) + steal);
                            (player._roundMessages = player._roundMessages || []).push(`${player.name}'s Byakugan passively drains ${steal} Chakra from ${opponent.name}.`);
                        }
                        break;
                    }
                    case "Uchiha": {
                        // Passive: increase dodge by 50% of base dodge, min +5 to be meaningful
                        const baseDodge = Number(player.dodge || 0);
                        const dodgeBonus = Math.max(5, Math.floor(baseDodge * 0.5));
                        player.activeEffects = player.activeEffects || [];
                        player.activeEffects.push({
                            type: 'buff',
                            stats: { dodge: dodgeBonus },
                            duration: 1,
                            source: 'bloodline_passive'
                        });
                        (player._roundMessages = player._roundMessages || []).push(`${player.name}'s Sharingan sharpens reflexes (passive +${dodgeBonus} dodge).`);
                        break;
                    }
                    case "Nara": {
                        // Passive: +3 chakra each round (kept from previous implementation)
                        player.chakra = Math.min(player.chakra + 3, 999);
                        (player._roundMessages = player._roundMessages || []).push(`${player.name}'s Battle IQ grants +3 Chakra (passive).`);
                        break;
                    }
                    default:
                        break;
                }

                // Decrement any active bloodline durations (for activation-mode bloodlines like Uchiha susanoo)
                if (state && state.active && typeof state.roundsLeft === 'number') {
                    state.roundsLeft--;
                    if (state.roundsLeft <= 0) {
                        state.active = false;
                        // If Uchiha susanoo wore off, remove susanoo effects (we stored them as activeEffects.source when applied)
                        player.activeEffects = (player.activeEffects || []).filter(e => e.source !== `${player.userId}-bloodline-awaken`);
                        (player._roundMessages = player._roundMessages || []).push(`${player.name}'s bloodline effect has ended.`);
                    }
                }
            }

            // Set canActivateBloodline flags for UI before showing move buttons (must be done for both players)
            player1.canActivateBloodline = bloodlineCanActivate(player1, bloodlineState[player1.userId], player2);
            player2.canActivateBloodline = bloodlineCanActivate(player2, bloodlineState[player2.userId], player1);

            // --- If there are any passive bloodline messages, display them now as a short embed ---
            const passiveMsgs = [];
            [player1, player2].forEach(p => {
                if (p._roundMessages && p._roundMessages.length) {
                    passiveMsgs.push(...p._roundMessages.map(m => `${m}`));
                    p._roundMessages = [];
                }
            });
            if (passiveMsgs.length > 0) {
                const passiveEmbed = new EmbedBuilder()
                    .setTitle('Bloodline Passives')
                    .setDescription(passiveMsgs.join('\n'))
                    .setColor(0x8B4513);
                await battleChannel.send({ embeds: [passiveEmbed] });
            }

            // --- Round-Based Jutsu Logic ---
            player1RoundBasedSummaries = [];
            player2RoundBasedSummaries = [];

            // Helper to get round-based description and apply effects
            const applyRoundBasedEffects = (activeJutsus, user, target, summariesArray) => {
                for (const jutsuName in activeJutsus) {
                    const data = activeJutsus[jutsuName];
                    const jutsu = jutsuList[jutsuName];
                    if (jutsu?.roundBased) {
                        const currentRound = data.round + 1; // Round number for the effect
                        let roundEffect = null;
                        for (const key of Object.keys(jutsu.roundEffects || {})) {
                            if (key.includes('-')) {
                                const [start, end] = key.split('-').map(Number);
                                if (currentRound >= start && currentRound <= end) {
                                    roundEffect = jutsu.roundEffects[key];
                                    break;
                                }
                            } else if (parseInt(key) === currentRound) {
                                roundEffect = jutsu.roundEffects[key];
                                break;
                            }
                        }

                        if (roundEffect) {
                            const effectiveUser = getEffectiveStats(user);
                            const effectiveTarget = getEffectiveStats(target);
                            let desc = roundEffect.description || "";
                            desc = desc
                                .replace(/undefined/g, user.name)
                                .replace(/\buser\b/gi, user.name)
                                .replace(/\btarget\b/gi, target.name);

                            // Collect effect values for summary
                            const effectSummary = [];
                            const dummyResult = { damage: 0, heal: 0, specialEffects: [] };

                            // Apply effects for this round of the active jutsu
                            let effectsToProcess = [];
                            if (Array.isArray(roundEffect.effects)) {
                                effectsToProcess = roundEffect.effects;
                            } else if (roundEffect.effects && typeof roundEffect.effects === 'object') {
                                effectsToProcess = [roundEffect.effects];
                            }

                            // Support for legacy keys
                            if (roundEffect.damage) effectsToProcess.push({ type: 'damage', ...roundEffect.damage });
                            if (roundEffect.heal) effectsToProcess.push({ type: 'heal', ...roundEffect.heal });
                            if (roundEffect.status) effectsToProcess.push({ type: 'status', status: roundEffect.status, duration: roundEffect.duration || 1 });
                            if (roundEffect.debuff) effectsToProcess.push({ type: 'debuff', stats: roundEffect.debuff.stats, duration: roundEffect.duration || 1 });
                            if (roundEffect.buff) effectsToProcess.push({ type: 'buff', stats: roundEffect.buff.stats, duration: roundEffect.duration || 1 });
                            if (roundEffect.chakra_gain) effectsToProcess.push({ type: 'chakra_gain', ...roundEffect.chakra_gain });

                            // Sort effects to ensure buffs/debuffs are applied BEFORE damage/heal
                            const sortedEffects = [...effectsToProcess].sort((a, b) => {
                                const pA = EFFECT_PRIORITY[a.type] ?? 5;
                                const pB = EFFECT_PRIORITY[b.type] ?? 5;
                                return pA - pB;
                            });

                            sortedEffects.forEach(effect => {
                                applyEffect(effect, user, target, effectiveUser, effectiveTarget, dummyResult, jutsuName, effectHandlers, true);
                            });

                            if (dummyResult.damage > 0) effectSummary.push({ type: 'damage', value: dummyResult.damage });
                            if (dummyResult.heal > 0) effectSummary.push({ type: 'heal', value: dummyResult.heal });
                            if (dummyResult.specialEffects) {
                                dummyResult.specialEffects.forEach(msg => {
                                    if (!msg.includes('damage') && !msg.includes('heal')) {
                                        effectSummary.push({ type: 'text', value: msg });
                                    }
                                });
                            }

                            summariesArray.push({ desc, effects: effectSummary });
                        }
                        activeJutsus[jutsuName].round++;
                        // Remove completed jutsu
                        const maxRound = Math.max(...Object.keys(jutsu.roundEffects || {}).map(k => {
                            const parts = k.split('-');
                            return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                        }));
                        if (data.round >= maxRound) {
                            delete activeJutsus[jutsuName];
                        }
                    }
                }
            };

            applyRoundBasedEffects(player1ActiveJutsus, player1, player2, player1RoundBasedSummaries);
            applyRoundBasedEffects(player2ActiveJutsus, player2, player1, player2RoundBasedSummaries);

            // --- CUSTOM ROUND-BASED JUTSU PROCESSING (for script-based jutsus) ---
            const processCustomRoundJutsus = (user, target, summariesArray) => {
                if (!user.activeCustomRoundJutsus || user.activeCustomRoundJutsus.length === 0) return;

                const customJutsusPath = path.join(__dirname, '../data/custom_jutsus');
                const toRemove = [];

                for (let i = 0; i < user.activeCustomRoundJutsus.length; i++) {
                    const customJutsu = user.activeCustomRoundJutsus[i];
                    customJutsu.currentRound = (customJutsu.currentRound || 1) + 1;

                    try {
                        const customScriptFile = path.join(customJutsusPath, customJutsu.scriptFile);
                        const customJutsuModule = require(customScriptFile);

                        if (typeof customJutsuModule.execute === 'function') {
                            const jutsu = jutsuList[customJutsu.name];
                            const effectiveUser = getEffectiveStats(user);
                            const effectiveTarget = getEffectiveStats(target);

                            const result = customJutsuModule.execute({
                                baseUser: user,
                                baseTarget: target,
                                effectiveUser,
                                effectiveTarget,
                                jutsuData: jutsu,
                                round: customJutsu.currentRound,
                                isFirstActivation: false,
                                jutsuList,
                                effectHandlers,
                                getEffectiveStats
                            });

                            // Enhanced Effect Processing for Custom Scripts
                            let effectsToProcess = [];
                            if (Array.isArray(result.effects)) {
                                effectsToProcess = result.effects;
                            } else {
                                // Fallback for script results without explicit effects array
                                if (result.damage) effectsToProcess.push({ type: 'damage', value: result.damage });
                                if (result.heal) effectsToProcess.push({ type: 'heal', value: result.heal });
                                if (result.stats) effectsToProcess.push({ type: result.isDebuff ? 'debuff' : 'buff', stats: result.stats, duration: result.duration || 1 });
                            }

                            // Sort effects
                            const sortedEffects = [...effectsToProcess].sort((a, b) => {
                                const pA = EFFECT_PRIORITY[a.type] ?? 5;
                                const pB = EFFECT_PRIORITY[b.type] ?? 5;
                                return pA - pB;
                            });

                            const dummyResult = { damage: 0, heal: 0, specialEffects: [] };
                            sortedEffects.forEach(effect => {
                                applyEffect(effect, user, target, effectiveUser, effectiveTarget, dummyResult, customJutsu.name, effectHandlers, true);
                            });

                            // Add to summaries
                            summariesArray.push({
                                desc: result.description || `${customJutsu.name} (Round ${customJutsu.currentRound})`,
                                effects: [
                                    ...(dummyResult.damage > 0 ? [{ type: 'damage', value: dummyResult.damage }] : []),
                                    ...(dummyResult.heal > 0 ? [{ type: 'heal', value: dummyResult.heal }] : []),
                                    ...(dummyResult.specialEffects || []).map(msg => ({ type: 'text', value: msg })),
                                    ...(result.specialEffects || []).filter(msg => !dummyResult.specialEffects.includes(msg)).map(msg => ({ type: 'text', value: msg }))
                                ]
                            });
                        }
                    } catch (err) {
                        console.error(`Error processing custom round jutsu ${customJutsu.name}:`, err);
                    }

                    // Check if jutsu should be removed
                    customJutsu.roundsLeft--;
                    if (customJutsu.roundsLeft <= 0) {
                        toRemove.push(i);
                    }
                }

                // Remove completed jutsus (in reverse to avoid index issues)
                for (let i = toRemove.length - 1; i >= 0; i--) {
                    user.activeCustomRoundJutsus.splice(toRemove[i], 1);
                }
            };

            processCustomRoundJutsus(player1, player2, player1RoundBasedSummaries);
            processCustomRoundJutsus(player2, player1, player2RoundBasedSummaries);

            // --- IZANAMI PHASE MANAGEMENT & INFINITY ---
            [player1, player2].forEach(p => {
                if (p.izanamiActive) {
                    p.izanamiRound++;
                    if (p.izanamiRound <= 3) {
                        p.izanamiPhase = "recording";
                        p.izanamiImmortal = true;
                        // Set health to a truly massive number to visually represent immortality
                        p.currentHealth = Math.max(p.currentHealth || 0, 999999999999999);
                        p.chakra = Math.max(p.chakra || 0, 999999999999999);

                        const opp = (p === player1) ? player2 : player1;
                        opp.izanamiImmortal = true;
                        opp.currentHealth = Math.max(opp.currentHealth || 0, 999999999999999);
                        opp.chakra = Math.max(opp.chakra || 0, 999999999999999);

                        const pSummaries = (p === player1) ? player1RoundBasedSummaries : player2RoundBasedSummaries;
                        pSummaries.push({ desc: "Izanami: Fate is being decided (Immortal Phase)" });
                    } else if (p.izanamiRound <= 6) {
                        p.izanamiPhase = "flow";
                        p.izanamiImmortal = false;
                        const opp = (p === player1) ? player2 : player1;
                        opp.izanamiImmortal = false;
                        const pSummaries = (p === player1) ? player1RoundBasedSummaries : player2RoundBasedSummaries;
                        pSummaries.push({ desc: "Izanami: The fate was already decided" });
                    } else {
                        p.izanamiActive = false;
                        p.izanamiPhase = "ended";
                        p.izanamiImmortal = false;
                        const opp = (p === player1) ? player2 : player1;
                        opp.izanamiImmortal = false;
                    }
                }
            });

            // --- Determine Custom Background for Battle Image ---
            let customBgUrl = null;
            const getActiveCustomBg = (activeJutsus) => {
                for (const jName in activeJutsus) {
                    const jutsu = jutsuList[jName];
                    if (jutsu?.custombackground && activeJutsus[jName].round >= jutsu.custombackground.round) {
                        return jutsu.custombackground.url;
                    }
                }
                return null;
            };
            const p1Bg = getActiveCustomBg(player1ActiveJutsus);
            const p2Bg = getActiveCustomBg(player2ActiveJutsus);
            customBgUrl = p1Bg || p2Bg; // Player 1's background takes precedence if both apply
            if (!customBgUrl && npcData?.background) {
                customBgUrl = npcData.background;
            }

            // Create and Send Moves Embed for P1
            // --- DEATH NOTE LOGIC (Player 1) ---
            if (!isPlayer2NPC && player1.subPlayers[0].equippedAccessory === "Death Note" && !player1.subPlayers[0].deathNoteUsed) {
                const user = player1.subPlayers[0];
                const opponent = player2;

                // Get opponent jutsus
                const oppJutsus = Object.values(opponent.jutsu || {})
                    .filter(j => j !== 'None' && j !== 'Attack'); // Cannot ban Attack or None

                if (oppJutsus.length > 0) {
                    const uniqueJutsus = [...new Set(oppJutsus)].slice(0, 25); // Limit to 25 for SelectMenu

                    if (uniqueJutsus.length > 0) {
                        const row = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`deathnote-${user.userId}-${roundNum}`)
                                .setPlaceholder('Write a name in the Death Note...')
                                .addOptions(uniqueJutsus.map(j => ({ label: j, value: j, description: `Bin ${j}` })))
                        );
                        const skipRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`deathnote_skip-${user.userId}-${roundNum}`)
                                .setLabel('Close Book')
                                .setStyle(ButtonStyle.Secondary)
                        );

                        const dnEmbed = new EmbedBuilder()
                            .setTitle('Death Note Activated')
                            .setDescription(`**${user.name}**, you have the Death Note equipped.\nSelect a jutsu from the list below to ban ${opponent.name} from using it for the rest of the battle.`)
                            .setColor('#000000')
                            .setThumbnail('https://i.postimg.cc/x83Wfbdy/image.png');

                        const dnMsg = await battleChannel.send({
                            content: `<@${user.userId}>`,
                            embeds: [dnEmbed],
                            components: [row, skipRow]
                        });

                        try {
                            const filter = i => i.user.id === user.userId && (i.customId.startsWith('deathnote') || i.customId.startsWith('deathnote_skip'));
                            const selection = await dnMsg.awaitMessageComponent({ filter, time: 30000 });

                            if (selection.isStringSelectMenu()) {
                                const bannedJutsu = selection.values[0];
                                opponent.bannedJutsus = opponent.bannedJutsus || [];
                                opponent.bannedJutsus.push(bannedJutsu);
                                user.deathNoteUsed = true;

                                await selection.reply({ content: `**${bannedJutsu}** has been written in the Death Note. ${opponent.name} can no longer use it!`, ephemeral: true });
                            } else {
                                await selection.deferUpdate();
                            }
                            await dnMsg.delete().catch(() => { });
                        } catch (e) {
                            await dnMsg.delete().catch(() => { });
                        }
                    }
                }
            }

            const mainPlayer = player1.subPlayers[0];
            const { embed: embed1, components: components1 } = createMovesEmbed(mainPlayer, roundNum);
            // Force color
            embed1.setColor('#006400');

            const moveMessage1 = await battleChannel.send({
                content: `<@${mainPlayer.userId}>`,
                embeds: [embed1],
                components: components1,
                fetchReply: true
            });

            // --- Generate and Send Battle Image Immediately ---
            // (Shared)
            const battleImagePath = await generateBattleImage(player1, player2, customBgUrl);
            const battleImage = new AttachmentBuilder(battleImagePath);
            await battleChannel.send({ files: [battleImage] });

            // --- Player 1 (or Team) Turn ---
            let player1Action = { damage: 0, heal: 0, specialEffects: [], description: "", hit: false };
            let teamActions = [];
            let multiplayerInterrupted = false;

            // Ensure subPlayers initialized (fallback)
            if (!player1.subPlayers) player1.subPlayers = [player1];

            // Sequential Move Collection Loop
            // We already sent P1's embed. We process P1 first, then others.

            for (let i = 0; i < player1.subPlayers.length; i++) {
                const subPlayer = player1.subPlayers[i];

                // If it's NOT P1 (i > 0), we need to send their embed now (AFTER battle image)
                let currentMessage;
                let currentComponents;

                if (i === 0) {
                    currentMessage = moveMessage1; // Already sent
                    currentComponents = components1;
                } else {
                    if (multiplayerInterrupted) break;
                    const { embed: embedSub, components: componentsSub } = createMovesEmbed(subPlayer, roundNum);
                    embedSub.setColor('#006400');
                    currentComponents = componentsSub;
                    currentMessage = await battleChannel.send({
                        content: `<@${subPlayer.userId}>`,
                        embeds: [embedSub],
                        components: componentsSub,
                        fetchReply: true
                    });
                }

                // Wait for action
                const subAction = await new Promise(resolve => {
                    const collector = currentMessage.createMessageComponentCollector({
                        filter: i => i.user.id === subPlayer.userId && i.customId.endsWith(`-${subPlayer.userId}-${roundNum}`),
                        time: 75000
                    });

                    // Save collector for external interruption
                    if (interaction.id && activeBattles.has(interaction.id)) {
                        activeBattles.get(interaction.id).collector = collector;
                    }

                    collector.on('collect', async i => {
                        try { await i.deferUpdate(); } catch (e) { }

                        if (i.customId.startsWith('awaken')) {
                            subPlayer.pendingBloodline = true;
                            try {
                                const disabledRows = currentComponents.map(row => {
                                    const r = ActionRowBuilder.from(row);
                                    r.components.forEach(c => {
                                        if (c.data.custom_id && c.data.custom_id.startsWith('awaken')) c.setDisabled(true);
                                    });
                                    return r;
                                });
                                await currentMessage.edit({ components: disabledRows }).catch(() => { });
                            } catch (e) { }
                            try { await i.followUp({ content: 'Awaken selected. Now choose a normal jutsu to use.', ephemeral: true }); } catch (e) { }
                            return;
                        }

                        if (i.customId.startsWith('move')) {
                            let jutsuName = getJutsuByButton(i.customId, subPlayer);
                            const jutsu = jutsuList[jutsuName];
                            // Calculate effective stats for THIS subplayer
                            const effectiveSub = getEffectiveStats(subPlayer);
                            const effectiveTarget = getEffectiveStats(player2);

                            // IZANAMI LOGIC
                            if (player1.izanamiActive || player2.izanamiActive) {
                                const activeOwner = player1.izanamiActive ? player1 : player2;
                                const isOwner = subPlayer.userId === activeOwner.userId;
                                const phase = activeOwner.izanamiPhase;

                                if (phase === "recording") {
                                    // Record move
                                    activeOwner.izanamiRecordedMoves[isOwner ? 'user' : 'target'].push(jutsuName);
                                    // Set result to "The Fate is Being Decided"
                                    resolve({
                                        damage: 0, heal: 0,
                                        description: "The Fate is Being Decided",
                                        specialEffects: [isOwner ? "User move recorded" : "Target move recorded"],
                                        hit: false, isStatusEffect: true, jutsuUsed: jutsuName
                                    });
                                    collector.stop();
                                    return;
                                } else if (phase === "flow") {
                                    if (!isOwner) {
                                        // Target forced to repeat
                                        const recordedIdx = activeOwner.izanamiRound - 4; // Flow starts after Round 3
                                        const expectedMove = activeOwner.izanamiRecordedMoves.target[recordedIdx];
                                        if (jutsuName !== expectedMove) {
                                            resolve({
                                                damage: 0, heal: 0,
                                                description: "You Cannot change fate.",
                                                specialEffects: ["Failed to repeat fate"],
                                                hit: false, isStatusEffect: true, jutsuUsed: jutsuName
                                            });
                                            collector.stop();
                                            return;
                                        }
                                    }
                                }
                            }

                            // Bloodline Activation Logic
                            if (subPlayer.pendingBloodline) {
                                const state = bloodlineState[subPlayer.userId];
                                const activationMsgs = applyBloodlineActivation(subPlayer, player2, state);

                                // Send Awaken Embed
                                try {
                                    const gif = BLOODLINE_GIFS[subPlayer.bloodline] || null;
                                    const title = `${subPlayer.name} awakens ${BLOODLINE_NAMES[subPlayer.bloodline] || subPlayer.bloodline}`;
                                    const desc = `${BLOODLINE_DEPARTMENTS[subPlayer.bloodline] || ''}\n\n${activationMsgs.join('\n')}`;
                                    const awakenEmbed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#006400');
                                    if (gif) awakenEmbed.setImage(gif);
                                    await battleChannel.send({ embeds: [awakenEmbed] }).catch(() => { });
                                } catch (e) { }

                                const result = executeJutsu(subPlayer, player2, effectiveSub, effectiveTarget, jutsuName);
                                result.specialEffects.unshift(...activationMsgs);
                                if (subPlayer.comboState && subPlayer.comboState.combo.requiredJutsus.includes(jutsuName)) {
                                    subPlayer.comboState.usedJutsus.add(jutsuName);
                                }
                                subPlayer.pendingBloodline = false;
                                resolve(result);
                                collector.stop();
                                return;
                            }

                            // Round-Based
                            if (jutsu?.roundBased && !player1ActiveJutsus[jutsuName]) {
                                // TODO: activeJutsus is currently shared. This is simplified.
                                const result = executeJutsu(subPlayer, player2, effectiveSub, effectiveTarget, jutsuName, 1, true);
                                if (!result.hit && result.specialEffects?.includes("Not enough chakra!")) {
                                    resolve(result);
                                    collector.stop();
                                    return;
                                }
                                player1ActiveJutsus[jutsuName] = { round: 1 }; // Shared tracking for now
                                resolve(result);
                                collector.stop();
                                return;
                            }

                            const result = executeJutsu(subPlayer, player2, effectiveSub, effectiveTarget, jutsuName);
                            if (subPlayer.comboState && subPlayer.comboState.combo.requiredJutsus.includes(jutsuName)) {
                                subPlayer.comboState.usedJutsus.add(jutsuName);
                            }

                            // Stun check (using current active effects for instant application)
                            const statusEffect = (subPlayer.activeEffects || []).find(e =>
                                e.type === 'status' && ['stun', 'flinch', 'drown', 'possessed', 'shadow_possession'].includes(e.status)
                            );
                            if (statusEffect && !['World Cutting Slash', 'Banana Killer'].includes(jutsuName)) {
                                resolve({
                                    damage: 0, heal: 0,
                                    description: `${subPlayer.name} is ${statusEffect.status} and can't move!`,
                                    specialEffects: [statusEffect.status.toUpperCase() + " active"],
                                    hit: false, isStatusEffect: true, jutsuUsed: null
                                });
                                collector.stop();
                                return;
                            }
                            resolve(result);
                            collector.stop();

                        } else {
                            // Inventory, etc.
                            try {
                                resolve(await processPlayerMove(i.customId, subPlayer));
                            } catch (err) {
                                resolve({ damage: 0, heal: 0, description: "Error processing move.", hit: false });
                            }
                            collector.stop();
                        }
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'multiplayer_joined') {
                            resolve({ interrupted: true });
                        }
                        if (reason === 'time') {
                            resolve({
                                damage: 0, heal: 0,
                                description: `${subPlayer.name} missed their chance!`,
                                specialEffects: ["Missed opportunity!"],
                                hit: false, fled: true, isRest: true
                            });
                        }
                        if (subPlayer.pendingBloodline) delete subPlayer.pendingBloodline;
                        currentMessage.edit({ components: [] }).catch(() => { });
                    });
                });

                if (subAction && subAction.interrupted) {
                    multiplayerInterrupted = true;
                    break;
                }
                if (subAction && subAction.fled) {
                }

                // --- IZANAMI AUTO-REPEAT LOGIC (Consolidated) ---
                if (player1.izanamiActive || player2.izanamiActive) {
                    const activeOwner = player1.izanamiActive ? player1 : player2;
                    if (activeOwner.userId === subPlayer.userId && activeOwner.izanamiPhase === "flow") {
                        const recordedIdx = activeOwner.izanamiRound - 4;
                        const repeatedMove = activeOwner.izanamiRecordedMoves.user[recordedIdx];
                        if (repeatedMove) {
                            const effectiveSub = getEffectiveStats(subPlayer);
                            const effectiveTarget = getEffectiveStats(player2);
                            const repeatedResult = executeJutsu(subPlayer, player2, effectiveSub, effectiveTarget, repeatedMove);
                            subAction.damage = (subAction.damage || 0) + (repeatedResult.damage || 0);
                            subAction.heal = (subAction.heal || 0) + (repeatedResult.heal || 0);
                            subAction.description = (subAction.description || "") + `\n**Izanami Repeat:** ${repeatedResult.description}`;
                            subAction.specialEffects = (subAction.specialEffects || []).concat(repeatedResult.specialEffects || []);
                        }
                    }
                }

                // --- NEW: Decrement duration AFTER acting ---
                const wornOffMsgs = effectHandlers.checkDurationAndRemove(subPlayer);
                if (wornOffMsgs && wornOffMsgs.length > 0) {
                    // We can add these to the action's special effects or just log them
                    subAction.specialEffects = (subAction.specialEffects || []).concat(wornOffMsgs);
                }

                teamActions.push(subAction);

                // Short delay between players?
                if (i < player1.subPlayers.length - 1) {
                    // If there are next players, maybe small delay
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (multiplayerInterrupted) {
                continue; // Break the 'while (battleActive)' loop's current iteration, restarting it (re-drawing image etc)
            }

            // Aggregate
            for (const act of teamActions) {
                if (act.fled && !player1Action.fled) {
                    player1Action.fled = true; // One flees, battle ends? Or just that player leaves? 
                    // Current engine ends battle on flee.
                }
                player1Action.damage += (act.damage || 0);
                player1Action.heal += (act.heal || 0);
                if (act.specialEffects) player1Action.specialEffects.push(...act.specialEffects);
                player1Action.description += (player1Action.description ? "\n" : "") + (act.description || "");
                if (act.hit) player1Action.hit = true;
                if (act.isCrit) player1Action.isCrit = true;
                if (act.jutsuUsed) player1Action.jutsuUsed = act.jutsuUsed; // Just take the last one
            }

            // Check for Flee
            if (player1Action.fled) {
                battleActive = false;
                await handleFlee(battleChannel, player1, player2, users, roundNum, {
                    winnerDealt: totalDamageDealt2,
                    winnerTaken: totalDamageTaken2,
                    loserDealt: totalDamageDealt1,
                    loserTaken: totalDamageTaken1
                }, battleType, isPlayer2NPC, client);
                return { winner: player2, loser: player1 };
            }

            // --- Player 2's Turn (NPC or Player) ---
            let player2Action;
            if (isPlayer2NPC) {
                // --- BOSS ENRAGE LOGIC ---
                if (isRaidBoss && player2.currentHealth < (player2.maxHealth * 0.75) && !player2.enraged) {
                    player2.enraged = true;
                    player2.activeEffects = player2.activeEffects || [];
                    player2.activeEffects.push({ type: 'buff', stats: { power: Math.floor(player2.power * 0.5) }, duration: 99, source: 'Enrage' });
                    try { await battleChannel.send(`⚠️ **${player2.name} IS ENRAGED!** Power increased massively!`); } catch (e) { }
                }
                const effective1 = getEffectiveStats(player1);
                const effective2 = getEffectiveStats(player2);
                player2Action = npcChooseMove(player2, player1, effective2, effective1, roundNum + 1);
                if (player2Action.isRoundActivation && player2Action.jutsuUsed) {
                    player2ActiveJutsus[player2Action.jutsuUsed] = { round: 1 };
                }

            } else {
                let displayPlayer2 = { ...player2 };

                // --- DEATH NOTE LOGIC (Player 2) ---
                if (player2.equippedAccessory === "Death Note" && !player2.deathNoteUsed) {
                    const user = player2;
                    const opponent = player1;

                    // Get opponent jutsus (from main player 1)
                    const oppJutsus = Object.values(opponent.jutsu || {})
                        .filter(j => j !== 'None' && j !== 'Attack');

                    if (oppJutsus.length > 0) {
                        const uniqueJutsus = [...new Set(oppJutsus)].slice(0, 25);

                        if (uniqueJutsus.length > 0) {
                            const row = new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`deathnote-${user.userId}-${roundNum}`)
                                    .setPlaceholder('Write a name in the Death Note...')
                                    .addOptions(uniqueJutsus.map(j => ({ label: j, value: j, description: `Ban ${j}` })))
                            );
                            const skipRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`deathnote_skip-${user.userId}-${roundNum}`)
                                    .setLabel('Close Book')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                            const dnEmbed = new EmbedBuilder()
                                .setTitle('Death Note Activated')
                                .setDescription(`**${user.name}**, you have the Death Note equipped.\nSelect a jutsu from the list below to ban ${opponent.name} from using it for the rest of the battle.`)
                                .setColor('#000000')
                                .setThumbnail('https://i.postimg.cc/x83Wfbdy/image.png');

                            const dnMsg = await battleChannel.send({
                                content: `<@${user.userId}>`,
                                embeds: [dnEmbed],
                                components: [row, skipRow]
                            });

                            try {
                                const filter = i => i.user.id === user.userId && (i.customId.startsWith('deathnote') || i.customId.startsWith('deathnote_skip'));
                                const selection = await dnMsg.awaitMessageComponent({ filter, time: 30000 });

                                if (selection.isStringSelectMenu()) {
                                    const bannedJutsu = selection.values[0];
                                    opponent.bannedJutsus = opponent.bannedJutsus || [];
                                    opponent.bannedJutsus.push(bannedJutsu);
                                    user.deathNoteUsed = true;

                                    await selection.reply({ content: `**${bannedJutsu}** has been written in the Death Note. ${opponent.name} can no longer use it!`, ephemeral: true });
                                } else {
                                    await selection.deferUpdate();
                                }
                                await dnMsg.delete().catch(() => { });
                            } catch (e) {
                                await dnMsg.delete().catch(() => { });
                            }
                        }
                    }
                }
                const { embed: embed2, components: components2 } = createMovesEmbed(displayPlayer2, roundNum);
                const moveMessage2 = await battleChannel.send({
                    content: `<@${player2.userId}>`,
                    embeds: [embed2],
                    components: components2,
                    fetchReply: true
                });

                player2Action = await new Promise(resolve => {
                    const collector = moveMessage2.createMessageComponentCollector({
                        filter: i => i.user.id === player2.userId && i.customId.endsWith(`-${player2.userId}-${roundNum}`),
                        time: 75000 // 1 minute 15 seconds
                    });

                    collector.on('collect', async i => {
                        try {
                            await i.deferUpdate();
                        } catch (err) {
                            console.error("Error in deferUpdate (player2):", err);
                            try {
                                await i.reply({ content: "Your action could not be processed (expired interaction).", ephemeral: true });
                            } catch (e) { }
                        }

                        // --- Awaken handling for player2 ---
                        if (i.customId.startsWith('awaken')) {
                            player2.pendingBloodline = true;
                            try {
                                const disabledRows = components2.map(row => {
                                    const r = ActionRowBuilder.from(row);
                                    r.components.forEach(c => {
                                        if (c.data.custom_id && c.data.custom_id.startsWith('awaken')) c.setDisabled(true);
                                    });
                                    return r;
                                });
                                await moveMessage2.edit({ components: disabledRows }).catch(() => { });
                            } catch (e) { }
                            try { await i.followUp({ content: 'Awaken selected. Now choose a normal jutsu to use with your bloodline activation.', ephemeral: true }); } catch (e) { }
                            return;
                        }

                        if (i.customId.startsWith('move')) {
                            // Read the selected jutsu from the displayPlayer (may be possessor's jutsus if possessed)
                            const jutsuName = getJutsuByButton(i.customId, displayPlayer2);
                            const jutsu = jutsuList[jutsuName];
                            const effective1 = getEffectiveStats(player1);
                            const effective2 = getEffectiveStats(player2);

                            // If player2 had activated Awaken previously, apply activation now
                            if (player2.pendingBloodline) {
                                const state = bloodlineState[player2.userId];
                                const activationMsgs = applyBloodlineActivation(player2, player1, state);
                                try {
                                    const gif = BLOODLINE_GIFS[player2.bloodline] || null;
                                    const title = `${player2.name} awakens ${BLOODLINE_NAMES[player2.bloodline] || player2.bloodline}`;
                                    const desc = `${BLOODLINE_DEPARTMENTS[player2.bloodline] || ''}\n\n${activationMsgs.join('\n')}`;
                                    const awakenEmbed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x8B0000);
                                    if (gif) awakenEmbed.setImage(gif);
                                    await battleChannel.send({ embeds: [awakenEmbed] }).catch(() => { });
                                } catch (e) { console.error('Failed to send awaken embed (player2):', e); }
                                const result = executeJutsu(player2, player1, effective2, effective1, jutsuName);
                                result.specialEffects.unshift(...activationMsgs);
                                if (player2.comboState && player2.comboState.combo.requiredJutsus.includes(jutsuName)) {
                                    player2.comboState.usedJutsus.add(jutsuName);
                                }
                                player2.pendingBloodline = false;
                                resolve(result);
                                collector.stop();
                                return;
                            }

                            // Handle round-based jutsu activation (first cast)
                            if (jutsu?.roundBased && !player2ActiveJutsus[jutsuName]) {
                                const result = executeJutsu(player2, player1, effective2, effective1, jutsuName, 1, true);
                                if (!result.hit && result.specialEffects?.includes("Not enough chakra!")) {
                                    resolve(result); // Resolve with chakra error
                                    collector.stop();
                                    return;
                                }
                                player2ActiveJutsus[jutsuName] = { round: 1 };
                                resolve(result);
                                collector.stop();
                                return;
                            }
                            const result = executeJutsu(player2, player1, effective2, effective1, jutsuName);
                            if (player2.comboState && player2.comboState.combo.requiredJutsus.includes(jutsuName)) {
                                player2.comboState.usedJutsus.add(jutsuName);
                            }
                            // Check for status effects on player2 (stun/flinch/drown) - USE CURRENT ACTIVE EFFECTS
                            const statusEffect = (player2.activeEffects || []).find(e =>
                                e.type === 'status' && ['stun', 'flinch', 'drown', 'possessed', 'shadow_possession'].includes(e.status)
                            );


                            // If player2 is incapacitated by a status, prevent their action
                            if (statusEffect && !['World Cutting Slash', 'Banana Killer'].includes(jutsuName)) {
                                resolve({
                                    damage: 0,
                                    heal: 0,
                                    description: `${player2.name} is ${statusEffect.status} and can't move!`,
                                    specialEffects: [statusEffect.status.toUpperCase() + " active"],
                                    hit: false,
                                    isStatusEffect: true,
                                    jutsuUsed: null
                                });
                                collector.stop();
                                return;
                            }
                            resolve(result);
                        } else {
                            try {
                                resolve(await processPlayerMove(i.customId, player2));
                            } catch (err) {
                                console.error("Error processing player move (player2):", err);
                                resolve({ damage: 0, heal: 0, description: "Error processing move.", hit: false });
                            }
                        }
                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: `${player2.name} did not make a move.`,
                                specialEffects: ["Missed opportunity!"],
                                hit: false,
                                fled: true,
                                isRest: true
                            });
                        }
                        if (player2.pendingBloodline) delete player2.pendingBloodline;
                        moveMessage2.edit({
                            components: components2.map(row => {
                                const disabledRow = ActionRowBuilder.from(row);
                                disabledRow.components.forEach(c => c.setDisabled(true));
                                return disabledRow;
                            })
                        }).catch(() => { });
                    });
                });

                if (player2Action.fled) {
                    battleActive = false;
                    await handleFlee(battleChannel, player2, player1, users, roundNum, {
                        winnerDealt: totalDamageDealt1,
                        winnerTaken: totalDamageTaken1,
                        loserDealt: totalDamageDealt2,
                        loserTaken: totalDamageTaken2
                    }, battleType, false, client); // isPlayer2NPC is always false here
                    return { winner: player1, loser: player2 };
                }
            }

            // --- POCKET WATCH MECHANIC GLOBAL ---
            let replayActive = false;
            const watchInteractions = [
                { attacker: player2, defender: player1, action: player2Action, attackerId: player2Id, defenderId: player1Id },
                { attacker: player1, defender: player2, action: player1Action, attackerId: player1Id, defenderId: player2Id }
            ];

            for (const entry of watchInteractions) {
                const hasWatch = entry.defender.equippedAccessory === "Pocket Watch" || (entry.defender.accessoryInventory && entry.defender.accessoryInventory.includes("Pocket Watch"));
                // Trigger only if attacker uses Izanami and hasn't been blocked before
                if (entry.action && entry.action.jutsuUsed === "Izanami" && hasWatch && !entry.attacker.izanamiDisabled) {
                    const glowEmbed = new EmbedBuilder()
                        .setTitle("The Watch starts to glow..")
                        .setImage("https://i.postimg.cc/nzVBnbX7/image.png")
                        .setColor("#FFFF00");
                    const interactButton = new ButtonBuilder()
                        .setCustomId(`pocketwatch_interact-${entry.defenderId}-${roundNum}`)
                        .setLabel("Interact")
                        .setStyle(ButtonStyle.Primary);
                    const row = new ActionRowBuilder().addComponents(interactButton);

                    const glowMsg = await battleChannel.send({ embeds: [glowEmbed], components: [row] });

                    try {
                        const interactionFilter = i => i.user.id === entry.defenderId && i.customId.startsWith('pocketwatch_interact');
                        const interactResponse = await glowMsg.awaitMessageComponent({ filter: interactionFilter, time: 30000 });

                        await interactResponse.deferUpdate();

                        const replayEmbed = new EmbedBuilder()
                            .setTitle("REPLAY!")
                            .setImage("https://news.mit.edu/sites/default/files/images/202207/MIT-TimeReversal-01-press_0.gif")
                            .setColor("#0000FF");
                        await battleChannel.send({ embeds: [replayEmbed] });

                        // Handle Boss Case vs General cases
                        if (entry.attacker.name.includes("Itachi") && npcTemplate) {
                            // Special death for Itachi Boss
                            entry.attacker.currentHealth = 0;
                            entry.action.description = "Time has been reverted! Itachi is defeated!";
                        } else {
                            // Standard Replay and Lockout
                            entry.attacker.izanamiDisabled = true;
                            entry.attacker.izanamiUsed = true; // Mark as used so it can't be used again
                            replayActive = true;
                            entry.action.description = "Time has been reverted! Izanami was cancelled!";
                        }

                        // Neutralize Izanami state completely
                        entry.attacker.izanamiActive = false;
                        entry.attacker.izanamiPhase = "ended";
                        entry.attacker.izanamiRound = 0;
                        player1.izanamiImmortal = false;
                        player2.izanamiImmortal = false;

                        // Nullify action
                        entry.action.damage = 0;
                        entry.action.heal = 0;
                        entry.action.hit = false;
                        entry.action.specialEffects = (entry.action.specialEffects || []).concat(["POCKET WATCH ACTIVATED", "REPLAY!"]);

                        await glowMsg.edit({ components: [] }).catch(() => { });
                    } catch (e) {
                        await glowMsg.edit({ components: [] }).catch(() => { });
                    }
                }
            }

            if (replayActive) {
                // Round restarted: skip damage applications and repeat loop with same roundNum
                // We don't increment roundNum at the bottom if we continue here
                continue;
            }

            // --- NEW: Decrement P2 duration AFTER acting ---
            const p2WornOffMsgs = effectHandlers.checkDurationAndRemove(player2);
            if (p2WornOffMsgs && p2WornOffMsgs.length > 0) {
                player2Action.specialEffects = (player2Action.specialEffects || []).concat(p2WornOffMsgs);
            }

            // --- Apply Player Actions and Update Health/Chakra ---
            // Apply damage with reflection checks

            // --- NEW: Banana Killer Forced Backflip Logic ---
            // If someone used Banana Killer, the opponent's action is nullified and forced into a backflip.
            if (player1.forceBackflip) {
                player1Action = {
                    damage: 0,
                    heal: 0,
                    description: `${player1.name} does a backflip`,
                    specialEffects: ["Banana'd!", "Backflip forced!"],
                    hit: false,
                    isStatusEffect: true,
                    jutsuUsed: null
                };
                delete player1.forceBackflip;
            }
            if (player2.forceBackflip) {
                player2Action = {
                    damage: 0,
                    heal: 0,
                    description: `${player2.name} does a backflip`,
                    specialEffects: ["Banana'd!", "Backflip forced!"],
                    hit: false,
                    isStatusEffect: true,
                    jutsuUsed: null
                };
                delete player2.forceBackflip;
            }

            // --- RAIDERS TOWER LOGIC (Delegated to script) ---
            const raidersTowerProcess = async (attacker, defender, action) => {
                const scriptPath = path.join(customJutsusPath, 'raiders_tower.js');
                if (fs.existsSync(scriptPath)) {
                    try {
                        const raidersTower = require(scriptPath);
                        raidersTower.execute({
                            baseUser: attacker,
                            baseTarget: defender,
                            action: action,
                            roundNum: roundNum,
                            type: 'process'
                        });
                        // The script modifies action and attacker directly
                        // No need for embeds - it shows in round summary via action.description
                    } catch (err) {
                        console.error("Error in Raiders Tower processing:", err);
                    }
                }
            };

            await raidersTowerProcess(player1, player2, player1Action);
            await raidersTowerProcess(player2, player1, player2Action);

            if (isRaidBoss) {
                // Anti-Kori Weakness Check: If Fireball is used against King Kori, skip his turn (he melts)
                if (player2.name === 'King Kori' && player1Action.jutsuUsed === 'Fireball Jutsu') {
                    // Skip boss attack
                    if (player1.currentHealth > 0) {
                        applyDamageWithReflection(player1, player2, player1Action.damage || 0, player1Action);
                    }
                } else {
                    // Boss attacks first!
                    applyDamageWithReflection(player2, player1, player2Action.damage || 0, player2Action);
                    // If player survives, they attack back
                    if (player1.currentHealth > 0) {
                        applyDamageWithReflection(player1, player2, player1Action.damage || 0, player1Action);
                    }
                }
            } else {
                // Normal speed tie / Simultaneous
                applyDamageWithReflection(player1, player2, player1Action.damage || 0, player1Action);
                applyDamageWithReflection(player2, player1, player2Action.damage || 0, player2Action);
            }

            // Apply healing after damage (healing is not reflected)
            player1.currentHealth = Math.min(player1.currentHealth + (player1Action.heal || 0), player1.maxHealth);
            player2.currentHealth = Math.min(player2.currentHealth + (player2Action.heal || 0), player2.health);
            // Immediately attempt to apply revive if a jutsu dropped someone to 0 during the round
            try {
                if (player1.currentHealth <= 0) {
                    const revived = tryApplyRevive(player1);
                    if (revived) {
                        const reviveEmbed = new EmbedBuilder()
                            .setTitle('**NOT YET!**')
                            .setDescription(`${player1.name} was revived and returned to the battle!`)
                            .setColor(0xFF0000)
                            .setImage('https://media.tenor.com/6Z6Vn2K1C5kAAAAM/goku-transform.gif');
                        await battleChannel.send({ embeds: [reviveEmbed] });
                        // ensure health clamps to max
                        player1.currentHealth = Math.min(player1.currentHealth, Number(player1.maxHealth || player1.health || 100));
                    }
                }
                if (player2.currentHealth <= 0) {
                    const revived = tryApplyRevive(player2);
                    if (revived) {
                        const reviveEmbed = new EmbedBuilder()
                            .setTitle('**NOT YET!**')
                            .setDescription(`${player2.name} was revived and returned to the battle!`)
                            .setColor(0xFF0000)
                            .setImage('https://media.tenor.com/6Z6Vn2K1C5kAAAAM/goku-transform.gif');
                        await battleChannel.send({ embeds: [reviveEmbed] });
                        player2.currentHealth = Math.min(player2.currentHealth, Number(player2.maxHealth || player2.health || 100));
                    }
                }
            } catch (err) {
                console.error('Error while applying immediate revive after actions:', err);
            }

            // --- Adaptation Nullification Embed ---
            if (player1Action.adaptationEmbed || (player2Action && player2Action.adaptationEmbed)) {
                const adaptationEmbed = new EmbedBuilder()
                    .setDescription("**With a final spin, there is no escape**")
                    .setImage("https://www.icegif.com/wp-content/uploads/2024/01/icegif-406.gif")
                    .setColor("Orange");

                await battleChannel.send({ embeds: [adaptationEmbed] });
            }

            // --- Combo Logic ---
            let comboCompleted1 = false, comboDamageText1 = "";
            if (player1.comboState && player1.comboState.combo.requiredJutsus.every(jutsu => player1.comboState.usedJutsus.has(jutsu))) {
                const combo = player1.comboState.combo;
                let comboResult = {
                    damage: combo.damage || 0,
                    heal: 0,
                    specialEffects: [],
                    hit: true
                };

                if (combo.effects && Array.isArray(combo.effects)) {
                    combo.effects.forEach(effect => {
                        switch (effect.type) {
                            case 'damage':
                                comboResult.damage += effect.value || 0;
                                comboResult.specialEffects.push(`Dealt ${effect.value || 0} damage`);
                                break;
                            case 'heal':
                                const healAmount = effectHandlers.heal(player1, effect.formula || "0");
                                comboResult.heal += healAmount;
                                comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                                break;
                            case 'status':
                                if (!player2.activeEffects) player2.activeEffects = [];
                                player2.activeEffects.push({
                                    type: 'status',
                                    status: effect.status,
                                    duration: effect.duration || 1
                                });
                                comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                break;
                            case 'debuff':
                                const debuffChanges = effectHandlers.debuff(player2, effect.stats);
                                if (!player2.activeEffects) player2.activeEffects = [];
                                player2.activeEffects.push({
                                    type: 'debuff',
                                    stats: debuffChanges,
                                    duration: effect.duration || 1
                                });
                                comboResult.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;
                        }
                    });
                }

                comboResult.comboUsed = combo.name;
                applyDamageWithReflection(player1, player2, comboResult.damage || 0, comboResult);

                if (comboResult.heal) {
                    player1.currentHealth = Math.min(player1.currentHealth + comboResult.heal, player1.maxHealth);
                }
                comboCompleted1 = true;
                comboDamageText1 = `\n${player1.name} lands a **${combo.name}**! ${comboResult.specialEffects.join(' ')}`;
                if (comboResult.reflectedDamageMessage) comboDamageText1 += `\n${comboResult.reflectedDamageMessage}`;
                player1.comboState.usedJutsus.clear(); // Reset combo progress
                totalDamageDealt1 += comboResult.damage || 0;
            }

            let comboCompleted2 = false, comboDamageText2 = "";
            if (!isPlayer2NPC && player2.comboState && player2.comboState.combo.requiredJutsus.every(jutsu => player2.comboState.usedJutsus.has(jutsu))) {
                const combo = player2.comboState.combo;
                let comboResult = {
                    damage: combo.damage || 0,
                    heal: 0,
                    specialEffects: [],
                    hit: true
                };

                if (combo.effects && Array.isArray(combo.effects)) {
                    combo.effects.forEach(effect => {
                        switch (effect.type) {
                            case 'damage':
                                comboResult.damage += effect.value || 0;
                                comboResult.specialEffects.push(`Dealt ${effect.value || 0} damage`);
                                break;
                            case 'heal':
                                const healAmount = effectHandlers.heal(player2, effect.formula || "0");
                                comboResult.heal += healAmount;
                                comboResult.specialEffects.push(`Healed ${healAmount} HP`);
                                break;
                            case 'status':
                                if (!player1.activeEffects) player1.activeEffects = [];
                                player1.activeEffects.push({
                                    type: 'status',
                                    status: effect.status,
                                    duration: effect.duration || 1
                                });
                                comboResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                break;
                            case 'debuff':
                                const debuffChanges = effectHandlers.debuff(player1, effect.stats);
                                if (!player1.activeEffects) player1.activeEffects = [];
                                player1.activeEffects.push({
                                    type: 'debuff',
                                    stats: debuffChanges,
                                    duration: effect.duration || 1
                                });
                                comboResult.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')} for ${effect.duration || 1} turns`);
                                break;
                        }
                    });
                }

                comboResult.comboUsed = combo.name;
                applyDamageWithReflection(player2, player1, comboResult.damage || 0, comboResult);

                if (comboResult.heal) {
                    player2.currentHealth = Math.min(player2.currentHealth + comboResult.heal, player2.maxHealth);
                }
                comboCompleted2 = true;
                comboDamageText2 = `\n${player2.name} lands a **${combo.name}**! ${comboResult.specialEffects.join(' ')}`;
                if (comboResult.reflectedDamageMessage) comboDamageText2 += `\n${comboResult.reflectedDamageMessage}`;
                player2.comboState.usedJutsus.clear(); // Reset combo progress
                totalDamageDealt2 += comboResult.damage || 0;
            }

            // --- Global Round Summary ---
            roundNum++;
            const summaryEmbed = createBattleSummary(
                player1Action, player2Action, player1, player2, roundNum,
                comboCompleted1, comboDamageText1, comboCompleted2, comboDamageText2,
                player1RoundBasedSummaries, player2RoundBasedSummaries
            );
            await battleChannel.send({ embeds: [summaryEmbed] });

            // --- Save Raid Boss HP after each round ---
            if (isRaidBoss && player2.name === 'Deidara') {
                const raidBossPath = path.resolve(__dirname, '../../menma/data/deidara_raid.json');
                try {
                    const raidData = { currentHP: Math.max(0, player2.currentHealth) };
                    fs.writeFileSync(raidBossPath, JSON.stringify(raidData, null, 2));
                } catch (e) {
                    console.error("Error saving Deidara raid HP:", e);
                }
            }

            if (player1.currentHealth <= 0 || player2.currentHealth <= 0) {
                battleActive = false;
                let winner = null;
                let loser = null;

                if (player1.currentHealth > 0 && player2.currentHealth <= 0) {
                    winner = player1;
                    loser = player2;
                } else if (player2.currentHealth > 0 && player1.currentHealth <= 0) {
                    winner = player2;
                    loser = player1;
                }

                if (winner) {
                    // ... (existing reward logic) ...
                    // Ensure only host gets rewards. subPlayers are ignored.
                    if (winner.userId !== player1.userId && player1.subPlayers && player1.subPlayers.find(sp => sp.userId === winner.userId)) {
                        // If for some reason a subplayer is marked as winner (unlikely with shared health logic), revert to host.
                        winner = player1;
                    }

                    let bountyReward = 0;
                    try {
                        const anbuPath = path.resolve(__dirname, '../data/anbu.json');
                        const akatsukiPath = path.resolve(__dirname, '../data/akatsuki.json');
                        const bountyPath = path.resolve(__dirname, '../data/bounty.json');

                        if (fs.existsSync(anbuPath) && fs.existsSync(akatsukiPath) && fs.existsSync(bountyPath)) {
                            const anbuData = JSON.parse(fs.readFileSync(anbuPath, 'utf8'));
                            const akatsukiData = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));

                            if (anbuData.members && akatsukiData.members &&
                                anbuData.members[winner.userId] && akatsukiData.members[loser.userId]) {
                                const bountyData = JSON.parse(fs.readFileSync(bountyPath, 'utf8'));
                                const loserBounty = bountyData[loser.userId] ? bountyData[loser.userId].bounty : 0;

                                if (loserBounty > 0 && mode !== 'friendly_preset' && battleType !== 'practice') {
                                    bountyReward = loserBounty;
                                    if (!anbuData.members[winner.userId] || typeof anbuData.members[winner.userId] !== 'object') {
                                        anbuData.members[winner.userId] = {};
                                    }
                                    anbuData.members[winner.userId].honor = (anbuData.members[winner.userId].honor || 0) + bountyReward;

                                    if (bountyData[loser.userId]) {
                                        bountyData[loser.userId].bounty = 0;
                                    }

                                    fs.writeFileSync(anbuPath, JSON.stringify(anbuData, null, 4));
                                    fs.writeFileSync(bountyPath, JSON.stringify(bountyData, null, 4));
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Error processing bounty reward:", e);
                    }

                    const winnerEmbed = new EmbedBuilder()
                        .setTitle('Battle Over!')
                        .setDescription(`${winner.name} is victorious!`)
                        .setColor('#006400');

                    if (bountyReward > 0) {
                        winnerEmbed.addFields({ name: 'Bounty Claimed', value: `${winner.name} has claimed a bounty of ${bountyReward} and converted it to Honor!` });
                    }

                    if (battleType !== 'arank' && battleType !== 'brank' && battleType !== 'trials') {
                        await battleChannel.send({ embeds: [winnerEmbed] });
                    }

                    if (mode === 'challenger') {
                        const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
                        const giftData = fs.existsSync(giftPath) ? JSON.parse(fs.readFileSync(giftPath, 'utf8')) : {};

                        if (!giftData[winner.userId]) {
                            giftData[winner.userId] = [];
                        }

                        giftData[winner.userId].push('elo');
                        fs.writeFileSync(giftPath, JSON.stringify(giftData, null, 2));

                        await battleChannel.send(`${winner.name} has received 1 elo for winning the challenger match!`);
                    }
                } else {
                    await battleChannel.send(`It's a draw!`);
                }

                if (battleType === 'trials' || battleType === 'otsutsuki' || battleType === 'akatsuki_trial') {
                    if (winner && winner.userId === player1.userId) {
                        return { winner: player1, loser: player2 };
                    } else if (winner && winner.userId === player2.userId) {
                        return { winner: player2, loser: player1 };
                    } else {
                        return { winner: null, loser: null };
                    }
                }

                if (users[player1Id]) {
                    users[player1Id].eightGatesLevel = 0;
                }
                if (users[player2Id] && !isPlayer2NPC) {
                    users[player2Id].eightGatesLevel = 0;
                }

                if (winner && winner.userId === player1.userId) {
                    // Raid/Mission progression removed (handled in event.js / travel.js now)
                }
                return { winner, loser };
            }
        }
    } finally {
        if (interaction.id) activeBattles.delete(interaction.id);
    }
}

/**
 * NPC AI for choosing a move.
 * @param {object} baseNpc - The NPC object.
 * @param {object} basePlayer - The player object.
 * @param {object} effectiveNpc - The NPC's effective stats.
 * @param {object} effectivePlayer - The player's effective stats.
 * @returns {object} The chosen action result.
 */
function npcChooseMove(baseNpc, basePlayer, effectiveNpc, effectivePlayer, currentRound = 1) {
    // Check for stun/flinch/other status effects that prevent action - USE SNAPSHOT
    const statusEffect = (baseNpc.roundStartEffects || baseNpc.activeEffects || []).find(e =>
        e.type === 'status' && ['stun', 'flinch', 'drown'].includes(e.status)
    );
    if (statusEffect) {
        let statusMsg = "";
        switch (statusEffect.status) {
            case 'stun':
                statusMsg = `${baseNpc.name} is stunned and can't move!`;
                break;
            case 'flinch':
                statusMsg = `${baseNpc.name} flinched and couldn't act!`;
                break;
            case 'drown':
                statusMsg = `${baseNpc.name} is drowning and can't act!`;
                break;
            default:
                statusMsg = `${baseNpc.name} is confused!`;
        }
        // Mark the action as a status effect for summary display
        return {
            damage: 0,
            heal: 0,
            description: statusMsg,
            specialEffects: [statusEffect.status.charAt(0).toUpperCase() + statusEffect.status.slice(1) + " active"],
            hit: false,
            opponentIsStunned: true,
            isStatusEffect: true, // <-- Add this flag for summary
            jutsuUsed: null // So summary doesn't try to look up a jutsu
        };
    }


    // Urashiki Specific Logic: Sequence for first 3 rounds
    if (baseNpc.name === "Urashiki Otsutsuki" && currentRound <= 3) {
        let sequenceJutsu = null;
        if (currentRound === 1) sequenceJutsu = "Chakra tool creation";
        else if (currentRound === 2) sequenceJutsu = "Urashiki jutsu steal";
        else if (currentRound === 3) sequenceJutsu = "Palace of the dragon king";

        if (sequenceJutsu && jutsuList[sequenceJutsu]) {
            const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, sequenceJutsu);
            result.jutsuUsed = sequenceJutsu;
            return result;
        }
    }


    let originalAccuracy = baseNpc.accuracy;
    let flyingRaijinIdx = (basePlayer.activeEffects || []).findIndex(e => e.type === 'status' && e.status === 'flying_raijin');
    let usedFlyingRaijin = false;
    if (flyingRaijinIdx !== -1) {
        baseNpc.accuracy = 0;
        usedFlyingRaijin = true;
    }


    let npcJutsuArr = [];
    if (Array.isArray(baseNpc.jutsu)) {
        npcJutsuArr = baseNpc.jutsu;
    } else if (typeof baseNpc.jutsu === "object" && baseNpc.jutsu !== null) {
        npcJutsuArr = Object.values(baseNpc.jutsu);
    }

    // Filter available jutsu based on chakra and Izanami restriction
    const availableJutsuNames = npcJutsuArr.filter(jName => {
        const jutsu = jutsuList[jName];
        if (jName === "Izanami" && (baseNpc.izanamiUsed || baseNpc.izanamiDisabled)) return false;
        return jutsu && (jutsu.chakraCost || 0) <= (baseNpc.chakra || 0);
    });

    if (availableJutsuNames.length === 0) {
        baseNpc.chakra = Math.min((baseNpc.chakra || 0) + 1, 15);
        return {
            damage: 0,
            heal: 0,
            description: `${baseNpc.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }

    // Pick a random jutsu from available
    const randomJutsuName = availableJutsuNames[Math.floor(Math.random() * availableJutsuNames.length)];
    // Use executeJutsu just like for users
    const result = executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsuName);

    // Restore accuracy after attack if Flying Raijin was used
    if (usedFlyingRaijin) {
        baseNpc.accuracy = originalAccuracy;
        // Remove the flying_raijin status so it only works for one attack
        (basePlayer.activeEffects || []).splice(flyingRaijinIdx, 1);
    }

    result.jutsuUsed = randomJutsuName;
    return result;
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('mission')
        .setDescription('All battle commands combined'),
    runBattle,
    activeBattles,
    getEffectiveStats,
    npcChooseMove,
    comboList,
    getCooldownString,
    // Minimal execute handler required by bot.js loader
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true }).catch(() => { });
        await interaction.editReply({
            content: 'Mission command loaded. This command requires implementation of execute() to parse options and call runBattle().'
        }).catch(() => { });
    }
};