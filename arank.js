const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dataPath = './data/users.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arank')
        .setDescription('Fight multiple NPCs in an A-Rank mission'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userPfp = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

        if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "❌ You haven't enrolled yet! Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];
        let totalExp = 0, totalMoney = 0, enemiesDefeated = 0, currentNpc = null;

        // Function to generate a new NPC
        const generateNpc = () => ({
            name: `Elite Bandit ${enemiesDefeated + 1}`,
            health: Math.floor(150 + player.level * 12),
            power: Math.floor(25 + player.level * 4),
            defense: Math.floor(12 + player.level * 3),
            currentHealth: Math.floor(150 + player.level * 12),
            image: "https://i.pinimg.com/736x/10/92/b0/1092b0aea71f620c1ed7fffe7a8704c1.jpg"
        });

        // Function to create the attack button
        const createAttackButton = () => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`attack-${interaction.id}`)
                    .setLabel('⚔ Attack')
                    .setStyle(ButtonStyle.Primary)
            );
        };

        // Function to start a new fight
        const startFight = async () => {
            if (enemiesDefeated >= 50) {
                return interaction.followUp({ embeds: [new EmbedBuilder().setTitle("🔥 Max Limit Reached!").setDescription("You can't fight more than **50 enemies** in one mission.").setColor("Red")] });
            }

            currentNpc = generateNpc();

            const embed = new EmbedBuilder()
                .setTitle("⚔ **A-Rank Battle Begins!**")
                .setDescription(`You are now facing **${currentNpc.name}**!\nGet ready for battle!`)
                .addFields(
                    { name: "❤️ Enemy Health", value: `${currentNpc.currentHealth}`, inline: true },
                    { name: "🔥 Enemy Power", value: `${currentNpc.power}`, inline: true },
                    { name: "🛡 Enemy Defense", value: `${currentNpc.defense}`, inline: true }
                )
                .setThumbnail(currentNpc.image)
                .setImage(userPfp)
                .setColor("Red");

            await interaction.followUp({ embeds: [embed], components: [createAttackButton()] });
        };

        // Function to process an attack
        const attackNpc = async (i) => {
            if (!currentNpc) return;

            let attackMissed = Math.random() < 0.05;
            if (attackMissed) {
                return i.update({
                    embeds: [new EmbedBuilder().setTitle("⚠️ **Missed Attack!**").setDescription(`Your attack **missed** against **${currentNpc.name}**! Stay focused!`).setColor("Yellow")],
                    components: [createAttackButton()]
                });
            }

            let playerDamage = Math.max(5, player.power - currentNpc.defense);
            currentNpc.currentHealth -= playerDamage;

            if (currentNpc.currentHealth <= 0) {
                enemiesDefeated++;
                let expReward = 500 + Math.floor(player.level * 50);
                totalExp += expReward;
                player.exp += expReward;

                let moneyReward = 0;
                if (enemiesDefeated % 5 === 0) {
                    moneyReward = 2500 + Math.floor(player.level * 150);
                    totalMoney += moneyReward;
                }

                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                const embed = new EmbedBuilder()
                    .setTitle("💥 **Enemy Defeated!**")
                    .setDescription(`You have **defeated** **${currentNpc.name}**!`)
                    .addFields(
                        { name: "🏅 EXP Earned", value: `${expReward}`, inline: true },
                        { name: "💰 Total Money Earned", value: `${totalMoney} Ryo`, inline: true }
                    )
                    .setThumbnail(currentNpc.image)
                    .setImage(userPfp)
                    .setColor("Gold");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`continue-${interaction.id}`)
                        .setLabel('➡️ Continue')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`stop-${interaction.id}`)
                        .setLabel('⏹ Stop')
                        .setStyle(ButtonStyle.Danger)
                );

                return i.update({ embeds: [embed], components: [row] });
            } else {
                let npcDamage = Math.max(5, currentNpc.power - player.defense);
                player.health -= npcDamage;

                if (player.health <= 0) {
                    return i.update({
                        embeds: [new EmbedBuilder().setTitle("💀 **Defeat!**").setDescription(`You were defeated by **${currentNpc.name}**!\n**Mission failed.**`).setColor("DarkRed")],
                        components: []
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle("⚔ **Battle Continues!**")
                    .setDescription(`**You attacked ${currentNpc.name}!**`)
                    .addFields(
                        { name: "💥 Damage Dealt", value: `${playerDamage}`, inline: true },
                        { name: "❤️ Enemy Health Left", value: `${currentNpc.currentHealth}`, inline: true },
                        { name: "🔥 Enemy Counterattack!", value: `You took **${npcDamage}** damage.`, inline: false }
                    )
                    .setThumbnail(currentNpc.image)
                    .setImage(userPfp)
                    .setColor("Red");

                await i.update({ embeds: [embed], components: [createAttackButton()] });
            }
        };

        // Start first fight
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔥 **A-Rank Mission Started!**").setDescription("Prepare yourself for an intense battle!").setColor("Blue")] });
        await startFight();

        // Button interactions
        const collector = interaction.channel.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: "This isn't your fight!", ephemeral: true });

            if (i.customId === `attack-${interaction.id}`) {
                await attackNpc(i);
            } else if (i.customId === `continue-${interaction.id}`) {
                await i.deferUpdate();
                await startFight();
            } else if (i.customId === `stop-${interaction.id}`) {
                collector.stop();
                player.money += totalMoney;
                fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

                return i.update({
                    embeds: [new EmbedBuilder().setTitle("🏆 **Mission Completed!**").setDescription(`You defeated **${enemiesDefeated} enemies**!`).addFields(
                        { name: "🏅 Total EXP", value: `${totalExp}`, inline: true },
                        { name: "💰 Total Money", value: `${totalMoney} Ryo`, inline: true }
                    ).setThumbnail(currentNpc.image).setImage(userPfp).setColor("Green")],
                    components: []
                });
            }
        });
    }
};
