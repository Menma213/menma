const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View the shinobi guide and command list'),

    async execute(interaction) {
        const categories = [
            {
                label: 'Getting Started',
                value: 'start',
                description: 'How to begin your journey',
                title: 'New Player Guide',
                content: 'Welcome to the Shinobi RPG. First thing you need to do is use the enroll command and defeat the bandit. After that, run the tutorial command. Asuma will guide you through the basics of fight mechanics and scrolls. If you skip the tutorial, you are going to have a hard time understanding how to actually get stronger.\n\nRelevant commands: /enroll, /tutorial'
            },
            {
                label: 'Combat and Jutsus',
                value: 'combat',
                description: 'Battle mechanics and jutsu management',
                title: 'Combat System',
                content: 'Battles are turn-based. You can have up to 5 jutsus equipped at once. Every jutsu costs chakra, so keep an eye on your chakra amount. Some jutsus apply status effects like stun, bleed, or burn. If you get stunned, you lose a turn. Burning or bleeding takes health every round.\n\nRelevant commands: /equip, /myjutsu'
            },
            {
                label: 'Progression',
                value: 'progression',
                description: 'Leveling and ranking up',
                title: 'Ninja Progression',
                content: 'To get stronger, you need exp from missions. Once you have enough, use the levelup command. Higher ranks unlock better missions and shops.\n\nRelevant commands: /levelup, /rankup, /profile'
            },
            {
                label: 'Missions and Tasks',
                value: 'missions',
                description: 'Mission ranks and rewards',
                title: 'Mission Board',
                content: 'Missions are your main source of income and exp.\n\nF-Rank: Good for beginners, very low cooldown, good for early grinding.\nD-Rank: Basic no interaction missions.\nB-Rank: Basic fighting missions.\nA-Rank: medium level challenges in sets of 50 battles.\nS-Rank: [STORY MODE] Boss fights against iconic characters like Orochimaru or Zabuza. Very high difficulty but best drops.\n\nRelevant commands: /frank, /drank, /brank, /arank, /srank'
            },
            {
                label: 'Bloodlines and Clans',
                value: 'clans',
                description: 'Special abilities and social systems',
                title: 'Bloodlines and Clans',
                content: 'Bloodlines are your clan related powers. You get a passive effect and a ultimate effect which only activates once the requirements are met. You can choose one using the bloodline command if you have enough Ryo.\n\nClans allow you to group up with other players. You can capture territories on the map to gain buffs for your whole clan.\n\nRelevant commands: /bloodline, /clan, /map'
            },
            {
                label: 'Economy and Shop',
                value: 'economy',
                description: 'Currency, trading, and items',
                title: 'Shinobi Economy',
                content: 'Ryo is the standard currency used for most things like buying stuff from the shop. Shinobi Shards are the premium currency of the bot which can be used in the ss shop. You can trade with other players using the trade command. You can trade ss for money and vice versa. Theres a secret server event that randomly happens that lets you buy ss for in game money.\n\nRelevant commands: /shop, /buy, /trade, /gift, /rob'
            },
            {
                label: 'Organizations',
                value: 'orgs',
                description: 'ANBU, Akatsuki, and Mentors',
                title: 'Special Groups',
                content: 'Once you reach high enough levels, you can join groups like the ANBU or the Akatsuki. These give you access to exclusive jutsus and special shops that normal ninja can\'t access. You can also train under mentors to learn their specific techniques.\n\nRelevant commands: /anbu, /akatsuki, /mentors'
            }
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Select a category to learn more')
            .addOptions(categories.map(cat => ({
                label: cat.label,
                value: cat.value,
                description: cat.description
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_help')
                .setLabel('Close')
                .setStyle(ButtonStyle.Danger)
        );

        const initialEmbed = new EmbedBuilder()
            .setTitle('Shinobi RPG Guide')
            .setDescription('Welcome to the official guide. Use the menu below to navigate through different sections of the game. This guide covers everything from your first steps to high-level organization warfare.')
            .setColor('#2b2d31');

        const response = await interaction.reply({
            embeds: [initialEmbed],
            components: [row, closeRow],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.SelectMenu,
            time: 300000
        });

        const buttonCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            const selected = categories.find(cat => cat.value === i.values[0]);
            const newEmbed = new EmbedBuilder()
                .setTitle(selected.title)
                .setDescription(selected.content)
                .setColor('#2b2d31')
                .setFooter({ text: 'Use the menu to switch categories' });

            await i.update({ embeds: [newEmbed] });
        });

        buttonCollector.on('collect', async i => {
            if (i.customId === 'close_help') {
                await i.update({ content: 'Guide closed.', embeds: [], components: [] });
                collector.stop();
                buttonCollector.stop();
            }
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({ components: [] });
            } catch (e) { }
        });
    }
};