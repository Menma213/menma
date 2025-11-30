const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { runBattle } = require('./combinedcommands.js');

// --- Config ---
const AKATSUKI_LEADER_ID = '420101737173483541';
const playersPath = path.join(__dirname, '..', 'data', 'players.json');
const akatsukiPath = path.join(__dirname, '..', 'data', 'akatsuki.json');
const MIN_LEVEL = 250;

// --- File I/O Helpers ---
function readJsonFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Error reading or parsing ${filePath}:`, e);
            return null;
        }
    }
    return {};
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`Error writing to ${filePath}:`, e);
        return false;
    }
}

// --- Webhook Helpers ---
async function getLeaderWebhook(channel) {
    try {
        const leader = await channel.client.users.fetch(AKATSUKI_LEADER_ID);
        const webhooks = await channel.fetchWebhooks();
        let leaderWebhook = webhooks.find(wh => wh.name === leader.username);

        if (!leaderWebhook) {
            leaderWebhook = await channel.createWebhook({
                name: leader.username,
                avatar: leader.displayAvatarURL({ dynamic: true }),
            });
        }
        return leaderWebhook;
    } catch (err) {
        if (err.code === 50013) { // Missing Permissions
            throw new Error('MISSING_WEBHOOK_PERMISSIONS');
        }
        throw err;
    }
}

async function safeWebhookSend(channel, webhook, sendOptions) {
    try {
        return await webhook.send(sendOptions);
    } catch (err) {
        if (err.code === 10015) { // Unknown Webhook
            try {
                const newWebhook = await getLeaderWebhook(channel);
                return await newWebhook.send(sendOptions);
            } catch (err2) {
                throw err2;
            }
        }
        throw err;
    }
}

// --- Button Helpers ---
function createContinueRow(customId = 'continue') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Continue')
            .setStyle(ButtonStyle.Primary)
    );
}

async function waitForButton(interaction, userId, customId, timeout = 60000) {
    const filter = i => i.customId === customId && i.user.id === userId;
    try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: timeout });
        await buttonInteraction.deferUpdate();
        return true;
    } catch (error) {
        return false;
    }
}

// --- Quest Stages ---
async function startQuest(interaction) {
    const userId = interaction.user.id;
    let leaderWebhook;

    const anbuPath = path.join(__dirname, '..', 'data', 'anbu.json');
    const anbuData = readJsonFile(anbuPath);
    if (anbuData && anbuData.members && anbuData.members[userId]) {
        delete anbuData.members[userId];
        writeJsonFile(anbuPath, anbuData);
    }

    try {
        leaderWebhook = await getLeaderWebhook(interaction.channel);
    } catch (err) {
        if (err.message === 'MISSING_WEBHOOK_PERMISSIONS') {
            await interaction.followUp({ content: "I lack the power to summon our leader. (Missing `Manage Webhooks` permission).", ephemeral: true });
            return;
        }
        console.error("Failed to get webhook:", err);
        await interaction.followUp({ content: "An unforeseen obstacle has appeared. The path is blocked for now.", ephemeral: true });
        return;
    }

    await interaction.editReply({ content: 'A shadow approaches...', components: [], embeds: [] });

    await safeWebhookSend(interaction.channel, leaderWebhook, {
        content: `So, you wish to walk the path of shadows.. Interesting.`,
        components: [createContinueRow('quest_start')]
    });

    if (await waitForButton(interaction, userId, 'quest_start')) {
        await questStage1(interaction, leaderWebhook);
    } else {
        await safeWebhookSend(interaction.channel, leaderWebhook, { content: "Hesitation. The evil path is not for the indecisive. Return when your will is forged." });
    }
}

async function questStage1(interaction, webhook) {
    const userId = interaction.user.id;
    await safeWebhookSend(interaction.channel, webhook, {
        content: `The Akatsuki is not a mere group of rogue ninja. We are the gifts of god to this world, the doomed world. Tell me, what do you seek by joining us? Power? Revenge? or perhaps, World Domination?`,
        components: [createContinueRow('quest_s1')]
    });

    if (await waitForButton(interaction, userId, 'quest_s1')) {
        await questStage2(interaction, webhook);
    } else {
        await safeWebhookSend(interaction.channel, webhook, { content: "Your silence speaks volumes. Return when you have an answer." });
    }
}

async function questStage2(interaction, webhook) {
    const userId = interaction.user.id;
    await safeWebhookSend(interaction.channel, webhook, {
        content: `Words do not determine your worthiness. To prove your worth, you must face a trial. A trial that will demonstrate your strength and your willingness to sever the bonds of the past.`,
        components: [createContinueRow('quest_s2')]
    });

    if (await waitForButton(interaction, userId, 'quest_s2')) {
        await questStage3(interaction, webhook);
    } else {
        await safeWebhookSend(interaction.channel, webhook, { content: "You hesitate at the final step. The Akatsuki has no place for the weak-willed." });
    }
}

async function questStage3(interaction, webhook) {
    const userId = interaction.user.id;
    await safeWebhookSend(interaction.channel, webhook, {
        content: `**Show me your strength.**`
    });

    const leader = await interaction.client.users.fetch(AKATSUKI_LEADER_ID);
    const leaderNpc = {
        name: leader.username,
        image: leader.displayAvatarURL({ dynamic: true }),
        health: 50000,
        power: 5000,
        defense: 4000,
        chakra: 1000,
        jutsu: ['Attack', 'Lightning Blade: All out', 'Rasenshuriken'],
        statsType: 'fixed'
    };

    const { winner, loser } = await runBattle(interaction, userId, 'NPC_AkatsukiLeader', 'akatsuki_trial', leaderNpc);

    if (winner && winner.userId === userId) {
        // User won, but we need to check the 10% health condition
        const healthLost = leaderNpc.health - loser.currentHealth;
        const healthLostPercentage = (healthLost / leaderNpc.health) * 100;

        if (healthLostPercentage >= 10) {
            const akatsukiData = readJsonFile(akatsukiPath);
            if (!akatsukiData.members) {
                akatsukiData.members = {};
            }
            akatsukiData.members[userId] = { status: 'Junior Akatsuki', joinedAt: new Date().toISOString() };
            if (writeJsonFile(akatsukiPath, akatsukiData)) {
                await safeWebhookSend(interaction.channel, webhook, {
                    content: `You have proven your strength. You have passed the trial. Welcome, Junior member.`
                });
            } else {
                await safeWebhookSend(interaction.channel, webhook, {
                    content: `An error occurred while recording your allegiance. The path remains closed.`
                });
            }
        } else {
            await safeWebhookSend(interaction.channel, webhook, {
                content: `You survived, but you could not land a significant blow. You are not ready. Train harder and return.`
            });
        }
    } else if (loser && loser.fled && loser.userId === userId) {
        // User fled
        await safeWebhookSend(interaction.channel, webhook, {
            content: `You fled. To run from a challenge is to admit defeat. You are not worthy of the Akatsuki.`
        });
    } else if (loser) {
        // User lost
        await safeWebhookSend(interaction.channel, webhook, {
            content: `You have been defeated. The Akatsuki has no place for the weak. Return when you have honed your skills.`
        });
    }
}



// --- Main Command ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('akatsuki')
        .setDescription('Provides information about the Akatsuki and your status.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const playersData = readJsonFile(playersPath);
        if (!playersData) {
            return interaction.reply({ content: "There was an error accessing player data.", ephemeral: true });
        }
        
        const akatsukiData = readJsonFile(akatsukiPath);
        if (!akatsukiData) {
            return interaction.reply({ content: "There was an error accessing Akatsuki data.", ephemeral: true });
        }

        const userLevel = playersData[userId]?.level || 0;
        const akatsukiMember = akatsukiData.members && akatsukiData.members[userId];
        
        let userStatus = 'Not a member';
        if (akatsukiMember) {
            userStatus = akatsukiMember.status || 'Junior Akatsuki';
        }

        const leader = await interaction.client.users.fetch(AKATSUKI_LEADER_ID);

        const akatsukiEmbed = new EmbedBuilder()
            .setTitle('The Akatsuki')
            .setColor('#DC143C')
            .setDescription('A group of shinobi existing outside the hidden villages, seeking to bring about a new world order.')
            .addFields(
                { name: 'Your Status', value: userStatus, inline: true },
                { name: 'Current Leader', value: leader.username, inline: true },
                { name: 'Requirement', value: `Level ${MIN_LEVEL}+`, inline: true },
                { name: 'Original Goal', value: 'To achieve peace through dialogue and non-violence in their war-torn homeland.' },
                { name: 'Later Goal', value: 'To capture the Tailed Beasts and enact the "Moon\'s Eye Plan" for forced world peace.' }
            )
            .setThumbnail(leader.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Source: Naruto Wiki' })
            .setTimestamp();

        const canJoin = !akatsukiMember && userLevel >= MIN_LEVEL;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join_akatsuki_quest')
                .setLabel('Begin the Trial')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!canJoin)
        );

        const reply = await interaction.reply({ embeds: [akatsukiEmbed], components: [row], ephemeral: true });
        
        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'join_akatsuki_quest',
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            await startQuest(i);
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                const expiredRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_akatsuki_quest_expired')
                        .setLabel('Trial Expired')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                interaction.editReply({ components: [expiredRow] });
            }
        });
    },
};