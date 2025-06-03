const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
const jutsusPath = path.resolve(__dirname, '/workspaces/menma/data/jutsus.json');

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

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
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
    // ... (other effect handlers from arank command)
};

const AKATSUKI_LEADER_ROLE_ID = '1371076470369288223'; // Set your Akatsuki Leader role ID here
const HOKAGE_ROLE_ID = '1349245807995387915'; // Set your Hokage role ID here

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
                .setDescription('Check the current war status')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Load data files
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const village = fs.existsSync(villagePath) ? JSON.parse(fs.readFileSync(villagePath, 'utf8')) : {};
        let akatsuki = fs.existsSync(akatsukiPath) ? JSON.parse(fs.readFileSync(akatsukiPath, 'utf8')) : { bombs: {} };

        if (!users[userId]) {
            return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
        }

        // Check if user is Akatsuki leader by role ID
        const isAkatsukiLeader = interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID);
        const isHokage = interaction.member.roles.cache.has(HOKAGE_ROLE_ID);

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
    
    if (interaction.channelId !== "1371473277842620506") { // Replace with actual channel ID
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
    const targetIsVillage = !targetIsAkatsuki; // Simplified - you might need more checks
    
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
    
    // Check if we can start a battle (both sides have fighters)
    if (akatsuki.battleFighters.akatsuki.length > 0 && akatsuki.battleFighters.village.length > 0) {
        await startBattle(interaction, users, akatsuki);
    } else {
        const side = targetIsAkatsuki ? "Akatsuki" : "Village";
        await interaction.followUp({ 
            content: `${targetUser.username} has been sent to battle for the ${side}. Waiting for the opponent to send their fighter.` 
        });
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

    const akatsukiFighter = users[akatsukiFighterId];
    const villageFighter = users[villageFighterId];

    // Defensive: fallback to username if .name is undefined
    const getFighterName = (user) => user?.name || user?.username || "Unknown";

    // Create fixed stats for both fighters, but use their jutsu from profile
    const createFighter = (user) => ({
        name: user?.name || user?.username || "Unknown",
        username: user?.username || user?.name || "Unknown",
        health: 10000,
        power: 2500,
        defense: 2500,
        chakra: 10,
        currentHealth: 10000,
        // Defensive: ensure jutsu is always an object (never undefined/null/array)
        jutsu: (user && typeof user.jutsu === "object" && !Array.isArray(user.jutsu)) ? user.jutsu : {},
        activeEffects: [],
        accuracy: 100,
        dodge: 0
    });

    let player = createFighter(akatsukiFighter);
    let npc = createFighter(villageFighter);

    // Announce fighters
    await interaction.channel.send(`The Akatsuki has sent ${getFighterName(akatsukiFighter)} for the battle!`);
    await interaction.channel.send(`The Village has sent ${getFighterName(villageFighter)} for the battle!`);

    let round = 1;
    let battleActive = true;

    // Helper for jutsu list
    let jutsuList = {};
    if (fs.existsSync(jutsusPath)) {
        jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
    }

    // Helper to get available jutsu names
    const getJutsuNames = (fighter) => Object.values(fighter.jutsu || {}).filter(j => j && j !== 'Attack' && j !== 'None');

    // PvP battle loop (arank style)
    while (battleActive) {
        // Player's turn (Akatsuki)
        let playerJutsuNames = getJutsuNames(player);
        let playerJutsuName = playerJutsuNames[Math.floor(Math.random() * playerJutsuNames.length)] || "Attack";
        let playerJutsu = jutsuList[playerJutsuName] || { name: "Attack", effects: [{ type: "damage", formula: "user.power - target.defense * 0.5" }] };
        let playerDamage = 0;
        let playerDesc = `${getFighterName(player)} used ${playerJutsu.name}`;
        playerJutsu.effects.forEach(effect => {
            if (effect.type === 'damage') {
                const result = effectHandlers.damage(player, npc, effect.formula);
                if (result.hit) {
                    playerDamage += result.damage;
                } else {
                    playerDesc = `${getFighterName(player)} missed ${playerJutsu.name}!`;
                }
            }
        });
        npc.currentHealth -= playerDamage;

        // NPC's turn (Village)
        let npcJutsuNames = getJutsuNames(npc);
        let npcJutsuName = npcJutsuNames[Math.floor(Math.random() * npcJutsuNames.length)] || "Attack";
        let npcJutsu = jutsuList[npcJutsuName] || { name: "Attack", effects: [{ type: "damage", formula: "user.power - target.defense * 0.5" }] };
        let npcDamage = 0;
        let npcDesc = `${getFighterName(npc)} used ${npcJutsu.name}`;
        npcJutsu.effects.forEach(effect => {
            if (effect.type === 'damage') {
                const result = effectHandlers.damage(npc, player, effect.formula);
                if (result.hit) {
                    npcDamage += result.damage;
                } else {
                    npcDesc = `${getFighterName(npc)} missed ${npcJutsu.name}!`;
                }
            }
        });
        player.currentHealth -= npcDamage;

        // Clamp health
        player.currentHealth = Math.max(0, player.currentHealth);
        npc.currentHealth = Math.max(0, npc.currentHealth);

        // Create battle summary
        const battleEmbed = new EmbedBuilder()
            .setTitle(`Round ${round}`)
            .setDescription(
                `${playerDesc} for ${playerDamage} damage!\n` +
                `${npcDesc} for ${npcDamage} damage!`
            )
            .addFields(
                { name: getFighterName(player), value: `${Math.round(player.currentHealth)}/10000 HP`, inline: true },
                { name: getFighterName(npc), value: `${Math.round(npc.currentHealth)}/10000 HP`, inline: true }
            )
            .setColor('#ff0000');

        await interaction.channel.send({ embeds: [battleEmbed] });

        // Check for winner
        if (player.currentHealth <= 0) {
            akatsuki.battleScore.village++;
            await interaction.channel.send(`${getFighterName(npc)} wins the round for the Village!`);
            battleActive = false;
        } else if (npc.currentHealth <= 0) {
            akatsuki.battleScore.akatsuki++;
            await interaction.channel.send(`${getFighterName(player)} wins the round for the Akatsuki!`);
            battleActive = false;
        }

        round++;
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        await interaction.channel.send(`Current Score - Akatsuki: ${akatsuki.battleScore.akatsuki} | Village: ${akatsuki.battleScore.village}\nSend more fighters with /war send!`);
    }
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
        jutsus: ["Tailed Beast Bomb", "Demon Cloak"]
    };
    
    // Create Akatsuki fighters with fixed stats
    const fighters = fighterIds.map(id => ({
        ...users[id],
        health: WAR_CONFIG.fixedStats.health,
        power: WAR_CONFIG.fixedStats.power,
        defense: WAR_CONFIG.fixedStats.defense,
        chakra: WAR_CONFIG.fixedStats.chakra,
        currentHealth: WAR_CONFIG.fixedStats.health
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
                description: "launches a massive Tailed Beast Bomb at all enemies!"
            };
        } else {
            // 10% chance for Demon Cloak
            jinAction = {
                name: "Demon Cloak",
                damage: 0,
                buff: { power: Math.floor(jinchuriki.power * 0.2) },
                description: "activates Demon Cloak, increasing their power!"
            };
            jinchuriki.power += jinAction.buff.power;
        }
        
        // Apply Jinchuriki action
        let damageReport = "";
        if (jinAction.damage > 0) {
            fighters.forEach(f => {
                const actualDamage = Math.max(0, jinAction.damage - f.defense);
                f.currentHealth -= actualDamage;
                damageReport += `${f.name} takes ${actualDamage} damage!\n`;
            });
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
                `${jinchuriki.name} ${jinAction.description}\n${damageReport}\n` +
                fighterActions.join('\n')
            )
            .addFields(
                { name: "Jinchuriki HP", value: `${Math.round(jinchuriki.currentHealth)}/${jinchuriki.health}`, inline: true },
                { name: "Akatsuki Fighters", value: fighters.map(f => `${f.name}: ${Math.round(f.currentHealth)}/${f.health}`).join('\n'), inline: true }
            )
            .setThumbnail(jinchuriki.avatar)
            .setColor('#ff0000');
        
        await interaction.channel.send({ embeds: [battleEmbed] });
        
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

// Helper function from arank command
function npcChooseMove(npc, target) {
    const availableJutsu = Array.isArray(npc.jutsus) ? npc.jutsus.filter(j => jutsuList[j]) : [];
    
    if (availableJutsu.length === 0) {
        return {
            damage: 0,
            description: "gathered chakra and rested",
            specialEffects: ["+1 Chakra"]
        };
    }
    
    const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
    const jutsu = jutsuList[randomJutsu];
    
    let description = jutsu.description || `used ${randomJutsu}`;
    let damage = 0;
    
    jutsu.effects.forEach(effect => {
        if (effect.type === 'damage') {
            const result = effectHandlers.damage(npc, target, effect.formula);
            if (result.hit) {
                damage += result.damage;
            } else {
                description = `${npc.name} missed ${randomJutsu}!`;
            }
        }
    });
    
    return {
        damage,
        description: `${npc.name} ${description}`
    };
}

// Helper function to format cooldown string
function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

// Village bank command
const villageBankCommand = {
    data: new SlashCommandBuilder()
        .setName('villagebank')
        .setDescription('Manage the village bank')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add money to the village bank')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('distribute')
                .setDescription('Distribute village bank funds')),

    async execute(interaction) {
        await interaction.deferReply();
        
        const userId = interaction.user.id;
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
        
        if (!users[userId]) {
            return interaction.followUp({ content: "You need to enroll first!", ephemeral: true });
        }
        
        // Check if user is Hokage
        const isHokage = interaction.member.roles.cache.has('HOKAGE_ROLE_ID'); // Replace with actual role ID
        if (!isHokage) {
            return interaction.followUp({ content: "Only the Hokage can manage the village bank!", ephemeral: true });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'add') {
            const amount = interaction.options.getInteger('amount');
            
            if (users[userId].money < amount) {
                return interaction.followUp({ content: "You don't have enough money!", ephemeral: true });
            }
            
            users[userId].money -= amount;
            village.villagebank = (village.villagebank || 0) + amount;
            
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
            
            return interaction.followUp({ content: `Successfully added ${amount} Ryo to the village bank.`, ephemeral: true });
        } else if (subcommand === 'distribute') {
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
};