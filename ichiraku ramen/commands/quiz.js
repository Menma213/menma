const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Owner IDs (replace with your owner IDs)
const OWNER_IDS = ['835408109899219004', '961918563382362122'];

// Quiz data
const quizPath = path.resolve(__dirname, '../../data/quiz.json');
const quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));

// Temporary leaderboard
let leaderboard = new Map();

module.exports = {
  name: 'quiz', // Command name
  description: 'Start a Ramen Quiz!', // Command description
  async execute(message, args) {
    // Check if the user is an owner
    if (!OWNER_IDS.includes(message.author.id)) {
      return message.reply('Only the bot owner can start the quiz.');
    }

    // Create the quiz embed
    const quizEmbed = new EmbedBuilder()
      .setTitle('Ramen Quiz! 🍜')
      .setDescription('Click the button below to join the quiz!')
      .setImage('https://media.proprofs.com/images/QM/user_images/2169923/1519695752.jpg')
      .setColor('#006400'); // Dark green color

    // Create the "Join Quiz" button
    const joinButton = new ButtonBuilder()
      .setCustomId('join_quiz')
      .setLabel('Join Quiz')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinButton);

    // Send the quiz embed with the button
    const quizMessage = await message.channel.send({ embeds: [quizEmbed], components: [row] });
    await message.channel.send("<@&1351949389056180226> Quiz will start in 1 minute! Join now!");

    // Collect participants
    const participants = new Set();

    // Button interaction collector for joining the quiz
    const joinFilter = (interaction) => interaction.customId === 'join_quiz';
    const joinCollector = quizMessage.createMessageComponentCollector({ filter: joinFilter, time: 60000 });

    joinCollector.on('collect', async (interaction) => {
      // Check if the user is enrolled
      const usersPath = path.resolve(__dirname, '../../data/users.json');
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      if (!users[interaction.user.id]) {
        await interaction.reply({ content: 'Please enroll before joining the quiz.', ephemeral: false });
        return;
      }

      // Add the user to the participants list
      participants.add(interaction.user.id);

      // Send a message confirming participation
      const participantList = Array.from(participants).map(id => `<@${id}>`).join(', ');
      await interaction.reply({ content: `You have joined the quiz! Current participants: ${participantList}`, ephemeral: false });
    });

    // Countdown warnings
    const countdownTimes = [45000, 30000, 15000, 0];
    countdownTimes.forEach((time) => {
      setTimeout(async () => {
        if (time === 0) {
          await message.channel.send('**Quiz STARTED!**');
        } else {
          await message.channel.send(`Quiz starts in **${time / 1000} seconds**!`);
        }
      }, 60000 - time);
    });

    // Start the quiz after 1 minute
    setTimeout(async () => {
      joinCollector.stop();

      // Check if at least 1 participant joined
      if (participants.size < 1) {
        return message.channel.send('Not enough participants to start the quiz.');
      }

      // Ask questions for each participant
      for (let round = 1; round <= 5; round++) {
        await message.channel.send(`**Round ${round}**`);

        for (const userId of participants) {
          // Get a random question
          const questionData = quizData[Math.floor(Math.random() * quizData.length)];

          // Create the question embed
          const questionEmbed = new EmbedBuilder()
            .setTitle(`Question for <@${userId}>`)
            .setDescription(questionData.question || 'No question available')
            .setImage(questionData.image_url || null)
            .setColor('#006400');

          // Create buttons for options
          const optionButtons = questionData.options.map((option, index) =>
            new ButtonBuilder()
              .setCustomId(`option_${index}`)
              .setLabel(option)
              .setStyle(ButtonStyle.Secondary)
          );

          const row = new ActionRowBuilder().addComponents(optionButtons);

          // Send the question embed with buttons (ephemeral)
          const questionMessage = await message.channel.send({
            content: `<@${userId}>`,
            embeds: [questionEmbed],
            components: [row],
          });

          // Collect the answer
          const answerFilter = (interaction) => interaction.user.id === userId && interaction.customId.startsWith('option_');
          const answerCollector = questionMessage.createMessageComponentCollector({ filter: answerFilter, time: 30000 });

          // Wait for the user to answer
          const answer = await new Promise((resolve) => {
            answerCollector.on('collect', async (interaction) => {
              // Get the selected option index
              const selectedOptionIndex = parseInt(interaction.customId.split('_')[1]);

              // Check if the answer is correct
              const correctAnswerIndex = questionData.options.indexOf(questionData.answer);
              if (selectedOptionIndex === correctAnswerIndex) {
                leaderboard.set(userId, (leaderboard.get(userId) || 0) + 1);
                await interaction.reply({ content: 'Correct! 🎉', ephemeral: false });
              } else {
                await interaction.reply({ content: `Wrong! The correct answer is **${questionData.answer}**.`, ephemeral: true });
              }

              // Stop the collector after the user answers
              answerCollector.stop();
              resolve(selectedOptionIndex);
            });

            // Handle timeout
            answerCollector.on('end', async () => {
              await questionMessage.edit({ components: [] }); // Disable buttons after timeout
              resolve(null); // No answer
            });
          });

          // If the user didn't answer, notify them
          if (answer === null) {
            await message.channel.send(`<@${userId}>, time's up! The correct answer was **${questionData.answer}**.`);
          }
        }

        // Display leaderboard after each round
        const sortedLeaderboard = Array.from(leaderboard.entries()).sort((a, b) => b[1] - a[1]);

        let leaderboardText = '';
        sortedLeaderboard.forEach(([userId, points], index) => {
          leaderboardText += `\`${index + 1}.\` <@${userId}> | \`${points} points\`\n`;
        });

        // Ensure leaderboard text is not empty
        if (!leaderboardText) leaderboardText = 'No participants yet.';

        const leaderboardEmbed = new EmbedBuilder()
          .setTitle('Leaderboard')
          .setDescription(leaderboardText)
          .setColor('#006400');

        await message.channel.send({ embeds: [leaderboardEmbed] });
      }

      // Declare the winner
      const sortedWinnerLeaderboard = Array.from(leaderboard.entries()).sort((a, b) => b[1] - a[1]);
      const winnerId = sortedWinnerLeaderboard[0][0];

      // Add 50 Ramen Coupons to the winner
      const usersPath = path.resolve(__dirname, '../../data/users.json');
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      users[winnerId].ramen = (users[winnerId].ramen || 0) + 50;
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

      // Create the winner embed
      const winnerEmbed = new EmbedBuilder()
        .setTitle('Quiz Winner!')
        .setDescription(`<@${winnerId}> has won the quiz and earned **50 Ramen Coupons**! 🎉`)
        .setColor('#006400');

      await message.channel.send({ embeds: [winnerEmbed] });

      // Reset the leaderboard
      leaderboard.clear();
    }, 60000); // 1 minute delay
  },
};
