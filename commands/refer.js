const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { userMutex } = require('../utils/locks');

const referralsPath = path.resolve(__dirname, '../../menma/data/referrals.json');
const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
const playersPath = path.resolve(__dirname, '../../menma/data/players.json');

// Initialize referrals file
if (!fs.existsSync(referralsPath)) {
    fs.writeFileSync(referralsPath, JSON.stringify({}, null, 2));
}

// XP Calculation Helper (Copied/Adapted from levelup.js)
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2;
    return (1 + currentLevel) * (Math.floor(currentLevel / 100) + 2);
}

function calculateTenLevelsExp(startLevel) {
    let totalExp = 0;
    let currentLevel = startLevel;
    for (let i = 0; i < 10; i++) {
        totalExp += getExpRequirement(currentLevel);
        currentLevel++;
    }
    return totalExp;
}

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refer')
        .setDescription('Referral system commands')
        .addSubcommand(sub =>
            sub.setName('generate')
                .setDescription('Generate your unique referral code'))
        .addSubcommand(sub =>
            sub.setName('redeem')
                .setDescription('Redeem a referral code')
                .addStringOption(opt =>
                    opt.setName('code')
                        .setDescription('The 5-digit code to redeem')
                        .setRequired(true))),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subCommand = interaction.options.getSubcommand();
        const referrals = JSON.parse(fs.readFileSync(referralsPath, 'utf8'));

        if (subCommand === 'generate') {
            // Check if user already has a code
            let existingCode = Object.keys(referrals).find(key => referrals[key].ownerId === userId);

            if (existingCode) {
                const embed = new EmbedBuilder()
                    .setTitle('Your Referral Code')
                    .setDescription(`Your code is: **${existingCode}**\nShare this with new players to earn rewards!`)
                    .setColor('#00ff00');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Generate new code
            let newCode;
            do {
                newCode = generateCode();
            } while (referrals[newCode]); // Ensure uniqueness

            referrals[newCode] = {
                ownerId: userId,
                uses: 0
            };

            fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('Referral Code Generated!')
                .setDescription(`Your unique code is: **${newCode}**\n\n**Rewards for Inviter (You):**\n- 10 Levels worth of EXP\n- 1,000,000 Ryo\n- 100 Ramen\n\n**Rewards for New Player:**\n- 100 Ramen\n- 1,000 EXP\n- 350,000 Ryo\n- Title: "Newbie"`)
                .setColor('#ffd700');

            return interaction.reply({ embeds: [embed] });

        } else if (subCommand === 'redeem') {
            const code = interaction.options.getString('code').toUpperCase();

            await userMutex.runExclusive(async () => {
                const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
                const userData = users[userId];
                const playerData = players[userId];

                if (!userData || !playerData) {
                    return interaction.reply({ content: "You must enroll first!", ephemeral: true });
                }

                // CHECK ELIGIBILITY
                if (!userData.referralEligible) {
                    return interaction.reply({ content: "You are not eligible to redeem a referral code. Only new players can redeem codes.", ephemeral: true });
                }

                if (userData.referralRedeemed) {
                    return interaction.reply({ content: "You have already redeemed a referral code!", ephemeral: true });
                }

                const referralData = referrals[code];
                if (!referralData) {
                    return interaction.reply({ content: "Invalid referral code.", ephemeral: true });
                }

                if (referralData.ownerId === userId) {
                    return interaction.reply({ content: "You cannot redeem your own code!", ephemeral: true });
                }

                const ownerId = referralData.ownerId;
                const ownerUser = users[ownerId];
                const ownerPlayer = players[ownerId];

                if (!ownerUser || !ownerPlayer) {
                    return interaction.reply({ content: "The owner of this code no longer exists.", ephemeral: true });
                }

                // APPLY REWARDS

                // 1. New User (Redeemer)
                // 100 ramen, 1000 exp, 350k money and a title called Newbie
                playerData.ramen = (playerData.ramen || 0) + 100;
                playerData.exp = (playerData.exp || 0) + 1000;
                playerData.money = (playerData.money || 0) + 350000;
                if (!userData.titles) userData.titles = [];
                if (!userData.titles.includes("Newbie")) {
                    userData.titles.push("Newbie");
                    // Optionally set as active title if none
                    if (!userData.title) userData.title = "Newbie";
                }
                userData.referralRedeemed = true; // Mark as used

                // 2. Inviter (Owner)
                // 10 levels worth of exp and 1 million ryo and 100 ramen
                // Calculate 10 levels EXP based on owner's CURRENT level
                const ownerLevel = Number(ownerPlayer.level) || 1;
                const bonusExp = calculateTenLevelsExp(ownerLevel);

                ownerPlayer.exp = (ownerPlayer.exp || 0) + bonusExp;
                ownerPlayer.money = (ownerPlayer.money || 0) + 1000000;
                ownerPlayer.ramen = (ownerPlayer.ramen || 0) + 100;

                referralData.uses++;

                // Save files
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
                fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2));

                const successEmbed = new EmbedBuilder()
                    .setTitle('Referral Successful!')
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Redeemed by', value: `<@${userId}>\n+100 Ramen\n+1000 EXP\n+350,000 Ryo\n"Newbie" Title`, inline: true },
                        { name: 'Inviter Reward', value: `<@${ownerId}>\n+${bonusExp.toLocaleString()} EXP (10 Levels worth)\n+1,000,000 Ryo\n+100 Ramen`, inline: true }
                    );

                await interaction.reply({ embeds: [successEmbed] });
            });
        }
    }
};
