const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/users.json'); // Path to user data

// Mentor Jutsu details with clan-specific requirements
const mentorJutsu = {
    Genin: {
        "Naruto": ["Shadow Clone Jutsu", "Sexy Jutsu"],
        "Sasuke": ["Fireball Jutsu"],
        "Sakura": ["Mystic Palms"],
        "Ino Yamanaka": ["Sensory"],
        "Shikamaru": ["Analysis"],
        "Choji Akamichi": ["Human Boulder (Akamichi Clan Only)"],
        "Rock Lee": ["Leaf Whirlwind"],
        "Tenten": ["Kunai Grenade"],
        "Neji Hyuga": ["Palm Rotation (Hyuga Clan Only)"],
        "Kiba Inuzuka": ["Smoke Bomb", "Ally Dog (Inuzuka Clan Only)"],
        "Hinata Hyuga": ["Parry"],
        "Shino Aburame": ["Chakra Parasite (Aburame Clan Only)"],
        "Kankuro": ["Poison Smoke"],
        "Temari": ["Wind Wall"],
        "Gaara": ["Sand Armor"],
        "Kakashi": ["Summon Ninken"],
        "Guy": ["Dynamic Entry"],
        "Mitsuki": ["Striking Shadow Snakes"],
        "Sarada": ["Lightning Burial: Banquet of Lightning"],
        "Boruto": ["Super High Compression Rasengan"]
    },
    Chuunin: {
        "Choji Akamichi": ["Akimichi Pills"],
        "Sakura": ["Cherry Blossom Impact"],
        "Tenten": ["Twin Rising Dragons"],
        "Gaara": ["Sand Coffin"],
        "Ino Yamanaka": ["Mind Transfer (Yamanaka Clan Only)"],
        "Shikamaru Nara": ["Shadow Possession (Nara Clan Only)"],
        "Shino Aburame": ["Insect Jamming (Aburame Clan Only)"],
        "Kankuro": ["Puppet Crow"],
        "Temari": ["Wind Scythe"],
        "Neji Hyuga": ["Sixty Four Palms (Hyuga Clan Only)"],
        "Kiba Inuzuka": ["Man Beast Clone (Inuzuka Clan Only)"],
        "Asuma": ["Chakra Infused Blades"]
    },
    Jounin: {
        "Sasuke Uchiha": ["Kirin", "Ephemeral"],
        "Jiraiya": ["Rasengan"],
        "Kakashi": ["Lightning Blade"],
        "Hinata Hyuga": ["Twin Lion Fist (Hyuga Clan Only)"],
        "Rock Lee": ["Primary Lotus"],
        "Kurenai": ["Demonic Illusion", "Nirvana Temple"],
        "Asuma": ["Burning Ash"],
        "Hashirama Senju": ["Wood Dragon Jutsu (Senju Clan Only)", "Wood Clone Jutsu (Senju Clan Only)", "Rashomon (Senju Clan Only)"],
        "Naruto Uzumaki": ["Adamantine Sealing Chains (Uzumaki Clan Only)"],
        "Shikamaru Nara": ["Shadow Strangle (Nara Clan Only)"],
        "Ino Yamanaka": ["Mind Destruction (Yamanaka Clan Only)"],
        "Guy": ["Eight Gates"]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Track your mentor progress and learn new Jutsu from them.'),
        
    async execute(interaction) {
        const userId = interaction.user.id;

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
        }

        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        if (!users[userId]) {
            return interaction.reply({ content: "You need to enroll first. Use `/enroll` to start.", ephemeral: true });
        }

        let player = users[userId];

        // Retrieve Mentor data
        let mentorExp = player.mentorExp || 0; // Default to 0 if not set
        let mentorLevel = player.mentorLevel || 0; // Default to level 0 if not set
        let playerClan = player.clan || ""; // Player's clan (bloodline)

        // Determine what Jutsu the player can learn
        let learnableJutsu = {
            genin: [],
            chuunin: [],
            jounin: []
        };
        let jutsuRequiredExp = 10 + (mentorLevel * 10); // Jutsu exp required grows as the player levels up in mentor

        if (mentorExp >= jutsuRequiredExp) {
            // Helper function to check if the player is in the required clan
            const checkClan = (clan) => playerClan === clan;

            // Add Genin Jutsu
            for (let mentor in mentorJutsu.Genin) {
                mentorJutsu.Genin[mentor].forEach(jutsu => {
                    if (jutsu.includes("Clan") && !checkClan(jutsu.split(" ")[jutsu.split(" ").length - 2])) {
                        return; // Skip if the player doesn't have the right clan
                    }
                    learnableJutsu.genin.push(`${mentor}: ${jutsu}`);
                });
            }

            // Add Chuunin Jutsu
            for (let mentor in mentorJutsu.Chuunin) {
                mentorJutsu.Chuunin[mentor].forEach(jutsu => {
                    if (jutsu.includes("Clan") && !checkClan(jutsu.split(" ")[jutsu.split(" ").length - 2])) {
                        return; // Skip if the player doesn't have the right clan
                    }
                    learnableJutsu.chuunin.push(`${mentor}: ${jutsu}`);
                });
            }

            // Add Jounin Jutsu
            for (let mentor in mentorJutsu.Jounin) {
                mentorJutsu.Jounin[mentor].forEach(jutsu => {
                    if (jutsu.includes("Clan") && !checkClan(jutsu.split(" ")[jutsu.split(" ").length - 2])) {
                        return; // Skip if the player doesn't have the right clan
                    }
                    learnableJutsu.jounin.push(`${mentor}: ${jutsu}`);
                });
            }
        }

        // Prepare the response message
        let progressMessage = `
        **Mentor Progress:**
        Mentor EXP: ${mentorExp}
        Mentor Level: ${mentorLevel}
        Jutsu you can learn based on your progress:
        
        **Genin Jutsu** (10 Mentor EXP required):
        ${learnableJutsu.genin.length ? learnableJutsu.genin.join('\n') : "None"}

        **Chuunin Jutsu** (30 Mentor EXP required):
        ${learnableJutsu.chuunin.length ? learnableJutsu.chuunin.join('\n') : "None"}
        
        **Jounin Jutsu** (50 Mentor EXP required):
        ${learnableJutsu.jounin.length ? learnableJutsu.jounin.join('\n') : "None"}
        `;

        return interaction.reply({ content: progressMessage, ephemeral: true });
    }
};
