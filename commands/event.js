const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle } = require('./combinedcommands.js');
const { userMutex, jutsuMutex } = require('../utils/locks');

// --- File Paths ---
const eventPath = path.resolve(__dirname, '../../menma/data/event.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const akatsukiEventPreviewPath = path.resolve(__dirname, '../../menma/data/akatsukievent.json');

// --- Config ---
const ZORO_BASE = {
    hp: 100,
    power: 50,
    defense: 50,
    chakra: 100,
    accuracy: 95,
    dodge: 10
};

const ZORO_LEVEL_GAIN = {
    hp: 20,
    power: 10,
    defense: 10
};

const ZORO_JUTSUS = [
    "Sword Slash",
    "Oni Giri",
    "Tiger Hunt",
    "Bull Charge",
    "Three Thousand Worlds",
    "Ashura: Makyusen"
];

const FLOOR_NPCS = [
    "Sasori", "Hidan", "Kabuto", "Konan", "Kakuzu",
    "Kisame", "Sasuke Uchiha", "Jugo", "Suigetsu", "Obito Uchiha"
];

const SUMMON_POOL = [
    { name: "1,000 EXP", type: "exp", value: 1000, weight: 90 },
    { name: "500 EXP", type: "exp", value: 500, weight: 90 },
    { name: "10,000 EXP", type: "exp", value: 10000, weight: 50 },
    { name: "10 Ramen", type: "ramen", value: 10, weight: 90 },
    { name: "50 Ramen", type: "ramen", value: 50, weight: 20 },
    { name: "100 Ramen", type: "ramen", value: 100, weight: 10 },
    { name: "OMEGA RARE 250 Ramen", type: "ramen", value: 250, weight: 0.1 },
    { name: "10,000 Ryo", type: "ryo", value: 10000, weight: 90 },
    { name: "100,000 Ryo", type: "ryo", value: 100000, weight: 50 },
    { name: "1,000,000 Ryo", type: "ryo", value: 1000000, weight: 10 },
    { name: "5,000,000 Ryo", type: "ryo", value: 5000000, weight: 5 },
    { name: "10,000,000 Ryo", type: "ryo", value: 10000000, weight: 1 },
    { name: "GIGA RARE 50,000,000 Ryo", type: "ryo", value: 50000000, weight: 0.1 },
    { name: "Akatsuki Profile Theme", type: "theme", value: "Akatsuki", weight: 5 },
    { name: "Susanoo", type: "jutsu", value: "Susanoo", weight: 10 },
    { name: "Amaterasu: Infinite Flames", type: "jutsu", value: "Amaterasu: Infinite Flames", weight: 5 },
    { name: "Tsukuyomi", type: "jutsu", value: "Tsukuyomi", weight: 5 },
    { name: "Almighty Push", type: "jutsu", value: "Almighty Push", weight: 5 },
    { name: "Praise Jashin", type: "jutsu", value: "Praise Jashin", weight: 5 },
    { name: "Kamui", type: "jutsu", value: "Kamui", weight: 5 },
    { name: "Izanami", type: "jutsu", value: "Izanami", weight: 0.01 }
];

// --- Helpers ---
function loadEventData() {
    if (!fs.existsSync(eventPath)) return { users: {} };
    try {
        return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    } catch (e) {
        return { users: {} };
    }
}

function saveEventData(data) {
    fs.writeFileSync(eventPath, JSON.stringify(data, null, 2));
}

function getZoroStats(level) {
    return {
        health: ZORO_BASE.hp + (level - 1) * ZORO_LEVEL_GAIN.hp,
        power: ZORO_BASE.power + (level - 1) * ZORO_LEVEL_GAIN.power,
        defense: ZORO_BASE.defense + (level - 1) * ZORO_LEVEL_GAIN.defense,
        chakra: ZORO_BASE.chakra,
        accuracy: ZORO_BASE.accuracy,
        dodge: ZORO_BASE.dodge
    };
}

async function getWebhook(channel, name, avatar) {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === name);
    if (!wh) {
        wh = await channel.createWebhook({ name, avatar });
    }
    return wh;
}

