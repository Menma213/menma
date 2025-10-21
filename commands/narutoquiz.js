const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const questions = [
    {
        question: "What is the name of Naruto Uzumaki's signature jutsu?",
        options: ["Rasengan", "Chidori", "Shadow Clone Jutsu", "Water Style: Water Dragon Jutsu"],
        correctAnswer: "Rasengan"
    },
    {
        question: "Who is Naruto's primary rival and best friend?",
        options: ["Sakura Haruno", "Sasuke Uchiha", "Kakashi Hatake", "Shikamaru Nara"],
        correctAnswer: "Sasuke Uchiha"
    },
    {
        question: "What is the name of the Tailed Beast sealed within Naruto?",
        options: ["Shukaku", "Matatabi", "Kurama", "Son Goku"],
        correctAnswer: "Kurama"
    },
    {
        question: "What is the Hidden Leaf Village's symbol called?",
        options: ["Shuriken", "Kunai", "Konoha", "Chakra"],
        correctAnswer: "Konoha"
    },
    {
        question: "Who is Naruto's sensei and leader of Team 7?",
        options: ["Jiraiya", "Tsunade", "Orochimaru", "Kakashi Hatake"],
        correctAnswer: "Kakashi Hatake"
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('narutoquiz')
        .setDescription('A singleplayer quiz with 5 questions and a point system.'),

    async execute(interaction) {
        let score = 0;
        let currentQuestionIndex = 0;

        const getQuestionEmbed = () => {
            const questionData = questions[currentQuestionIndex];
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`Naruto Quiz - Question ${currentQuestionIndex + 1}`)
                .setDescription(questionData.question);

            const row = new ActionRowBuilder();
            questionData.options.forEach(option => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(option)
                        .setLabel(option)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            return { embed, row };
        };

        const initialEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Naruto Quiz')
            .setDescription('Get ready for the quiz! Click a button to answer the questions.');

        await interaction.reply({ embeds: [initialEmbed], components: [] });

        const { embed: firstQuestionEmbed, row: firstQuestionRow } = getQuestionEmbed();
        const message = await interaction.editReply({ embeds: [firstQuestionEmbed], components: [firstQuestionRow] });

        const collector = message.createMessageComponentCollector({ time: 60000 }); // 60 seconds time limit

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: "This is not your quiz!", ephemeral: true });
                return;
            }

            const userAnswer = i.customId;
            const correctAnswer = questions[currentQuestionIndex].correctAnswer;

            if (userAnswer === correctAnswer) {
                score++;
                await i.update({ content: `Correct! Your score is now ${score}.`, embeds: [], components: [] });
            } else {
                await i.update({ content: `Incorrect! The correct answer was "${correctAnswer}". Your score is still ${score}.`, embeds: [], components: [] });
            }

            currentQuestionIndex++;

            if (currentQuestionIndex < questions.length) {
                const { embed: nextQuestionEmbed, row: nextQuestionRow } = getQuestionEmbed();
                await interaction.editReply({ embeds: [nextQuestionEmbed], components: [nextQuestionRow] });
            } else {
                collector.stop();
                const finalEmbed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('Quiz Finished!')
                    .setDescription(`You have completed the Naruto Quiz!\nYour final score is: ${score}/${questions.length}`);
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            if (currentQuestionIndex < questions.length) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Quiz Timed Out')
                    .setDescription(`You ran out of time! Your final score is: ${score}/${questions.length}`);
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(err => console.error("Error sending timeout embed:", err));
            }
        });
    }
};