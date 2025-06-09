const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

// War configuration
const WAR_CONFIG = {
    cooldown: 30 * 1000, // 30 seconds for testing (6 hours in production: 6 * 60 * 60 * 1000)
    nukeLevels: {
        1: { damage: 100 },
        2: { damage: 250 },
        3: { damage: 500 },
        4: { damage: 1000 },
        5: { damage: 2000 },
        6: { damage: 3000 },
        7: { damage: 4000 },
        8: { damage: 6000 },
        9: { damage: 8000 },
        10: { damage: 10000 }
    },
    fixedStats: {
        health: 10000,
        chakra: 10,
        power: 2500,
        defense: 2500
    },
    jinchurikiStats: {
        health: 100000,
        power: 10000,
        defense: 10000
    }
};

// Emoji constants
const EMOJIS = {
    buff: "<:buff:1364946947055816856>",
    debuff: "<:debuff:1368242212374188062>",
    stun: "<:stun:1368243608695738399>",
    heal: "<:heal:1368243632045297766>",
    bleed: "<:bleed:1368243924346605608>",
    flinch: "<:flinch:1368243647711023124>",
    curse: "<:curse:1368243540978827294>",
    status: "<:status:1368243589498540092>"
};

// Combo system
const COMBOS = {
    "Basic Combo": {
        name: "Basic Combo",
        requiredJutsus: ["Attack", "Transformation Jutsu"],
        resultMove: {
            name: "Empowered Attack",
            damage: 10000,
            damageType: "true"
        }
    }
};

// Combo emoji constants
const COMBO_EMOJI_FILLED = "⭕";
const COMBO_EMOJI_EMPTY = "⚪";

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
    
    // Add Jinchuriki specific jutsus if not already defined
    if (!jutsuList["Tailed Beast Bomb"]) {
        jutsuList["Tailed Beast Bomb"] = {
            name: "Tailed Beast Bomb",
            description: "launches a massive ball of concentrated chakra",
            chakraCost: 5,
            effects: [
                {
                    type: "damage",
                    formula: "user.power * 0.8"
                }
            ]
        };
    }
    
    if (!jutsuList["Demon Cloak"]) {
        jutsuList["Demon Cloak"] = {
            name: "Demon Cloak",
            description: "activates Demon Cloak, increasing power",
            chakraCost: 3,
            effects: [
                {
                    type: "buff",
                    stats: {
                        power: "user.power * 0.2"
                    },
                    duration: 3
                }
            ]
        };
    }
}

