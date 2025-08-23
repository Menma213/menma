

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '/workspaces/menma/images');
const combosPath = path.resolve(__dirname, '../../menma/data/combos.json');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Add Shuriken Throw jutsu to jutsuList if not present
if (!jutsuList["Shuriken Throw"]) {
    jutsuList["Shuriken Throw"] = {
        name: "Shuriken Throw",
        description: "A basic ranged attack with shuriken.",
        chakraCost: 0,
        effects: [
            { type: "damage", formula: "max(5, user.power * 0.5 - target.defense * 0.2)" }
        ]
    };
}

// Load combos from combos.json (future-proof, like jutsus)
let comboList = {};
if (fs.existsSync(combosPath)) {
    comboList = JSON.parse(fs.readFileSync(combosPath, 'utf8'));
}

// Effect handlers with improved error handling
const effectHandlers = {
    damage: (user, target, formula, effect = {}) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100,
                    dodge: Number(user.dodge) || 0
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0,
                    accuracy: Number(target.accuracy) || 100
                },
                // Add flags for special conditions
                hasHiddenMist: target.activeEffects?.some(e => e.type === 'status' && e.status === 'mist'),
                isTargetIncapacitated: target.activeEffects?.some(e => 
                    e.type === 'status' && 
                    ['stun', 'flinch'].includes(e.status)
                ),
                max: Math.max
            };

            // --- FLYING RAIJIN DODGE IMMUNITY PATCH ---
            // If target has a dodge >= 10000, they dodge everything this turn
            if (context.target.dodge >= 10000) {
                return { damage: 0, hit: false, special: "dodged" };
            }

            // Apply accuracy bonus if present
            const finalAccuracy = effect.accuracyBonus ? 
                effectHandlers.getAccuracyBonus(effect, context.user.accuracy) : 
                context.user.accuracy;
            const hitChance = Math.max(0, Math.min(100, finalAccuracy - context.target.dodge));
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

        if (!statsDefinition || typeof statsDefinition !== 'object') {
            return changes;
        }

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

        if (!statsDefinition || typeof statsDefinition !== 'object') {
            return changes;
        }

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
    status: (chance) => Math.random() < (chance || 1),

    // Add handling for bleeding status
    bleed: (target) => {
        const bleedDamage = Math.floor(target.health * 0.1); // 10% health as bleed damage
        return bleedDamage;
    },

    // Add handling for flinch status
    flinch: (chance) => Math.random() < chance,

    // Add handling for accuracy bonus
    getAccuracyBonus: (effect, baseAccuracy) => {
        return baseAccuracy + (effect.accuracyBonus || 0);
    }
};

// Add emoji constants
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
const COMBO_EMOJI_FILLED = ":o:";
const COMBO_EMOJI_EMPTY = ":white_circle:";
// Add chakra regen rates
const CHAKRA_REGEN = {
    'Academy Student': 1,
    'Genin': 2,
    'Chunin': 2,
    'Jounin': 2
};

// Bloodline emoji/gif/name/department definitions (copied from srank.js)
const BLOODLINE_EMOJIS = {
    Uchiha: "🩸",
    Hyuga: "👁️",
    Uzumaki: "🌀",
    Senju: "🌳",
    Nara: "🪙"
};
const BLOODLINE_GIFS = {
    Uchiha: "https://media.tenor.com/0QwQvQkQwQwAAAAd/sharingan.gif",
    Hyuga: "https://media.tenor.com/Hyuga.gif",
    Uzumaki: "https://media.tenor.com/Uzumaki.gif",
    Senju: "https://media.tenor.com/Senju.gif",
    Nara: "https://media.tenor.com/Nara.gif"
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

// Utility functions
function getCooldownString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

function getMaterialDrop(role) {
    if (role === "Hokage") return Math.floor(Math.random() * 3) + 12;
    if (role === "Right Hand Man") return Math.floor(Math.random() * 3) + 10;
    if (role === "Guard") return Math.floor(Math.random() * 3) + 8;
    if (role === "Spy") return Math.floor(Math.random() * 3) + 2;
    return 0;
}

function getRandomMaterial() {
    const mats = [
        { name: "Iron", emoji: "🪓", key: "iron" },
        { name: "Wood", emoji: "🌲", key: "wood" },
        { name: "Rope", emoji: "🪢", key: "rope" }
    ];
    return mats[Math.floor(Math.random() * mats.length)];
}

function getAkatsukiMaterialDrop(role) {
    if (role === "Akatsuki Leader") return Math.floor(Math.random() * 3) + 12;
    if (role === "Co-Leader") return Math.floor(Math.random() * 3) + 10;
    if (role === "Bruiser") return Math.floor(Math.random() * 3) + 8;
    if (role === "Scientist") return Math.floor(Math.random() * 3) + 2;
    return 0;
}

function getRandomAkatsukiMaterial() {
    const mats = [
        { name: "Metal", emoji: "🪙", key: "metal" },
        { name: "Gunpowder", emoji: "💥", key: "gunpowder" },
        { name: "Copper", emoji: "🔌", key: "copper" }
    ];
    return mats[Math.floor(Math.random() * mats.length)];
}

// Helper to robustly download remote images to a temp file and return the local path
async function downloadImageToFile(url) {
    return new Promise((resolve, reject) => {
        try {
            const isDiscordAvatar = url.includes('cdn.discordapp.com');
            const ext = isDiscordAvatar ? 'png' : 'png'; // Always use png for avatars, fallback to png for others
            const tmpDir = path.resolve(__dirname, '../images/tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tmpFile = path.join(tmpDir, `img_${Date.now()}_${Math.floor(Math.random()*10000)}.${ext}`);
            const file = fs.createWriteStream(tmpFile);
            https.get(url, res => {
                if (res.statusCode !== 200) {
                    file.close(() => {});
                    try { fs.unlinkSync(tmpFile); } catch {}
                    return reject(new Error(`Failed to download image: ${url}`));
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        fs.stat(tmpFile, (err, stats) => {
                            if (err || !stats || stats.size === 0) {
                                try { fs.unlinkSync(tmpFile); } catch {}
                                return reject(new Error(`Downloaded image is empty: ${url}`));
                            }
                            resolve(tmpFile);
                        });
                    });
                });
            }).on('error', err => {
                file.close(() => {});
                try { fs.unlinkSync(tmpFile); } catch {}
                reject(err);
            });
        } catch (e) {
            reject(e);
        }
    });
}

