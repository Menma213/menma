const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function createMovesEmbedPvP(player, roundNum) {
    const embed = new EmbedBuilder()
        .setTitle(`Round ${roundNum} - ${player.name}'s Turn`)
        .setDescription(`Health: ${Math.round(player.currentHealth)}/${player.health}\nChakra: ${player.chakra}/10`)
        .setColor('#0099ff');

    const jutsuButtons = createJutsuButtons(player, roundNum);
    return { embed, components: jutsuButtons };
}

function createJutsuButtons(player, roundNum) {
    const rows = [];
    const buttons = [];
    
    // Basic attack button
    buttons.push(
        new ButtonBuilder()
            .setCustomId(`basic-${player.userId}-${roundNum}`)
            .setLabel('Basic Attack')
            .setStyle(ButtonStyle.Secondary)
    );

    // Add jutsu buttons if player has jutsus
    if (player.Jutsu1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`move1-${player.userId}-${roundNum}`)
                .setLabel(player.Jutsu1)
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (player.Jutsu2) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`move2-${player.userId}-${roundNum}`)
                .setLabel(player.Jutsu2)
                .setStyle(ButtonStyle.Primary)
        );
    }

    // Split buttons into rows of 3
    for (let i = 0; i < buttons.length; i += 3) {
        const row = new ActionRowBuilder()
            .addComponents(buttons.slice(i, i + 3));
        rows.push(row);
    }

    return rows;
}

function createBattleSummaryPvP(action, player, opponent, roundNum, comboCompleted, comboDamageText) {
    let description = `Round ${roundNum}\n\n`;
    
    if (action.jutsuUsed) {
        description += `${player.name} used ${action.jutsuUsed}!\n`;
    }
    
    if (action.damage > 0) {
        description += `Dealt ${action.damage} damage!\n`;
    }
    
    if (action.heal > 0) {
        description += `Healed for ${action.heal} HP!\n`;
    }
    
    if (action.specialEffects?.length > 0) {
        description += `Effects: ${action.specialEffects.join(', ')}\n`;
    }
    
    if (comboCompleted && comboDamageText) {
        description += comboDamageText;
    }
    
    return new EmbedBuilder()
        .setColor(action.hit ? '#00ff00' : '#ff0000')
        .setTitle('Battle Update')
        .setDescription(description)
        .addFields(
            { name: `${player.name}`, value: `HP: ${Math.round(player.currentHealth)}/${player.health}`, inline: true },
            { name: `${opponent.name}`, value: `HP: ${Math.round(opponent.currentHealth)}/${opponent.health}`, inline: true }
        );
}

function getJutsuByButtonPvP(customId, player) {
    const moveMatch = customId.match(/^move(\d+)/);
    if (!moveMatch) return null;
    
    const moveNumber = moveMatch[1];
    return player[`Jutsu${moveNumber}`] || null;
}

function executeJutsu(user, target, userStats, targetStats, jutsuName) {
    // Basic implementation - expand based on your jutsu system
    return {
        damage: Math.floor(userStats.power * 1.5),
        heal: 0,
        hit: true,
        description: `${user.name} used ${jutsuName}!`,
        specialEffects: []
    };
}

function processPlayerMove(moveId, player, opponent, playerStats, opponentStats) {
    if (moveId.startsWith('basic-')) {
        return {
            damage: Math.floor(playerStats.power * 0.8),
            heal: 0,
            hit: true,
            description: `${player.name} used a basic attack!`,
            specialEffects: []
        };
    }
    return null;
}

module.exports = {
    createMovesEmbedPvP,
    createBattleSummaryPvP,
    getJutsuByButtonPvP,
    executeJutsu,
    processPlayerMove
};
