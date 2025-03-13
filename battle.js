const fs = require('fs');
const dataPath = './data/users.json';

function battleNPC(interaction, users, userId) {
    const npc = { name: 'Academy Ninja', health: 500, power: 50, defense: 20 };
    let player = users[userId];

    while (player.health > 0 && npc.health > 0) {
        npc.health -= Math.max(0, player.power - npc.defense);
        if (npc.health <= 0) break;

        player.health -= Math.max(0, npc.power - player.defense);
    }

    if (player.health > 0) {
        users[userId].wins += 1;
        interaction.followUp(`You defeated the ${npc.name}! Welcome to the ninja world.`);
    } else {
        users[userId].losses += 1;
        interaction.followUp(`You lost to the ${npc.name}, but you're still enrolled!`);
    }

    users[userId].health = 1000; // Restore health
    fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
}

module.exports = { battleNPC };
