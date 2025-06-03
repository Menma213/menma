const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const villagePath = path.resolve(__dirname, '../../menma/data/village.json');
const akatsukiPath = path.resolve(__dirname, '../../menma/data/akatsuki.json');
const HOKAGE_ROLE_ID = '1349245807995387915';
const AKATSUKI_LEADER_ROLE_ID = '1371076470369288223';
const SANNIN_ROLE_ID = '1349245907467505755';
const COUNCIL_CHANNEL_ID = '1349314394311491588';
const AKATSUKI_COUNCIL_CHANNEL_ID = '1349314034079629362';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('council')
        .setDescription('View the council information'),
    async execute(interaction) {
        const isHokage = interaction.member.roles.cache.has(HOKAGE_ROLE_ID);
        const isAkatsukiLeader = interaction.member.roles.cache.has(AKATSUKI_LEADER_ROLE_ID);
        const isSannin = interaction.member.roles.cache.has(SANNIN_ROLE_ID);

        if (!isHokage && !isAkatsukiLeader && !isSannin) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }
        if (isHokage && interaction.channel.id !== COUNCIL_CHANNEL_ID) {
            return interaction.reply({ content: "This command can only be used in the Hokage Office.", ephemeral: true });
        }
        if (isAkatsukiLeader && interaction.channel.id !== AKATSUKI_COUNCIL_CHANNEL_ID) {
            return interaction.reply({ content: "This command can only be used in the Akatsuki Hideout.", ephemeral: true });
        }
        if (isSannin && interaction.channel.id !== COUNCIL_CHANNEL_ID && interaction.channel.id !== AKATSUKI_COUNCIL_CHANNEL_ID) {
            return interaction.reply({ content: "This command can only be used in council channels.", ephemeral: true });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.reply({ content: "User database not found.", ephemeral: true });
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

        if (isHokage || isSannin) {
            let village = { iron: 0, wood: 0, rope: 0, defense: 0, turrets: {} };
            if (fs.existsSync(villagePath)) {
                village = JSON.parse(fs.readFileSync(villagePath, 'utf8'));
            }
            if (!village.turrets) {
                village.turrets = {};
                for (let i = 1; i <= 10; i++) village.turrets[i] = { hp: 0, max: 100 * i };
            }
            const rightHandMan = Object.values(users).find(u => u.occupation === "Anbu" && u.role === "Right Hand Man")?.username || "None";
            const spies = Object.values(users).filter(u => u.occupation === "Anbu" && u.role === "Spy").length;
            const guards = Object.values(users).filter(u => u.occupation === "Anbu" && u.role === "Guard").length;
            const jinchurikis = Object.values(users).filter(u => u.perks === "Jinchuriki").length;
            const sannins = Object.values(users).filter(u => u.role === "Sannin").length;

            const turretStatus = [];
            for (let i = 1; i <= 10; i++) {
                const t = village.turrets[i];
                if (!t || t.hp === 0) {
                    turretStatus.push(`Turret ${i}: 🔒 Locked`);
                } else {
                    turretStatus.push(`Turret ${i}: ${t.hp}/${t.max} HP`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Council Information`)
                .setDescription(isHokage 
                    ? `Greetings, Hokage **${interaction.user.username}**.` 
                    : `Greetings, Sannin **${interaction.user.username}**.`)
                .setColor('#FFD700')
                .setImage('https://i.pinimg.com/736x/3b/a5/ff/3ba5ff9d67478c1fd0d100e02604985f.jpg')
                .addFields(
                    {
                        name: 'Hokage Commands',
                        value:
                            `- **/anbu**: Hokage appoints strong ninja as the Anbu Black Ops\n` +
                            `- **/appoint**: Appoint roles to your Anbu!\n` +
                            `- **/council**: Shows this command\n` +
                            `- **/defense**: Build Defences to fight against the Akatsuki\n` +
                            `- **/guard**: Guard the Hokage's office for a free cooldown reset.\n` +
                            `- **/spy**: Gather information about the Akatsuki.`
                    },
                    { name: 'War Status', value: 'Negative', inline: true },
                    { name: 'Materials', value: `<:iron:1371159307332096100> Iron: ${village.iron}\n<:wood:1371160087980150865> Wood: ${village.wood}\n<:lead:1371160204418351155> Rope: ${village.rope}`, inline: true },
                    { name: 'Defense Level', value: `${village.defense || 0}/10`, inline: true },
                    { name: 'Turrets', value: turretStatus.join('\n'), inline: false },
                    { name: 'Village', value: `Right Hand Man: ${rightHandMan}\nNo. of Spies: ${spies}\nNo. of Guards: ${guards}\nNo. of Jinchurikis: ${jinchurikis}\nNo. of Sannin: ${sannins}` }
                )
                .setFooter({ text: "Tip: The Guard role might be the most valuable if you're trying to grind levels!" });

            return interaction.reply({ embeds: [embed] });
        } else if (isAkatsukiLeader) {
            let akatsuki = { metal: 0, gunpowder: 0, copper: 0, bombs: {} };
            if (fs.existsSync(akatsukiPath)) {
                akatsuki = JSON.parse(fs.readFileSync(akatsukiPath, 'utf8'));
            }
            if (!akatsuki.bombs) {
                akatsuki.bombs = {};
                for (let i = 1; i <= 10; i++) akatsuki.bombs[i] = { damage: 0, max: 100 * i };
            }
            const coLeader = Object.values(users).find(u => u.occupation === "Akatsuki" && u.role === "Co-Leader")?.username || "None";
            const bruisers = Object.values(users).filter(u => u.occupation === "Akatsuki" && u.role === "Bruiser").length;
            const scientists = Object.values(users).filter(u => u.occupation === "Akatsuki" && u.role === "Scientist").length;
            const sannins = Object.values(users).filter(u => u.role === "Sannin").length;

            const bombStatus = [];
            for (let i = 1; i <= 10; i++) {
                const b = akatsuki.bombs[i];
                if (!b || b.damage === 0) {
                    bombStatus.push(`Nuclear Chakra Bomb ${i}: 🔒 Locked`);
                } else {
                    bombStatus.push(`Nuclear Chakra Bomb ${i}: ${b.damage}/${b.max} Damage`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Akatsuki Council`)
                .setDescription(`Hello Chief, **${interaction.user.username}**.`)
                .setColor('#B71C1C')
                .setImage('https://static.wikia.nocookie.net/naruto/images/2/2e/Akatsuki_Infobox.png')
                .addFields(
                    {
                        name: 'Akatsuki Commands',
                        value:
                            `- **/invite**: Invite someone to the Akatsuki.\n` +
                            `- **/setrole**: Assign roles to Akatsuki members (Co-Leader, Bruiser, Scientist).\n` +
                            `- **/council**: Shows this command\n` +
                            `- **/blueprint**: Scientists create blueprints for bombs.\n` +
                            `- **/buildbomb**: Chief turns blueprints into real bombs.\n` +
                            `- **/rob**: Bruisers rob for ramen tickets.`
                    },
                    { name: 'War Status', value: 'Negative', inline: true },
                    { name: 'Materials', value: `🪙 Metal: ${akatsuki.metal}\n💥 Gunpowder: ${akatsuki.gunpowder}\n🔌 Copper: ${akatsuki.copper}`, inline: true },
                    { name: 'Bomb Level', value: `${akatsuki.bombLevel || 0}/10`, inline: true },
                    { name: 'Nuclear Chakra Bombs', value: bombStatus.join('\n'), inline: false },
                    { name: 'Akatsuki', value: `Co-Leader: ${coLeader}\nBruisers: ${bruisers}\nScientists: ${scientists}\nNo. of Sannin: ${sannins}` }
                )
                .setFooter({ text: "Tip: Bruisers can rob for ramen tickets every 3 hours!" });

            return interaction.reply({ embeds: [embed] });
        }
    }
};