const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
    ChannelType,
    Client,
    GatewayIntentBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// We import the runBattle function from your combinedcommands.js file.
const { runBattle } = require('./combinedcommands.js');

// --- FILE PATHS ---
const settingsPath = path.join(__dirname, 'tournament_settings.json');
const narutoFontPath = path.join(__dirname, '..', 'fonts', 'njnaruto.ttf');

// --- CONSTANTS ---
const ADMIN_ROLE_ID = "1381268854776529028";
const REGISTRATION_CHANNEL_ID = "1406694779026411520";
const TOURNAMENT_ROLE_ID = "1414642487632461954";
const GUILD_ID = "1388552014761426954";
const ADMIN_PASSWORD = "zephyrisbald";

// --- FONT REGISTRATION ---
try {
    if (fs.existsSync(narutoFontPath)) {
        registerFont(narutoFontPath, { family: 'Naruto' });
    } else {
        console.log("Naruto font not found, using default 'Arial'.");
    }
} catch (e) {
    console.log("Could not load font, using 'Arial'.", e);
}
const FONT = fs.existsSync(narutoFontPath) ? 'Naruto' : 'Arial';

// --- HELPER FUNCTIONS ---
function loadSettings() {
    if (fs.existsSync(settingsPath)) {
        try {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            console.error("Error reading tournament_settings.json:", e);
            return getDefaultSettings();
        }
    }
    return getDefaultSettings();
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
    } catch (e) {
        console.error("Error writing to tournament_settings.json:", e);
    }
}

function getDefaultSettings() {
    return {
        status: "none", // none, pending_registration, running, completed
        tournamentName: null,
        bo_type: 3, // Best of 3, 5, etc.
        date: null,
        time: null,
        bracketType: null,
        maxParticipants: 0,
        rewards: null,
        participants: [],
        matches: [], // { p1, p2, winner, round, played, p1_score, p2_score, next_initiator }
        currentRound: 0,
        registrationMessageId: null
    };
}

// --- IMAGE GENERATION ---
async function generateRegistrationImage(settings) {
    const width = 1000;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    // Black cosmic background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Generate cosmic 'star' effect
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 150; i++) { // 150 stars
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, 1000, 400);
    ctx.font = `60px ${FONT}`;
    ctx.fillStyle = '#ff6600';
    ctx.textAlign = 'center';
    ctx.fillText(settings.tournamentName, 500, 80);
    ctx.font = `30px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText("Registration is Now Open!", 500, 150);
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dddddd';
    ctx.fillText(`Date: ${settings.date} @ ${settings.time} GMT`, 50, 220);
    ctx.fillText(`Format: Best of ${settings.bo_type}`, 50, 260);
    ctx.fillText(`Participants: 0 / ${settings.maxParticipants}`, 50, 300);
    ctx.fillText(`Rewards: ${settings.rewards}`, 50, 340);
    return canvas.toBuffer('image/png');
}

async function generateVsImage(p1, p2) {
    const width = 1000;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    // Black cosmic background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Generate cosmic 'star' effect
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 150; i++) { // 150 stars
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    const avatarSize = 200;
    const p1X = 100, p2X = 1000 - 100 - avatarSize, avatarY = 100;
    try {
        const p1Avatar = await loadImage(p1.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.drawImage(p1Avatar, p1X, avatarY, avatarSize, avatarSize);
    } catch {
        ctx.fillStyle = '#5865f2';
        ctx.fillRect(p1X, avatarY, avatarSize, avatarSize);
    }
    try {
        const p2Avatar = await loadImage(p2.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.drawImage(p2Avatar, p2X, avatarY, avatarSize, avatarSize);
    } catch {
        ctx.fillStyle = '#5865f2';
        ctx.fillRect(p2X, avatarY, avatarSize, avatarSize);
    }
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 8;
    ctx.strokeRect(p1X, avatarY, avatarSize, avatarSize);
    ctx.strokeRect(p2X, avatarY, avatarSize, avatarSize);
    ctx.font = `120px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.strokeText("VS", 500, 200);
    ctx.fillText("VS", 500, 200);
    ctx.font = `40px ${FONT}`;
    ctx.strokeText(p1.username, p1X + avatarSize / 2, 350);
    ctx.fillText(p1.username, p1X + avatarSize / 2, 350);
    ctx.strokeText(p2.username, p2X + avatarSize / 2, 350);
    ctx.fillText(p2.username, p2X + avatarSize / 2, 350);
    return canvas.toBuffer('image/png');
}

