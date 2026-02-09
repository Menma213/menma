const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { runBattle } = require('./combinedcommands.js');
const fs = require('fs');
const path = require('path');

const ADMIN_ID = "961918563382362122"; // Based on scroll.js
const COOLDOWN_PATH = path.resolve(__dirname, '../../menma/data/quiz_event_cooldown.json');
const RAID_DATA_PATH = path.resolve(__dirname, '../../menma/data/deidara_raid.json');
const PLAYERS_PATH = path.resolve(__dirname, '../../menma/data/players.json');

const TEUCHI_AVATAR = 'https://i.postimg.cc/MZjPTd7g/image.png';
const DEIDARA_AVATAR = 'https://i.pinimg.com/736x/26/ef/79/26ef7930af90c9db54da5091621b456c.jpg';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function getWebhook(channel, name, avatar) {
    try {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.name === name);
        if (!webhook) {
            webhook = await channel.createWebhook({
                name: name,
                avatar: avatar,
            });
        }
        return webhook;
    } catch (e) {
        console.error("Error getting webhook:", e);
        return null;
    }
}

async function startAkatsukiEvent(channel) {
    const teuchiWH = await getWebhook(channel, 'Teuchi', TEUCHI_AVATAR);

    // 1. Teuchi says "HELP ME!"
    const helpEmbed = new EmbedBuilder()
        .setTitle('Quiz...?')
        .setDescription('Teuchi is in trouble!')
        .setColor('#ff0000')
        .setImage(TEUCHI_AVATAR);

    const whatHappenedButton = new ButtonBuilder()
        .setCustomId('what_happened')
        .setLabel('What happened?')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(whatHappenedButton);

    if (teuchiWH) {
        await teuchiWH.send({
            content: "HELP ME!!!",
            embeds: [helpEmbed],
            components: [row],
            username: 'Teuchi',
            avatarURL: TEUCHI_AVATAR
        });
    } else {
        await channel.send({ content: "HELP ME!!!", embeds: [helpEmbed], components: [row] });
    }

    const participants = new Set();
    const filter = i => i.customId === 'what_happened';
    const collector = channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        if (!participants.has(i.user.id)) {
            participants.add(i.user.id);
            await i.reply({ content: `${i.user.username} has joined to help!`, ephemeral: false });
        } else {
            await i.reply({ content: `You already joined!`, ephemeral: true });
        }
    });

    await delay(60000); // Wait 1 minute
    collector.stop();

    if (participants.size === 0) {
        return channel.send("Nobody came to help... Teuchi was kidnapped? (Event cancelled due to no participants)");
    }

    // 2. Story Plays
    if (teuchiWH) {
        await teuchiWH.send({
            content: "Someone has been bullying me and stealing the stuff from the shop! please help me.",
            username: 'Teuchi',
            avatarURL: TEUCHI_AVATAR
        });
    } else {
        await channel.send("**Teuchi**: Someone has been bullying me and stealing the stuff from the shop! please help me.");
    }

    await delay(2000);

    if (teuchiWH) {
        await teuchiWH.send({
            content: "Look that cloaked man is coming back! fight him off!",
            username: 'Teuchi',
            avatarURL: TEUCHI_AVATAR
        });
    } else {
        await channel.send("**Teuchi**: Look that cloaked man is coming back! fight him off!");
    }

    await delay(1000);

    const deidaraWH = await getWebhook(channel, 'Deidara', DEIDARA_AVATAR);
    if (deidaraWH) {
        await deidaraWH.send({
            content: "Old man! Did you miss me?",
            username: 'Deidara',
            avatarURL: DEIDARA_AVATAR
        });
    } else {
        await channel.send("**Deidara**: Old man! Did you miss me? Hmph!");
    }

    // 3. Fight Trigger
    const fightButton = new ButtonBuilder()
        .setCustomId('fight_deidara')
        .setLabel('Fight Deidara away!')
        .setStyle(ButtonStyle.Primary);

    const fightRow = new ActionRowBuilder().addComponents(fightButton);
    await channel.send({ content: "Deidara has arrived! All participants, prepare for battle!", components: [fightRow] });

    // Handle Battles One by One
    const fightFilter = i => i.customId === 'fight_deidara' && participants.has(i.user.id);
    const fightCollector = channel.createMessageComponentCollector({ filter: fightFilter, time: 300000 }); // 5 minutes to start fights

    const fought = new Set();
    let deidaraDefeated = false;

    fightCollector.on('collect', async i => {
        if (fought.has(i.user.id)) {
            return i.reply({ content: "You already fought him!", ephemeral: true });
        }
        fought.add(i.user.id);

        await i.reply({ content: "Starting battle...", ephemeral: true });

        // Deidara NPC Template
        const deidaraTemplate = {
            name: "Deidara",
            image: DEIDARA_AVATAR,
            health: 10000000000,
            currentHealth: 10000000000,
            maxHealth: 10000000000,
            power: 50000000,
            defense: 50000000,
            accuracy: 200000,
            dodge: 50,
            jutsu: ["Explosive Bird", "C3", "Rasengan"],
            statsType: 'fixed',
            immunities: ["stun", "flinch", "drown", "possessed", "bleed", "poison", "burn", "curse", "frost", "shadow_possession", "mist", "blind", "confuse", "stumble", "zap", "siphon", "darkness", "debuff", "all"]
        };

        const result = await runBattle(i, i.user.id, "NPC_Deidara", "raid", deidaraTemplate, 'friendly', true);

        // check if he was defeated during this fight
        const raidData = JSON.parse(fs.readFileSync(RAID_DATA_PATH, 'utf8'));
        if (raidData.currentHP <= 0) {
            deidaraDefeated = true;
            fightCollector.stop();
        }

        if (fought.size === participants.size) {
            fightCollector.stop();
        }
    });

    fightCollector.on('end', async () => {
        if (deidaraDefeated) {
            await channel.send("🎉 **DEIDARA HAS BEEN DEFEATED!** Everyone who participated earns **100 Ramen Coupons**!");

            // Give Rewards
            const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
            participants.forEach(userId => {
                if (players[userId]) {
                    players[userId].ramen = (players[userId].ramen || 0) + 100;
                }
            });
            fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));

            // Reset Deidara HP for next time? 
            // The prompt doesn't say to reset, so I'll keep it at 0 until someone manually resets or the next event loop.
        } else {
            await channel.send("Deidara managed to escape... for now.");
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Start the Akatsuki Event raid!'),
    name: 'quiz',
    description: 'Start the Akatsuki Event raid!',
    async execute(interaction, args) {
        // Main Server Restriction
        if (interaction.guildId !== '1381268582595297321') {
            const msg = 'This command can only be used in the main server.';
            if (interaction.reply) return interaction.reply({ content: msg, ephemeral: true });
            return interaction.channel.send(msg);
        }

        const userId = interaction.user ? interaction.user.id : interaction.author.id;
        const now = Date.now();
        const COOLDOWN_TIME = 12 * 60 * 60 * 1000;

        // Load Cooldowns
        let cooldowns = {};
        if (fs.existsSync(COOLDOWN_PATH)) {
            cooldowns = JSON.parse(fs.readFileSync(COOLDOWN_PATH, 'utf8'));
        }

        const lastRun = cooldowns.lastRun || 0;
        const isAdmin = userId === ADMIN_ID;

        if (!isAdmin && now < lastRun + COOLDOWN_TIME) {
            const remaining = lastRun + COOLDOWN_TIME - now;
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

            const msg = `The quiz event is on cooldown. Try again in ${hours}h ${minutes}m.`;
            if (interaction.reply) return interaction.reply({ content: msg, ephemeral: true });
            return interaction.channel.send(msg);
        }

        // Update Cooldown
        cooldowns.lastRun = now;
        fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(cooldowns, null, 2));

        if (interaction.reply) {
            await interaction.reply({ content: "Starting Akatsuki Event...", ephemeral: true });
        }

        await startAkatsukiEvent(interaction.channel);
    },
};
