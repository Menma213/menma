const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const FOD_CHANNEL_ID = '1389124554051289149'; // <-- set this to your Forest of Death channel ID
const TEAM_CATEGORY_NAME = 'Forest of Death Teams';
const ADMIN_USER_ID = '1381268854776529028';
const PING_ROLE_ID = '1389238943823827067';
const MIN_PARTICIPANTS = 4;
const JOIN_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
const QUESTION_TIMERS = [30, 15, 7, 5]; // seconds for each round
const AUTOSTART_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours

const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
const quizData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/fod.json'), 'utf8'));

let currentFODGame = null;
let autoStartInterval = null;

class FODGame {
    constructor(channel, client) {
        this.channel = channel;
        this.client = client;
        this.participants = new Map();
        this.teams = [];
        this.teamChannels = new Map();
        this.teamScores = new Map();
        this.activeTeams = [];
        this.currentRound = 0;
        this.questionsAsked = 0;
        this.ankoWebhook = null;
        this.active = false;
        this.collector = null;
        this.category = null;
    }

    async initialize() {
        // Unlock the channel for joining
        await this.channel.permissionOverwrites.edit(this.channel.guild.roles.everyone, {
            SendMessages: true,
        });

        // Create or get Anko webhook
        this.ankoWebhook = await this.getOrCreateWebhook(this.channel, 'Anko');

        // Announce start
        await this.channel.send(`<@&${PING_ROLE_ID}>`);
        const startEmbed = new EmbedBuilder()
            .setTitle('Forest of Death - Team Edition')
            .setDescription('Would you like to join the Forest of Death? Type anything in this channel to join!')
            .setColor('#006400')
            .setImage('https://images-ext-1.discordapp.net/external/EHutcWmx0NJT1_xBXJ9rb9v72deI6tS4yeacm_U_xiU/https/pa1.narvii.com/6534/629af99050803dd5f64b124ddb572e3f0cc0d6b2_hq.gif?width=400&height=222');
        await this.channel.send({ embeds: [startEmbed] });

        this.active = true;
        this.participants.clear();

        // Collect participants
        this.collector = this.channel.createMessageCollector({
            filter: msg => !msg.author.bot,
            time: JOIN_WAIT_TIME
        });

        this.collector.on('collect', async msg => {
            if (!this.participants.has(msg.author.id)) {
                this.participants.set(msg.author.id, msg.author);
                await this.channel.send(`${msg.author.username} has entered the Forest of Death!`);
            }
        });

        this.collector.on('end', async () => {
            if (this.participants.size < MIN_PARTICIPANTS) {
                await this.channel.send(`Not enough participants to start. Need at least ${MIN_PARTICIPANTS}.`);
                await this.cleanup();
                return;
            }
            await this.startGame();
        });
    }

    async startGame() {
        // Lock the channel for the event
        await this.channel.permissionOverwrites.edit(this.channel.guild.roles.everyone, {
            SendMessages: false,
        });

        await this.announce('The Forest of Death has begun! Forming teams...');
        await this.createTeams();
        await this.createTeamChannels();
        await this.startQuizRounds();
    }

    async createTeams() {
        const participants = Array.from(this.participants.values());
        // Shuffle
        for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
        }
        // Teams of 2, last solo if odd
        this.teams = [];
        for (let i = 0; i < participants.length; i += 2) {
            if (i + 1 < participants.length) {
                this.teams.push([participants[i], participants[i + 1]]);
            } else {
                this.teams.push([participants[i]]);
            }
        }
        this.activeTeams = this.teams.map((_, idx) => `Team ${String.fromCharCode(65 + idx)}`);
        this.teamScores.clear();
        this.teams.forEach((_, idx) => this.teamScores.set(`Team ${String.fromCharCode(65 + idx)}`, 0));

