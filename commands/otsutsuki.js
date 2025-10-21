const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { runBattle } = require('./combinedcommands');

const TONERI_NPC = {
    name: "Toneri Otsutsuki",
    image: "https://www.pngplay.com/wp-content/uploads/12/Toneri-Otsutsuki-Transparent-Images.png",
    baseHealth: 15,
    basePower: 10,
    baseDefense: 10,
    accuracy: 1000,
    Chakra: 1000,
    dodge: 75,
    background: "https://static.wikia.nocookie.net/naruto/images/1/13/Luna.png/revision/latest?cb=20100606104042&path-prefix=it",
    jutsu: [
        "Attack",
        "Tenseigan Chakra Mode",
        "Otsutsuki's Wrath",
        "Truth-Seeking Orbs"
    ]
};

const TONERI_REWARDS = {
    xp: 25000,
    ryo: 100000,
    item: "Tenseigan Scroll"
};

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const giftPath = path.resolve(__dirname, '../../menma/data/gift.json');
const cooldownPath = path.resolve(__dirname, '../../menma/data/otsutsuki_cooldowns.json');

const COOLDOWN_DURATION = 20 * 60 * 1000; // 20 minutes in ms

// Utility to load and save gift.json
function loadGiftData() {
    if (!fs.existsSync(giftPath)) return {};
    return JSON.parse(fs.readFileSync(giftPath, 'utf8'));
}

function saveGiftData(data) {
    fs.writeFileSync(giftPath, JSON.stringify(data, null, 2));
}

// Utility to generate a unique gift ID
function generateGiftId(userGifts) {
    let id;
    do {
        id = Math.floor(Math.random() * 5000) + 1;
    } while (userGifts && userGifts.some(g => g.id === id));
    return id;
}

// Function to add rewards to gift inventory
function addRewardsToGiftInventory(userId, rewards) {
    let giftData = loadGiftData();
    if (!giftData[userId]) giftData[userId] = [];
    
    // Add money reward
    const moneyGiftId = generateGiftId(giftData[userId]);
    giftData[userId].push({
        id: moneyGiftId,
        type: 'money',
        amount: rewards.ryo,
        from: 'system',
        date: Date.now(),
        source: 'Otsutsuki Victory'
    });
    
    // Add item reward if it exists
    if (rewards.item) {
        const itemGiftId = generateGiftId(giftData[userId]);
        giftData[userId].push({
            id: itemGiftId,
            type: 'scroll', // <-- changed from 'jutsu' to 'scroll'
            name: rewards.item,
            from: 'system',
            date: Date.now(),
            source: 'Otsutsuki Victory'
        });
    }
    
    // Add XP reward
    const xpGiftId = generateGiftId(giftData[userId]);
    giftData[userId].push({
        id: xpGiftId,
        type: 'exp',
        amount: rewards.xp,
        from: 'Otsutsuki',
        date: Date.now(),
        source: 'Otsutsuki Victory'
    });
    
    saveGiftData(giftData);
    return giftData[userId].filter(g => g.source === 'Otsutsuki Victory');
}

function loadCooldowns() {
    if (!fs.existsSync(cooldownPath)) return {};
    return JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
}

function saveCooldowns(data) {
    fs.writeFileSync(cooldownPath, JSON.stringify(data, null, 2));
}

function isOnCooldown(userId) {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) return false;
    return Date.now() < cooldowns[userId];
}

function setCooldown(userId) {
    const cooldowns = loadCooldowns();
    cooldowns[userId] = Date.now() + COOLDOWN_DURATION;
    saveCooldowns(cooldowns);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otsutsuki')
        .setDescription('Challenge the otsutsuki.'),

    async execute(interaction) {
        // Defer the reply to give time for the battle logic to run
        await interaction.deferReply();

        const userId = interaction.user.id;
        const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : {};

        if (!users[userId]) {
           
            return interaction.editReply({
                content: "You must enroll before challenging an Otsutsuki! Use the `/enroll` command."
            });
        }

        // Check for cooldown
        if (isOnCooldown(userId)) {
            const cooldowns = loadCooldowns();
            const remaining = Math.ceil((cooldowns[userId] - Date.now()) / 60000);
            return interaction.editReply({
                content: `You must wait ${remaining} more minute(s) before challenging the Otsutsuki again.`
            });
        }

        const npcId = "NPC_Toneri_Otsutsuki";
        // Assuming runBattle handles the entire battle interaction and returns 'win' or 'lose'
        const battleResult = await runBattle(
            interaction,
            userId,
            npcId,
            'otsutsuki',
            TONERI_NPC
        );
        try {
            await interaction.editReply({ content: 'Battle sequence concluded. Processing results...', components: [] });
        } catch (error) {
            // Log if we can't edit the initial message, but continue execution.
            console.error('Could not edit initial deferred reply:', error);
        }
        // -------------------------

        if (battleResult === 'win') {
            // Set cooldown for 20 minutes
            setCooldown(userId);

            // Add rewards to gift inventory
            const giftedRewards = addRewardsToGiftInventory(userId, TONERI_REWARDS);
            
            // Create rewards embed
            const rewardsEmbed = new EmbedBuilder()
                .setTitle(`Victory! ${TONERI_NPC.name} Defeated!`)
                .setDescription(`You have successfully defeated the powerful Otsutsuki! Your rewards have been sent to your gift inventory.`)
                .setColor('#00ff00')
                .addFields(
                    { 
                        name: 'Ryo Earned', 
                        value: `+${TONERI_REWARDS.ryo.toLocaleString()}`, 
                        inline: true 
                    },
                    { 
                        name: 'XP Gained', 
                        value: `+${TONERI_REWARDS.xp.toLocaleString()}`, 
                        inline: true 
                    },
                    { 
                        name: 'Item Received', 
                        value: `${TONERI_REWARDS.item}`, 
                        inline: false 
                    },
                    { 
                        name: 'Gift Information', 
                        value: `Use \`/gift inventory\` to claim your rewards!\n**Gift IDs:** ${giftedRewards.map(g => g.id).join(', ')}`, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'The peace of the world is safe... for now.' })
                .setTimestamp()
                .setThumbnail(TONERI_NPC.image);

            
            await interaction.followUp({ 
                embeds: [rewardsEmbed], 
                components: [] 
            });
        } else {
            // Treat any non-'win' result as a loss
            const lossEmbed = new EmbedBuilder()
                .setTitle(`Defeat!`)
                .setDescription(`${TONERI_NPC.name} has defeated you.`)
                .setColor('#ff0000')
                .setFooter({ text: 'You can try as many times as you want!' })
                .setTimestamp()
                .setThumbnail(TONERI_NPC.image);

            await interaction.followUp({ 
                embeds: [lossEmbed], 
                components: [] 
            });
        }
    }
};