// --- CANVAS: BRACKET IMAGE ---
/**
 * Generates a tournament bracket image
 * @param {object} settings The tournament settings
 * @returns {Promise<Buffer>} A buffer containing the PNG image
 */
async function generateBracketImage(settings) {
    const participants = settings.participants;
    const numParticipants = participants.length;
    if (numParticipants < 2) {
        const canvas = createCanvas(300, 100);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 300, 100);
        ctx.font = '20px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough participants', 150, 50);
        return canvas.toBuffer('image/png');
    }

    // Calculate dimensions (increased for better readability)
    const colWidth = 300;
    const rowHeight = 80;
    const numRounds = Math.ceil(Math.log2(numParticipants));
    const width = (numRounds + 1) * colWidth;
    const bracketSize = Math.pow(2, numRounds);
    const height = bracketSize * rowHeight;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '18px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white'; // Set line color to white
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let roundParticipants = [...participants.map(p => p.id)];
    let round = 1;
    let colX = 10;

    const getName = (id) => (participants.find(p => p.id === id) || { username: "BYE" }).username;

    while (round <= numRounds) {
        const yStep = Math.pow(2, round - 1) * rowHeight;
        const yOffset = yStep / 2;
        let currentY = yOffset;
        const nextRoundParticipants = [];
        const matchesThisRound = settings.matches.filter(m => m.round === round);

        for (let i = 0; i < roundParticipants.length; i += 2) {
            const p1Id = roundParticipants[i];
            const p2Id = roundParticipants[i + 1];

            const p1Name = getName(p1Id);
            const p2Name = p2Id ? getName(p2Id) : "BYE";

            const y1 = currentY;
            const y2 = y1 + yStep;
            
            // Draw names and boxes
            ctx.fillText(p1Name, colX, y1);
            ctx.strokeRect(colX - 5, y1 - rowHeight / 4, colWidth - 20, rowHeight / 2);

            if (p2Id) {
                ctx.fillText(p2Name, colX, y2);
                ctx.strokeRect(colX - 5, y2 - rowHeight / 4, colWidth - 20, rowHeight / 2);

                const lineY = (y1 + y2) / 2;
                const lineXEnd = colX + colWidth - (colWidth / 2);

                ctx.beginPath();
                ctx.moveTo(lineXEnd, y1);
                ctx.lineTo(lineXEnd, y2);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(colX + colWidth - 25, y1);
                ctx.lineTo(lineXEnd, y1);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(colX + colWidth - 25, y2);
                ctx.lineTo(lineXEnd, y2);
                ctx.stroke();

                const nextRoundX = colX + colWidth;
                ctx.beginPath();
                ctx.moveTo(lineXEnd, lineY);
                ctx.lineTo(nextRoundX, lineY);
                ctx.stroke();

                const match = matchesThisRound.find(m => (m.p1 === p1Id && m.p2 === p2Id) || (m.p1 === p2Id && m.p2 === p1Id));
                if (match && match.winner) {
                    nextRoundParticipants.push(match.winner);
                } else {
                    nextRoundParticipants.push(null); // Winner TBD
                }
            } else {
                // Auto-advance bye
                const nextRoundX = colX + colWidth;
                 ctx.beginPath();
                 ctx.moveTo(colX + colWidth - 25, y1);
                 ctx.lineTo(nextRoundX, y1);
                 ctx.stroke();
                nextRoundParticipants.push(p1Id);
            }
            currentY += yStep * 2;
        }
        roundParticipants = nextRoundParticipants;
        colX += colWidth;
        round++;
    }

    if (settings.status === 'completed') {
        const championId = settings.matches.find(m => m.round === numRounds)?.winner;
        if (championId) {
            const winnerName = getName(championId);
            const y = height / 2;
            ctx.font = `24px ${FONT}`;
            ctx.fillStyle = '#ff6600'; // Keep champion name orange
            ctx.fillText(winnerName, colX, y - 15);
            ctx.fillText("CHAMPION", colX, y + 15);
        }
    }

    return canvas.toBuffer('image/png');
}

