const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Sample anime questions and answers
const questions = [
    {
        question: "Who is the main protagonist of 'Attack on Titan'?",
        options: ["Levi Ackerman", "Eren Yeager", "Mikasa Ackerman", "Armin Arlert"],
        answer: "Eren Yeager"
    },
    {
        question: "What is the name of the ninja village where Naruto Uzumaki is from?",
        options: ["Sand Village", "Mist Village", "Leaf Village", "Cloud Village"],
        answer: "Leaf Village"
    },
    {
        question: "In 'My Hero Academia', what is Izuku Midoriya's hero name?",
        options: ["Dynamight", "Eraserhead", "Uravity", "Deku"],
        answer: "Deku"
    },
    {
        question: "What is the name of the powerful demon in 'Demon Slayer: Kimetsu no Yaiba' that Tanjiro encounters first?",
        options: ["Muzan Kibutsuji", "Rui", "Kyojuro Rengoku", "Akaza"],
        answer: "Rui"
    },
    {
        question: "What anime features a high school student who can communicate with cats?",
        options: ["Komi Can't Communicate", "Fruits Basket", "Natsume's Book of Friends", "Ouran High School Host Club"],
        answer: "Natsume's Book of Friends"
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('animequiz')
        .setDescription('a quiz about anime'),

    async execute(interaction) {
        const randomIndex = Math.floor(Math.random() * questions.length);
        const currentQuestion = questions[randomIndex];

        const buttons = currentQuestion.options.map((option, index) => {
            return new ButtonBuilder()
                .setCustomId(`quiz_answer_${index}`)
                .setLabel(option)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Anime Quiz!')
            .setDescription(`**${currentQuestion.question}**`)
            .addFields(
                { name: '\u200B', value: 'Choose your answer below.' }
            )
            .setFooter({ text: 'You have 60 seconds to answer!' });

        await interaction.reply({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId.startsWith('quiz_answer_')) {
                const selectedIndex = parseInt(i.customId.split('_')[2]);
                const selectedAnswer = currentQuestion.options[selectedIndex];

                if (selectedAnswer === currentQuestion.answer) {
                    await i.update({
                        content: 'Correct! You got it right!',
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x00FF00)
                                .setTitle('Anime Quiz - Result')
                                .setDescription(`**${currentQuestion.question}**\n\nYour answer: **${selectedAnswer}**\n\n**Correct!**`)
                        ],
                        components: []
                    });
                } else {
                    await i.update({
                        content: `Incorrect. The correct answer was **${currentQuestion.answer}**.`,
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Anime Quiz - Result')
                                .setDescription(`**${currentQuestion.question}**\n\nYour answer: **${selectedAnswer}**\n\n**Incorrect.** The correct answer was **${currentQuestion.answer}**.`)
                        ],
                        components: []
                    });
                }
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: 'Time\'s up! You didn\'t answer in time.',
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFFF00)
                            .setTitle('Anime Quiz - Time\'s Up')
                            .setDescription(`**${currentQuestion.question}**\n\nThe correct answer was **${currentQuestion.answer}**.`)
                    ],
                    components: []
                });
            }
        });
    },
};