const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('enroll')
        .setDescription('Enroll in the ninja world and face your first trial'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
        const enemyImage = "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg"; // NPC image

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (users[userId]) {
            return interaction.reply({ content: "❌ You are already enrolled! Use `/profile` to view your stats.", ephemeral: true });
        }

        const enrollEmbed = new EmbedBuilder()
            .setColor(0x4B0082)
            .setTitle('🌟 Your Journey Awaits, Young Ninja! 🌟')
            .setDescription('Before you can begin your path as a shinobi, you must pass the Academy Trial. Are you ready to prove yourself?')
            .addFields(
                { name: '⚔️ The Path of the Shinobi', value: 'It is filled with peril, honor, and power. Your strength will be tested through battle. Do you have the courage to face the challenge?' },
                { name: '💡 How will you begin?', value: 'Press **"Accept"** to begin your journey or **"Decline"** to stay behind.' }
            )
            .setFooter({ text: 'Only the worthy will survive the trials ahead.' })
            .setThumbnail(enemyImage);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept-${userId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline-${userId}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [enrollEmbed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (!i.customId.startsWith(`accept-`) && !i.customId.startsWith(`decline-`)) return;
            if (i.user.id !== userId) return i.reply({ content: "This isn't your enrollment!", ephemeral: true });

            if (i.customId === `accept-${userId}`) {
                users[userId] = {
                    level: 1, exp: 0, wins: 0, losses: 0, health: 100, power: 20, defense: 10, money: 0
                };
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                await i.update({ content: '✅ You have accepted the trial! Your training battle begins now...', components: [] });

                // Start battle
                await startBattle(interaction, userId, userAvatar, enemyImage);
            } else {
                await i.update({ content: '❌ You chose to remain in the shadows... Maybe next time, Shinobi.', components: [] });
            }
            collector.stop();
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                return interaction.editReply({ content: '❌ Enrollment timed out. Try again later.', components: [] });
            }
        });
    }
};

// **Start Battle Function**
async function startBattle(interaction, userId, userAvatar, enemyImage) {
    let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    let player = users[userId];

    let npc = {
        name: "Academy Instructor",
        health: 100,
        power: 15,
        defense: 5,
        currentHealth: 100
    };

    const generateBattleImage = async () => {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 700, height: 350 });

        const playerHealthPercent = Math.max((player.health / 100) * 100, 0);
        const npcHealthPercent = Math.max((npc.currentHealth / npc.health) * 100, 0);

        const htmlContent = `
            <html>
            <body style="margin: 0; padding: 0; position: relative;">
                <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                
                <div style="position: absolute; left: 50px; top: 50px;"><img src="${enemyImage}" width="150" /></div>
                <div style="position: absolute; right: 50px; top: 50px;"><img src="${userAvatar}" width="120" /></div>

                <div style="position: absolute; left: 50px; top: 220px; width: 150px; height: 15px; background: gray;">
                    <div style="width: ${npcHealthPercent}%; height: 100%; background: red;"></div>
                </div>
                <div style="position: absolute; right: 50px; top: 220px; width: 120px; height: 15px; background: gray;">
                    <div style="width: ${playerHealthPercent}%; height: 100%; background: green;"></div>
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        const imagePath = `./battle_scene_${userId}.png`;
        await page.screenshot({ path: imagePath });
        await browser.close();
        return imagePath;
    };

    const updateBattleUI = async (i) => {
        const battleImage = new AttachmentBuilder(await generateBattleImage());
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`attack-${userId}`).setLabel('Attack').setStyle(ButtonStyle.Primary)
        );

        if (i) {
            await i.update({ content: "**Training Battle in Progress!**", components: [row], files: [battleImage] });
        } else {
            await interaction.followUp({ content: "**Battle Started!**", components: [row], files: [battleImage] });
        }
    };

    const handleAttack = async (i) => {
        npc.currentHealth -= player.power - npc.defense;

        if (npc.currentHealth <= 0) {
            // Enrollment Success - No rewards, just a message
            return i.update({
                content: `🏆 **Victory!** You have successfully defeated the Academy Instructor!\n\nYour battle prowess is undeniable, and you are now a Shinobi! You have proven your strength and courage. Go forth, make the village proud and live up to the expectations of your comrades. Your journey as a Shinobi has only just begun.`,
                components: [],
                files: [new AttachmentBuilder(await generateBattleImage())]
            });
        }


        player.health -= npc.power - player.defense;

        if (player.health <= 0) {
            // Enrollment Failure - Custom failure message
            return i.update({
                content: `💀 **Defeat!** You have been defeated by the Academy Instructor...\n\nIt is clear you need to train harder, but your determination and spirit are what define a true Shinobi. You are now a Shinobi, but don't let this defeat break you. Use it as motivation to become stronger, for this is just the beginning of your journey.`,
                components: [],
                files: [new AttachmentBuilder(await generateBattleImage())]
            });
        }


        await updateBattleUI(i);
    };

    await updateBattleUI();

    const collector = interaction.channel.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== userId) return i.reply({ content: "This isn't your battle!", ephemeral: true });
        if (i.customId === `attack-${userId}`) await handleAttack(i);
    });
}