async function sendWebhookAndWait(webhook, content, userId, channel) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`event_continue_${userId}`).setLabel('Continue').setStyle(ButtonStyle.Primary)
    );
    const msg = await webhook.send({ content, components: [row] });

    try {
        const i = await channel.awaitMessageComponent({
            filter: i => i.user.id === userId && i.customId === `event_continue_${userId}`,
            time: 300000
        });
        await i.deferUpdate();
        await webhook.editMessage(msg.id, { components: [] });
    } catch (e) {
        await webhook.editMessage(msg.id, { components: [] });
    }
}

function weightedRandom(pool) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of pool) {
        if (random < item.weight) return item;
        random -= item.weight;
    }
    return pool[0];
}

// --- Main Command ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Akatsuki Event commands')
        .addSubcommand(sub => sub.setName('summon').setDescription('Summon for Akatsuki rewards (Cost: 100k Ryo)'))
        .addSubcommand(sub => sub.setName('story').setDescription('Progress through the Akatsuki Event story'))
        .addSubcommand(sub => sub.setName('fight').setDescription('Fight through 100 floors as Zoro'))
        .addSubcommand(sub => sub.setName('shop').setDescription('Exchange Akatsuki Tokens for Jutsus and Themes'))
        .addSubcommand(sub => sub.setName('cardlevelup').setDescription('Level up your Zoro card (Cost: Ryo)'))
        .addSubcommand(sub => sub.setName('cardawaken').setDescription('Awaken your Zoro card (Cost: Card Essence)')),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        // 1. Check Preview Completion
        if (!fs.existsSync(akatsukiEventPreviewPath)) {
            return interaction.reply({ content: "To begin interacting with the event, please finish the Preview. https://shinobirpg.online/story", ephemeral: true });
        }
        const previewData = JSON.parse(fs.readFileSync(akatsukiEventPreviewPath, 'utf8'));
        if (!previewData.users || !previewData.users[userId]) {
            return interaction.reply({ content: "To begin interacting with the event, please finish the Preview. https://shinobirpg.online/story", ephemeral: true });
        }

        const eventData = loadEventData();
        if (!eventData.users[userId]) {
            eventData.users[userId] = {
                storyStage: 0,
                tokens: 0,
                zoro: {
                    level: 1,
                    exp: 0,
                    awakenStage: 0,
                    floorsCleared: 0,
                    cardEssence: 0,
                    currentFloor: 1
                },
                inventory: { jutsus: [], themes: [] }
            };
            saveEventData(eventData);
        }
        const userEvent = eventData.users[userId];

        // --- Subcommands ---
        if (subcommand === 'story') {
            await handleStory(interaction, userId, userEvent, eventData);
        } else if (subcommand === 'summon') {
            await handleSummon(interaction, userId, userEvent, eventData);
        } else if (subcommand === 'fight') {
            await handleFight(interaction, userId, userEvent, eventData);
        } else if (subcommand === 'shop') {
            await handleShop(interaction, userId, userEvent, eventData);
        } else if (subcommand === 'cardlevelup') {
            await handleLevelUp(interaction, userId, userEvent, eventData);
        } else if (subcommand === 'cardawaken') {
            await handleAwaken(interaction, userId, userEvent, eventData);
        }
    }
};

// --- Subcommand Handlers ---