// --- TOURNAMENT LOGIC ---
async function startRegistration(client, settings) {
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);
    if (!channel) return console.error("Registration channel not found!");

    const attachment = new AttachmentBuilder(await generateRegistrationImage(settings), { name: 'reg.png' });
    const embed = new EmbedBuilder().setTitle(settings.tournamentName).setDescription(`Registration is open!`).setImage('attachment://reg.png');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tournament_register').setLabel('Register').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tournament_unregister').setLabel('Unregister').setStyle(ButtonStyle.Danger)
    );
    const regMessage = await channel.send({ embeds: [embed], files: [attachment], components: [row] });
    settings.registrationMessageId = regMessage.id;
    saveSettings(settings);
}

async function startTournament(client) {
    let settings = loadSettings();
    if (settings.status !== "pending_registration") return;

    console.log("Starting tournament...");
    settings.status = "running";
    settings.currentRound = 1;
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);

    try {
        const regMessage = await channel.messages.fetch(settings.registrationMessageId);
        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(regMessage.components[0].components[0]).setDisabled(true),
            ButtonBuilder.from(regMessage.components[0].components[1]).setDisabled(true)
        );
        await regMessage.edit({ components: [disabledRow] });
    } catch (e) { console.error("Could not disable registration button:", e); }

    let participants = [...settings.participants];
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    settings.matches = [];
    for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i + 1];
        if (p2) {
            settings.matches.push({
                round: 1,
                p1: p1.id,
                p2: p2.id,
                winner: null,
                played: false,
                p1_score: 0,
                p2_score: 0,
                bo_type: settings.bo_type,
                next_initiator: Math.random() < 0.5 ? p1.id : p2.id
            });
        } else {
            settings.matches.push({ round: 1, p1: p1.id, p2: "BYE", winner: p1.id, played: true });
        }
    }
    saveSettings(settings);

    const bracketImage = await generateBracketImage(settings);
    const attachment = new AttachmentBuilder(bracketImage, { name: 'tournament_bracket.png' });
    await channel.send({
        content: `The bracket has been set! <@&${TOURNAMENT_ROLE_ID}>`,
        files: [attachment]
    });
    runNextMatch(client);
}

async function runNextMatch(client) {
    let settings = loadSettings();
    if (settings.status !== "running") return;

    const nextMatch = settings.matches.find(m => !m.played);
    if (!nextMatch) {
        return advanceRound(client);
    }

    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);
    try {
        const p1 = await client.users.fetch(nextMatch.p1);
        const p2 = await client.users.fetch(nextMatch.p2);
        const initiator = await client.users.fetch(nextMatch.next_initiator);

        const vsImage = await generateVsImage(p1, p2);
        const attachment = new AttachmentBuilder(vsImage, { name: 'vs.png' });

        await channel.send({
            content: `Next match! ${p1.toString()} vs ${p2.toString()}!\n**Score:** ${nextMatch.p1_score} - ${nextMatch.p2_score} (BO${nextMatch.bo_type})\n\n${initiator.toString()}, you must initiate the fight with the \`/fight\` command.`,
            files: [attachment]
        });
    } catch (e) {
        console.error("Error announcing next match:", e);
        nextMatch.winner = "FORFEIT";
        nextMatch.played = true;
        saveSettings(settings);
        runNextMatch(client); // Try to run the next one
    }
}