// Battle utilities
class BattleUtils {
    static getEffectiveStats(entity) {
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

        (entity.activeEffects || []).forEach(effect => {
            if (effect.type === 'buff' || effect.type === 'debuff') {
                Object.entries(effect.stats).forEach(([stat, value]) => {
                    effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                });
            }
        });

        return effectiveStats;
    }

    static getRoundEffect(roundEffects, currentRound) {
        for (const [roundRange, effectData] of Object.entries(roundEffects)) {
            const [start, end] = roundRange.split('-').map(Number);
            if ((end && currentRound >= start && currentRound <= end) || 
                (!end && currentRound === start)) {
                return effectData;
            }
        }
        return null;
    }

    static async generateBattleImage(player, npc, roundNum = 1, jutsu1 = null, jutsu2 = null) {
        const width = 800, height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Custom background handling
        let bgUrl = 'https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg';
        let customBg = null;
        if (jutsu1 && jutsu1.custombackground && jutsu1.custombackground.round && roundNum >= jutsu1.custombackground.round) {
            customBg = jutsu1.custombackground.url;
        }
        if (customBg) bgUrl = customBg;

        // --- AVATAR PATCH (from oldbrank.js) ---
        // User avatar
        let playerImgUrl;
        if (player.avatar) {
            playerImgUrl = `https://cdn.discordapp.com/avatars/${player.userId || player.id}/${player.avatar}.png?size=256`;
        } else {
            const defaultAvatarNumber = parseInt(player.discriminator) % 5;
            playerImgUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }
        // NPC avatar
        let npcImgUrl = npc.imageUrl || 'https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg';

        // Load images robustly
        let bgImg, npcImg, playerImg;
        try {
            bgImg = await loadImage(bgUrl);
        } catch {
            const bgPath = await downloadImageToFile(bgUrl);
            bgImg = await loadImage(bgPath);
            try { fs.unlinkSync(bgPath); } catch {}
        }
        try {
            npcImg = await loadImage(npcImgUrl);
        } catch {
            const npcPath = await downloadImageToFile(npcImgUrl);
            npcImg = await loadImage(npcPath);
            try { fs.unlinkSync(npcPath); } catch {}
        }
        try {
            playerImg = await loadImage(playerImgUrl);
        } catch {
            const playerPath = await downloadImageToFile(playerImgUrl);
            playerImg = await loadImage(playerPath);
            try { fs.unlinkSync(playerPath); } catch {}
        }

        // Draw background
        ctx.drawImage(bgImg, 0, 0, width, height);

        // Helper for rounded rectangles
        const roundRect = (x, y, w, h, r) => {
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
        };

        // Positions
        const charW = 150, charH = 150;
        const npcX = 50, npcY = 120;
        const playerX = width - 50 - charW, playerY = 120;
        const nameY = 80, barY = 280;
        const nameH = 28, barH = 22;

        // Draw NPC character (left)
        ctx.save();
        roundRect(npcX, npcY, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(npcImg, npcX, npcY, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(npcX, npcY, charW, charH, 10);
        ctx.stroke();

        // Draw Player character (right)
        ctx.save();
        roundRect(playerX, playerY, charW, charH, 10);
        ctx.clip();
        ctx.drawImage(playerImg, playerX, playerY, charW, charH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#6e1515";
        roundRect(playerX, playerY, charW, charH, 10);
        ctx.stroke();

        // Name tags
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // NPC name
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#000";
        roundRect(npcX, nameY, charW, nameH, 5);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText(npc.name, npcX + charW / 2, nameY + nameH / 2);
        ctx.shadowBlur = 0;
        // Player name
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#000";
        roundRect(playerX, nameY, charW, nameH, 5);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText(player.name, playerX + charW / 2, nameY + nameH / 2);
        ctx.shadowBlur = 0;

        // Health bars
        const drawHealthBar = (x, y, percent, color) => {
            ctx.save();
            ctx.fillStyle = "#333";
            roundRect(x, y, charW, barH, 5);
            ctx.fill();
            ctx.fillStyle = color;
            roundRect(x, y, charW * Math.max(0, percent), barH, 5);
            ctx.fill();
            ctx.restore();
        };

        drawHealthBar(npcX, barY, npc.currentHealth / npc.health, "#ff4444");
        drawHealthBar(playerX, barY, player.currentHealth / player.health, "#4CAF50");

        // VS text
        ctx.save();
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText("VS", width / 2, height / 2);
        ctx.restore();

        // Save to file
        if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true });
        const filename = `battle_${player.userId || player.id}_${npc.name}_${Date.now()}.png`;
        const fullPath = path.join(imagesPath, filename);

        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(fullPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });

        return fullPath;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Fight a weak NPC in a B-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Load user data
        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        }
        