        // Announce teams
        let teamList = 'Teams have been formed:\n';
        this.teams.forEach((team, idx) => {
            const teamName = `Team ${String.fromCharCode(65 + idx)}`;
            const members = team.map(m => m.username).join(' and ');
            teamList += `**${teamName}**: ${members}\n`;
        });
        await this.announce(teamList);
    }

    async createTeamChannels() {
        // Find or create category
        let category = this.channel.guild.channels.cache.find(
            c => c.name === TEAM_CATEGORY_NAME && c.type === ChannelType.GuildCategory
        );
        if (!category) {
            // Create at the top of the server list (position 0)
            category = await this.channel.guild.channels.create({
                name: TEAM_CATEGORY_NAME,
                type: ChannelType.GuildCategory,
                position: 0,
                permissionOverwrites: [
                    {
                        id: this.channel.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });
        } else {
            // Move category to top if not already
            if (category.position !== 0) {
                await category.setPosition(0);
            }
        }
        this.category = category;

        // Create team channels at the top
        for (let i = 0; i < this.teams.length; i++) {
            const teamName = `Team ${String.fromCharCode(65 + i)}`;
            const teamChannel = await this.channel.guild.channels.create({
                name: teamName.toLowerCase().replace(/\s+/g, '-'),
                type: ChannelType.GuildText,
                parent: category.id,
                position: 0,
                permissionOverwrites: [
                    {
                        id: this.channel.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    ...this.teams[i].map(member => ({
                        id: member.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    }))
                ]
            });
            this.teamChannels.set(teamName, teamChannel);

            // Welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Welcome to ${teamName}!`)
                .setDescription('Work together to answer the quiz questions. Only if both members choose the same correct answer, you earn a point. If you choose differently or both choose the same wrong answer, you get nothing!')
                .setColor('#006400');
            await teamChannel.send({
                content: this.teams[i].map(member => `<@${member.id}>`).join(' '),
                embeds: [welcomeEmbed]
            });
        }
        await this.announce('Team channels have been created!');
    }

    async startQuizRounds() {
        this.currentRound = 0;
        await this.runQuizRound();
    }

    async runQuizRound() {
        const timer = QUESTION_TIMERS[Math.min(this.currentRound, QUESTION_TIMERS.length - 1)];
        this.questionsAsked = 0;
        // Sequentially ask 3 questions per team, not in parallel
        for (let questNum = 1; questNum <= 3; questNum++) {
            for (let i = 0; i < this.activeTeams.length; i++) {
                const teamName = this.activeTeams[i];
                const teamChannel = this.teamChannels.get(teamName);
                if (teamChannel) {
                    await this.askQuestionToTeam(teamName, teamChannel, timer, questNum);
                    // Add a small delay between teams for pacing (e.g., 2 seconds)
                    await new Promise(res => setTimeout(res, 2000));
                }
            }
            this.questionsAsked++;
        }
        await this.evaluateRound();
    }

    async askQuestionToTeam(teamName, teamChannel, timer, questNum) {
        // Pick a random quiz and then a random question from that quiz
        const quiz = quizData.quizzes[Math.floor(Math.random() * quizData.quizzes.length)];
        const questions = quiz.questions;
        const question = questions[Math.floor(Math.random() * questions.length)];

        // Support both "text" and "question" keys for question text
        const questionText = question.text || question.question;

        const questionEmbed = new EmbedBuilder()
            .setTitle(`Quest ${questNum} for ${teamName}`)
            .setDescription(questionText)
            .setColor('#006400')
            .setFooter({ text: `You have ${timer} seconds to answer` });

        if (question.image_url) questionEmbed.setImage(question.image_url);

        // Buttons for options
        const actionRow = new ActionRowBuilder();
        const buttonMap = new Map();
        (question.options || []).forEach((option, idx) => {
            const button = new ButtonBuilder()
                .setCustomId(`fod_answer_${teamName}_${questNum}_${idx}`)
                .setLabel(option)
                .setStyle(ButtonStyle.Primary);
            actionRow.addComponents(button);
            buttonMap.set(idx, option);
        });

        const message = await teamChannel.send({
            embeds: [questionEmbed],
            components: [actionRow]
        });

        // Collect answers
        const teamIdx = teamName.charCodeAt(5) - 65;
        const teamMembers = this.teams[teamIdx];
        const answers = new Map();
        let answeredCount = 0;

        const filter = i => i.customId.startsWith(`fod_answer_${teamName}_${questNum}_`) &&
            teamMembers.some(member => member.id === i.user.id);

        return new Promise(resolve => {
            const collector = teamChannel.createMessageComponentCollector({
                filter,
                time: timer * 1000
            });

            collector.on('collect', async i => {
                const answerIndex = parseInt(i.customId.split('_').pop());
                const answer = buttonMap.get(answerIndex);
                const userId = i.user.id;

                if (!answers.has(userId)) {
                    answers.set(userId, answer);
                    answeredCount++;
                    await i.reply({
                        content: `${i.user.username} has answered.`,
                        ephemeral: true
                    });
                    if (answeredCount === teamMembers.length) {
                        collector.stop('allAnswered');
                    }
                } else {
                    await i.reply({
                        content: 'You have already answered this question!',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', async () => {
                // Disable buttons
                const disabledRow = new ActionRowBuilder();
                actionRow.components.forEach(button => {
                    disabledRow.addComponents(
                        ButtonBuilder.from(button).setDisabled(true)
                    );
                });
                await message.edit({ components: [disabledRow] });

                // Evaluate answers
                if (answers.size < teamMembers.length) {
                    await teamChannel.send('Time is up! No points awarded.');
                    // Announce with delay for pacing
                    await this.announce(`${teamName} did not complete their quest in time.`);
                    return resolve();
                }
                const answerValues = Array.from(answers.values());
                if (answerValues.every(val => val === answerValues[0])) {
                    if (answerValues[0] === question.answer) {
                        // Both chose same correct answer
                        const currentScore = this.teamScores.get(teamName) || 0;
                        this.teamScores.set(teamName, currentScore + 1);
                        await teamChannel.send(`✅ Both chose the correct answer! ${teamName} earns 1 point!`);
                        await this.announce(`${teamName} has completed their quest!`);
                    } else {
                        await teamChannel.send(`❌ Both chose the same wrong answer. No points awarded.`);
                        await this.announce(`${teamName} failed their quest.`);
                    }
                } else {
                    await teamChannel.send('❌ Team members chose different answers! No points awarded.');
                    await this.announce(`${teamName} failed their quest.`);
                }
                resolve();
            });
        });
    }

    async evaluateRound() {
        // Find teams with highest points
        const scores = Array.from(this.teamScores.entries());
        const maxScore = Math.max(...scores.map(([_, score]) => score));
        const leadingTeams = scores.filter(([_, score]) => score === maxScore).map(([team]) => team);

        if (leadingTeams.length === 1 || this.currentRound === QUESTION_TIMERS.length - 1) {
            // Winner(s)
            await this.announce(
                `🏆 ${leadingTeams.join(', ')} win(s) the Forest of Death with ${maxScore} points!`
            );
            for (const teamName of leadingTeams) {
                await this.awardPrizes(teamName);
            }
            await this.cleanup();
        } else {
            // Eliminate teams not in leadingTeams
            const eliminated = this.activeTeams.filter(t => !leadingTeams.includes(t));
            for (const teamName of eliminated) {
                const channel = this.teamChannels.get(teamName);
                if (channel) {
                    await channel.send('You have been eliminated from the Forest of Death.');
                    await channel.delete();
                }
            }
            this.activeTeams = leadingTeams;
            this.currentRound++;
            await this.announce(
                `Teams advancing to next round: ${leadingTeams.join(', ')}. Timer is now ${QUESTION_TIMERS[this.currentRound]} seconds.`
            );
            await this.runQuizRound();
        }
    }

    async awardPrizes(teamName) {
        const teamIdx = teamName.charCodeAt(5) - 65;
        const teamMembers = this.teams[teamIdx];
        let playersData = {};
        try {
            playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        } catch (err) {
            await this.announce('Error reading players.json for rewards.');
            return;
        }
        for (const member of teamMembers) {
            if (playersData[member.id]) {
                playersData[member.id].ramen = (playersData[member.id].ramen || 0) + 50;
                playersData[member.id].money = (playersData[member.id].money || 0) + 5000;
                await this.announce(`${member.username} from ${teamName} wins 50 Ramen Coupons and 5000 Money!`);
            } else {
                await this.announce(`${member.username} from ${teamName} is not enrolled. No rewards given.`);
            }
        }
        try {
            fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
        } catch (err) {
            await this.announce('Error saving players.json after rewards.');
        }
    }

    async announce(message) {
        if (this.ankoWebhook) {
            await this.ankoWebhook.send({
                content: message,
                username: 'Anko',
                avatarURL: 'https://static.wikia.nocookie.net/naruto/images/b/bd/Anko_Part_I.png/revision/latest?cb=20170412103610'
            });
        } else {
            await this.channel.send(message);
        }
    }

    async getOrCreateWebhook(channel, name) {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.name === name);
        if (!webhook) {
            if (webhooks.size >= 15) {
                for (const wh of webhooks.values()) {
                    await wh.delete();
                }
            }
            webhook = await channel.createWebhook({
                name: name,
                avatar: 'https://static.wikia.nocookie.net/naruto/images/7/7c/Anko.png'
            });
        }
        return webhook;
    }

    async cleanup() {
        this.active = false;
        currentFODGame = null;
        // Delete all team channels
        for (const channel of this.teamChannels.values()) {
            try {
                await channel.delete();
            } catch {}
        }
        // Delete category if empty
        if (this.category) {
            try {
                const children = this.category.children.cache;
                if (children.size === 0) await this.category.delete();
            } catch {}
        }
        // Lock the main channel
        await this.channel.permissionOverwrites.edit(this.channel.guild.roles.everyone, {
            SendMessages: false,
        });
        await this.announce('The Forest of Death has concluded!');
    }
}

async function autoStartFOD(client) {
    const channel = await client.channels.fetch(FOD_CHANNEL_ID);
    if (!channel) return;
    if (currentFODGame && currentFODGame.active) return;
    currentFODGame = new FODGame(channel, client);
    await currentFODGame.initialize();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fod')
        .setDescription('Start the Forest of Death! (Admin only)'),
    async execute(interaction, client) {
        if (interaction.channel.id !== FOD_CHANNEL_ID) {
            return interaction.reply({ content: 'This command can only be used in the Forest of Death channel.', ephemeral: true });
        }
        const commandInvokerId = interaction.user.id;
        const member = await interaction.guild.members.fetch(commandInvokerId);
        if (!member.roles.cache.has(ADMIN_USER_ID)) {
            return interaction.reply({
                content: 'Only administrators can start the Forest of Death.',
                ephemeral: true
            });
        }
        if (currentFODGame && currentFODGame.active) {
            return interaction.reply({
                content: 'A Forest of Death game is already in progress.',
                ephemeral: true
            });
        }
        await interaction.deferReply();
        currentFODGame = new FODGame(interaction.channel, client);
        await currentFODGame.initialize();
        await interaction.editReply({
            content: 'Forest of Death has been initiated! Participants can now join by typing in this channel.'
        });
    },
    // Call this from your bot's ready event to enable auto-start
    startAutoFOD(client) {
        if (autoStartInterval) clearInterval(autoStartInterval);
        autoStartInterval = setInterval(() => autoStartFOD(client), AUTOSTART_INTERVAL);
    }
};
