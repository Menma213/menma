const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');


const PLACES = [
    { name: "Yamada Ramen Store", image: "https://i.redd.it/pbaic624o2121.jpg" },
    { name: "Ichiraku Ramen", image: "https://static.wikia.nocookie.net/eroninja/images/3/30/Ichiraku_Ramen_NintendoDS.png/revision/latest/thumbnail/width/360/height/450?cb=20180806221108" },
    { name: "Hokage Bites", image: "https://wallpaperbat.com/img/8610773-lofi-ramen-shop-wallpaper.jpg" },
    { name: "Naruto's Bento", image: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7ce6ebed-e5ab-45c3-974f-a43c8f3055f8/d99luql-58381a46-7449-4d01-8c4b-1031d80db80e.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzdjZTZlYmVkLWU1YWItNDVjMy05NzRmLWE0M2M4ZjMwNTVmOFwvZDk5bHVxbC01ODM4MWE0Ni03NDQ5LTRkMDEtOGM0Yi0xMDMxZDgwZGI4MGUuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.cdkzpg-H-PRUeFMRoxY0q5D_nzW5JhOszsIf2iYFAAU" }
];
const FAIL_MESSAGES = [
    "You went to the store but got caught!",
    "The shop was closed.",
    "You tripped the alarm and had to run!",
    "A ninja spotted you and you fled!"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Bruisers rob for ramen tickets (3h cooldown)'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users[userId];
        if (!user) return interaction.reply({ content: "You need to enroll first!", ephemeral: true });
        if (user.occupation !== "Akatsuki" || user.role !== "Bruiser") {
            return interaction.reply({ content: "Only Akatsuki Bruisers can use this command.", ephemeral: true });
        }

        const now = Date.now();
        if (user.lastrob && now - user.lastrob < 3 * 60 * 60 * 1000) {
            const left = 3 * 60 * 60 * 1000 - (now - user.lastrob);
            const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
            return interaction.reply({ content: `You can rob again in ${h}h ${m}m ${s}s.`, ephemeral: true });
        }
        user.lastrob = now;

        // Pick a place
        const row = new ActionRowBuilder().addComponents(
            PLACES.map((p, i) =>
                new ButtonBuilder()
                    .setCustomId(`rob_place_${i}`)
                    .setLabel(p.name)
                    .setStyle(1) // Use 1 for Primary (blue) style
            )
        );
        const embed = new EmbedBuilder()
            .setTitle("Select a place you want to rob")
            .setImage(PLACES[0].image)
            .setColor('#B71C1C');
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const filter = i => i.user.id === userId && i.customId.startsWith('rob_place_');
        const collected = await msg.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);
        if (!collected) return;

        const placeIdx = parseInt(collected.customId.split('_')[2]);
        const place = PLACES[placeIdx];
        await collected.deferUpdate();

        // 60% chance success
        if (Math.random() < 0.6) {
            // Load players.json and update ramen for this user
            const playersPath = path.resolve(__dirname, '../../menma/data/players.json');
            const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
            if (players[userId]) {
                // Ensure ramen is a number
                players[userId].ramen = (parseInt(players[userId].ramen) || 0) + 1; 
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
            }
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Success!`)
                        .setDescription(`You robbed **${place.name}** and got a ramen ticket! 🍜`)
                        .setImage(place.image)
                        .setColor('#43d675')
                ]
            });
        } else {
            const failMsg = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Failed!`)
                        .setDescription(failMsg)
                        .setImage(place.image)
                        .setColor('#B71C1C')
                ]
            });
        }
    }
};
