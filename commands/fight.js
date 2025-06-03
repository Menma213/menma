const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { updateRequirements } = require('./scroll');

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

// Add combo system
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

const COMBO_EMOJI_FILLED = "⭕";
const COMBO_EMOJI_EMPTY = "⚪";

// Path configurations
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '/workspaces/menma/data/jutsus.json');
const imagesPath = path.resolve(__dirname, '/workspaces/menma/images');

// Load jutsus from JSON file
let jutsuList = {};
if (fs.existsSync(jutsusPath)) {
    jutsuList = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
}

// Effect handlers with improved error handling
const effectHandlers = {
    damage: (user, target, formula) => {
        try {
            const context = {
                user: {
                    power: Number(user.power) || 0,
                    defense: Number(user.defense) || 0,
                    health: Number(user.health) || 0,
                    chakra: Number(user.chakra) || 0,
                    accuracy: Number(user.accuracy) || 100 // Default 100% accuracy if not specified
                },
                target: {
                    power: Number(target.power) || 0,
                    defense: Number(target.defense) || 1,
                    health: Number(target.health) || 0,
                    chakra: Number(target.chakra) || 0,
                    dodge: Number(target.dodge) || 0 // Default 0% dodge if not specified
                }
            };
            
            // Calculate hit chance (user accuracy vs target dodge)
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

const generateBattleImage = async (challenger, opponent, challengerAvatar, opponentAvatar) => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400 });

    const challengerHealthPercent = Math.max((challenger.currentHealth / challenger.health) * 100, 0);
    const opponentHealthPercent = Math.max((opponent.currentHealth / opponent.health) * 100, 0);

    const imagesDir = path.resolve(__dirname, '../images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const htmlContent = `
        <html>
        <style>
            body { margin: 0; padding: 0; }
            .battle-container { width: 800px; height: 400px; position: relative; background: url('https://i.pinimg.com/originals/5d/e5/62/5de5622ecdd4e24685f141f10e4573e3.jpg') center center no-repeat; background-size: cover; border-radius: 10px; overflow: hidden; }
            .character { position: absolute; width: 150px; height: 150px; border-radius: 10px; border: 3px solid #6e1515; object-fit: cover; }
            .player { right: 50px; top: 120px; }
            .enemy { left: 50px; top: 120px; }
            .name-tag { position: absolute; width: 150px; text-align: center; color: white; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-shadow: 2px 2px 4px #000; top: 80px; background: rgba(0,0,0,0.5); border-radius: 5px; padding: 2px 0; }
            .player-name { right: 50px; }
            .enemy-name { left: 50px; }
            .health-bar { position: absolute; width: 150px; height: 22px; background-color: #333; border-radius: 5px; overflow: hidden; top: 280px; }
            .health-fill { height: 100%; }
            .npc-health-fill { background-color: #ff4444; width: ${opponentHealthPercent}%; }
            .player-health-fill { background-color: #4CAF50; width: ${challengerHealthPercent}%; }
            .health-text { position: absolute; width: 100%; text-align: center; color: white; font-family: Arial, sans-serif; font-size: 13px; line-height: 22px; text-shadow: 1px 1px 1px black; }
            .player-health { right: 50px; }
            .enemy-health { left: 50px; }
            .vs-text { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: white; font-family: Arial, sans-serif; font-size: 48px; font-weight: bold; text-shadow: 2px 2px 4px #000; }
        </style>
        <body>
            <div class="battle-container">
                <div class="name-tag enemy-name">${opponent.name}</div>
                <img class="character enemy" src="${opponentAvatar}">
                <div class="health-bar enemy-health">
                    <div class="health-fill npc-health-fill"></div>
                    <div class="health-text">${Math.round(opponent.currentHealth)}/${opponent.health}</div>
                </div>
                <div class="name-tag player-name">${challenger.name}</div>
                <img class="character player" src="${challengerAvatar}">
                <div class="health-bar player-health">
                    <div class="health-fill player-health-fill"></div>
                    <div class="health-text">${Math.round(challenger.currentHealth)}/${challenger.health}</div>
                </div>
                <div class="vs-text">VS</div>
            </div>
        </body>
        </html>
    `;

    const imagePath = path.join(imagesDir, `battle_${challenger.name}_${opponent.name}_${Date.now()}.png`);
    await page.setContent(htmlContent);
    await page.screenshot({ path: imagePath });
    await browser.close();
    return imagePath;
};

const createMovesEmbed = (player, userId, roundNum) => {
    const embed = new EmbedBuilder()
        .setTitle(`${player.name}`)
        .setColor('#006400')
        .setDescription(
            `${player.name}, It is your turn!\nUse buttons to make a choice.\n\n` +
            Object.entries(player.jutsu)
                .filter(([_, jutsu]) => jutsu !== 'None')
                .map(([slot, jutsu], index) => {
                    const jutsuData = jutsuList[jutsu];
                    return `${index + 1}: ${jutsuData?.name || jutsu}${jutsuData?.chakraCost ? ` (${jutsuData?.chakraCost} Chakra)` : ''}`;
                })
                .join('\n') +
            `\n\n[😴] to focus your chakra.\n[❌] to flee from battle.\n\nChakra: ${player.chakra}`
        );

    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;
    const rows = [];
    Object.entries(player.jutsu).forEach(([_, jutsuName], index) => {
        if (jutsuName !== 'None') {
            const jutsu = jutsuList[jutsuName];
            const disabled = player.chakra < (jutsu?.chakraCost || 0);
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${jutsuName}-${userId}-${roundNum}`)
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
    // Add rest/flee
    currentRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`rest-${userId}-${roundNum}`)
            .setLabel('😴')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`flee-${userId}-${roundNum}`)
            .setLabel('❌')
            .setStyle(ButtonStyle.Primary)
    );
    if (currentRow.components.length > 0) rows.push(currentRow);
    return { embed, components: rows.slice(0, 5) };
};

const createBattleSummary = (playerAction, npcAction, player, currentNpc, roundNum, playerHealth, jutsuList, comboState) => {
    // Get active effect emojis
    const getEffectEmojis = (entity) => {
        const emojis = [];
        entity.activeEffects.forEach(effect => {
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

    const playerEffectEmojis = getEffectEmojis(player);
    const npcEffectEmojis = getEffectEmojis(currentNpc);

    const playerDesc = playerAction.isRest ? playerAction.description :
        !playerAction.hit ? (playerAction.specialEffects.includes("Stun active") ? "is stunned!" :
            playerAction.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") :
            jutsuList[playerAction.jutsuUsed]?.description || playerAction.description;

    const npcDesc = !npcAction.hit ? (npcAction.specialEffects.includes("Stun active") ? `${currentNpc.name} is stunned!` :
        npcAction.specialEffects.includes("Flinch active") ? `${currentNpc.name} flinched!` : `${currentNpc.name} missed!`) :
        npcAction.description;

    let statusEffects = [];

    // Handle active status effects
    [player, currentNpc].forEach(entity => {
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'status') {
                switch (effect.status) {
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

    // Combo progress UI
    let comboProgressText = "";
    if (comboState && comboState.combo) {
        // Only show if at least one combo jutsu was used this round
        const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
            comboState.usedJutsus.has(jutsu)
        );
        if (usedThisRound) {
            const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
            const total = comboState.combo.requiredJutsus.length;
            comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${playerEffectEmojis}@${player.name} ${playerDesc}` +
            `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
            `\n\n${npcEffectEmojis}${npcDesc}` +
            `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}`
            + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
            + comboProgressText // <-- Combo UI
        )
        .addFields({
            name: 'Battle Status',
            value: `${player.name} || ${Math.round(playerHealth)} HP\n${currentNpc.name} || ${Math.round(currentNpc.currentHealth)} HP\nChakra: ${player.chakra}            Chakra: ${currentNpc.chakra}`
        });

    // Add jutsu image/gif if available
    const playerJutsu = jutsuList[playerAction.jutsuUsed];
    if (playerJutsu?.image_url) {
        embed.setImage(playerJutsu.image_url);
    }

    return embed;
};

const createBattleSummary = (
    challengerAction, opponentAction,
    challenger, opponent,
    roundNum, jutsuList, comboState
) => {
    // Get active effect emojis
    const getEffectEmojis = (entity) => {
        const emojis = [];
        entity.activeEffects.forEach(effect => {
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

    const challengerEffectEmojis = getEffectEmojis(challenger);
    const opponentEffectEmojis = getEffectEmojis(opponent);

    const challengerDesc = challengerAction.isRest ? challengerAction.description :
        !challengerAction.hit ? (challengerAction.specialEffects?.includes("Stun active") ? "is stunned!" :
            challengerAction.specialEffects?.includes("Flinch active") ? "flinched!" : "missed!") :
            jutsuList[challengerAction.jutsuUsed]?.description || challengerAction.description;

    const opponentDesc = !opponentAction.hit ? (opponentAction.specialEffects?.includes("Stun active") ? `${opponent.name} is stunned!` :
        opponentAction.specialEffects?.includes("Flinch active") ? `${opponent.name} flinched!` : `${opponent.name} missed!`) :
        opponentAction.description;

    let statusEffects = [];

    // Handle active status effects
    [challenger, opponent].forEach(entity => {
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'status') {
                switch (effect.status) {
                    case 'bleed':
                        const bleedDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= bleedDamage;
                        statusEffects.push(`${entity.name} is bleeding! (-${bleedDamage} HP)`);
                        break;
                    case 'drowning':
                        const drowningDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= drowningDamage;
                        const jutsu = jutsuList['Water Prison'];
                        const chakraDrain = jutsu?.effects?.[0]?.chakraDrain || 3;
                        entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                        statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                        break;
                }
            }
        });
    });

    // Combo progress UI
    let comboProgressText = "";
    if (comboState && comboState.combo) {
        const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
            comboState.usedJutsus.has(jutsu)
        );
        if (usedThisRound) {
            const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
            const total = comboState.combo.requiredJutsus.length;
            comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${challengerEffectEmojis}@${challenger.name} ${challengerDesc}` +
            `${challengerAction.damage ? ` for ${Math.round(challengerAction.damage)}!` : challengerAction.heal ? ` for ${Math.round(challengerAction.heal)} HP!` : '!'}` +
            `\n\n${opponentEffectEmojis}${opponent.name} ${opponentDesc}` +
            `${opponentAction.damage ? ` for ${Math.round(opponentAction.damage)}!` : opponentAction.heal ? ` for ${Math.round(opponentAction.heal)} HP!` : '!'}`
            + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
            + comboProgressText
        )
        .addFields({
            name: 'Battle Status',
            value: `${challenger.name} || ${Math.round(challenger.currentHealth)} HP\n${opponent.name} || ${Math.round(opponent.currentHealth)} HP\nChakra: ${challenger.chakra}            Chakra: ${opponent.chakra}`
        });
// Fix createBattleSummary to use correct PvP player variables
const createBattleSummary = (
    challengerAction, opponentAction,
    challenger, opponent,
    roundNum, jutsuList, comboState
) => {
    // Get active effect emojis
    const getEffectEmojis = (entity) => {
        const emojis = [];
        entity.activeEffects.forEach(effect => {
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

    const challengerEffectEmojis = getEffectEmojis(challenger);
    const opponentEffectEmojis = getEffectEmojis(opponent);

    const challengerDesc = challengerAction.isRest ? challengerAction.description :
        !challengerAction.hit ? (challengerAction.specialEffects?.includes("Stun active") ? "is stunned!" :
            challengerAction.specialEffects?.includes("Flinch active") ? "flinched!" : "missed!") :
            jutsuList[challengerAction.jutsuUsed]?.description || challengerAction.description;

    const opponentDesc = !opponentAction.hit ? (opponentAction.specialEffects?.includes("Stun active") ? `${opponent.name} is stunned!` :
        opponentAction.specialEffects?.includes("Flinch active") ? `${opponent.name} flinched!` : `${opponent.name} missed!`) :
        opponentAction.description;

    let statusEffects = [];

    // Handle active status effects
    [challenger, opponent].forEach(entity => {
        entity.activeEffects.forEach(effect => {
            if (effect.type === 'status') {
                switch (effect.status) {
                    case 'bleed':
                        const bleedDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= bleedDamage;
                        statusEffects.push(`${entity.name} is bleeding! (-${bleedDamage} HP)`);
                        break;
                    case 'drowning':
                        const drowningDamage = Math.floor(entity.health * 0.1);
                        entity.currentHealth -= drowningDamage;
                        const jutsu = jutsuList['Water Prison'];
                        const chakraDrain = jutsu?.effects?.[0]?.chakraDrain || 3;
                        entity.chakra = Math.max(0, entity.chakra - chakraDrain);
                        statusEffects.push(`${entity.name} is drowning! (-${drowningDamage} HP, -${chakraDrain} Chakra)`);
                        break;
                }
            }
        });
    });

    // Combo progress UI
    let comboProgressText = "";
    if (comboState && comboState.combo) {
        const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
            comboState.usedJutsus.has(jutsu)
        );
        if (usedThisRound) {
            const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
            const total = comboState.combo.requiredJutsus.length;
            comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`Round: ${roundNum}!`)
        .setColor('#006400')
        .setDescription(
            `${challengerEffectEmojis}@${challenger.name} ${challengerDesc}` +
            `${challengerAction.damage ? ` for ${Math.round(challengerAction.damage)}!` : challengerAction.heal ? ` for ${Math.round(challengerAction.heal)} HP!` : '!'}` +
            `\n\n${opponentEffectEmojis}${opponent.name} ${opponentDesc}` +
            `${opponentAction.damage ? ` for ${Math.round(opponentAction.damage)}!` : opponentAction.heal ? ` for ${Math.round(opponentAction.heal)} HP!` : '!'}`
            + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
            + comboProgressText
        )
        .addFields({
            name: 'Battle Status',
            value: `${challenger.name} || ${Math.round(challenger.currentHealth)} HP\n${opponent.name} || ${Math.round(opponent.currentHealth)} HP\nChakra: ${challenger.chakra}            Chakra: ${opponent.chakra}`
        });

    // Add jutsu image/gif if available
    const challengerJutsu = jutsuList[challengerAction.jutsuUsed];
    if (challengerJutsu?.image_url) {
        embed.setImage(challengerJutsu.image_url);
    }

    return embed;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another player to a battle')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('The player to challenge')
                .setRequired(true)
        ),

    async execute(interaction) {
        const challengerId = interaction.user.id;
        const opponentId = interaction.options.getUser('opponent').id;

        // Basic validations
        if (challengerId === opponentId) {
            return interaction.reply({ content: "You can't challenge yourself!", ephemeral: true });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "Database not found.", ephemeral: true });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[challengerId] || !users[opponentId]) {
            return interaction.reply({ content: "Both players must be enrolled to fight!", ephemeral: true });
        }

        // Challenge phase
        const challengeEmbed = new EmbedBuilder()
            .setTitle('Battle Challenge!')
            .setDescription(`<@${opponentId}>, do you accept <@${challengerId}>'s challenge?`)
            .setColor('#FF0000')
            .setFooter({ text: 'Challenge expires in 60 seconds' });

        const challengeButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept-challenge')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline-challenge')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const challengeMessage = await interaction.reply({
            content: `<@${opponentId}>`,
            embeds: [challengeEmbed],
            components: [challengeButtons],
            fetchReply: true
        });

        const challengeCollector = challengeMessage.createMessageComponentCollector({ 
            filter: i => i.user.id === opponentId,
            time: 60000 
        });

        challengeCollector.on('collect', async i => {
            if (i.customId === 'decline-challenge') {
                await i.update({
                    content: 'Challenge declined!',
                    embeds: [],
                    components: []
                });
                return challengeCollector.stop();
            }

            // Challenge accepted - start battle
            await i.deferUpdate();
            
            // Initialize battle entities
            const challenger = {
                ...users[challengerId],
                name: interaction.user.username,
                activeEffects: [],
                accuracy: 100, // Base accuracy
                dodge: 0      // Base dodge
            };

            const opponent = {
                ...users[opponentId],
                name: interaction.options.getUser('opponent').username,
                activeEffects: [],
                accuracy: 100, // Base accuracy
                dodge: 0       // Base dodge
            };

            let roundNum = 1;
            let challengerHealth = challenger.health;
            let opponentHealth = opponent.health;

           
            // Execute a jutsu with base and effective stats
            const executeJutsu = (baseUser, baseTarget, effectiveUser, effectiveTarget, jutsuName) => {
                const jutsu = jutsuList[jutsuName];
                if (!jutsu) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name || 'User'} attempted unknown jutsu: ${jutsuName}`,
                        specialEffects: ["Jutsu failed!"],
                        hit: false
                    };
                }

                const result = {
                    damage: 0,
                    heal: 0,
                    description: `${baseUser.name || 'User'} used ${jutsu.name}`,
                    specialEffects: [],
                    hit: true
                };

                // Check and deduct chakra from base user
                if ((baseUser.chakra || 0) < (jutsu.chakraCost || 0)) {
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${baseUser.name || 'User'} failed to perform ${jutsu.name} (not enough chakra)`,
                        specialEffects: ["Chakra exhausted!"],
                        hit: false
                    };
                }
                baseUser.chakra -= jutsu.chakraCost || 0;

                // Process all effects
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
                                    baseTarget.activeEffects.push({
                                        type: 'status',
                                        status: effect.status,
                                        duration: effect.duration || 1
                                    });
                                    result.specialEffects.push(`Applied ${effect.status} for ${effect.duration || 1} turns`);
                                }
                                break;

                            case 'chakra_gain':
                                let gainAmount = 0;
                                if (typeof effect.amount === 'number') {
                                    gainAmount = effect.amount;
                                } else {
                                    try {
                                        gainAmount = Math.max(0, math.evaluate(effect.amount, { user: baseUser }));
                                    } catch(e) { 
                                        console.error("chakra_gain formula error", e); 
                                        gainAmount = 0;
                                    }
                                }
                                baseUser.chakra = Math.min((baseUser.chakra || 0) + gainAmount, 10);
                                if (gainAmount > 0) {
                                    result.specialEffects.push(`Gained ${Math.round(gainAmount)} Chakra`);
                                }
                                break;
                        }
                    } catch (err) {
                        console.error(`Error processing ${effect.type} effect for ${jutsuName}:`, err);
                        result.specialEffects.push(`Error applying ${effect.type} effect`);
                    }
                });

                return result;
            };

           
            // Process player move with effective stats
            const processPlayerMove = async (customId, basePlayer, baseTarget, effectivePlayer, effectiveTarget) => {
                const action = customId.split('-')[0];
                
                if (action === 'rest') {
                    basePlayer.chakra = Math.min(basePlayer.chakra + 1);
                    return {
                        damage: 0,
                        heal: 0,
                        description: `${basePlayer.name} gathered chakra and rested`,
                        specialEffects: ["+1 Chakra"],
                        hit: true
                    };
                }
                
                if (action === 'flee') {
                    return { fled: true };
                }
                
                return executeJutsu(basePlayer, baseTarget, effectivePlayer, effectiveTarget, action);
            };

            // Calculate effective stats considering active effects
            const getEffectiveStats = (entity) => {
                const stats = { ...entity };
                delete stats.activeEffects;

                // Start with base stats
                const effectiveStats = {
                    power: stats.power || 10,
                    defense: stats.defense || 10,
                    chakra: stats.chakra || 10,
                    health: stats.health || 100,
                    accuracy: stats.accuracy || 100, // Default accuracy
                    dodge: stats.dodge || 0         // Default dodge
                };

                // Apply all active effects
                entity.activeEffects.forEach(effect => {
                    if (effect.type === 'buff' || effect.type === 'debuff') {
                        Object.entries(effect.stats).forEach(([stat, value]) => {
                            effectiveStats[stat] = (effectiveStats[stat] || 0) + value;
                        });
                    }
                });

                return effectiveStats;
            };

             // Create battle summary
                        const createBattleSummary = (playerAction, npcAction) => {
                            // Get active effect emojis
                            const getEffectEmojis = (entity) => {
                                const emojis = [];
                                entity.activeEffects.forEach(effect => {
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
            
                            const playerEffectEmojis = getEffectEmojis(player);
                            const npcEffectEmojis = getEffectEmojis(currentNpc);
            
                            const playerDesc = playerAction.isRest ? playerAction.description :
                                              !playerAction.hit ? (playerAction.specialEffects.includes("Stun active") ? "is stunned!" :
                                                                 playerAction.specialEffects.includes("Flinch active") ? "flinched!" : "missed!") : 
                                              jutsuList[playerAction.jutsuUsed]?.description || playerAction.description;
                            
                            const npcDesc = !npcAction.hit ? (npcAction.specialEffects.includes("Stun active") ? `${currentNpc.name} is stunned!` :
                                                             npcAction.specialEffects.includes("Flinch active") ? `${currentNpc.name} flinched!` : `${currentNpc.name} missed!`) : 
                                           npcAction.description;
            
                            let statusEffects = [];
                            
                            // Handle active status effects
                            [player, currentNpc].forEach(entity => {
                                entity.activeEffects.forEach(effect => {
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
            
                            // Combo progress UI
                            let comboProgressText = "";
                            if (comboState && comboState.combo) {
                                // Only show if at least one combo jutsu was used this round
                                const usedThisRound = comboState.combo.requiredJutsus.some(jutsu =>
                                    comboState.usedJutsus.has(jutsu)
                                );
                                if (usedThisRound) {
                                    const filled = comboState.combo.requiredJutsus.filter(jutsu => comboState.usedJutsus.has(jutsu)).length;
                                    const total = comboState.combo.requiredJutsus.length;
                                    comboProgressText = `\nCombo charging up... ${COMBO_EMOJI_FILLED.repeat(filled)}${COMBO_EMOJI_EMPTY.repeat(total - filled)}`;
                                }
                            }
            
                            const embed = new EmbedBuilder()
                                .setTitle(`Round: ${roundNum}!`)
                                .setColor('#006400')
                                .setDescription(
                                    `${playerEffectEmojis}@${player.name} ${playerDesc}` +
                                    `${playerAction.damage ? ` for ${Math.round(playerAction.damage)}!` : playerAction.heal ? ` for ${Math.round(playerAction.heal)} HP!` : '!'}` +
                                    `\n\n${npcEffectEmojis}${npcDesc}` +
                                    `${npcAction.damage ? ` for ${Math.round(npcAction.damage)}!` : npcAction.heal ? ` for ${Math.round(npcAction.heal)} HP!` : '!'}`
                                    + (statusEffects.length ? `\n\n${statusEffects.join('\n')}` : '')
                                    + comboProgressText // <-- Combo UI
                                )
                                .addFields({
                                    name: 'Battle Status',
                                    value: `${player.name} || ${Math.round(playerHealth)} HP\n${currentNpc.name} || ${Math.round(currentNpc.currentHealth)} HP\nChakra: ${player.chakra}            Chakra: ${currentNpc.chakra}`
                                });
            
                            // Add jutsu image/gif if available
                            const playerJutsu = jutsuList[playerAction.jutsuUsed];
                            if (playerJutsu?.image_url) {
                                embed.setImage(playerJutsu.image_url);
                            }
            
                            return embed;
                        };

            // Start battle
            try {
                const challengerAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
                const opponentAvatar = interaction.options.getUser('opponent').displayAvatarURL({ format: 'png', size: 128 });
                const battleImage = new AttachmentBuilder(await generateBattleImage(challenger, opponent, challengerAvatar, opponentAvatar));
                await interaction.followUp({ 
                    content: `**Battle Started!** ${challenger.name} vs ${opponent.name}`,
                    files: [battleImage]
                });

                let battleActive = true;
                
                while (battleActive) {
                    // Update effect durations at start of turn
                    [challenger, opponent].forEach(entity => {
                        entity.activeEffects.forEach(effect => {
                            if (effect.duration > 0) effect.duration--;
                        });
                        entity.activeEffects = entity.activeEffects.filter(e => e.duration > 0);
                    });

                    // Calculate effective stats for this turn
                    const effectiveChallenger = getEffectiveStats(challenger);
                    const effectiveOpponent = getEffectiveStats(opponent);

                    // 1. Show moves embed for challenger first
                    const { embed: challengerEmbed, components: challengerComponents } = createMovesEmbed(challenger, challengerId, roundNum);
                    const challengerMessage = await interaction.followUp({
                        content: `<@${challengerId}> it's your turn!`,
                        embeds: [challengerEmbed],
                        components: challengerComponents,
                        fetchReply: true
                    });

                    // 2. Show battle image
                    const battleImage = new AttachmentBuilder(await generateBattleImage(challenger, opponent, challengerAvatar, opponentAvatar));
                    await interaction.followUp({ files: [battleImage] });

                    // 3. Show moves embed for opponent
                    const { embed: opponentEmbed, components: opponentComponents } = createMovesEmbed(opponent, opponentId, roundNum);
                    const opponentMessage = await interaction.followUp({
                        content: `<@${opponentId}> it's your turn!`,
                        embeds: [opponentEmbed],
                        components: opponentComponents,
                        fetchReply: true
                    });

                    // Collect both players' actions
                    const [challengerAction, opponentAction] = await Promise.all([
                        // Collect challenger action
                        new Promise(resolve => {
                            const collector = challengerMessage.createMessageComponentCollector({
                                filter: i => i.user.id === challengerId && i.customId.endsWith(`-${challengerId}-${roundNum}`),
                                time: 60000
                            });

                            collector.on('collect', async i => {
                                await i.deferUpdate();
                                resolve(await processPlayerMove(i.customId, challenger, opponent, effectiveChallenger, effectiveOpponent));
                                collector.stop();
                            });

                            collector.on('end', (collected, reason) => {
                                if (reason === 'time') {
                                    resolve({
                                        damage: 0,
                                        heal: 0,
                                        description: `${challenger.name} stood still (timed out)`,
                                        specialEffects: ["Missed opportunity!"],
                                        hit: false
                                    });
                                }
                                challengerMessage.edit({ 
                                    components: challengerComponents.map(row => {
                                        const disabledRow = ActionRowBuilder.from(row);
                                        disabledRow.components.forEach(c => c.setDisabled(true));
                                        return disabledRow;
                                    })
                                }).catch(console.error);
                            });
                        }),
                        // Collect opponent action
                        new Promise(resolve => {
                            const collector = opponentMessage.createMessageComponentCollector({
                                filter: i => i.user.id === opponentId && i.customId.endsWith(`-${opponentId}-${roundNum}`),
                                time: 60000
                            });

                            collector.on('collect', async i => {
                                await i.deferUpdate();
                                resolve(await processPlayerMove(i.customId, opponent, challenger, effectiveOpponent, effectiveChallenger));
                                collector.stop();
                            });

                            collector.on('end', (collected, reason) => {
                                if (reason === 'time') {
                                    resolve({
                                        damage: 0,
                                        heal: 0,
                                        description: `${opponent.name} stood still (timed out)`,
                                        specialEffects: ["Missed opportunity!"],
                                        hit: false
                                    });
                                }
                                opponentMessage.edit({ 
                                    components: opponentComponents.map(row => {
                                        const disabledRow = ActionRowBuilder.from(row);
                                        disabledRow.components.forEach(c => c.setDisabled(true));
                                        return disabledRow;
                                    })
                                }).catch(console.error);
                            });
                        })
                    ]);

                    // Process actions and update health
                    if (challengerAction.fled || opponentAction.fled) {
                        battleActive = false;
                        const fleeing = challengerAction.fled ? challenger.name : opponent.name;
                        await interaction.followUp(`${fleeing} fled from the battle!`);
                        break;
                    }

                    // Apply damage and healing
                    opponentHealth -= challengerAction.damage || 0;
                    challengerHealth -= opponentAction.damage || 0;
                    if (challengerAction.heal) challengerHealth = Math.min(challengerHealth + challengerAction.heal, challenger.health);
                    if (opponentAction.heal) opponentHealth = Math.min(opponentHealth + opponentAction.heal, opponent.health);

                    // 4. Show round summary and updated battle image
                    const roundBattleImage = new AttachmentBuilder(await generateBattleImage(challenger, opponent, challengerAvatar, opponentAvatar));
                    await interaction.followUp({
                        embeds: [createBattleSummary(challengerAction, opponentAction)],
                        files: [roundBattleImage]
                    });

                    // Check win conditions
                    if (challengerHealth <= 0 || opponentHealth <= 0) {
                        battleActive = false;
                        const winner = challengerHealth > 0 ? challenger : opponent;
                        const loser = challengerHealth > 0 ? opponent : challenger;
                        
                        await updateRequirements(interaction.user.id, 'pvp');

                        await interaction.followUp(`**${winner.name} wins the battle!**`);
                    }

                    // Passive chakra regen
                    challenger.chakra = Math.min(challenger.chakra + 3, 10);
                    opponent.chakra = Math.min(opponent.chakra + 3, 10);

                    roundNum++;
                    
                    // Add delay between rounds if battle continues
                    if (battleActive) await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.error("Battle error:", error);
                await interaction.followUp("An error occurred during the battle!");
            }
        });

        challengeCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ 
                    content: 'Challenge expired!', 
                    embeds: [], 
                    components: [] 
                }).catch(console.error);
            }
        });
    }
};