        let player = users[userId];

        // --- COOLDOWN SYSTEM ---
        const now = Date.now();

        // Premium cooldown roles
        const JINCHURIKI_ROLE = "1385641469507010640";
        const LEGENDARY_ROLE = "1385640798581952714";
        const DONATOR_ROLE = "1385640728130097182";
        let cooldownMs = 12 * 60 * 1000; // default 12 min

        // Check premium roles (jinchuriki > legendary > donator)
        const memberRoles = interaction.member.roles.cache;
        if (memberRoles.has(JINCHURIKI_ROLE)) {
            cooldownMs = 5.5 * 60 * 1000; // 5 min 30 sec
        } else if (memberRoles.has(LEGENDARY_ROLE)) {
            cooldownMs = Math.round(7 * 60 * 1000); // 6 min 3 sec
        } else if (memberRoles.has(DONATOR_ROLE)) {
            cooldownMs = Math.round(8 * 60 * 1000); // 6 min 39 sec
        }

        if (player.lastbrank && now - player.lastbrank < cooldownMs) {
            const left = cooldownMs - (now - player.lastbrank);
            return interaction.reply({ content: `You can do this again in ${getCooldownString(left)}.`, ephemeral: true });
        }
        player.lastbrank = now;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Initialize player and NPC
        // --- AVATAR PATCH (profile.js logic) ---
        let avatarUrl;
        if (interaction.user.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
        } else {
            const defaultAvatarNumber = parseInt(interaction.user.discriminator) % 5;
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }

        player = {
            ...users[userId],
            userId: interaction.user.id,
            name: interaction.user.username,
            avatar: interaction.user.avatar,
            discriminator: interaction.user.discriminator,
            activeEffects: [],
            accuracy: 100,
            dodge: 0,
            currentHealth: users[userId].health,
            chakra: users[userId].chakra || 10,
            activeJutsus: {},
            comboState: users[userId].Combo && comboList[users[userId].Combo] ? { 
                combo: comboList[users[userId].Combo], 
                usedJutsus: new Set() 
            } : null
        };

        // --- NEW NPC IMAGE PATCH ---
        const npcImageUrl = "https://static.wikia.nocookie.net/naruto/images/9/9c/Mizuki.png/revision/latest?cb=20210529210947&path-prefix=fr"; // Example NPC image

        const npc = {
            name: "Bandit Leader",
            health: Math.floor(player.health * 0.5),
            power: Math.floor(player.power * 0.9),
            defense: Math.floor(player.defense * 0.01),
            chakra: 999,
            jutsu: ["Attack", "Serpents Wrath", "Shuriken Throw"],
            activeEffects: [],
            accuracy: 85,
            dodge: 15,
            currentHealth: Math.floor(player.health * 0.5),
            avatar: null, // NPC doesn't use Discord avatar
            imageUrl: npcImageUrl
        };

        let roundNum = 1;
        let battleActive = true;

        // Track active round-based jutsus and summaries
        let playerActiveJutsus = {};
        let npcActiveJutsus = {};
        let playerRoundBasedSummaries = [];
        let npcRoundBasedSummaries = [];

        // Create moves embed
        const createMovesEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle(`${player.name}`)
                .setColor('#006400')
                .setDescription(
                    `${player.name}, It is your turn!\nUse buttons to make a choice.\n\n` +
                    Object.entries(player.jutsu)
                        .filter(([_, jutsu]) => jutsu !== 'None')
                        .map(([_, jutsuName], index) => {
                            const jutsuData = jutsuList[jutsuName];
                            return `${index + 1}: ${jutsuData?.name || jutsuName}${jutsuData?.chakraCost ? ` (${jutsuData.chakraCost} Chakra)` : ''}`;
                        })
                        .join('\n') +
                    `\n\n[😴] to focus your chakra.\n[❌] to flee from battle.\n\nChakra: ${player.chakra}`
                );

