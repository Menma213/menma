const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Fight a weak NPC in a B-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userAvatar = interaction.user.displayAvatarURL({ format: 'png', size: 128 });
        const enemyImage = "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg";

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "❌ You haven't enrolled yet! Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];
        let originalHealth = player.health; // Store original health to restore later if defeated

        let npc = {
            name: "Bandit",
            health: Math.floor(player.health * 0.75 + player.defense * 2),
            power: Math.floor(player.power * 0.9 + player.level * 2),
            defense: Math.floor(player.defense * 0.8 + player.level),
            currentHealth: Math.floor(player.health * 0.75 + player.defense * 2),
        };

        async function generateBattleImage() {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setViewport({ width: 700, height: 350 });

            const playerHealthPercent = Math.max((player.health / originalHealth) * 100, 0);
            const npcHealthPercent = Math.max((npc.currentHealth / npc.health) * 100, 0);

            const htmlContent = `
                <html>
                <body style="margin: 0; padding: 0; position: relative;">
                    <img src="https://th.bing.com/th/id/R.067ea36dadfb751eb748255b475471da?rik=t4KQCUGlwxVq0Q&riu=http%3a%2f%2ffc03.deviantart.net%2ffs70%2fi%2f2013%2f268%2f7%2f5%2fbosque_naruto_by_lwisf3rxd-d6ntjgx.jpg&ehk=FH5skKe491eVsFi6eNVSnBJTJbUhblD%2bFfBsLEsWunU%3d&risl=&pid=ImgRaw&r=0" style="width: 700px; height: 350px; position: absolute; z-index: -1;">
                    
                    <div style="position: absolute; left: 50px; top: 50px;">
                        <img src="${enemyImage}" width="150" />
                    </div>

                    <div style="position: absolute; right: 50px; top: 50px;">
                        <img src="${userAvatar}" width="120" />
                    </div>

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
        }

        const updateBattleUI = async (i) => {
            const imagePath = await generateBattleImage();
            const battleImage = new AttachmentBuilder(imagePath);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${interaction.id}`)
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Primary)
            );

            if (i) {
                await i.update({ content: "**Battle in Progress!**", components: [row], files: [battleImage] });
            } else {
                await interaction.reply({ content: "**Battle Started!**", components: [row], files: [battleImage] });
            }
        };

        const handleAttack = async (i) => {
            let playerDamage = Math.max(5, player.power - npc.defense);
            let npcDamage = Math.max(1, npc.power - player.defense);

            if (Math.random() < 0.05) playerDamage = 0; // 5% chance to miss
            if (Math.random() < 0.05) npcDamage = 0; // 5% chance for NPC to miss

            npc.currentHealth -= playerDamage;

            if (npc.currentHealth <= 0) {
                let expReward = 300 + Math.floor(player.level * 30);
                let moneyReward = 500 + Math.floor(player.level * 20);
                player.exp += expReward;
                player.money += moneyReward;
                player.wins += 1;
                player.health = originalHealth; // Restore full health after battle

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return i.update({
                    content: `🏆 **Victory!** You defeated **${npc.name}**!\n\n🏅 **EXP Gained:** ${expReward}\n💰 **Money Earned:** ${moneyReward} Ryo`,
                    components: [],
                    files: [new AttachmentBuilder(await generateBattleImage())]
                });
            }

            // NPC retaliates
            player.health -= npcDamage;

            if (player.health <= 0) {
                player.losses += 1;
                player.health = originalHealth; // Reset to original health

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return i.update({
                    content: `💀 **Defeat!** You were defeated by **${npc.name}**...`,
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

            if (i.customId === `attack-${interaction.id}`) {
                await handleAttack(i);
            }
        });

        collector.on('end', async () => {
            if (npc.currentHealth > 0 && player.health > 0) {
                return interaction.followUp("⏳ **Battle ended due to inactivity!**");
            }
        });
    }
};