// Effect handlers
const effectHandlers = {
    damage: (user, target, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0
                }
            };
            
            const hitChance = Math.max(0, Math.min(100, context.user.accuracy - context.target.dodge));
            const hits = Math.random() * 100 <= hitChance;
            
            if (!hits) {
                return { damage: 0, hit: false };
            }
            
            const damage = Math.max(0, Math.floor(math.evaluate(formula, context)));
            return { damage, hit: true };
        } catch (err) {
            console.error(`Damage formula error: ${formula}`, err);
            return { damage: 0, hit: false };
        }
    },

    buff: (user, statsDefinition) => {
        const changes = {};
        const context = {
            user: {
                power: Number(user.power) || 0,
                defense: Number(user.defense) || 0,
                health: Number(user.health) || 0,
                chakra: Number(user.chakra) || 0,
                accuracy: Number(user.accuracy) || 100
            }
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                changes[stat] = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : Math.floor(math.evaluate(formulaOrValue, context));
            } catch (err) {
                console.error(`Buff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    debuff: (target, statsDefinition) => {
        const changes = {};
        const context = {
            target: {
                power: Number(target.power) || 0,
                defense: Number(target.defense) || 1,
                health: Number(target.health) || 0,
                chakra: Number(target.chakra) || 0,
                accuracy: Number(target.accuracy) || 100,
                dodge: Number(target.dodge) || 0
            }
        };

        for (const [stat, formulaOrValue] of Object.entries(statsDefinition)) {
            try {
                const value = typeof formulaOrValue === 'number' 
                    ? formulaOrValue 
                    : math.evaluate(formulaOrValue, context);
                changes[stat] = value < 0 ? value : -Math.abs(value);
            } catch (err) {
                console.error(`Debuff formula error for ${stat}: ${formulaOrValue}`, err);
                changes[stat] = 0;
            }
        }
        return changes;
    },

    heal: (user, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0
                }
            };
            return Math.max(0, Math.floor(math.evaluate(formula, context)));
        } catch (err) {
            console.error(`Heal formula error: ${formula}`, err);
            return 0;
        }
    },

    instantKill: (chance) => Math.random() < chance,
    status: (chance) => Math.random() < (chance || 1)
};

// Utility functions
function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

// Main war command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('war')
        .setDescription('Akatsuki war commands')
        .addSubcommand(subcommand =>
            subcommand.setName('target')
                .setDescription('Set the Jinchuriki target')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The Jinchuriki to target')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('weapon')
                .setDescription('Set the nuclear chakra bomb level')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The weapon level (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)))
        .addSubcommand(subcommand =>
            subcommand.setName('start')
                .setDescription('Start the war (Akatsuki leader only)'))
        .addSubcommand(subcommand =>
            subcommand.setName('send')
                .setDescription('Send a fighter to battle')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to send')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('status')
                .setDescription('Check the current war status'))
        .addSubcommand(subcommand =>
            subcommand.setName('villagebank')
                .setDescription('Manage the village bank')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Add or distribute funds')
                        .setRequired(true)
                        .addChoices(
                            { name: 'add', value: 'add' },
                            { name: 'distribute', value: 'distribute' }
                        ))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to add (only for add action)'))),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Load data files
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const village = fs.existsSync(villagePath) ? JSON.parse(fs.readFileSync(villagePath, 'utf8')) : { turrets: {} };
        let akatsuki = fs.existsSync(akatsukiPath) ? JSON.parse(fs.readFileSync(akatsukiPath, 'utf8')) : { bombs: {} };

        if (!users[userId]) {
            return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
        }

        // Check if user is Akatsuki leader
        const isAkatsukiLeader =interaction.member.roles.cache.has('1371076470369288223');
        const isHokage = interaction.member.roles.cache.has('1349278752944947240'); // Hokage role ID

        // Handle subcommands
        switch (subcommand) {
            case 'target':
                return handleTarget(interaction, users, akatsuki, isAkatsukiLeader);
            case 'weapon':
                return handleWeapon(interaction, akatsuki, isAkatsukiLeader);
            case 'start':
                return handleStart(interaction, users, village, akatsuki, isAkatsukiLeader);
            case 'send':
                return handleSend(interaction, users, akatsuki, isAkatsukiLeader, isHokage);
            case 'status':
                return handleStatus(interaction, akatsuki, users);
            case 'villagebank':
                return handleVillageBank(interaction, users, village, isHokage);
            default:
                return interaction.followUp({ content: "Invalid subcommand!", ephemeral: true });
        }
    }
};

// Handle target subcommand
async function handleTarget(interaction, users, akatsuki, isAkatsukiLeader) {
    if (!isAkatsukiLeader) {
        return interaction.followUp({ content: "Only the Akatsuki leader can set the target!", ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetId = targetUser.id;
    
    // Check if target is a Jinchuriki
    if (!users[targetId] || users[targetId].perks !== "Jinchuriki") {
        return interaction.followUp({ content: "The target must be a Jinchuriki!", ephemeral: true });
    }
    
    // Update Akatsuki target
    akatsuki.target = {
        username: targetUser.username,
        id: targetId,
        avatar: targetUser.displayAvatarURL({ format: 'png', size: 256 })
    };
    
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    // Notify spies
    const spyMessage = `The Akatsuki are now targeting ${targetUser.username}!`;
    // You would need to implement logic to send this to spies
    
    return interaction.followUp({ 
        content: `Target set to ${targetUser.username}. The spies have been notified.`,
        ephemeral: true 
    });
}

// Handle weapon subcommand
async function handleWeapon(interaction, akatsuki, isAkatsukiLeader) {
    if (!isAkatsukiLeader) {
        return interaction.followUp({ content: "Only the Akatsuki leader can set the weapon level!", ephemeral: true });
    }
    
    const level = interaction.options.getInteger('level');
    akatsuki.weaponLevel = level;
    akatsuki.weaponDamage = WAR_CONFIG.nukeLevels[level].damage;
    
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    return interaction.followUp({ 
        content: `Nuclear Chakra Bomb level set to ${level} (Damage: ${akatsuki.weaponDamage}).`,
        ephemeral: true 
    });
}

// Handle start subcommand
async function handleStart(interaction, users, village, akatsuki, isAkatsukiLeader) {
    // Check permissions and requirements
    if (!isAkatsukiLeader) {
        return interaction.followUp({ content: "Only the Akatsuki leader can start a war!", ephemeral: true });
    }
    
    if (interaction.channelId !== "WAR_CHANNEL_ID") { // Replace with actual channel ID
        return interaction.followUp({ content: "War can only be started in the war channel!", ephemeral: true });
    }
    
    if (!akatsuki.target) {
        return interaction.followUp({ content: "You must set a target first with /war target!", ephemeral: true });
    }
    
    if (!akatsuki.weaponLevel) {
        return interaction.followUp({ content: "You must set a weapon level first with /war weapon!", ephemeral: true });
    }
    
    // Check if war is already active
    if (akatsuki.warActive) {
        return interaction.followUp({ content: "There is already an active war!", ephemeral: true });
    }
    
    // Set war as active and start cooldown
    akatsuki.warActive = true;
    akatsuki.warStartTime = Date.now() + WAR_CONFIG.cooldown;
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    // Send initial war message
    const embed = new EmbedBuilder()
        .setTitle("War Declaration")
        .setDescription(`The Akatsuki have declared war on the village! The attack will commence in ${getCooldownString(WAR_CONFIG.cooldown)}.`)
        .addFields(
            { name: "Target", value: akatsuki.target.username, inline: true },
            { name: "Weapon Level", value: akatsuki.weaponLevel.toString(), inline: true },
            { name: "Estimated Damage", value: akatsuki.weaponDamage.toString(), inline: true }
        )
        .setColor('#ff0000');
    
    await interaction.followUp({ embeds: [embed] });
    
    // Set timeout for actual war start
    setTimeout(async () => {
        await startActualWar(interaction, users, village, akatsuki);
    }, WAR_CONFIG.cooldown);
}

// Handle send subcommand
async function handleSend(interaction, users, akatsuki, isAkatsukiLeader, isHokage) {
    const targetUser = interaction.options.getUser('user');
    const targetId = targetUser.id;
    const userId = interaction.user.id;
    
    // Check if war is active
    if (!akatsuki.warActive || !akatsuki.battlePhase) {
        return interaction.followUp({ content: "There is no ongoing war to send fighters to!", ephemeral: true });
    }
    
    // Check if user is Akatsuki leader or Hokage
    if (!isHokage && !isAkatsukiLeader) {
        return interaction.followUp({ content: "Only the Hokage or Akatsuki leader can send fighters!", ephemeral: true });
    }
    
    // Check if target is on the right side
    const targetIsAkatsuki = users[targetId]?.occupation === "Akatsuki";
    const targetIsVillage = !targetIsAkatsuki && (
        users[targetId]?.role === "Right Hand Man" || 
        users[targetId]?.role === "Guard" || 
        users[targetId]?.role === "Spy"
    );
    
    if (!targetIsAkatsuki && !targetIsVillage) {
        return interaction.followUp({ content: "The target must be an Akatsuki member or a village defender!", ephemeral: true });
    }
    
    if ((isHokage && targetIsAkatsuki) || (isAkatsukiLeader && targetIsVillage)) {
        return interaction.followUp({ content: "You can't send enemy fighters to battle!", ephemeral: true });
    }
    
    // Add fighter to the battle
    if (!akatsuki.battleFighters) akatsuki.battleFighters = { akatsuki: [], village: [] };
    
    if (targetIsAkatsuki) {
        if (akatsuki.battleFighters.akatsuki.includes(targetId)) {
            return interaction.followUp({ content: "This fighter has already been sent!", ephemeral: true });
        }
        akatsuki.battleFighters.akatsuki.push(targetId);
    } else {
        if (akatsuki.battleFighters.village.includes(targetId)) {
            return interaction.followUp({ content: "This fighter has already been sent!", ephemeral: true });
        }
        akatsuki.battleFighters.village.push(targetId);
    }
    
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    // Announce the fighter
    const side = targetIsAkatsuki ? "Akatsuki" : "Village";
    await interaction.followUp({ 
        content: `The ${side} has sent ${targetUser.username} for the battle!` 
    });
    
    // Check if we can start a battle (both sides have fighters)
    if (akatsuki.battleFighters.akatsuki.length > 0 && akatsuki.battleFighters.village.length > 0) {
        await startBattle(interaction, users, akatsuki);
    }
}

// Handle status subcommand
async function handleStatus(interaction, akatsuki, users) {
    const embed = new EmbedBuilder()
        .setTitle("War Status")
        .setColor('#ff0000')
        .setThumbnail('https://example.com/war_image.png'); // Replace with actual image
    
    // Basic status
    const status = akatsuki.warActive ? "POSITIVE (War ongoing)" : "NEGATIVE (No active war)";
    embed.setDescription(`War Status: ${status}`);
    
    // Leadership info
    let akatsukiLeader = null;
    let coLeader = null;
    let bruisers = 0;
    let scientists = 0;
    
    for (const [id, user] of Object.entries(users)) {
        if (user.occupation === "Akatsuki") {
            if (user.role === "Leader") akatsukiLeader = user;
            else if (user.role === "Co-Leader") coLeader = user;
            else if (user.role === "Bruiser") bruisers++;
            else if (user.role === "Scientist") scientists++;
        }
    }
    
    embed.addFields(
        { name: "Chief", value: akatsukiLeader ? akatsukiLeader.name : "None", inline: true },
        { name: "Co-leader", value: coLeader ? coLeader.name : "None", inline: true },
        { name: "Bruisers", value: bruisers.toString(), inline: true },
        { name: "Scientists", value: scientists.toString(), inline: true }
    );
    
    // War specific info
    if (akatsuki.warActive) {
        if (akatsuki.target) {
            embed.addFields({ name: "Current Target", value: akatsuki.target.username, inline: true });
        }
        
        if (akatsuki.weaponLevel) {
            embed.addFields({ 
                name: "Weapon Level", 
                value: `Level ${akatsuki.weaponLevel} (${akatsuki.weaponDamage} damage)`, 
                inline: true 
            });
        }
        
        if (akatsuki.battlePhase) {
            const phase = akatsuki.battlePhase === "infiltration" ? "Infiltration Battle" : "Jinchuriki Hunt";
            embed.addFields({ name: "Current Phase", value: phase, inline: true });
            
            if (akatsuki.battleScore) {
                embed.addFields(
                    { name: "Akatsuki Score", value: akatsuki.battleScore.akatsuki.toString(), inline: true },
                    { name: "Village Score", value: akatsuki.battleScore.village.toString(), inline: true }
                );
            }
        }
    }
    
    await interaction.followUp({ embeds: [embed] });
}

// Handle village bank subcommand
async function handleVillageBank(interaction, users, village, isHokage) {
    if (!isHokage) {
        return interaction.followUp({ content: "Only the Hokage can manage the village bank!", ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const userId = interaction.user.id;
    
    if (action === 'add') {
        const amount = interaction.options.getInteger('amount');
        
        if (!amount || amount <= 0) {
            return interaction.followUp({ content: "You must specify a positive amount to add!", ephemeral: true });
        }
        
        if (users[userId].money < amount) {
            return interaction.followUp({ content: "You don't have enough money!", ephemeral: true });
        }
        
        users[userId].money -= amount;
        village.villagebank = (village.villagebank || 0) + amount;
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
        
        return interaction.followUp({ content: `Successfully added ${amount} Ryo to the village bank.`, ephemeral: true });
    } else if (action === 'distribute') {
        if (!village.villagebank || village.villagebank <= 0) {
            return interaction.followUp({ content: "The village bank is empty!", ephemeral: true });
        }
        
        // Count eligible roles (Right Hand Man, Guard, Spy)
        let eligibleCount = 0;
        for (const user of Object.values(users)) {
            if (user.role === "Right Hand Man" || user.role === "Guard" || user.role === "Spy") {
                eligibleCount++;
            }
        }
        
        if (eligibleCount === 0) {
            return interaction.followUp({ content: "There are no eligible members to distribute funds to!", ephemeral: true });
        }
        
        // Calculate share (make it even by removing last digit if necessary)
        let share = Math.floor(village.villagebank / eligibleCount);
        share = Math.floor(share / 10) * 10; // Remove last digit
        
        // Distribute funds
        let distributed = 0;
        for (const [id, user] of Object.entries(users)) {
            if (user.role === "Right Hand Man" || user.role === "Guard" || user.role === "Spy") {
                user.money += share;
                distributed += share;
            }
        }
        
        // Update village bank
        village.villagebank -= distributed;
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
        
        return interaction.followUp({ 
            content: `Distributed ${distributed} Ryo from the village bank to ${eligibleCount} members (${share} Ryo each).` 
        });
    }
}

// Start the actual war after cooldown
async function startActualWar(interaction, users, village, akatsuki) {
    // Check defense levels
    let highestUnlockedTurret = 0;
    for (let level = 1; level <= 10; level++) {
        if (village.turrets?.[level]?.hp > 0) {
            highestUnlockedTurret = level;
        }
    }
    
    const turretHp = village.turrets?.[highestUnlockedTurret]?.hp || 0;
    const nukeDamage = akatsuki.weaponDamage;
    
    // Send war start message
    await interaction.channel.send("# THE SHINOBI WAR BEGINS");
    
    const warEmbed = new EmbedBuilder()
        .setTitle("War Breaks Out!")
        .setDescription("The Akatsuki have launched their attack on the village!")
        .setImage("https://example.com/war_gif.gif") // Replace with actual gif
        .setColor('#ff0000');
    
    await interaction.channel.send({ embeds: [warEmbed] });
    
    // Story embed
    const storyEmbed = new EmbedBuilder()
        .setTitle("The Village Under Attack!")
        .setDescription("The Akatsuki send out a nuclear bomb at the village's defenses! The villagers panic as the massive chakra bomb streaks through the sky towards the village. The Hokage arrives at the scene immediately with the Anbu Black Ops, ready to defend their home.")
        .setColor('#ff0000');
    
    await interaction.channel.send({ embeds: [storyEmbed] });
    
    // Determine outcome of the initial attack
    if (turretHp >= nukeDamage) {
        // Village defenses hold
        await interaction.channel.send({
            content: `**Village Defenses Hold!**\nThe level ${highestUnlockedTurret} turrets (${turretHp} HP) successfully intercepted the level ${akatsuki.weaponLevel} nuclear chakra bomb (${nukeDamage} damage)!`
        });
        
        // Akatsuki loses and pays fine
        let totalFine = 0;
        for (const [id, user] of Object.entries(users)) {
            if (user.occupation === "Akatsuki") {
                const fine = Math.floor(user.money * 0.9);
                user.money -= fine;
                totalFine += fine;
            }
        }
        
        // Update village bank
        village.villagebank = (village.villagebank || 0) + totalFine;
        fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        await interaction.channel.send({
            content: `The Akatsuki have been defeated and fined 90% of their money (total: ${totalFine} Ryo added to village bank).`
        });
        
        // End war
        akatsuki.warActive = false;
        fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    } else {
        // Akatsuki successfully infiltrates
        await interaction.channel.send({
            content: `**Village Defenses Breached!**\nThe level ${highestUnlockedTurret} turrets (${turretHp} HP) failed to stop the level ${akatsuki.weaponLevel} nuclear chakra bomb (${nukeDamage} damage)!`
        });
        
        // Start infiltration battle phase
        akatsuki.battlePhase = "infiltration";
        akatsuki.battleScore = { akatsuki: 0, village: 0 };
        fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
        
        // Send battle prompt
        const battleEmbed = new EmbedBuilder()
            .setTitle("Battle in the Village!")
            .setDescription("The Akatsuki infiltrate the village! The villagers yell and scream for help! The beautiful roads of Konoha are now filled by the debris of the nuclear chakra bomb. The Leader of the Akatsuki is then stopped in his tracks by the Anbu black ops led by the Hokage! But little did they know, the Akatsuki leader brought his entire army along! Prepare for battle!")
            .setColor('#ff0000');
        
        await interaction.channel.send({ embeds: [battleEmbed] });
        
        await interaction.channel.send("The Hokage and The leader of the Akatsuki may now use the `/war send @username` for the battle to begin.");
    }
}

// Start a battle between sent fighters
async function startBattle(interaction, users, akatsuki) {
    const akatsukiFighterId = akatsuki.battleFighters.akatsuki[0];
    const villageFighterId = akatsuki.battleFighters.village[0];
    
    const akatsukiFighter = {
        ...users[akatsukiFighterId],
        name: users[akatsukiFighterId].name,
        avatar: interaction.client.users.cache.get(akatsukiFighterId)?.displayAvatarURL({ format: 'png', size: 256 })
    };
    
    const villageFighter = {
        ...users[villageFighterId],
        name: users[villageFighterId].name,
        avatar: interaction.client.users.cache.get(villageFighterId)?.displayAvatarURL({ format: 'png', size: 256 })
    };
    
    // Create fixed stats for both fighters
    const createFighter = (user) => ({
        ...user,
        health: WAR_CONFIG.fixedStats.health,
        power: WAR_CONFIG.fixedStats.power,
        defense: WAR_CONFIG.fixedStats.defense,
        chakra: WAR_CONFIG.fixedStats.chakra,
        currentHealth: WAR_CONFIG.fixedStats.health,
        activeEffects: [],
        accuracy: 100,
        dodge: 0
    });
    
    let fighter1 = createFighter(akatsukiFighter);
    let fighter2 = createFighter(villageFighter);
    
    // Combo tracking
    let comboState1 = null;
    if (fighter1.Combo && COMBOS[fighter1.Combo]) {
        comboState1 = {
            combo: COMBOS[fighter1.Combo],
            usedJutsus: new Set()
        };
    }
    
    let comboState2 = null;
    if (fighter2.Combo && COMBOS[fighter2.Combo]) {
        comboState2 = {
            combo: COMBOS[fighter2.Combo],
            usedJutsus: new Set()
        };
    }
    
    // Battle loop
    let round = 1;
    let battleActive = true;
    
    while (battleActive) {
        // Fighter 1 turn
        const fighter1Action = await processFighterTurn(interaction, fighter1, fighter2, akatsukiFighterId, round, comboState1);
        fighter2.currentHealth -= fighter1Action.damage || 0;
        
        // Fighter 2 turn (if still alive)
        let fighter2Action = { damage: 0, description: `${fighter2.name} is defeated` };
        if (fighter2.currentHealth > 0) {
            fighter2Action = await processFighterTurn(interaction, fighter2, fighter1, villageFighterId, round, comboState2);
            fighter1.currentHealth -= fighter2Action.damage || 0;
        }
        
        // Create battle summary
        const battleEmbed = createBattleSummaryEmbed(fighter1, fighter2, fighter1Action, fighter2Action, round);
        
        // Generate battle image
        const battleImage = await generateBattleImage(
            fighter1.name, 
            fighter1.avatar, 
            fighter1.currentHealth, 
            fighter1.health,
            fighter2.name, 
            fighter2.avatar, 
            fighter2.currentHealth, 
            fighter2.health
        );
        
        await interaction.channel.send({ 
            embeds: [battleEmbed],
            files: [battleImage]
        });
        
        // Check for winner
        if (fighter1.currentHealth <= 0) {
            // Village wins the round
            akatsuki.battleScore.village++;
            await interaction.channel.send(`${villageFighter.name} wins the round for the Village!`);
            battleActive = false;
        } else if (fighter2.currentHealth <= 0) {
            // Akatsuki wins the round
            akatsuki.battleScore.akatsuki++;
            await interaction.channel.send(`${akatsukiFighter.name} wins the round for the Akatsuki!`);
            battleActive = false;
        }
        
        round++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between rounds
    }
    
    // Remove the fighters who just battled
    akatsuki.battleFighters.akatsuki.shift();
    akatsuki.battleFighters.village.shift();
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    // Check if one side has won
    if (akatsuki.battleScore.akatsuki >= 5) {
        await akatsukiWins(interaction, users, akatsuki);
    } else if (akatsuki.battleScore.village >= 5) {
        await villageWins(interaction, users, akatsuki);
    } else {
        // Continue battle
        await interaction.channel.send(`Current Score - Akatsuki: ${akatsuki.battleScore.akatsuki} | Village: ${akatsuki.battleScore.village}\nSend more fighters with /war send!`);
    }
}

// Process a fighter's turn
async function processFighterTurn(interaction, fighter, opponent, fighterId, round, comboState) {
    // Calculate effective stats
    const effectiveFighter = getEffectiveStats(fighter);
    const effectiveOpponent = getEffectiveStats(opponent);
    
    // Create moves embed
    const { embed, components } = createMovesEmbed(fighter, fighterId, round);
    const moveMessage = await interaction.channel.send({
        content: `${fighter.name}'s turn!`,
        embeds: [embed],
        components: components
    });
    
    const action = await new Promise(resolve => {
        const collector = moveMessage.createMessageComponentCollector({
            filter: i => i.user.id === fighterId && i.customId.endsWith(`-${fighterId}-${round}`),
            time: 60000
        });
        
        collector.on('collect', async i => {
            await i.deferUpdate();
            const result = await processFighterMove(i.customId, fighter, opponent, effectiveFighter, effectiveOpponent);
            
            // Combo tracking
            if (comboState && result.jutsuUsed && comboState.combo.requiredJutsus.includes(result.jutsuUsed)) {
                comboState.usedJutsus.add(result.jutsuUsed);
            }
            
            resolve(result);
            collector.stop();
        });
        
        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                resolve({
                    damage: 0,
                    heal: 0,
                    description: `${fighter.name} did not make a move in time!`,
                    specialEffects: [],
                    hit: false
                });
            }
            // Disable all buttons
            moveMessage.edit({ 
                components: components.map(row => {
                    const disabledRow = ActionRowBuilder.from(row);
                    disabledRow.components.forEach(c => c.setDisabled(true));
                    return disabledRow;
                })
            }).catch(console.error);
        });
    });
    
    // Combo completion check and bonus damage
    if (comboState && comboState.combo.requiredJutsus.every(jutsu => comboState.usedJutsus.has(jutsu))) {
        const bonusDamage = comboState.combo.resultMove.damage;
        opponent.currentHealth -= bonusDamage;
        action.specialEffects.push(`Combo activated! Bonus damage: ${bonusDamage}`);
        comboState.usedJutsus.clear();
    }
    
    return action;
}

