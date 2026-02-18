module.exports = {
    // Combos Shop
    shopItems: {
        "basic combo": {
            name: "Basic Combo",
            description: "Attack + Transformation Jutsu",
            effect: "Creates an \"Empowered Attack\" that deals 25 True Damage.",
            price: 0,
            currency: "money",
            requirements: ["attack", "transformation"]
        },
        "intermediate combo": {
            name: "Intermediate Combo",
            description: "Analysis + Transformation Jutsu + Rasengan",
            effect: "Deals 500 true damage, stuns for 1 round, and applies bleed.",
            price: 15000,
            currency: "money",
            requirements: ["analysis", "transformation", "rasengan"]
        },
        "dance of the shadows": {
            name: "Dance of the Shadows",
            description: "Shadow Clone Jutsu + Rasenshuriken + Sexy Jutsu",
            effect: "Deals 4000 true damage and applies bleed for 3 turns.",
            price: 250,
            currency: "ss",
            requirements: ["Shadow Clone Jutsu", "Rasenshuriken", "Sexy Jutsu"]
        },
        "serpent's corruption": {
            name: "Serpent's Corruption",
            description: "Serpents Wrath + Transformation Jutsu + Mystic Palm",
            effect: "Deals 10000 true damage and applies poison for 4 turns.",
            price: 500,
            currency: "ss",
            requirements: ["Serpents Wrath", "Transformation Jutsu", "Mystic Palm"]
        },
        "wind and fire": {
            name: "Wind and Fire",
            description: "Rasenshuriken + Burning Ash + Fireball Jutsu",
            effect: "Deals 15000 true damage, applies burn for 3 turns and bleed for 2 turns.",
            price: 50000000,
            currency: "money",
            requirements: ["Rasenshuriken", "Burning Ash", "Fireball Jutsu"]
        },
        "flash of the leaf": {
            name: "Flash of the Leaf",
            description: "Flying Raijin Jutsu + Lightning Blade: All Out + Rasengan",
            effect: "Deals 20000 true damage and stuns for 1 turn.",
            price: 100000000,
            currency: "money",
            requirements: ["Flying Raijin Jutsu", "Lightning Blade: All Out", "Rasengan"]
        },
        "legendary sannin": {
            name: "Legendary Sannin",
            description: "Creation Rebirth + Serpents Wrath + Shadow Clone Jutsu",
            effect: "Deals 2500 true damage, applies poison for 3 turns, and heals user for 20% HP.",
            price: 300,
            currency: "ss",
            requirements: ["Creation Rebirth", "Serpents Wrath", "Shadow Clone Jutsu"]
        }
    },

    // Shinobi Shards Shop (Premium)
    premiumItems: [
        {
            id: "donator",
            name: "Donator",
            display: "Donator Gamepass",
            description: "Unlocks the exclusive Donator role.",
            price: 100,
            roleId: "1385640728130097182",
            duration: 30 * 24 * 60 * 60 * 1000, // 1 month
            type: 'role'
        },
        {
            id: "legendary ninja",
            name: "Legendary Ninja",
            display: "Legendary Ninja",
            description: "Grants the Legendary Ninja role.",
            price: 200,
            roleId: "1385640798581952714",
            duration: 30 * 24 * 60 * 60 * 1000,
            type: 'role'
        },
        {
            id: "jinchuriki",
            name: "Jinchuriki",
            display: "Jinchuriki",
            description: "Become a Jinchuriki and receive the Jinchuriki role.",
            price: 500,
            roleId: "1385641469507010640",
            duration: 30 * 24 * 60 * 60 * 1000,
            type: 'role'
        },
        {
            id: "custom jutsu",
            name: "Custom Jutsu",
            display: "Custom Jutsu",
            description: "Create your own custom jutsu! (3 effects)",
            price: 1000,
            type: 'custom_jutsu'
        },
        {
            id: "auto frank 3h",
            name: "Auto-Frank (3 Hours)",
            display: "Auto-Frank (3 Hours)",
            description: "Automatically run F-rank missions for 3 hours. Grants 21,600 base EXP. \n To buy: use 'auto frank 3h'",
            price: 600,
            type: 'autofrank',
            durationKey: '3h'
        },
        {
            id: "auto frank 6h",
            name: "Auto-Frank (6 Hours)",
            display: "Auto-Frank (6 Hours)",
            description: "Automatically run F-rank missions for 6 hours. Grants 43,200 base EXP. \n To buy: use 'auto frank 6h'",
            price: 1400,
            type: 'autofrank',
            durationKey: '6h'
        },
        {
            id: "auto frank 12h",
            name: "Auto-Frank (12 Hours)",
            display: "Auto-Frank (12 Hours)",
            description: "Automatically run F-rank missions for 12 hours. Grants 86,400 base EXP. \n To buy: use 'auto frank 12h'",
            price: 2000,
            type: 'autofrank',
            durationKey: '12h'
        },
        {
            id: "death note",
            name: "Death Note",
            display: "Death Note",
            description: "A notebook that kills anyone whose name is written inside.",
            price: 2500,
            type: 'accessory'
        }
    ],

    // Jutsu Shop (Money) - Fixed the missing items in buy.js
    jutsuShopItems: {
        "human boulder": {
            name: "Human Boulder",
            description: "Transforms into a massive boulder and rolls over target.",
            price: 10000,
            key: "Human Boulder"
        },
        "puppet kazekage": {
            name: "Puppet Kazekage",
            description: "Summons a puppet to attack target. Stays until death.",
            price: 100000,
            key: "Puppet Kazekage"
        }
    },

    // Event Shop (Ay Tokens)
    eventShopItems: {
        "ramen bowl": {
            name: "Ramen Bowl",
            description: "A delicious bowl of ramen. Restores health or stashes for later.",
            price: 1,
            key: "Ramen Bowl",
            type: "ramen"
        },
        "ice prison": {
            name: "Ice Prison",
            description: "Jutsu: Trap your opponent in a prison of ice.",
            price: 50,
            key: "Ice Prison",
            type: "jutsu"
        },
        "crystal palace": {
            name: "Crystal Palace",
            description: "Ultimate Ice Jutsu. Ignores x Defense.",
            price: 500,
            key: "Crystal Palace",
            type: "jutsu"
        },
        "profile theme: frost": {
            name: "Profile Theme: Frost",
            description: "Unlocks the 'Frost' profile theme. Auto-equipped on purchase.",
            price: 600,
            key: "theme_frost",
            type: "theme"
        },
        "twin rising dragons": {
            name: "Twin Rising Dragons",
            description: "Powerful Ninja Tool barrage.",
            price: 150,
            key: "Twin Rising Dragons",
            type: "jutsu"
        },
        "primary lotus": {
            name: "Primary Lotus",
            description: "Taijutsu combo.",
            price: 150,
            key: "Primary Lotus",
            type: "jutsu"
        }
    },

    // Miscellaneous Shop (Shinobi Shards)
    miscShopItems: {
        "stat refund": {
            name: "Stat Refund",
            description: "Refunds all your invested stat points, allowing you to reallocate them.",
            price: 500,
            key: "stat_refund"
        }
    }
};
