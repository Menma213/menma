module.exports = {
    name: "Asura's Blade of Execution",
    call: `"I'll exterminate all of you celestial dog scum from this planet using my true power! I am above everyone! This blade will be your deathbed! Scream in terror as I, Ashura the Evil God, kill you all!"`,
    description: "The user fills the air with a killing intent, summoning their most destructive attack. Their power is amplified beyond mortal limits, annihilating everything in their way.",
    effect: (user, opponent) => {
        // Calculate stat boosts
        let chakraBoost = user.chakra * user.defense * user.attack * opponent.defense;
        let damageMultiplier = 10 * (Math.floor(user.chakra / 2)); 
        let returnDamage = opponent.damageTaken * 50;

        // Apply buffs
        user.chakra += chakraBoost;
        user.health = Math.max(user.health, 1); // Health cannot drop below 0
        user.dodge = 100;
        user.accuracy = 100;
        user.defense += user.attack * user.defense * opponent.attack * opponent.defense;
        user.attack += user.attack * user.defense * opponent.attack * opponent.defense;
        user.health += user.attack * user.defense * opponent.attack * opponent.defense;
        
        // Shield effect: Absorb all damage and heal received damage
        user.shield = Infinity;
        user.heal(user.damageTaken);

        // Nullify all negative effects
        user.statusImmunity = true;
        user.effectImmunity = true;
        user.trapImmunity = true;

        // Force opponent into curse mark
        opponent.forceCurseMark = true;

        // Directly hitting the opponent, ignoring all resistances
        let finalDamage = damageMultiplier;
        opponent.takeDamage(finalDamage);

        // Return absorbed damage with a 50x multiplier
        if (returnDamage > 0) {
            opponent.takeDamage(returnDamage);
        }

        // 80% OHKO chance
        if (Math.random() < 0.8) {
            opponent.health = 0;
        }

        return `${user.name} unleashes *Asura's Blade of Execution*, nullifying all defenses and overwhelming ${opponent.name} with god-like power!`;
    }
};