// Create moves embed for a fighter
function createMovesEmbed(fighter, fighterId, round) {
    const embed = new EmbedBuilder()
        .setTitle(`${fighter.name}`)
        .setColor('#006400')
        .setDescription(
            `${fighter.name}, it is your turn!\nUse the buttons below to make your move.\n\n` +
            Object.entries(fighter.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([slot, jutsu], index) => {
                    const jutsuData = jutsuList[jutsu];
                    return `${index + 1}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                })
                .join('\n') +
            `\n\nChakra: ${fighter.chakra}`
        );

    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;
    const rows = [];
    
    // Add jutsu buttons
    Object.entries(fighter.jutsu).forEach(([_, jutsuName], index) => {
        if (jutsuName !== 'None') {
            const jutsu = jutsuList[jutsuName];
            const disabled = fighter.chakra < (jutsu?.chakraCost || 0);
            
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${jutsuName}-${fighterId}-${round}`)
                    .setLabel(`${index + 1}`)
                    .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setDisabled(disabled)
            );
            
            buttonCount++;
            
            if (buttonCount === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonCount = 0;
            }
        }
    });

    // Add rest button to the last row if there's space
    if (buttonCount < 4) {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`rest-${fighterId}-${round}`)
                .setLabel('Rest')
                .setStyle(ButtonStyle.Primary)
        );
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }
    } else {
        // If last row is full, create a new row for utility buttons
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }
        const utilityRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rest-${fighterId}-${round}`)
                    .setLabel('Rest')
                    .setStyle(ButtonStyle.Primary)
            );
        rows.push(utilityRow);
    }

    return { embed, components: rows.slice(0, 5) };
}

// Process fighter move
async function processFighterMove(customId, fighter, opponent, effectiveFighter, effectiveOpponent) {
    const action = customId.split('-')[0];
    
    if (action === 'rest') {
        fighter.chakra += 1;
        return {
            damage: 0,
            heal: 0,
            description: `${fighter.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true,
            isRest: true
        };
    }
    
    return executeJutsu(fighter, opponent, effectiveFighter, effectiveOpponent, action);
}

