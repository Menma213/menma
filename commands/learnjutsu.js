const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const jutsusPath = path.join(dataPath, 'jutsu.json');

const loadData = path => {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (err) {
        console.error(`Error loading ${path}:`, err);
        return {};
    }
};
const saveData = (path, data) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${path}:`, err);
    }
};

const SCROLL_JUTSU_INFO = {
    "Needle Assault Scroll": {
        jutsu: "Needle Assault",
        shards: 2
    },
    "Silent Assassination Scroll": {
        jutsu: "Silent Assassination",
        shards: 2
    },
    "Serpents Wrath Scroll": {
        jutsu: "Serpents Wrath",
        shards: 2
    },
    "Infused Chakra Blade Scroll": {
        jutsu: "Infused Chakra Blade",
        shards: 1
    },
    "Amaterasu": {
        jutsu: "Amaterasu",
        shards: 6
    },
    "Lightning Blade: All Out": {
        jutsu: "Lightning Blade: All Out",
        shards: 10
    },
    "9th form: Rengoku": {
        jutsu: "9th form: Rengoku",
        shards: 15
    },
    "Summon Manda": {
        jutsu: "Summon Manda",
        shards: 10
    },
    "Kamehameha Scroll": {
        jutsu: "Kamehameha",
        shards: 50
    },
    "Asura's Blade of Execution": {
        jutsu: "Asura's Blade of Execution",
        shards: 50 // A very high cost for this ultimate jutsu
    },
    "Tenseigan Scroll": {
        jutsu: "Tenseigan Chakra Mode",
        shards: 20
    },
    "Chakra Tool Creation Scroll": {
        jutsu: "Chakra tool creation",
        shards: 50
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('learnjutsu')
        .setDescription('Attempt to learn jutsu from your current scroll'),

    async execute(interaction) {
        const users = loadData(usersPath);
        const jutsuData = loadData(jutsusPath);
        const userId = interaction.user.id;
        const user = users[userId];

        if (!user) {
            return interaction.reply({ content: "You need to be a ninja first!", ephemeral: true });
        }

        const currentScroll = user.current_scroll;
        if (!currentScroll) {
            return interaction.reply({ content: "You don't have an active scroll set!", ephemeral: true });
        }

        const jutsuInfo = SCROLL_JUTSU_INFO[currentScroll];
        if (!jutsuInfo) {
            return interaction.reply({
                content: "Error: This scroll is not configured for a jutsu.",
                ephemeral: true
            });
        }

        const requiredShards = jutsuInfo.shards;
        const userShards = jutsuData[userId]?.items?.['Crystalline Shard'] || 0;
        const jutsuName = jutsuInfo.jutsu;

        // Check if the user already knows the jutsu
        if (jutsuData[userId]?.usersjutsu?.includes(jutsuName)) {
            return interaction.reply({
                content: `You already know the **${jutsuName}** jutsu!`,
                ephemeral: true
            });
        }

        // Check for sufficient shards
        if (userShards < requiredShards) {
            return interaction.reply({
                content: `You need **${requiredShards} Crystalline Shards** to learn **${jutsuName}**, but you only have **${userShards}**.`,
                ephemeral: true
            });
        }

        // Deduct shards and learn the jutsu
        jutsuData[userId].items['Crystalline Shard'] -= requiredShards;

        // Add the jutsu to the user's learned jutsus
        if (!jutsuData[userId].usersjutsu) {
            jutsuData[userId].usersjutsu = [];
        }
        jutsuData[userId].usersjutsu.push(jutsuName);

        // Remove the scroll from the user's inventory and reset their current scroll
        const userScrolls = jutsuData[userId].scrolls || [];
        jutsuData[userId].scrolls = userScrolls.filter(s => s !== currentScroll);
        user.current_scroll = null;

        saveData(jutsusPath, jutsuData);
        saveData(usersPath, users);

        const embed = new EmbedBuilder()
            .setColor('#4BB543')
            .setTitle(' Jutsu Learned!')
            .setDescription(`You successfully learned **${jutsuName}**!`)
            .addFields(
                { name: 'Shards Used', value: `${requiredShards}`, inline: true },
                { name: 'Remaining Shards', value: `${jutsuData[userId].items['Crystalline Shard']}`, inline: true }
            );

        return interaction.reply({ embeds: [embed] });
    }
};