            const jutsuButtons = Object.entries(player.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([_, jutsuName], index) => {
                    const jutsu = jutsuList[jutsuName];
                    const disabled = player.chakra < (jutsu?.chakraCost || 0);
                    return new ButtonBuilder()
                        .setCustomId(`move${index + 1}-${userId}-${roundNum}`)
                        .setLabel(`${index + 1}`)
                        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(disabled);
                });

            const rows = [];
            if (jutsuButtons.length > 0) {
                const row1 = new ActionRowBuilder();
                jutsuButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
                rows.push(row1);
            }
            
            const row2 = new ActionRowBuilder();
            if (jutsuButtons.length > 5) row2.addComponents(jutsuButtons[5]);
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rest-${userId}-${roundNum}`)
                    .setLabel('😴')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`flee-${userId}-${roundNum}`)
                    .setLabel('❌')
                    .setStyle(ButtonStyle.Primary)
            );
            rows.push(row2);

            return { embed, components: rows.slice(0, 5) };
        };

        // Get jutsu by button ID
        const getJutsuByButton = (buttonId) => {
            const match = buttonId.match(/^move(\d+)-/);
            if (!match) return null;
            const idx = parseInt(match[1], 10) - 1;
            const jutsuNames = Object.entries(player.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([_, jutsuName]) => jutsuName);
            return jutsuNames[idx];
        };

        // Execute a jutsu
        const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName, currentRound = 1, isRoundBasedActivation = false) => {
            const jutsu = jutsuList[jutsuName];
            if (!jutsu) {
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name} attempted unknown jutsu: ${jutsuName}`,
                    specialEffects: ["Jutsu failed!"],
                    hit: false
                };
            }

            // Handle round-based jutsus
            if (jutsu.roundBased) {
                // Only deduct chakra on first activation
                if (isRoundBasedActivation) {
                    if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                        return {
                            damage: 0,
                            heal: 0,
                            description: `${baseUser.name} failed to perform ${jutsu.name} (not enough chakra)`,
                            specialEffects: ["Chakra exhausted!"],
                            hit: false
                        };
                    }
                    baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
                }

                const roundEffect = BattleUtils.getRoundEffect(jutsu.roundEffects, currentRound);
                let desc = "";
                let effectsSummary = [];
                let damage = 0, heal = 0, hit = true;
                
                if (roundEffect) {
                    // Replace placeholders in description
                    desc = roundEffect.description
                        .replace(/\buser\b/gi, `<@${baseUser.userId || baseUser.id}>`)
                        .replace(/\btarget\b/gi, baseTarget.name)
                        .replace(/\[Player\]/g, baseUser.name)
                        .replace(/\[Enemy\]/g, baseTarget.name);

                    // Apply effects if present
                    if (roundEffect.effects) {
                        roundEffect.effects.forEach(effect => {
                            let tempResult = { damage: 0, heal: 0, specialEffects: [], hit: true };
                            switch (effect.type) {
                                case 'damage':
                                    const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
                                    tempResult.damage += damageResult.damage;
                                    tempResult.hit = damageResult.hit;
                                    if (damageResult.hit && damageResult.damage > 0) {
                                        tempResult.specialEffects.push(`Dealt ${Math.round(damageResult.damage)} damage`);
                                    } else if (!damageResult.hit) {
                                        tempResult.specialEffects.push("Attack missed!");
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
                                    tempResult.specialEffects.push(`Gained buffs: ${Object.entries(buffChanges)
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
                                    tempResult.specialEffects.push(`Applied debuffs: ${Object.entries(debuffChanges)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join(', ')} for ${effect.duration || 1} turns`);
                                    break;
                                case 'heal':
                                    const healAmount = effectHandlers.heal(effectiveUser, effect.formula);
                                    tempResult.heal += healAmount;
                                    if (healAmount > 0) {
                                        tempResult.specialEffects.push(`Healed ${Math.round(healAmount)} HP`);
                                    }
                                    break;
                                case 'status':
                                    if (effect.status === 'bleed') {
                                        const bleedDamage = Math.floor(effectiveTarget.health * (effect.damagePerTurn ? parseFloat(effect.damagePerTurn.match(/0\.\d+/)?.[0] || 0.1) : 0.1));
                                        tempResult.damage += bleedDamage;
                                        tempResult.specialEffects.push(`${baseTarget.name} is bleeding! (-${bleedDamage} HP)`);
                                    }
                                    if (effect.status === 'drowning') {
                                        const drowningDamage = Math.floor(effectiveTarget.health * 0.1);
                                        tempResult.damage += drowningDamage;
                                        tempResult.specialEffects.push(`${baseTarget.name} is drowning! (-${drowningDamage} HP)`);
                                    }
                                    if (effect.status === 'reaper_seal') {
                                        const reaperDamage = Math.floor(effectiveTarget.health * 0.2);
                                        tempResult.damage += reaperDamage;
                                        tempResult.specialEffects.push(`${baseTarget.name}'s soul is being ripped by the shinigami! (-${reaperDamage} HP)`);
                                    }
                                    if (!baseTarget.activeEffects) baseTarget.activeEffects = [];
                                    baseTarget.activeEffects.push({
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1,
                                        damagePerTurn: effect.damagePerTurn
                                    });
                                    tempResult.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                    break;
                            }
                            damage += tempResult.damage || 0;
                            heal += tempResult.heal || 0;
                            if (tempResult.specialEffects.length) effectsSummary.push(...tempResult.specialEffects);
                            if (tempResult.hit === false) hit = false;
                        });
                    }
                } else {
                    desc = `${baseUser.name}'s ${jutsu.name} is inactive this round.`;
                    hit = false;
                }

                return {
                    damage,
                    heal,
                    description: desc,
                    specialEffects: effectsSummary,
                    hit,
                    jutsuUsed: jutsuName,
                    isRoundBased: true,
                    roundBasedDesc: desc,
                    roundBasedEffects: effectsSummary
                };
            }

            // Regular jutsu handling
            const result = {
                damage: 0,
                heal: 0,
                description: `${baseUser.name} used ${jutsu.name}`,
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
                    hit: false
                };
            }
            
            baseUser.chakra = Math.max(0, (baseUser.chakra || 0) - (jutsu.chakraCost || 0));
            
            (jutsu.effects || []).forEach(effect => {
                try {
                    switch (effect.type) {
                        case 'damage':
                            const damageResult = effectHandlers.damage(effectiveUser, effectiveTarget, effect.formula, effect);
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
                                baseTarget.activeEffects.push({
                                    type: 'status',
                                    status: effect.status,
                                    duration: effect.duration || 1,
                                    damagePerTurn: effect.damagePerTurn
                                });
                                result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                            }
                            break;
                        case 'chakra_gain':
                            baseUser.chakra += effect.amount || 0;
                            result.specialEffects.push(`Gained ${effect.amount} Chakra`);
                            break;
                    }
                } catch (err) {
                    console.error(`Error processing ${effect.type} effect:`, err);
                    result.specialEffects.push(`Error applying ${effect.type} effect`);
                }
            });
            
            return result;
        };

        // Process player move
        const processPlayerMove = async (customId, basePlayer, baseNpc, effectivePlayer, effectiveNpc) => {
            const action = customId.split('-')[0];
            if (action === 'rest') {
                basePlayer.chakra = Math.min(basePlayer.chakra + 1, basePlayer.chakra + 5);
                return {
                    damage: 0,
                    heal: 0,
                    description: `${basePlayer.name} gathered chakra and rested`,
                    specialEffects: ["+1 Chakra"],
                    hit: true,
                    isRest: true
                };
            }
            if (action === 'flee') return { fled: true };
            return executeJutsu(basePlayer, baseNpc, effectivePlayer, effectiveNpc, action);
        };

        // NPC chooses move
        const npcChooseMove = (baseNpc, basePlayer, effectiveNpc, effectivePlayer) => {
            // Check if stunned
            const stunnedEffect = baseNpc.activeEffects.find(e => e.type === 'status' && e.status === 'stun');
            if (stunnedEffect) {
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseNpc.name} is stunned and can't move!`,
                    specialEffects: ["Stun active"],
                    hit: false
                };
            }

            // Filter available jutsu based on chakra
            const availableJutsu = baseNpc.jutsu.filter(j => {
                const jutsu = jutsuList[j];
                return jutsu && (jutsu.chakraCost || 0) <= baseNpc.chakra;
            });

            if (availableJutsu.length === 0) {
                baseNpc.chakra = Math.min(baseNpc.chakra + 1, 10);
                return {
                    damage: 0,
                    heal: 0,
                    description: `${baseNpc.name} gathered chakra and rested`,
                    specialEffects: ["+1 Chakra"],
                    hit: true
                };
            }

            const randomJutsu = availableJutsu[Math.floor(Math.random() * availableJutsu.length)];
            return executeJutsu(baseNpc, basePlayer, effectiveNpc, effectivePlayer, randomJutsu);
        };

        // Create battle summary
        const createBattleSummary = (playerAction, npcAction) => {
            const getEffectEmojis = (entity) => {
                const emojis = [];
                (entity.activeEffects || []).forEach(effect => {
                    if (effect.type === 'buff') emojis.push(EMOJIS.buff);
                    if (effect.type === 'debuff') emojis.push(EMOJIS.debuff);
                    if (effect.type === 'status') emojis.push(EMOJIS[effect.status] || EMOJIS.status);
                });
                return emojis.length ? `[${emojis.join('')}] ` : '';
            };
            
            const playerEffectEmojis = getEffectEmojis(player);
            const npcEffectEmojis = getEffectEmojis(npc);

            const getActionDescription = (action, user, target) => {
                if (action.isRest) return action.description;
                if (!action.hit) {
                    if (action.specialEffects?.includes("Stun active")) return "is stunned!";
                    if (action.specialEffects?.includes("Flinch active")) return "flinched!";
                    return "missed!";
                }
                // PATCH: Use fallback to user.name if jutsuUsed is undefined
                return jutsuList[action.jutsuUsed]?.description || action.description || `${user.name} acted.`;
            };

            const playerDesc = getActionDescription(playerAction, player, npc);
            const npcDesc = getActionDescription(npcAction, npc, player);

            const getComboProgress = () => {
                if (!player.comboState) return "";
                const combo = player.comboState.combo;
                const usedJutsus = player.comboState.usedJutsus || new Set();
                const filled = combo.requiredJutsus.filter(jutsu => usedJutsus.has(jutsu)).length;
                const total = combo.requiredJutsus.length;
                return `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
            };

            // Add round-based jutsu descriptions/effects to summary
            const roundBasedText = (summaries) => {
                if (!summaries || !summaries.length) return "";
                return summaries.map(s => {
                    let txt = `\n${s.desc}`;
                    if (s.effects && s.effects.length) {
                        txt += `\nEffects: ${s.effects.join(', ')}`;
                    }
                    return txt;
                }).join('\n');
            };

            const embed = new EmbedBuilder()
                .setTitle(`Round: ${roundNum}!`)
                .setColor('#006400')
                .setDescription(
                    `${playerEffectEmojis}${player.name} ${playerDesc}` +
                    `${playerAction.damage ? ` for ${Math.round(playerAction.damage)} damage!` : 
                     playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                    getComboProgress() +
                    roundBasedText(playerRoundBasedSummaries) +
                    `\n\n${npcEffectEmojis}${npc.name} ${npcDesc}` +
                    `${npcAction.damage ? ` for ${Math.round(npcAction.damage)} damage!` : 
                     npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}` +
                    roundBasedText(npcRoundBasedSummaries)
                )
                .addFields({
                    name: 'Battle Status',
                    value: `${player.name} | ${Math.round(player.currentHealth)} HP | ${player.chakra} Chakra\n` +
                           `${npc.name} | ${Math.round(npc.currentHealth)} HP | ${npc.chakra} Chakra`
                });

            const playerJutsu = jutsuList[playerAction.jutsuUsed] || jutsuList[npcAction.jutsuUsed];
            if (playerJutsu?.image_url) embed.setImage(playerJutsu.image_url);
            
            return embed;
        };

        // --- Battle loop ---
        try {
            await interaction.reply({ content: "**B-Rank Mission Started!**" });

            while (battleActive) {
                // --- PATCH: Gather round-based jutsu summaries but do NOT apply damage/heal yet ---
                let pendingPlayerRoundBasedEffects = [];
                playerRoundBasedSummaries = [];
                Object.entries(playerActiveJutsus).forEach(([jutsuName, data]) => {
                    const jutsu = jutsuList[jutsuName];
                    if (jutsu?.roundBased) {
                        const effectivePlayer = BattleUtils.getEffectiveStats(player);
                        const effectiveNpc = BattleUtils.getEffectiveStats(npc);

                        const result = executeJutsu(
                            player,
                            npc,
                            effectivePlayer,
                            effectiveNpc,
                            jutsuName,
                            data.round + 1
                        );

                        // Prepare summary for display only
                        let desc = result.roundBasedDesc
                            .replace(/undefined/g, player.name)
                            .replace(/\buser\b/gi, `<@${player.userId || player.id}>`)
                            .replace(/\btarget\b/gi, `<@${npc.name}>`)
                            .replace(/\[Player\]/g, player.name)
                            .replace(/\[Enemy\]/g, npc.name);

                        playerRoundBasedSummaries.push({
                            desc: desc,
                            effects: result.roundBasedEffects
                        });

                        // --- PATCH: Queue up effects for application after move selection ---
                        pendingPlayerRoundBasedEffects.push({
                            damage: result.damage,
                            heal: result.heal
                        });

                        playerActiveJutsus[jutsuName].round++;

                        // Remove completed jutsu
                        const maxRound = Math.max(...Object.keys(jutsu.roundEffects).map(k => {
                            const parts = k.split('-');
                            return parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
                        }));

                        if (data.round >= maxRound) {
                            delete playerActiveJutsus[jutsuName];
                        }
                    }
                });

                // Calculate effective stats
                const effectivePlayer = BattleUtils.getEffectiveStats(player);
                const effectiveNpc = BattleUtils.getEffectiveStats(npc);

                // Player's turn
                const { embed: embed1, components: components1 } = createMovesEmbed();
                const moveMessage1 = await interaction.followUp({
                    content: `<@${player.userId || userId}>`,
                    embeds: [embed1],
                    components: components1,
                    fetchReply: true
                });

                // Generate battle image with potential custom background
                let activeJutsu = null;
                Object.keys(playerActiveJutsus).forEach(jName => {
                    const jutsu = jutsuList[jName];
                    if (jutsu?.custombackground && playerActiveJutsus[jName].round >= jutsu.custombackground.round) {
                        activeJutsu = jutsu;
                    }
                });

                const battleImagePath = await BattleUtils.generateBattleImage(
                    player, npc, roundNum, activeJutsu, null
                );
                const battleImage = new AttachmentBuilder(battleImagePath);
                await interaction.followUp({ files: [battleImage] });

                // --- PATCH: Now apply round-based jutsu effects (damage/heal) after image is sent ---
                pendingPlayerRoundBasedEffects.forEach(eff => {
                    if (eff.damage && eff.damage > 0) {
                        npc.currentHealth -= eff.damage;
                    }
                    if (eff.heal && eff.heal > 0) {
                        player.currentHealth = Math.min(player.currentHealth + eff.heal, player.health);
                    }
                });

                const playerAction = await new Promise(resolve => {
                    const collector = moveMessage1.createMessageComponentCollector({
                        filter: i => i.user.id === userId && i.customId.endsWith(`-${userId}-${roundNum}`),
                        time: 90000
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        if (i.customId.startsWith('move')) {
                            const jutsuName = getJutsuByButton(i.customId);
                            const jutsu = jutsuList[jutsuName];

                            // Handle round-based jutsus
                            if (jutsu?.roundBased) {
                                // Only activate if not already active
                                if (!playerActiveJutsus[jutsuName]) {
                                    const result = executeJutsu(
                                        player,
                                        npc,
                                        effectivePlayer,
                                        effectiveNpc,
                                        jutsuName,
                                        1,
                                        true // activation
                                    );
                                    if (!result.hit) {
                                        resolve(result);
                                        collector.stop();
                                        return;
                                    }
                                    playerActiveJutsus[jutsuName] = { round: 1 };
                                    playerRoundBasedSummaries.push({
                                        desc: result.roundBasedDesc,
                                        effects: result.roundBasedEffects
                                    });
                                    result.jutsuUsed = jutsuName;
                                    resolve(result);
                                    collector.stop();
                                    return;
                                }
                            }

                            const result = executeJutsu(
                                player,
                                npc,
                                effectivePlayer,
                                effectiveNpc,
                                jutsuName
                            );

                            // Track combo progress
                            if (player.comboState?.combo.requiredJutsus.includes(jutsuName)) {
                                player.comboState.usedJutsus.add(jutsuName);
                            }

                            result.jutsuUsed = jutsuName;
                            resolve(result);
                        } else {
                            resolve(await processPlayerMove(i.customId, player, npc, effectivePlayer, effectiveNpc));
                        }
                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            resolve({
                                damage: 0,
                                heal: 0,
                                description: `${player.name} did not make a move.`,
                                specialEffects: ["Missed opportunity!"],
                                hit: false,
                                fled: true
                            });
                        }
                        moveMessage1.edit({
                            components: components1.map(row => {
                                const disabledRow = ActionRowBuilder.from(row);
                                disabledRow.components.forEach(c => c.setDisabled(true));
                                return disabledRow;
                            })
                        }).catch(() => {});
                    });
                });

                if (playerAction.fled) {
                    battleActive = false;
                    await interaction.followUp(`${player.name} fled from the battle!`);
                    return;
                }

                // Apply player action results
                npc.currentHealth -= playerAction.damage || 0;
                if (playerAction.heal) {
                    player.currentHealth = Math.min(player.currentHealth + playerAction.heal, player.health);
                }

                // Process combos
                const processCombo = () => {
                    if (!player.comboState) return { completed: false, damageText: "" };
                    
                    const combo = player.comboState.combo;
                    if (combo.requiredJutsus.every(jutsu => player.comboState.usedJutsus.has(jutsu))) {
                        let comboResult = {
                            damage: combo.damage || 0,
                            heal: 0,
                            specialEffects: []
                        };
                        
                        (combo.effects || []).forEach(effect => {
                            BattleSystem.applyEffect(effect, player, npc, 
                                BattleUtils.getEffectiveStats(player), 
                                BattleUtils.getEffectiveStats(npc), 
                                comboResult);
                        });
                        
                        npc.currentHealth -= comboResult.damage;
                        if (comboResult.heal) {
                            player.currentHealth = Math.min(player.currentHealth + comboResult.heal, player.health);
                        }
                        
                        player.comboState.usedJutsus.clear();
                        return {
                            completed: true,
                            damageText: `\n${player.name} lands a ${combo.name}! ${comboResult.specialEffects.join(' ')}`
                        };
                    }
                    return { completed: false, damageText: "" };
                };

                const comboResult = processCombo();

                // NPC's turn (if still alive)
                let npcAction = { damage: 0, heal: 0, description: `${npc.name} is defeated`, specialEffects: [], hit: false };
                if (npc.currentHealth > 0) {
                    npcAction = npcChooseMove(npc, player, effectiveNpc, effectivePlayer);
                    player.currentHealth -= npcAction.damage || 0;
                    if (npcAction.heal) {
                        npc.currentHealth = Math.min(npc.currentHealth + npcAction.heal, npc.health);
                    }
                }

                // Clamp health values
                player.currentHealth = Math.max(0, player.currentHealth);
                npc.currentHealth = Math.max(0, npc.currentHealth);

                // Show round summary
                const summaryEmbed = createBattleSummary(playerAction, npcAction);
                if (comboResult.completed) {
                    summaryEmbed.setDescription(
                        summaryEmbed.data.description + comboResult.damageText
                    );
                }
                await interaction.followUp({ embeds: [summaryEmbed] });

                // Clear round-based summaries after displaying
                playerRoundBasedSummaries = [];
                npcRoundBasedSummaries = [];

                // Check for win/loss
                if (player.currentHealth <= 0 || npc.currentHealth <= 0) {
                    battleActive = false;
                    
                    if (player.currentHealth > 0 && npc.currentHealth <= 0) {
                        // Player wins
                        const expReward = math.random(5.0, 8.0);
                        const moneyReward = 500 + Math.floor(player.level * 20);
                        
                        // Update user data
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].exp += expReward;
                        users[userId].money += moneyReward;
                        users[userId].wins += 1;
                        users[userId].health = player.health;
                        users[userId].mentorExp = (users[userId].mentorExp || 0) + 1;
                        users[userId].brankWon = true;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        
                        await updateRequirements(interaction.user.id, 'b_mission');
                        
                        // Material drop
                        let role = player.role || "";
                        if (interaction.member.roles.cache.has('1349278752944947240')) role = "Hokage";
                        const amount = getMaterialDrop(role);
                        const mat = getRandomMaterial();

                        // Village drop message
                        let villageDropMsg = "";
                        if (amount > 0) {
                            let village = { iron: 0, wood: 0, rope: 0, defense: 0 };
                            if (fs.existsSync(villagePath)) {
                                village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
                            }
                            village[mat.key] = (village[mat.key] || 0) + amount;
                            fs.writeFileSync(villagePath, JSON.stringify(village, null, 2));
                            villageDropMsg = `You found ${amount} ${mat.name} ${mat.emoji} during the mission\n`;
                        }

                        // Akatsuki drop
                        let akatsukiDropMsg = "";
                        if (player.occupation === "Akatsuki") {
                            let akatsukiRole = player.role || "";
                            let akatsukiAmount = getAkatsukiMaterialDrop(akatsukiRole);
                            if (akatsukiAmount > 0) {
                                const akatsukiMat = getRandomAkatsukiMaterial();
                                const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
                                let akatsuki = { metal: 0, gunpowder: 0, copper: 0, bombs: {} };
                                if (fs.existsSync(akatsukiPath)) {
                                    akatsuki = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
                                }
                                akatsuki[akatsukiMat.key] = (akatsuki[akatsukiMat.key] || 0) + akatsukiAmount;
                                fs.writeFileSync(akatsukiPath, JSON.stringify(akatsuki, null, 2));
                                akatsukiDropMsg = `You found ${akatsukiAmount} ${akatsukiMat.name} ${akatsukiMat.emoji} during the mission\n`;
                            }
                        }

                        // Reward embed
                        const rewardEmbed = new EmbedBuilder()
                            .setTitle(`Battle End! ${player.name} has won!`)
                            .setDescription(
                                `<@${userId}> has earned ${expReward.toFixed(1)} exp!\n<@${userId}> has earned $${moneyReward}!`
                            )
                            .setColor('#006400');

                        // Send response with drops
                        let dropMsg = "```";
                        if (player.occupation === "Akatsuki" && akatsukiDropMsg) {
                            dropMsg += `\n${akatsukiDropMsg}`;
                        } else if (amount > 0) {
                            dropMsg += `\n${villageDropMsg}`;
                        }
                        dropMsg += "```";
                        await interaction.followUp({ embeds: [rewardEmbed], content: dropMsg });
                    } else if (npc.currentHealth > 0 && player.currentHealth <= 0) {
                        // Player loses
                        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                        users[userId].losses += 1;
                        users[userId].health = player.health;
                        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                        await interaction.followUp(`**Defeat!** You were defeated by ${npc.name}...`);
                    } else {
                        // Draw
                        await interaction.followUp(`It's a draw!`);
                    }
                }

                // Passive chakra regen
                player.chakra = Math.min(player.chakra + (CHAKRA_REGEN[player.rank] || 1), player.chakra + 5);
                npc.chakra = Math.min(npc.chakra + 2, npc.chakra + 5);

                // Update effect durations
                [player, npc].forEach(entity => {
                    entity.activeEffects.forEach(effect => {
                        if (effect.duration > 0) effect.duration--;
                    });
                    entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                });

                roundNum++;
                if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (error) {
            console.error("Battle error:", error);
            await interaction.followUp("An error occurred during the battle!");
        }
    }
};