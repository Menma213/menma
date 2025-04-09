const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Challenge another player to a PvP battle')
        .addUserOption(option => option.setName('opponent').setDescription('Select an opponent').setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const opponentId = interaction.options.getUser('opponent').id;

        // Check if user is challenging themselves
        if (userId === opponentId) {
            return interaction.reply({ content: "❌ You can't challenge yourself!", ephemeral: true });
        }

        const userAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
        const opponentAvatar = interaction.options.getUser('opponent').displayAvatarURL({ format: 'png', size: 128 });

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId] || !users[opponentId]) {
            return interaction.reply({ content: "❌ Both players must be enrolled to fight! Use `/enroll` to start.", ephemeral: true });
        }

        let player1 = users[userId];
        let player2 = users[opponentId];
        let turn = 1;
        let player1Health = player1.health;
        let player2Health = player2.health;

        // Function to generate battle image
        async function generateBattleImage() {
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            await page.setViewport({ width: 700, height: 350 });

            const player1HealthPercent = Math.max((player1Health / player1.health) * 100, 0);
            const player2HealthPercent = Math.max((player2Health / player2.health) * 100, 0);

            const htmlContent = `
                <html>
                <body style="margin: 0; padding: 0; position: relative;">
                    <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                    
                    <div style="position: absolute; left: 50px; top: 50px;">
                        <img src="${userAvatar}" width="120" />
                    </div>

                    <div style="position: absolute; right: 50px; top: 50px;">
                        <img src="${opponentAvatar}" width="120" />
                    </div>

                    <div style="position: absolute; left: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${player1HealthPercent}%; height: 100%; background: green;"></div>
                    </div>

                    <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                        <div style="width: ${player2HealthPercent}%; height: 100%; background: red;"></div>
                    </div>
                </body>
                </html>
            `;

            await page.setContent(htmlContent);
            const imagePath = `./pvp_battle_${userId}.png`;
            await page.screenshot({ path: imagePath });
            await browser.close();
            return imagePath;
        }

        const updateBattleUI = async (message, userTurn) => {
            const imagePath = await generateBattleImage();
            const battleImage = new AttachmentBuilder(imagePath);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('attack')
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Primary)
            );

            const turnMessage = userTurn === userId ? 'Your Turn!' : `${opponentId}'s Turn!`;

            await message.edit({
                content: `**PvP Battle in Progress!**\n\n${turnMessage}`,
                components: [row],
                files: [battleImage]
            });
        };

        const handleAttack = async (buttonInteraction) => {
            if (turn % 2 !== 0 && buttonInteraction.user.id !== userId) return buttonInteraction.reply({ content: "Wait for your turn!", ephemeral: true });
            if (turn % 2 === 0 && buttonInteraction.user.id !== opponentId) return buttonInteraction.reply({ content: "Wait for your turn!", ephemeral: true });

            let attacker = turn % 2 !== 0 ? player1 : player2;
            let defender = turn % 2 !== 0 ? player2 : player1;
            let defenderHealth = turn % 2 !== 0 ? player2Health : player1Health;

            let damage = Math.max(5, attacker.power - defender.defense);
            if (Math.random() < 0.05) damage = 0; // 5% chance to miss

            defenderHealth -= damage;

            if (turn % 2 !== 0) player2Health = defenderHealth;
            else player1Health = defenderHealth;

            turn++;

            if (player1Health <= 0 || player2Health <= 0) {
                let winner = player1Health > 0 ? player1 : player2;
                let loser = player1Health > 0 ? player2 : player1;

                winner.wins += 1;
                loser.losses += 1;

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return buttonInteraction.update({
                    content: `🏆 **Victory!** ${winner === player1 ? `<@${userId}>` : `<@${opponentId}>`} wins the battle!`,
                    components: [],
                    files: [new AttachmentBuilder(await generateBattleImage())]
                });
            }

            await updateBattleUI(buttonInteraction.message, turn % 2 !== 0 ? userId : opponentId);
        };

        // Step 1: Send the DM challenge to the opponent
        const challengeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept')
                .setLabel('Accept Challenge')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline')
                .setLabel('Decline Challenge')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            const dmChannel = await interaction.options.getUser('opponent').createDM();
            await dmChannel.send({
                content: `${interaction.user.username} has challenged you to a PvP battle!`,
                components: [challengeRow]
            });

            // Send ephemeral reply to the challenger
            await interaction.reply({
                content: "✅ Battle challenge sent to the opponent! Please wait for their response.",
                ephemeral: true
            });

            // Step 2: Set up the collector to listen for accept/decline
            const filter = (buttonInteraction) => buttonInteraction.user.id === opponentId;
            const collector = dmChannel.createMessageComponentCollector({ filter, time: 30000 });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === 'accept') {
                    await buttonInteraction.reply({ content: "You accepted the challenge! Battle starting in the main channel..." });

                    // Step 3: Send battle start message in the original channel
                    const firstMessage = await interaction.channel.send({
                        content: "**PvP Battle Started!**",
                        components: [],
                        files: [new AttachmentBuilder(await generateBattleImage())]
                    });

                    // Add attack button to the battle message
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('attack')
                            .setLabel('Attack')
                            .setStyle(ButtonStyle.Primary)
                    );

                    // Send the battle message with the attack button
                    await firstMessage.edit({
                        content: "**PvP Battle Started!**",
                        components: [row],
                        files: [new AttachmentBuilder(await generateBattleImage())]
                    });

                    // Start battle by updating the UI with the attack button and handling turns
                    const attackCollector = firstMessage.createMessageComponentCollector({ filter: (i) => i.user.id === userId || i.user.id === opponentId, time: 60000 });
                    attackCollector.on('collect', handleAttack);
                } else if (buttonInteraction.customId === 'decline') {
                    await buttonInteraction.reply({ content: "You declined the challenge. Battle canceled." });
                }
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    dmChannel.send({ content: "The challenge timed out. No response from the opponent." });
                }
            });
        } catch (error) {
            console.error('Error sending DM:', error);
            return interaction.reply({ content: '❌ Failed to send DM. Please ensure the opponent has DMs enabled.', ephemeral: true });
        }
    }
};
