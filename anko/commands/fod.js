const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Owner ID (replace with your owner ID)
const OWNER_ID = '835408109899219004';

// Forest of Death settings
const MIN_PARTICIPANTS = 3; // Editable minimum participants
const WAIT_TIME = 320000; // 5 minutes in milliseconds

// Paths
const deathsPath = path.resolve(__dirname, '../../data/deaths.json');
const usersPath = path.resolve(__dirname, '../../data/users.json');

// Naruto attacks for the battle
const NARUTO_ATTACKS = [
  'Rasengan',
  'Shadow Clone Jutsu',
  'Chidori',
  'Fireball Jutsu',
  'Summoning Jutsu',
  'Eight Gates',
  'Amaterasu',
  'Susanoo',
];

module.exports = {
  name: 'fod', // Command name
  description: 'Start the Forest of Death!', // Command description
  async execute(message, args) {
    // Check if the user is the owner
    if (message.author.id !== OWNER_ID) {
      return message.reply('Only the bot owner can start the Forest of Death.');
    }

    // Unlock the channel
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: true,
    });

    // Ping everyone and send the starting embed

    await message.channel.send('<@&1351949389056180226>');

    const startEmbed = new EmbedBuilder()
      .setTitle('Forest of Death')
      .setDescription('Would you like to join the Forest of Death?')
      .setColor('#006400') // Dark green color
      .setImage('https://images-ext-1.discordapp.net/external/EHutcWmx0NJT1_xBXJ9rb9v72deI6tS4yeacm_U_xiU/https/pa1.narvii.com/6534/629af99050803dd5f64b124ddb572e3f0cc0d6b2_hq.gif?width=400&height=222'); // Replace with your image URL

    await message.channel.send({ embeds: [startEmbed] });

    // Collect participants
    const participants = new Set();
    const filter = (msg) => !msg.author.bot; // Allow only non-bot messages

    const collector = message.channel.createMessageCollector({ filter, time: WAIT_TIME });

    collector.on('collect', (msg) => {
      // Check if the user has already joined
      if (!participants.has(msg.author.id)) {
        participants.add(msg.author.id);
        message.channel.send(`${msg.author.username} has joined the Forest of Death!`);
      }
    });

    // Start the Forest of Death after the wait time
    setTimeout(async () => {
      collector.stop();

      // Check if enough participants joined
      if (participants.size < MIN_PARTICIPANTS) {
        return message.channel.send(`Not enough participants to start the Forest of Death. Need at least ${MIN_PARTICIPANTS}.`);
      }

      // Lock the channel
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false,
      });

      // Start the Forest of Death
      const deaths = JSON.parse(fs.readFileSync(deathsPath, 'utf8'));
      let remainingParticipants = Array.from(participants);

      while (remainingParticipants.length > 2) {
        // Randomly select a participant to die
        const deadIndex = Math.floor(Math.random() * remainingParticipants.length);
        const deadUserId = remainingParticipants[deadIndex];
        const deadUser = await message.client.users.fetch(deadUserId);

        // Randomly select a death type
        const deathType = deaths[Math.floor(Math.random() * deaths.length)].deathtype;

        // Send the death message
        const deathEmbed = new EmbedBuilder()
          .setTitle('Forest of Death')
          .setDescription(`${deadUser.username} was ${deathType}!`)
          .setColor('#006400'); // Dark green color

        await message.channel.send({ embeds: [deathEmbed] });

        // Remove the dead participant
        remainingParticipants.splice(deadIndex, 1);
      }

      // Start the RNG-based battle
      const [player1Id, player2Id] = remainingParticipants;
      const player1 = await message.client.users.fetch(player1Id);
      const player2 = await message.client.users.fetch(player2Id);

      let player1HP = 5;
      let player2HP = 5;

      const battleEmbed = new EmbedBuilder()
        .setTitle(`${player1.username} vs ${player2.username}`)
        .setDescription('The final battle begins!')
        .setColor('#006400') // Dark green color
        .setImage('https://images-ext-1.discordapp.net/external/O2_yNRJUKZwqlX3cERTRVZi1EWFj0wMbtds27qzzSPU/https/c.tenor.com/uQA1kJfi9NIAAAAM/sasuke-orochimaru.gif'); // Replace with your image URL

      await message.channel.send({ embeds: [battleEmbed] });

      // Battle loop
      while (player1HP > 0 && player2HP > 0) {
        // Player 1 attacks
        const player1Attack = NARUTO_ATTACKS[Math.floor(Math.random() * NARUTO_ATTACKS.length)];
        const player1Damage = Math.floor(Math.random() * 3); // Random damage between 0 and 2

        // Apply damage to Player 2
        player2HP -= player1Damage;

        // Send the attack update
        const player1AttackEmbed = new EmbedBuilder()
          .setTitle('Battle Update')
          .setDescription(
            `${player1.username} used **${player1Attack}** and dealt **${player1Damage} damage**!\n\n` +
            `${player1.username}: ${player1HP} HP\n` +
            `${player2.username}: ${player2HP} HP`
          )
          .setColor('#006400'); // Dark green color

        await message.channel.send({ embeds: [player1AttackEmbed] });

        // Check if Player 2 is defeated
        if (player2HP <= 0) break;

        // Wait 2 seconds before the next attack
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Player 2 attacks
        const player2Attack = NARUTO_ATTACKS[Math.floor(Math.random() * NARUTO_ATTACKS.length)];
        const player2Damage = Math.floor(Math.random() * 3); // Random damage between 0 and 2

        // Apply damage to Player 1
        player1HP -= player2Damage;

        // Send the attack update
        const player2AttackEmbed = new EmbedBuilder()
          .setTitle('Battle Update')
          .setDescription(
            `${player2.username} used **${player2Attack}** and dealt **${player2Damage} damage**!\n\n` +
            `${player1.username}: ${player1HP} HP\n` +
            `${player2.username}: ${player2HP} HP`
          )
          .setColor('#006400'); // Dark green color

        await message.channel.send({ embeds: [player2AttackEmbed] });

        // Wait 2 seconds before the next attack
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Determine the winner
      const winner = player1HP > 0 ? player1 : player2;
      const loser = player1HP > 0 ? player2 : player1;

      // Send the winner announcement
      const winnerEmbed = new EmbedBuilder()
        .setTitle('Forest of Death Winner!')
        .setDescription(`${winner.username} has won the Forest of Death and earned **50 Ramen Coupons** and **5000 Money**!`)
        .setColor('#006400'); // Dark green color

      await message.channel.send({ embeds: [winnerEmbed] });

      // Update the winner's profile
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      users[winner.id].ramen = (users[winner.id].ramen || 0) + 50;
      users[winner.id].money = (users[winner.id].money || 0) + 5000;
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    }, WAIT_TIME); // Wait time before starting
  },

};