async function processTournamentFight(client, winnerId, loserId, initiatorId) {
    let settings = loadSettings();
    if (settings.status !== 'running') return;

    const matchIndex = settings.matches.findIndex(m =>
        !m.played &&
        ((m.p1 === winnerId && m.p2 === loserId) || (m.p1 === loserId && m.p2 === winnerId))
    );

    if (matchIndex === -1) {
        console.log("Tournament hook: Received fight result for non-tournament match or completed match.");
        return;
    }
    
    const match = settings.matches[matchIndex];

    // Check if the initiator was the correct player
    if (initiatorId !== match.next_initiator) {
        const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);
        const wrongPlayer = await client.users.fetch(initiatorId);
        const correctPlayer = await client.users.fetch(match.next_initiator);
        await channel.send(`> ${wrongPlayer.toString()}, you were not supposed to start that fight! It was ${correctPlayer.toString()}'s turn. The result of this fight will not be counted.`);
        return; // Abort processing
    }

    if (match.p1 === winnerId) {
        match.p1_score++;
    } else {
        match.p2_score++;
    }

    const winCondition = Math.ceil(match.bo_type / 2);
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);

    if (match.p1_score >= winCondition || match.p2_score >= winCondition) {
        // Series is over
        match.winner = winnerId;
        match.played = true;
        const winnerUser = await client.users.fetch(winnerId);
        await channel.send(`The series is over! **${winnerUser.username}** is victorious with a score of ${match.p1_score} - ${match.p2_score}!`);
        settings.matches[matchIndex] = match;
        saveSettings(settings);
        // Wait a bit before advancing to avoid race conditions or spam
        setTimeout(() => runNextMatch(client), 5000);
    } else {
        // Series continues
        match.next_initiator = loserId; // Loser of the last fight initiates the next one
        const winnerUser = await client.users.fetch(winnerId);
        const loserUser = await client.users.fetch(loserId);
        await channel.send(`Match point to ${winnerUser.toString()}! The score is now **${match.p1_score} - ${match.p2_score}**. \n${loserUser.toString()}, it's your turn to initiate the next fight.`);
        settings.matches[matchIndex] = match;
        saveSettings(settings);
    }
}

async function advanceRound(client) {
    let settings = loadSettings();
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);

    const allMatchesInRoundPlayed = settings.matches.filter(m => m.round === settings.currentRound).every(m => m.played);
    if (!allMatchesInRoundPlayed) {
        // If not all matches are played, do nothing and wait for the next fight result.
        return;
    }

    const winners = settings.matches
        .filter(m => m.round === settings.currentRound && m.winner && m.winner !== "BYE" && m.winner !== "FORFEIT")
        .map(m => m.winner);

    if (winners.length === 1) {
        // --- We have a Champion! ---
        settings.status = "completed";
        const champion = await client.users.fetch(winners[0]);
        await channel.send({ content: `The tournament **${settings.tournamentName}** has concluded! \nCongratulations to the new Champion, ${champion.toString()}! <@&${TOURNAMENT_ROLE_ID}>` });
        
        // Send final bracket
        const bracketImage = await generateBracketImage(settings);
        const attachment = new AttachmentBuilder(bracketImage, { name: 'tournament_final_bracket.png' });
        await channel.send({
            content: `Final Bracket:`,
            files: [attachment]
        });
        
        saveSettings(settings);
        return;
    }

    if (winners.length === 0) {
        await channel.send("The tournament has concluded due to no participants advancing.");
        settings.status = "completed";
        saveSettings(settings);
        return;
    }

    // --- Prepare Next Round ---
    settings.currentRound++;
    console.log(`Advancing to round ${settings.currentRound}`);
    
    // Shuffle winners for next round pairings
    for (let i = winners.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [winners[i], winners[j]] = [winners[j], winners[i]];
    }

    // Create new matches
    for (let i = 0; i < winners.length; i += 2) {
        if (winners[i + 1]) {
            settings.matches.push({
                round: settings.currentRound,
                p1: winners[i],
                p2: winners[i + 1],
                winner: null,
                played: false,
                p1_score: 0,
                p2_score: 0,
                bo_type: settings.bo_type,
                next_initiator: Math.random() < 0.5 ? winners[i] : winners[i+1]
            });
        } else {
            // Bye for this round
            settings.matches.push({
                round: settings.currentRound,
                p1: winners[i],
                p2: "BYE",
                winner: winners[i],
                played: true
            });
        }
    }

    saveSettings(settings);

    // --- Send Updated Bracket ---
    await channel.send(`Round ${settings.currentRound - 1} is complete! Here is the updated bracket for Round ${settings.currentRound}:`);
    const bracketImage = await generateBracketImage(settings);
    const attachment = new AttachmentBuilder(bracketImage, { name: `tournament_bracket_R${settings.currentRound}.png` });
    await channel.send({
        files: [attachment]
    });

    // Start the next match announcement
    setTimeout(() => {
        runNextMatch(client);
    }, 10000); // 10 second delay
}