// Execute a jutsu
function executeJutsu(baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) {
    const jutsu = jutsuList[jutsuName];
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

    const result = {
        damage: 0,
        heal: 0,
        description: jutsu.description || `${baseUser.name} used ${jutsu.name}`,
        specialEffects: [],
        hit: true,
        jutsuUsed: jutsuName
    };

    if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
        return {
            damage: 0,
            heal: 0,
            description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
            specialEffects: ["Chakra exhausted!"],
            hit: false,
            jutsuUsed: jutsuName
        };
    }
    baseUser.chakra -= jutsu.chakraCost || 0;

    jutsu.effects.forEach(effect => {
        try {
            switch (effect.type) {
                case 'damage':
                    const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula);
                    result.damage += damageResult.damage;
                    result.hit = damageResult.hit;
                    if (damageResult.hit && damageResult.damage > 0) {
                        result.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                    } else if (!damageResult.hit) {
                        result.specialEffects.push("Attack missed!");
                    }
                    break;

                case 'buff':
                    const buffChanges = effectHandlers.buff(baseUser, effect.stats);
                    if (!baseUser.activeEffects) baseUser.activeEffects = [];
                    baseUser.activeEffects.push({
                        type: 'buff',
                        stats: buffChanges,
                        duration: effect.duration || 1
                    });
                    result.specialEffects.push(`Gained buffs: ${Object.entries(buffChanges)
                        .map(([k, v]) => `${k}: +${v}`)
                        .join(', ')} for ${effect.duration || 1} turns`);
                    break;

                case 'debuff':
                    const debuffChanges = effectHandlers.debuff(baseTarget, effect.stats);
                    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                    baseTarget.activeEffects.push({
                        type: 'debuff',
                        stats: debuffChanges,
                        duration: effect.duration || 1
                    });
                    result.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')} for ${effect.duration || 1} turns`);
                    break;

                case 'heal':
                    const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                    result.heal += healAmount;
                    if (healAmount > 0) {
                        result.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                    }
                    break;

                case 'instantKill':
                    if (effectHandlers.instantKill(effect.chance)) {
                        result.damage = effectiveTarget.health;
                        result.specialEffects.push("INSTANT KILL!");
                    }
                    break;

                case 'status':
                    if (effectHandlers.status(effect.chance)) {
                        if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                        const statusEffect = {
                            type: 'status',
                            status: effect.status,
                            duration: effect.duration || 1
                        };
                        
                        if (effect.status === 'bleed' || effect.status === 'drowning') {
                            statusEffect.damagePerTurn = baseTarget.health * 0.1;
                        }
                        
                        baseTarget.activeEffects.push(statusEffect);
                        result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                    }
                    break;
            }
        } catch (err) {
            console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
            result.specialEffects.push(`Error applying ${effect.type} effect`);
        }
    });

    return result;
}

