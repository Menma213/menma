const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- File Paths ---
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

// --- Data Loading ---
let jutsuList = fs.existsSync(jutsusPath) ? JSON.parse(fs.readFileSync(jutsusPath, 'utf8')) : {};

// Helper for webhooks (Hagoromo, Zephyr, Yori, Asuma)
async function getSecretWebhook(channel, name, avatar) {
    try {
        const webhooks = await channel.fetchWebhooks();
        let wh = webhooks.find(w => w.name === name);
        if (!wh) {
            wh = await channel.createWebhook({ name, avatar });
        }
        return wh;
    } catch (err) {
        console.error(`Failed to get/create webhook for ${name}:`, err);
        throw err;
    }
}

/**
 * Main function to run a memory sequence
 * @param {object} interaction - The Discord interaction
 * @param {string} userId - The ID of the player
 */
async function runMemorySequence(interaction, userId) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const rank = users[userId]?.rank || 'Academy Student';

    if (rank === 'Academy Student') {
        return await runGeninMemory(interaction, userId, users);
    } else {
        // Placeholder for other memories
        await interaction.reply({ content: "*The spirits of the past seem quiet for now.*", ephemeral: true }).catch(() => { });
        return;
    }
}

async function runGeninMemory(interaction, userId, users) {
    const channel = interaction.channel;
    const client = interaction.client;
    const user = await client.users.fetch(userId);

    const hagoromoPfp = 'https://i.pinimg.com/736x/f8/7e/3f/f87e3f296806f31891ced678ae0ec522.jpg';
    const zephyrPfp = 'https://i.postimg.cc/nhZ00RdT/image.png';
    const yoriPfp = 'https://i.postimg.cc/N0jbwyvJ/image.png';
    const asumaPfp = 'https://i.pinimg.com/originals/d9/b6/1a/d9b61a4328fd5986574164a3d40e430f.png';

    // 1. Initial Prompt
    const startBtn = new ButtonBuilder()
        .setCustomId(`whats_this-${userId}`)
        .setLabel("What's this?")
        .setStyle(ButtonStyle.Primary);

    const startRow = new ActionRowBuilder().addComponents(startBtn);

    const startMsg = await interaction.reply({
        content: "You found a glowing orb",
        components: [startRow],
        ephemeral: false
    });

    try {
        const i = await startMsg.awaitMessageComponent({ filter: i => i.user.id === userId, time: 60000 });
        await i.deferUpdate();
        await startMsg.edit({ components: [] }).catch(() => { });
    } catch (e) {
        await startMsg.edit({ content: "The orb faded away...", components: [] }).catch(() => { });
        return;
    }

    // Helper to send webhook message and wait for "Continue" button
    const continueBtn = new ButtonBuilder()
        .setCustomId(`continue-${userId}`)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Secondary);
    const continueRow = new ActionRowBuilder().addComponents(continueBtn);

    async function sendWHAndWait(webhook, content) {
        const msg = await webhook.send({
            content,
            components: [continueRow],
            wait: true // Ensure we get the message object back
        });

        try {
            const filter = i => i.user.id === userId && i.customId === `continue-${userId}`;
            const i = await channel.awaitMessageComponent({ filter, time: 300000 });
            await i.deferUpdate();
            await webhook.editMessage(msg.id, { components: [] }).catch(() => { });
        } catch (e) {
            await webhook.editMessage(msg.id, { components: [] }).catch(() => { });
        }
    }

    // 2. Dialogue Sequence
    let hWH, zWH, yWH;
    try {
        hWH = await getSecretWebhook(channel, 'Hagoromo Otsutsuki', hagoromoPfp);
        yWH = await getSecretWebhook(channel, 'Yori', yoriPfp);
        zWH = await getSecretWebhook(channel, 'Zephyr', zephyrPfp);
    } catch (e) {
        return channel.send({ content: "The memory sequence was interrupted (Missing Webhook Permissions)." }).catch(() => { });
    }

    await sendWHAndWait(hWH, "Stop it you two! There's no point in fighting over something that is over!");
    await sendWHAndWait(yWH, "He...");
    await sendWHAndWait(hWH, "Silence! It wasn't his fault!");
    await sendWHAndWait(zWH, "Stop it old man. He won't understand anyway, he's too dumb for it! Haha!");

    // 3. Fight Trigger
    const fightBtn = new ButtonBuilder()
        .setCustomId(`fight-${userId}`)
        .setLabel('Fight')
        .setStyle(ButtonStyle.Danger);

    const fightRow = new ActionRowBuilder().addComponents(fightBtn);
    const fightMsg = await channel.send({ content: "Another fight erupts!", components: [fightRow] });

    try {
        const i = await fightMsg.awaitMessageComponent({ filter: i => i.user.id === userId, time: 60000 });
        await i.deferUpdate();
        await fightMsg.edit({ components: [] }).catch(() => { });
    } catch (e) {
        await fightMsg.edit({ content: "The memory faded...", components: [] }).catch(() => { });
        return;
    }

    // 4. Scriped Battle Clash
    const battleEmbed = new EmbedBuilder()
        .setTitle("Memory Clash")
        .setDescription(`${user.username} vs Zephyr`)
        .setColor('#1E90FF')
        .setImage('https://media.tenor.com/On7iZ965fvgAAAAM/blue-dragon-dragon.gif');

    await channel.send({ embeds: [battleEmbed] });
    await new Promise(r => setTimeout(r, 3000));

    const summaryEmbed = new EmbedBuilder()
        .setTitle("Round Summary")
        .setColor('#800080')
        .setDescription(
            `**${user.username}** unleashed **Dragonic Roar**!\n` +
            `**Zephyr** used **Emperor of the skies**!\n\n` +
            `*The clash shakes the very foundation of the vision...*`
        );

    await channel.send({ embeds: [summaryEmbed] });
    await new Promise(r => setTimeout(r, 5000));

    // 5. Hospital Scene
    await channel.send({ content: "You suddenly wake up in the village hospital." });
    await new Promise(r => setTimeout(r, 3000));

    const aWH = await getSecretWebhook(channel, 'Asuma Sarutobi', asumaPfp);
    await sendWHAndWait(aWH, "The visions. Did it happen again? I hope it's not bad..");

    const userWH = await getSecretWebhook(channel, user.username, user.displayAvatarURL());
    await sendWHAndWait(userWH, "I saw some strange people.. I'll have to learn more though.");

    // 6. Rewards and Rank Up
    const GENIN_ROLE_ID = '1381606591609962578';
    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    if (member) {
        try {
            await member.roles.add(GENIN_ROLE_ID);
        } catch (err) {
            console.error('Failed to add Genin role:', err);
        }
    }

    users[userId].rank = "Genin";
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    const rewardEmbed = new EmbedBuilder()
        .setTitle("Progression Updated")
        .setColor('#7CFC00')
        .setDescription(
            `Knowledge +500!\n` +
            `You reached a new Rank: **Genin**!`
        );

    await channel.send({ embeds: [rewardEmbed] });
}

module.exports = {
    runMemorySequence
};