async function handleInteraction(interaction) {
    if (interaction.isButton()) {
        const settings = loadSettings();
        if (interaction.customId === 'tournament_register') {
            if (settings.participants.some(p => p.id === interaction.user.id)) {
                return interaction.reply({ content: "You are already registered.", ephemeral: true });
            }
            if (settings.participants.length >= settings.maxParticipants) {
                return interaction.reply({ content: "Sorry, the tournament is full.", ephemeral: true });
            }
            settings.participants.push({ id: interaction.user.id, username: interaction.user.username });
            saveSettings(settings);
            try {
                await interaction.member.roles.add(TOURNAMENT_ROLE_ID);
            } catch (e) { console.error("Failed to add role:", e); }
            return interaction.reply({ content: `You have registered for **${settings.tournamentName}**!`, ephemeral: true });
        }
        if (interaction.customId === 'tournament_unregister') {
            if (!settings.participants.some(p => p.id === interaction.user.id)) {
                return interaction.reply({ content: "You are not registered.", ephemeral: true });
            }
            settings.participants = settings.participants.filter(p => p.id !== interaction.user.id);
            saveSettings(settings);
            try {
                await interaction.member.roles.remove(TOURNAMENT_ROLE_ID);
            } catch (e) { console.error("Failed to remove role:", e); }
            return interaction.reply({ content: `You have unregistered from **${settings.tournamentName}**.`, ephemeral: true });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'tournament_admin_modal') {
            let settings = loadSettings();
            if (settings.status === "running") {
                return interaction.reply({ content: "A tournament is already running. Please wait for it to finish or use `/tournament reset`.", ephemeral: true });
            }
            settings = {
                ...getDefaultSettings(),
                status: "pending_registration",
                tournamentName: interaction.fields.getTextInputValue('tournamentName'),
                date: interaction.fields.getTextInputValue('tournamentDate'),
                time: interaction.fields.getTextInputValue('tournamentTime'),
                maxParticipants: parseInt(interaction.fields.getTextInputValue('maxParticipants'), 10) || 32,
                bo_type: parseInt(interaction.fields.getTextInputValue('bo_type'), 10) || 3,
                bracketType: 'Single Elimination',
                rewards: 'To be announced',
            };
            saveSettings(settings);
            await interaction.reply({ content: 'Tournament settings saved! Starting registration...', ephemeral: true });
            startRegistration(interaction.client, settings);
            // scheduleTournamentStart is removed for manual start
        }
    }
}

function registerClient(client) {
    if (!client || client._tournamentHandlerRegistered) return;
    client._tournamentHandlerRegistered = true;
    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isButton() || interaction.isModalSubmit()) {
                await handleInteraction(interaction);
            }
        } catch (err) { console.error('Error in tournament interaction handler:', err); }
    });
    console.log('Tournament module: client interactionCreate listener registered.');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tournament')
        .setDescription('Manage the server tournament')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('admin').setDescription('Open the tournament admin panel'))
        .addSubcommand(sub => sub.setName('start').setDescription('Force start a pending tournament'))
        .addSubcommand(sub => sub.setName('reset').setDescription('DEBUG: Reset tournament state')),

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: "You do not have permission.", ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'admin') {
            const modal = new ModalBuilder().setCustomId('tournament_admin_modal').setTitle('Tournament Admin Panel');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tournamentName').setLabel('Tournament Name').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tournamentDate').setLabel('Date (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tournamentTime').setLabel('Time (HH:MM in GMT)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('maxParticipants').setLabel('Max Participants').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('bo_type').setLabel('Best of? (3 or 5)').setStyle(TextInputStyle.Short).setPlaceholder('3').setRequired(true)
                )
            );
            await interaction.showModal(modal);
        } else if (subcommand === 'start') {
            await interaction.reply({ content: "Forcing tournament start...", ephemeral: true });
            startTournament(interaction.client);
        } else if (subcommand === 'reset') {
            saveSettings(getDefaultSettings());
            await interaction.reply({ content: "Tournament settings have been reset.", ephemeral: true });
        }
    },
    handleInteraction,
    registerClient,
    processTournamentFight
};