async function handleStory(interaction, userId, userEvent, eventData) {
    if (userEvent.storyStage < 0) return interaction.reply({ content: "You have finished the story introduction!", ephemeral: true });

    await interaction.deferReply();
    const channel = interaction.channel;
    const user = interaction.user;

    // Webhook PFPs
    const ZORO_PFP = 'https://i.pinimg.com/736x/28/95/36/289536f9297400c9b08101dec6b9ec08.jpg';
    const GUARD_PFP = 'https://i.postimg.cc/MKdPX766/image.png';
    const ITACHI_PFP = 'https://i.pinimg.com/736x/8d/7c/55/8d7c55de7de9be2201cf06d53b9e31fa.gif';
    const MYSTERY_PFP = 'https://static.wikia.nocookie.net/naruto/images/4/45/Hagoromo_pfp.png'; // Fallback

    const zoroWH = await getWebhook(channel, 'Zoro', ZORO_PFP);
    const userWH = await getWebhook(channel, user.username, user.displayAvatarURL());
    const guardWH = await getWebhook(channel, 'Guard#1', GUARD_PFP);
    const itachiWH = await getWebhook(channel, 'Itachi', ITACHI_PFP);

    if (userEvent.storyStage === 0) {
        await sendWebhookAndWait(userWH, "Oh god. What have i done to deserve this? Where am i?", userId, channel);
        await sendWebhookAndWait(zoroWH, "Oi! When you were retrieving the scroll you were followed by 2 men in black! You have no senses!", userId, channel);
        await sendWebhookAndWait(userWH, "Zoro? You're here too?", userId, channel);
        await sendWebhookAndWait(zoroWH, "I had to co-operate. He used a strange mind technique.", userId, channel);
        await sendWebhookAndWait(userWH, "it's called a genjutsu. We need to get out of here.", userId, channel);
        await sendWebhookAndWait(zoroWH, "I can break these chains with ease, but it'll only end up worse for us. There's bunch of guards outside.", userId, channel);
        await sendWebhookAndWait(userWH, "where are your swords?", userId, channel);
        await sendWebhookAndWait(zoroWH, "They took em, bastards. Or i wouldnt sit here like a coward.", userId, channel);
        await sendWebhookAndWait(userWH, "I have enough energy to um maybe kill a guard or two.", userId, channel);
        await sendWebhookAndWait(zoroWH, "I don't know how it's gonna help but here, take this an old dying man gave it to me.", userId, channel);

        await interaction.followUp({ content: "**<Obtained 1x Pocket Watch>**" });

        await sendWebhookAndWait(userWH, "a watch? I aint Sure how this is gonna work. Nothings gonna happen if we sit here all day!", userId, channel);
        await sendWebhookAndWait(zoroWH, "Alright. \n**<Zoro breaks all the chains using Conquerors haki>** \nLet's go!", userId, channel);
        await sendWebhookAndWait(userWH, "Careful, do not yell!", userId, channel);
        await sendWebhookAndWait(guardWH, "THEY BROKE THROUGH. EVERYONE ASSEMBLE!", userId, channel);
        await sendWebhookAndWait(zoroWH, "Well..Shit.", userId, channel);
        await sendWebhookAndWait(userWH, "Alright...Watch this.", userId, channel);

        // Guard Fight
        const guardsNPC = {
            name: "100 Guards",
            image: GUARD_PFP,
            health: 100,
            power: 10,
            defense: 10,
            chakra: 0,
            jutsu: ["Attack"],
            statsType: "fixed"
        };

        // Use player1Override to force Energy Blast
        const userOverride = {
            name: user.username,
            jutsu: { "0": "Energy Blast" },
            health: 100,
            currentHealth: 100,
            power: 50,
            defense: 50,
            chakra: 100
        };

        await interaction.followUp({ content: "The battle begins!" });
        await runBattle(interaction, userId, "NPC_100Guards", "event_story", guardsNPC, 'friendly', false, userOverride);


        await sendWebhookAndWait(userWH, "Hah! Take that. Although..that took all my energy.", userId, channel);
        await sendWebhookAndWait(zoroWH, "Let's find my swords!", userId, channel);
        await interaction.followUp({ content: "*They look around*\nThey find a room that is covered in ice." });

        await sendWebhookAndWait(userWH, "That is hella Fishy.", userId, channel);
        await sendWebhookAndWait(zoroWH, "This is where my swords are", userId, channel);
        await sendWebhookAndWait(userWH, "how do you know?", userId, channel);
        await sendWebhookAndWait(zoroWH, "**Barges in** There they are! \n**<Picks up his swords>**", userId, channel);
        await sendWebhookAndWait(userWH, "Oof! Thank god. Now let's get out of here.", userId, channel);
        await interaction.followUp({ content: "**As they are about to walk out...**" });
        await sendWebhookAndWait(userWH, "Great..nothing new here. Your regular boring plot twist.", userId, channel);
        await sendWebhookAndWait(zoroWH, "I feel the presence again, its the Genjutsu guy.", userId, channel);
        await sendWebhookAndWait(userWH, "There he is...", userId, channel);
        await sendWebhookAndWait(itachiWH, "You broke out? How annoying.", userId, channel);
        await sendWebhookAndWait(zoroWH, "I will crush your skull!", userId, channel);
        await sendWebhookAndWait(userWH, "What do you want from me? why have you been following me?", userId, channel);
        await sendWebhookAndWait(itachiWH, "I needed your blood. Now, i have it. You can die.", userId, channel);

        await interaction.followUp({ content: "**Itachi disappears** But the rest of the akatsuki members appear." });
        await sendWebhookAndWait(zoroWH, "Tch. I'm done. ***ENMA***", userId, channel);
        await interaction.followUp({ content: "**Zoro readies a powerful attack to strike a cloaked akatsuki figure but..**" });
        await sendWebhookAndWait(userWH, "Zoro, watch out!", userId, channel);
        await interaction.followUp({ content: "**Zoro is hit by a really big ice shard! He is bleeding**" });
        await interaction.followUp({ content: "User looks up to see who did it and There's another fall falling right at User." });
        await sendWebhookAndWait(userWH, "So this is how it ends...", userId, channel);

        await interaction.followUp({ content: "**<1x Pocket Watch used>**\n**A Strange Noise Echoes**: ***REPLAY***", embeds: [new EmbedBuilder().setTitle("TIME RESET").setColor("#000000").setImage("https://media.tenor.com/2Yy-f2Wf_rAAAAAM/time-rewind.gif")] });

        await sendWebhookAndWait(zoroWH, "I feel the presence again, its the Genjutsu guy.", userId, channel);
        await sendWebhookAndWait(userWH, "H-Huh...", userId, channel);
        await sendWebhookAndWait(itachiWH, "You broke out? How annoying.", userId, channel);
        await sendWebhookAndWait(zoroWH, "I will crush your skull!", userId, channel);
        await sendWebhookAndWait(userWH, "Zoro! whatever you do, Do not attack!", userId, channel);
        await sendWebhookAndWait(zoroWH, "Huh?", userId, channel);
        await sendWebhookAndWait(userWH, "Listen to me, please! the pocket watch is a mythical weapon, its reacting to the situation!", userId, channel);
        await sendWebhookAndWait(zoroWH, "Then what do you want me to do?", userId, channel);
        await sendWebhookAndWait(userWH, "I-Idon't know.", userId, channel);

        const scrollWH = await getWebhook(channel, "Mysterious Scroll", ITACHI_PFP);
        await sendWebhookAndWait(scrollWH, "Poor Soul. I Shall guide you.", userId, channel);

        await interaction.followUp({ content: "**<Obtained 1x Card Roronoa Zoro>**" });
        await sendWebhookAndWait(scrollWH, "Young'un. I request thou to equip this card. Please use `/event fight` and i shall guide you.", userId, channel);

        const introEmbed = new EmbedBuilder()
            .setTitle("Event Introduction Complete!")
            .setColor("#FF0000")
            .setDescription("You can now play as Zoro. After switching to Zoro, you can use `/event fight` and fight your way to Itachi! It's not that easy though! You must level him up using `/event cardlevelup` and slowly unlock his moves using `/event cardawaken`.")
            .setImage(ZORO_PFP);

        await interaction.followUp({ embeds: [introEmbed] });

        userEvent.storyStage = 1;
        saveEventData(eventData);
    }
}