// Calculate effective stats considering active effects
function getEffectiveStats(entity) {
    const stats = { ...entity };
    delete stats.activeEffects;

    const effectiveStats = {
        power: stats.power || 10,
        defense: stats.defense || 10,
        chakra: stats.chakra || 10,
        health: stats.health || 100,
        accuracy: stats.accuracy || 100,
        dodge: stats.dodge || 0
    };

    entity.activeEffects?.forEach(effect => {
        if (effect.type === 'buff' || effect.type === 'debuff') {
            Object.entries(effect.stats).forEach(([stat, value]) => {
                effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
            });
        }
    });

    return effectiveStats;
}

// Create battle summary embed
function createBattleSummaryEmbed(fighter1, fighter2, action1, action2, round) {
    const getEffectEmojis = (entity) => {
        const emojis = [];
        entity.activeEffects?.forEach(effect => {
            if (effect.type === 'buff') emojis.push(EMOJIS.buff);
            if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
            if (effect.type === 'status') {
                switch (effect.status) {
                    case 'stun': emojis.push(EMOJIS.stun); break;
                    case 'bleed': emojis.push(EMOJIS.bleed); break;
                    case 'flinch': emojis.push(EMOJIS.flinch); break;
                    case 'cursed': emojis.push(EMOJIS.curse); break;
                    default: emojis.push(EMOJIS.status);
                }
            }
        });
        return emojis.length ? `[${emojis.join('')}] ` : '';
    };

    const fighter1EffectEmojis = getEffectEmojis(fighter1);
    const fighter2EffectEmojis = getEffectEmojis(fighter2);

    const fighter1Desc = action1.isRest ? action1.description :
                        !action1.hit ? (action1.specialEffects.includes("Stun active") ? "is stunned!" :
                                       action1.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") : 
                        jutsuList[action1.jutsuUsed]?.description || action1.description;
    
    const fighter2Desc = !action2.hit ? (action2.specialEffects.includes("Stun active") ? `${fighter2.name} is stunned!` :
                                       action2.specialEffects.includes("Flinch active") ? `${fighter2.name} flinched!` : `${fighter2.name} missed!`) : 
                        action2.description;

    let statusEffects = [];
    
    // Handle active status effects
    [fighter1, fighter2].forEach(entity => {
        entity.activeEffects?.forEach(effect => {
            if (effect.type === 'status') {
                switch(effect.status) {
                    case 'bleed':
                        const bleedDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= bleedDamage;
                        statusEffects.push(`${entity.name} is bleeding! (-${bleedDamage} HP)`);
                        break;
                    case 'drowning':
                        const drowningDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= drowningDamage;
                        const jutsu = jutsuList['Water Prison'];
                        const chakraDrain = jutsu.effects[0].chakraDrain || 3;
                        entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                        statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                        break;
                }
            }
        });
    });

    const embed = new EmbedBuilder()
        .setTitle(`Round ${round}`)
        .setColor('#ff0000')
        .setDescription(
            `${fighter1EffectEmojis}${fighter1Desc}` +
            `${action1.damage ? ` for ${Math.round(action1.damage)}!` : action1.heal ? ` for ${Math.round(action1.heal)} HP!` : '!'}` +
            `\n\n${fighter2EffectEmojis}${fighter2Desc}` +
            `${action2.damage ? ` for ${Math.round(action2.damage)}!` : action2.heal ? ` for ${Math.round(action2.heal)} HP!` : '!'}`
            + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
        )
        .addFields({
            name: 'Battle Status',
            value: `${fighter1.name} || ${Math.round(fighter1.currentHealth)} HP\n${fighter2.name} || ${Math.round(fighter2.currentHealth)} HP\nChakra: ${fighter1.chakra}            Chakra: ${fighter2.chakra}`
        });

    return embed;
}

// Generate battle image
async function generateBattleImage(name1, avatar1, hp1, maxHp1, name2, avatar2, hp2, maxHp2) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400 });

    const hpPercent1 = Math.max((hp1 / maxHp1) * 100, 0);
    const hpPercent2 = Math.max((hp2 / maxHp2) * 100, 0);

    // Create images directory if it doesn't exist
    const imagesDir = path.resolve(__dirname, '../images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const htmlContent = `
        <html>
        <style>
            body {
                margin: 0;
                padding: 0;
            }
            .battle-container {
                width: 800px;
                height: 400px;
                position: relative;
                background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat;
                background-size: cover;
                border-radius: 10px;
                overflow: hidden;
            }
            .character {
                position: absolute;
                width: 150px;
                height: 150px;
                border-radius: 10px;
                border: 3px solid #6e1515;
                object-fit: cover;
            }
            .player {
                right: 50px;
                top: 120px;
            }
            .enemy {
                left: 50px;
                top: 120px;
            }
            .name-tag {
                position: absolute;
                width: 150px;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 18px;
                font-weight: bold;
                text-shadow: 2px 2px 4px #000;
                top: 80px;
                background: rgba(0,0,0,0.5);
                border-radius: 5px;
                padding: 2px 0;
            }
            .player-name {
                right: 50px;
            }
            .enemy-name {
                left: 50px;
            }
            .health-bar {
                position: absolute;
                width: 150px;
                height: 22px;
                background-color: #333;
                border-radius: 5px;
                overflow: hidden;
                top: 280px;
            }
            .health-fill {
                height: 100%;
            }
            .npc-health-fill {
                background-color: #ff4444;
                width: ${hpPercent2}%;
            }
            .player-health-fill {
                background-color: #4CAF50;
                width: ${hpPercent1}%;
            }
            .health-text {
                position: absolute;
                width: 100%;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 13px;
                line-height: 22px;
                text-shadow: 1px 1px 1px black;
            }
            .player-health {
                right: 50px;
            }
            .enemy-health {
                left: 50px;
            }
            .vs-text {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-family: Arial, sans-serif;
                font-size: 48px;
                font-weight: bold;
                text-shadow: 2px 2px 4px #000;
            }
        </style>
        <body>
            <div class="battle-container">
                <div class="name-tag enemy-name">${name2}</div>
                <img class="character enemy" src="${avatar2}">
                <div class="health-bar enemy-health">
                    <div class="health-fill npc-health-fill"></div>
                    <div class="health-text">${Math.round(hp2)}/${maxHp2}</div>
                </div>
                
                <div class="name-tag player-name">${name1}</div>
                <img class="character player" src="${avatar1}">
                <div class="health-bar player-health">
                    <div class="health-fill player-health-fill"></div>
                    <div class="health-text">${Math.round(hp1)}/${maxHp1}</div>
                </div>
                <div class="vs-text">VS</div>
            </div>
        </body>
        </html>
    `;

    await page.setContent(htmlContent);
    const imagePath = path.join(imagesDir, `battle_${Date.now()}.png`);
    await page.screenshot({ path: imagePath });
    await browser.close();
    return new AttachmentBuilder(imagePath);
}

// Akatsuki wins the infiltration battle
async function akatsukiWins(interaction, users, akatsuki) {
    await interaction.channel.send("**The Akatsuki Have Won!**\nThe Hokage's army gets demolished by the Akatsuki and now the Akatsuki look for what they were here for: THE JINCHURIKI!");
    
    // Start Jinchuriki hunt phase
    akatsuki.battlePhase = "jinchuriki";
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
    
    // Create Jinchuriki hunt embed with join button
    const target = akatsuki.target;
    const embed = new EmbedBuilder()
        .setTitle("Jinchuriki Hunt!")
        .setDescription(`The Akatsuki are hunting ${target.username}! 4 Akatsuki members can join the fight against the Jinchuriki.`)
        .setThumbnail(target.avatar)
        .setColor('#ff0000');
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('join_jinchuriki_fight')
                .setLabel('Join Jinchuriki Fight')
                .setStyle(ButtonStyle.Danger)
        );
    
    const message = await interaction.channel.send({ 
        embeds: [embed], 
        components: [row] 
    });
    
    // Collect joiners
    const collected = await message.awaitMessageComponent({ 
        filter: i => {
            const user = users[i.user.id];
            return user?.occupation === "Akatsuki";
        },
        time: 60000,
        max: 4
    });
    
    const fighters = collected.map(c => c.user.id);
    
    // Start Jinchuriki battle
    await startJinchurikiBattle(interaction, users, akatsuki, fighters);
}

// Village wins the infiltration battle
async function villageWins(interaction, users, akatsuki) {
    await interaction.channel.send("**The Village Has Won!**\nThe Anbu black Ops has successfully defeated the Akatsuki.");
    
    // Akatsuki pays fine
    let totalFine = 0;
    for (const [id, user] of Object.entries(users)) {
        if (user.occupation === "Akatsuki") {
            const fine = Math.floor(user.money * 0.9);
            user.money -= fine;
            totalFine += fine;
        }
    }
    
    // Update village bank
    const village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
    village.villagebank = (village.villagebank || 0) + totalFine;
    fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    
    await interaction.channel.send(`The Akatsuki have been fined 90% of their money (total: ${totalFine} Ryo added to village bank).`);
    
    // End war
    akatsuki.warActive = false;
    akatsuki.battlePhase = undefined;
    akatsuki.battleScore = undefined;
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
}

// Start Jinchuriki battle
async function startJinchurikiBattle(interaction, users, akatsuki, fighterIds) {
    const target = akatsuki.target;
    
    // Create Jinchuriki NPC
    const jinchuriki = {
        name: target.username,
        avatar: target.avatar,
        health: WAR_CONFIG.jinchurikiStats.health,
        power: WAR_CONFIG.jinchurikiStats.power,
        defense: WAR_CONFIG.jinchurikiStats.defense,
        currentHealth: WAR_CONFIG.jinchurikiStats.health,
        jutsus: ["Tailed Beast Bomb", "Demon Cloak"],
        activeEffects: [],
        accuracy: 100,
        dodge: 0
    };
    
    // Create Akatsuki fighters with fixed stats
    const fighters = fighterIds.map(id => ({
        ...users[id],
        name: users[id].name,
        avatar: interaction.client.users.cache.get(id)?.displayAvatarURL({ format: 'png', size: 256 }),
        health: WAR_CONFIG.fixedStats.health,
        power: WAR_CONFIG.fixedStats.power,
        defense: WAR_CONFIG.fixedStats.defense,
        chakra: WAR_CONFIG.fixedStats.chakra,
        currentHealth: WAR_CONFIG.fixedStats.health,
        activeEffects: [],
        accuracy: 100,
        dodge: 0
    }));
    
    // Battle loop
    let round = 1;
    let battleActive = true;
    
    while (battleActive) {
        // Jinchuriki turn (attacks all fighters)
        let jinAction;
        if (Math.random() < 0.9) {
            // 90% chance for Tailed Beast Bomb
            jinAction = {
                name: "Tailed Beast Bomb",
                damage: Math.floor(jinchuriki.power * 0.8),
                description: "launches a massive Tailed Beast Bomb at all enemies!",
                specialEffects: []
            };
            
            // Apply damage to all fighters
            fighters.forEach(f => {
                const damage = Math.max(0, jinAction.damage - f.defense);
                f.currentHealth -= damage;
                jinAction.specialEffects.push(`${f.name} takes ${damage} damage!`);
            });
        } else {
            // 10% chance for Demon Cloak
            jinAction = {
                name: "Demon Cloak",
                damage: 0,
                description: "activates Demon Cloak, increasing their power!",
                specialEffects: []
            };
            
            const powerBuff = Math.floor(jinchuriki.power * 0.2);
            jinchuriki.power += powerBuff;
            jinchuriki.activeEffects.push({
                type: 'buff',
                stats: { power: powerBuff },
                duration: 3
            });
            
            jinAction.specialEffects.push(`Power increased by ${powerBuff}!`);
        }
        
        // Fighters turn (each alive fighter attacks)
        let fighterActions = [];
        fighters.forEach(f => {
            if (f.currentHealth > 0) {
                const action = npcChooseMove(f, jinchuriki);
                jinchuriki.currentHealth -= action.damage;
                fighterActions.push(`${f.name} ${action.description} for ${action.damage} damage!`);
            }
        });
        
        // Create battle summary
        const battleEmbed = new EmbedBuilder()
            .setTitle(`Round ${round} - Jinchuriki Battle`)
            .setDescription(
                `${jinchuriki.name} ${jinAction.description}\n${jinAction.specialEffects.join('\n')}\n` +
                fighterActions.join('\n')
            )
            .addFields(
                { name: "Jinchuriki HP", value: `${Math.round(jinchuriki.currentHealth)}/${jinchuriki.health}`, inline: true },
                { name: "Akatsuki Fighters", value: fighters.map(f => `${f.name}: ${Math.round(f.currentHealth)}/${f.health}`).join('\n'), inline: true }
            )
            .setThumbnail(jinchuriki.avatar)
            .setColor('#ff0000');
        
        // Generate battle image
        const battleImage = await generateJinchurikiBattleImage(jinchuriki, fighters);
        
        await interaction.channel.send({ 
            embeds: [battleEmbed],
            files: [battleImage]
        });
        
        // Check for winner
        if (jinchuriki.currentHealth <= 0) {
            // Akatsuki wins
            await interaction.channel.send("**The Akatsuki Have Defeated the Jinchuriki!**");
            
            // Reward all Akatsuki members
            for (const [id, user] of Object.entries(users)) {
                if (user.occupation === "Akatsuki") {
                    user.money += 1000000; // 1 million Ryo
                }
            }
            
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            await interaction.channel.send("All Akatsuki members have received 1,000,000 Ryo for capturing the Jinchuriki!");
            
            battleActive = false;
        } else if (fighters.every(f => f.currentHealth <= 0)) {
            // Jinchuriki wins
            await interaction.channel.send("**The Jinchuriki Has Defeated the Akatsuki!**\nThe remaining Akatsuki members flee in defeat.");
            battleActive = false;
        }
        
        round++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between rounds
    }
    
    // End war
    akatsuki.warActive = false;
    akatsuki.battlePhase = undefined;
    fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
}

// Generate Jinchuriki battle image (4v1 layout)
async function generateJinchurikiBattleImage(jinchuriki, fighters) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 }); // Taller image for 4v1 layout

    const jinHpPercent = Math.max((jinchuriki.currentHealth / jinchuriki.health) * 100, 0);
    
    // Create images directory if it doesn't exist
    const imagesDir = path.resolve(__dirname, '../images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Generate HTML for 4 fighters on right, Jinchuriki on left
    const fightersHtml = fighters.map((f, i) => {
        const hpPercent = Math.max((f.currentHealth / f.health) * 100, 0);
        return `
            <div class="fighter" style="top: ${60 + i * 120}px;">
                <div class="name-tag">${f.name}</div>
                <img class="character" src="${f.avatar}">
                <div class="health-bar">
                    <div class="health-fill" style="width: ${hpPercent}%;"></div>
                    <div class="health-text">${Math.round(f.currentHealth)}/${f.health}</div>
                </div>
            </div>
        `;
    }).join('');

    const htmlContent = `
        <html>
        <style>
            body {
                margin: 0;
                padding: 0;
            }
            .battle-container {
                width: 800px;
                height: 600px;
                position: relative;
                background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat;
                background-size: cover;
                border-radius: 10px;
                overflow: hidden;
            }
            .jinchuriki {
                position: absolute;
                left: 50px;
                top: 150px;
                width: 200px;
                height: 200px;
                border-radius: 10px;
                border: 3px solid #6e1515;
                object-fit: cover;
            }
            .fighter {
                position: absolute;
                right: 50px;
                width: 120px;
                height: 120px;
                border-radius: 10px;
                border: 3px solid #6e1515;
                object-fit: cover;
            }
            .character {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .name-tag {
                position: absolute;
                width: 100%;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 2px 2px 4px #000;
                top: -30px;
                background: rgba(0,0,0,0.5);
                border-radius: 5px;
                padding: 2px 0;
            }
            .health-bar {
                position: absolute;
                width: 100%;
                height: 18px;
                background-color: #333;
                border-radius: 5px;
                overflow: hidden;
                top: 110px;
            }
            .health-fill {
                height: 100%;
                background-color: #ff4444;
            }
            .health-text {
                position: absolute;
                width: 100%;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 11px;
                line-height: 18px;
                text-shadow: 1px 1px 1px black;
            }
            .jin-health {
                position: absolute;
                width: 200px;
                height: 25px;
                background-color: #333;
                border-radius: 5px;
                overflow: hidden;
                left: 50px;
                top: 360px;
            }
            .jin-health-fill {
                height: 100%;
                background-color: #ff4444;
                width: ${jinHpPercent}%;
            }
            .jin-health-text {
                position: absolute;
                width: 100%;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 25px;
                text-shadow: 1px 1px 1px black;
            }
            .jin-name {
                position: absolute;
                left: 50px;
                top: 120px;
                width: 200px;
                text-align: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 18px;
                font-weight: bold;
                text-shadow: 2px 2px 4px #000;
                background: rgba(0,0,0,0.5);
                border-radius: 5px;
                padding: 2px 0;
            }
        </style>
        <body>
            <div class="battle-container">
                <div class="jin-name">${jinchuriki.name}</div>
                <img class="jinchuriki" src="${jinchuriki.avatar}">
                <div class="jin-health">
                    <div class="jin-health-fill"></div>
                    <div class="jin-health-text">${Math.round(jinchuriki.currentHealth)}/${jinchuriki.health}</div>
                </div>
                ${fightersHtml}
            </div>
        </body>
        </html>
    `;

    await page.setContent(htmlContent);
    const imagePath = path.join(imagesDir, `jinchuriki_battle_${Date.now()}.png`);
    await page.screenshot({ path: imagePath });
    await browser.close();
    return new AttachmentBuilder(imagePath);
}

// NPC chooses move (for Jinchuriki battle)
function npcChooseMove(npc, target) {
    const availableJutsu = npc.jutsus.filter(j => jutsuList[j]);
    
    if (availableJutsu.length === 0) {
        return {
            damage: 0,
            heal: 0,
            description: `${npc.name} gathered chakra and rested`,
            specialEffects: ["+1 Chakra"],
            hit: true
        };
    }

    const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
    return executeJutsu(npc, target, npc, target, randomJutsu);
}