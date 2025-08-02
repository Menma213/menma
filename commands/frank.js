const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const SERVER_BOOSTER_ROLE = '1399150845022572544'; // Replace with your actual Booster role ID
// Removed: BOOSTER_MAX_ATTEMPTS
// Removed: BOOSTER_ATTEMPT_WINDOW
const COOLDOWN = 3000; // 3 seconds
const CAPTCHA_FAIL_ALERT_CHANNEL = '1381271394901557323'; // Set to your alert channel ID
const MAIN_SERVER_ID = '1381268582595297321'; // Set to your main server ID
const ADMIN_ID = '1381268854776529028'; // Set to your admin user ID
const BAN_FILE = path.resolve(__dirname, '../../menma/data/frank_bans.json');

function loadBans() {
    if (!fs.existsSync(BAN_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(BAN_FILE, 'utf8'));
    } catch {
        return {};
    }
}
function saveBans(bans) {
    fs.writeFileSync(BAN_FILE, JSON.stringify(bans, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('frank')
        .setDescription('Do a micro training mission for quick EXP')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Optional action (e.g., "unlock" to unban a user)')
                .addChoices(
                    { name: 'unlock', value: 'unlock' }
                )
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User for the "unlock" action (Admin only)')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!interaction.guild || interaction.guild.id !== MAIN_SERVER_ID) {
            return interaction.reply({ content: 'This command can only be used in the main server.', ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user');

        if (action === 'unlock') {
            if (interaction.user.id !== ADMIN_ID) {
                return interaction.reply({ content: 'Only the admin can use the "unlock" action.', ephemeral: true });
            }
            if (!targetUser) {
                return interaction.reply({ content: 'You must provide a user to unlock.', ephemeral: true });
            }

            let bans = loadBans();
            if (bans[targetUser.id]) {
                delete bans[targetUser.id];
                saveBans(bans);
                return interaction.reply({ content: `Unbanned <@${targetUser.id}> from using frank.`, ephemeral: false });
            } else {
                return interaction.reply({ content: `<@${targetUser.id}> is not banned from frank.`, ephemeral: true });
            }
        }

        await interaction.deferReply({ ephemeral: false });

        const userId = interaction.user.id;
        let bans = loadBans();
        if (bans[userId]) {
            return interaction.editReply({
                content: "You have been temporarily banned from using frank. Please approach an admin to get yourself unbanned.",
                ephemeral: true
            });
        }

        if (!fs.existsSync(usersPath)) {
            return interaction.editReply("Database connection failed. Please try again later.");
        }
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        if (!users[userId]) {
            return interaction.editReply({
                content: "You must enroll as a ninja before you can train!",
                ephemeral: true
            });
        }
        const player = users[userId];

        if (!global._frankCooldown) global._frankCooldown = {};
        const now = Date.now();
        if (global._frankCooldown[userId] && now - global._frankCooldown[userId] < COOLDOWN) {
            const wait = Math.ceil((COOLDOWN - (now - global._frankCooldown[userId])) / 1000);
            return interaction.editReply({
                content: `You must wait ${wait} more second(s) before doing another F-rank mission.`,
                ephemeral: false
            });
        }
        global._frankCooldown[userId] = now;

        if (Math.random() < 0.05) {
            const captcha = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
            await interaction.editReply({
                content: `<:peek:1399145591019405312> **Anti-macro Check:**\nType the following number to continue: \`${captcha}\``,
                ephemeral: false
            });

            const filter = m => m.author.id === userId && m.content.trim() === captcha;
            let passed = false;
            try {
                const collected = await interaction.channel.awaitMessages({
                    filter,
                    max: 1,
                    time: 60000,
                    errors: ['time']
                });
                passed = true;
            } catch {
                bans[userId] = { bannedAt: Date.now() };
                saveBans(bans);
                try {
                    const alertChannel = await interaction.client.channels.fetch(CAPTCHA_FAIL_ALERT_CHANNEL);
                    if (alertChannel) {
                        await alertChannel.send(`<@${ADMIN_ID}>, <@${userId}> has failed the captcha in <#${interaction.channel.id}> and has been banned from frank.`);
                    }
                } catch {}
                return interaction.followUp({
                    content: "❌ Captcha failed or timed out. You have been temporarily banned from using frank. Please approach an admin to get yourself unbanned.",
                    ephemeral: true
                });
            }
            if (!passed) return;
        }

        // Booster EXP logic (simplified)
        let exp = 1; // Default EXP for all users
        let boosterMessage = '';

        if (interaction.member && interaction.member.roles.cache.has(SERVER_BOOSTER_ROLE)) {
            exp = 1.1; // Server Boosters always get 1.1 EXP
            boosterMessage = ' *(Server Booster Bonus!)*';
        }

        // Award EXP
        player.exp = (player.exp || 0) + exp;
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Embed
        const frankEmbed = new EmbedBuilder()
            .setColor('#FF9800')
            .setTitle(` Micro Training Complete!`)
            .setDescription(
                `**${interaction.user.username}** rested and gained **${exp} EXP**${boosterMessage}`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setImage('https://media.tenor.com/8-kXsED3TwwAAAAM/modo-senin-naruto.gif')
            .setFooter({ text: 'Keep grinding, shinobi!' })
            .setTimestamp();

        await interaction.followUp({ embeds: [frankEmbed] });
    }
};