async function handleSummon(interaction, userId, userEvent, eventData) {
    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    const userSS = players[userId]?.ss || 0;

    const SUMMON_IMG = "https://i.pinimg.com/736x/16/59/f5/1659f5bc946d0612435bd6f70d164e81.jpg";

    const rewardList = [
        "• 1,000 / 500 / 10,000 EXP",
        "• 10 / 50 / 100 / 250 Ramen",
        "• 10k / 100k / 1m / 5m / 10m / 50m Ryo",
        "• Akatsuki Profile Theme (Rare)",
        "**Legendary Jutsus:**",
        "• Susanoo",
        "• Amaterasu: Infinite Flames",
        "• Tsukuyomi",
        "• Almighty Push",
        "• Praise Jashin",
        "• Kamui",
        "• **Izanami** (LOWEST CHANCE)"
    ].join('\n');

    const summonEmbed = new EmbedBuilder()
        .setTitle("Akatsuki Summon")
        .setColor("#8B0000")
        .setDescription(`**Welcome to the Akatsuki Summon!**\n\nTest your luck and obtain powerful jutsus, rare themes, and massive rewards!\n\n**Obtainable Rewards:**\n${rewardList}\n\n**Cost:**\n- 1 Summon: **10 SS**\n- 10 Summons: **100 SS**\n\n**Current SS:** \`${userSS}\`\n\n*10 Summons guarantee 10 Akatsuki Tokens!*`)
        .setImage(SUMMON_IMG);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('summon_1')
            .setLabel('Summon x1 (10 SS)')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(userSS < 10),
        new ButtonBuilder()
            .setCustomId('summon_10')
            .setLabel('Summon x10 (100 SS)')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(userSS < 100)
    );

    const msg = await interaction.reply({ embeds: [summonEmbed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async i => {
        const count = i.customId === 'summon_1' ? 1 : 10;
        const cost = count * 10;

        const freshPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        if ((freshPlayers[userId]?.ss || 0) < cost) {
            return i.reply({ content: `You don't have enough SS! You need ${cost}.`, ephemeral: true });
        }

        freshPlayers[userId].ss -= cost;
        fs.writeFileSync(playersPath, JSON.stringify(freshPlayers, null, 2));

        await i.deferUpdate();

        // Animation
        const colors = ['#000000', '#FF0000', '#8B0000', '#FF4500', '#DC143C'];
        const animationEmbed = new EmbedBuilder()
            .setTitle("Summoning...")
            .setImage(SUMMON_IMG);

        for (let j = 0; j < 5; j++) {
            animationEmbed.setColor(colors[j]);
            await msg.edit({ embeds: [animationEmbed], components: [] });
            await new Promise(r => setTimeout(r, 600));
        }

        // Rewards
        const results = [];
        for (let j = 0; j < count; j++) {
            results.push(weightedRandom(SUMMON_POOL));
        }

        userEvent.tokens += count === 1 ? 1 : 10; // 10 tokens for 10x roll

        // Apply Rewards
        const rewardSummary = results.map(r => r.name).join('\n');
        const finalPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        const finalUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userJutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
        const userJutsuData = JSON.parse(fs.readFileSync(userJutsuPath, 'utf8'));
        if (!userJutsuData[userId]) userJutsuData[userId] = { scrolls: [] };

        results.forEach(reward => {
            if (reward.type === 'ryo') {
                finalPlayers[userId].money = (finalPlayers[userId].money || 0) + reward.value;
            } else if (reward.type === 'exp') {
                finalPlayers[userId].exp = (finalPlayers[userId].exp || 0) + reward.value;
            } else if (reward.type === 'ramen') {
                finalUsers[userId].ramen = (finalUsers[userId].ramen || 0) + reward.value;
            } else if (reward.type === 'jutsu') {
                if (!userJutsuData[userId].scrolls.includes(reward.value)) {
                    userJutsuData[userId].scrolls.push(reward.value);
                }
            } else if (reward.type === 'theme') {
                userEvent.inventory.themes.push(reward.value);
            }
        });

        fs.writeFileSync(playersPath, JSON.stringify(finalPlayers, null, 2));
        fs.writeFileSync(usersPath, JSON.stringify(finalUsers, null, 2));
        fs.writeFileSync(userJutsuPath, JSON.stringify(userJutsuData, null, 2));
        saveEventData(eventData);

        const resultEmbed = new EmbedBuilder()
            .setTitle(count === 1 ? "Summon Result" : "10x Summon Results")
            .setColor("#FFD700")
            .setDescription(`**You obtained:**\n${rewardSummary}\n\n**+${count === 1 ? 1 : 10} Akatsuki Tokens**`)
            .setImage(SUMMON_IMG);

        await msg.edit({ embeds: [resultEmbed], components: [] });
        collector.stop();
    });
}

async function handleFight(interaction, userId, userEvent, eventData) {
    if (userEvent.storyStage < 1) {
        return interaction.reply({ content: "You must finish the story introduction first! Use `/event story`.", ephemeral: true });
    }

    await interaction.deferReply();

    const floor = userEvent.zoro.currentFloor;
    const tier = Math.floor((floor - 1) / 10) + 1;
    const npcIdx = (floor - 1) % 10;
    const npcName = FLOOR_NPCS[npcIdx];

    const multiplier = Math.pow(5, tier - 1);

    const zoroStats = getZoroStats(userEvent.zoro.level);
    const zoroJutsus = ZORO_JUTSUS.slice(0, userEvent.zoro.awakenStage + 1);

    // Create Zoro Mock
    const zoroPlayer = {
        name: "Roronoa Zoro",
        image: "https://i.pinimg.com/736x/28/95/36/289536f9297400c9b08101dec6b9ec08.jpg",
        ...zoroStats,
        currentHealth: zoroStats.health,
        maxHealth: zoroStats.health,
        jutsu: Object.fromEntries(zoroJutsus.map((j, i) => [i, j])),
        statsType: "fixed",
        userId: userId // needed for session
    };

    // Create NPC
    const npc = {
        name: npcName + ` (Floor ${floor})`,
        image: "", // user said leave blank
        health: 100 * multiplier * (1 + (floor - 1) * 0.1),
        currentHealth: 100 * multiplier * (1 + (floor - 1) * 0.1),
        power: 50 * multiplier * (1 + (floor - 1) * 0.1),
        defense: 50 * multiplier * (1 + (floor - 1) * 0.1),
        chakra: 1000,
        accuracy: 90 + floor,
        dodge: 10 + floor,
        jutsu: ["Attack", "Fireball Jutsu", "Rasengan"], // Default strong jutsus
        statsType: "fixed",
        immunities: ["stun", "bleed", "burn", "status"]
    };

    if (floor === 100) {
        npc.name = "Ultimate Boss: Itachi Uchiha";
        npc.health = 5000000000;
        npc.currentHealth = 5000000000;
        npc.power = 20000000;
        npc.defense = 20000000;
        npc.jutsu = ["Izanami", "Tsukuyomi", "Amaterasu: Infinite Flames", "Susanoo"];
    }

    const result = await runBattle(interaction, userId, `NPC_${npcName}`, "event_fight", npc, 'friendly', false, zoroPlayer);


    if (result && result.winner && result.winner.userId === userId) {
        // WIN
        userEvent.zoro.floorsCleared = Math.max(userEvent.zoro.floorsCleared, floor);
        userEvent.zoro.currentFloor = floor + 1;
        userEvent.zoro.cardEssence += 1;

        const winEmbed = new EmbedBuilder()
            .setTitle(`Floor ${floor} Cleared!`)
            .setColor("#00FF00")
            .setDescription(`You defeated ${npcName}!\n\n**+1 Card Essence**\nNext Floor: ${floor + 1}`)
            .setImage(zoroPlayer.image);

        if (floor === 100) {
            winEmbed.setDescription("CONGRATULATIONS! You have defeated Itachi Uchiha. The story continues in the next update... To be continued!");
            userEvent.zoro.currentFloor = 100; // stick at 100
        }

        saveEventData(eventData);
        await interaction.followUp({ embeds: [winEmbed] });
    } else {
        // LOSS
        userEvent.zoro.currentFloor = 1;
        saveEventData(eventData);
        const lossEmbed = new EmbedBuilder()
            .setTitle("BATTLE DEFEAT")
            .setColor("#FF0000")
            .setDescription("You were defeated. You must restart from Floor 1! Keep your levels and awakenings, and try again.");
        await interaction.followUp({ embeds: [lossEmbed] });
    }
}

async function handleLevelUp(interaction, userId, userEvent, eventData) {
    const cost = 200000 + (userEvent.zoro.level - 1) * 50000;
    const maxLevel = (userEvent.zoro.awakenStage + 1) * 20;

    if (userEvent.zoro.level >= maxLevel) {
        return interaction.reply({ content: `Zoro has reached his current level cap (${maxLevel})! Awaken him to increase the cap.`, ephemeral: true });
    }

    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    if (players[userId].money < cost) {
        return interaction.reply({ content: `You need ${cost.toLocaleString()} Ryo to level up!`, ephemeral: true });
    }

    players[userId].money -= cost;
    userEvent.zoro.level += 1;

    fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
    saveEventData(eventData);

    const stats = getZoroStats(userEvent.zoro.level);
    const embed = new EmbedBuilder()
        .setTitle("Zoro Level Up!")
        .setColor("#00FF00")
        .setDescription(`Zoro is now Level **${userEvent.zoro.level}**!\n\n**HP:** ${stats.health}\n**Power:** ${stats.power}\n**Defense:** ${stats.defense}`)
        .setFooter({ text: `Next Level Cost: ${(200000 + (userEvent.zoro.level - 1) * 50000).toLocaleString()} Ryo` });

    await interaction.reply({ embeds: [embed] });
}

async function handleAwaken(interaction, userId, userEvent, eventData) {
    if (userEvent.zoro.awakenStage >= 5) {
        return interaction.reply({ content: "Zoro is already fully awakened!", ephemeral: true });
    }

    if (userEvent.zoro.cardEssence < 20) {
        return interaction.reply({ content: `You need 20 Card Essence to awaken! (You have ${userEvent.zoro.cardEssence})`, ephemeral: true });
    }

    userEvent.zoro.cardEssence -= 20;
    userEvent.zoro.awakenStage += 1;

    const newJutsu = ZORO_JUTSUS[userEvent.zoro.awakenStage];
    saveEventData(eventData);

    const embed = new EmbedBuilder()
        .setTitle("ZORO AWAKENED!")
        .setColor("#FFD700")
        .setDescription(`Zoro has reached Awakening Stage **${userEvent.zoro.awakenStage}**!\n\n**Unlocked Jutsu:** ${newJutsu}\n**New Level Cap:** ${(userEvent.zoro.awakenStage + 1) * 20}`)
        .setImage("https://i.pinimg.com/736x/28/95/36/289536f9297400c9b08101dec6b9ec08.jpg");

    await interaction.reply({ embeds: [embed] });
}

async function handleShop(interaction, userId, userEvent, eventData) {
    const shopEmbed = new EmbedBuilder()
        .setTitle("Akatsuki Token Shop")
        .setColor("#8B0000")
        .setDescription(`Spend your Akatsuki Tokens here to obtain legendary techniques and exclusive themes!\n\n**Your Balance:** \`${userEvent.tokens} Tokens\``)
        .setImage("https://i.postimg.cc/3J4VD64M/image.png")
        .addFields(
            { name: "Susanoo", value: "50 Tokens", inline: true },
            { name: "Amaterasu: Infinite Flames", value: "75 Tokens", inline: true },
            { name: "Tsukuyomi", value: "75 Tokens", inline: true },
            { name: "Almighty Push", value: "60 Tokens", inline: true },
            { name: "Kamui", value: "60 Tokens", inline: true },
            { name: "Praise Jashin", value: "50 Tokens", inline: true },
            { name: "Izanami", value: "200 Tokens", inline: true },
            { name: "Akatsuki Profile Theme", value: "100 Tokens", inline: true }
        );

    const select = new StringSelectMenuBuilder()
        .setCustomId('shop_select')
        .setPlaceholder('Select an item to buy')
        .addOptions([
            { label: 'Susanoo', value: 'Susanoo_50' },
            { label: 'Amaterasu: Infinite Flames', value: 'Amaterasu: Infinite Flames_75' },
            { label: 'Tsukuyomi', value: 'Tsukuyomi_75' },
            { label: 'Almighty Push', value: 'Almighty Push_60' },
            { label: 'Kamui', value: 'Kamui_60' },
            { label: 'Praise Jashin', value: 'Praise Jashin_50' },
            { label: 'Izanami', value: 'Izanami_200' },
            { label: 'Akatsuki Profile Theme', value: 'Theme_100' }
        ]);

    const row = new ActionRowBuilder().addComponents(select);
    const msg = await interaction.reply({ embeds: [shopEmbed], components: [row] });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async i => {
        const [name, costStr] = i.values[0].split('_');
        const cost = parseInt(costStr);

        if (userEvent.tokens < cost) {
            return i.reply({ content: `You don't have enough tokens! You need ${cost}.`, ephemeral: true });
        }

        userEvent.tokens -= cost;
        if (name === 'Theme') {
            userEvent.inventory.themes.push('Akatsuki');
        } else {
            const userJutsuPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
            const userJutsuData = JSON.parse(fs.readFileSync(userJutsuPath, 'utf8'));
            if (!userJutsuData[userId]) userJutsuData[userId] = { scrolls: [] };
            if (!userJutsuData[userId].scrolls.includes(name)) {
                userJutsuData[userId].scrolls.push(name);
                fs.writeFileSync(userJutsuPath, JSON.stringify(userJutsuData, null, 2));
            }
        }

        saveEventData(eventData);
        await i.reply({ content: `Successfully purchased **${name}**!`, ephemeral: true });
        collector.stop();
    });
}
