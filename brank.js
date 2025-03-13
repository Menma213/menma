const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brank')
        .setDescription('Fight a weak NPC in a B-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userAvatar = interaction.user.displayAvatarURL({ dynamic: true });

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "❌ You haven't enrolled yet! Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];
        let npc = {
            name: "Bandit",
            health: Math.floor(50 + player.level * 5),
            power: Math.floor(10 + player.level * 2),
            defense: Math.floor(5 + player.level * 1.5),
            currentHealth: Math.floor(50 + player.level * 5), // Track current health
        };

        // Function to send battle UI
        const updateBattleUI = async (i) => {
            const battleEmbed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setTitle(`⚔ B-Rank Battle: ${npc.name}`)
                .setDescription("Turn-based combat! Click **Attack** to fight!")
                .addFields(
                    { name: "🧑‍💥 Your Health", value: `${player.health} HP`, inline: true },
                    { name: "🦹 Enemy Health", value: `${npc.currentHealth} HP`, inline: true }
                )
                .setThumbnail("https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg") // NPC image
                .setFooter({ text: `Fighting as ${interaction.user.username}`, iconURL: userAvatar });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${interaction.id}`)
                    .setLabel('Attack')
                    .setStyle(ButtonStyle.Primary)
            );

            if (i) {
                await i.update({ embeds: [battleEmbed], components: [row] });
            } else {
                await interaction.reply({ embeds: [battleEmbed], components: [row] });
            }
        };

        // Function to handle attack
        const handleAttack = async (i) => {
            let playerDamage = Math.max(5, player.power - npc.defense);
            let npcDamage = Math.max(1, npc.power - player.defense);

            // 5% chance to miss the attack
            if (Math.random() < 0.05) {
                playerDamage = 0;
            }

            npc.currentHealth -= playerDamage;

            let resultMessage = `⚔ **You attacked ${npc.name}!**\n💥 **Damage Dealt:** ${playerDamage}\n`;

            if (npc.currentHealth <= 0) {
                let expReward = 300 + Math.floor(player.level * 30);
                let moneyReward = 500 + Math.floor(player.level * 20);
                player.exp += expReward;
                player.money += moneyReward;
                player.wins += 1;

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return i.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x00ff00)
                            .setTitle("🏆 Victory!")
                            .setDescription(`You defeated **${npc.name}**!`)
                            .addFields(
                                { name: "🏅 EXP Gained", value: `${expReward}`, inline: true },
                                { name: "💰 Money Earned", value: `${moneyReward} Ryo`, inline: true }
                            )
                            .setThumbnail("https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg")
                            .setFooter({ text: "Use /train to level up!", iconURL: userAvatar })
                    ],
                    components: []
                });
            }

            // NPC attacks back
            player.health -= npcDamage;

            if (player.health <= 0) {
                player.losses += 1;
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return i.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("💀 Defeat!")
                            .setDescription(`You were defeated by **${npc.name}**...`)
                            .setThumbnail("https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg")
                            .setFooter({ text: "Better luck next time!", iconURL: userAvatar })
                    ],
                    components: []
                });
            }

            resultMessage += `🔥 **Enemy Attacks Back! You take ${npcDamage} damage.**`;
            await i.update({ content: resultMessage });
            await updateBattleUI(i);
        };

        // Start battle
        await updateBattleUI();

        // Button interaction collector
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
