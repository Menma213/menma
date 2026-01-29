const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');

const CLANS_FILE = path.join(__dirname, '../data/clans.json');
const USERS_FILE = path.join(__dirname, '../data/users.json');
const PLAYERS_FILE = path.join(__dirname, '../data/players.json');
const TERRITORIES_FILE = path.join(__dirname, '../data/territories.json');
const BLUEPRINTS_FILE = path.join(__dirname, '../data/blueprints.json');
const CLAN_TOKENS_FILE = path.join(__dirname, '../data/clantokens.json');
const CLAN_CONTRIBUTIONS_FILE = path.join(__dirname, '../data/clancontributions.json');

// Helper to load JSON
async function loadJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
        return {};
    }
}

// Helper to save JSON
async function saveJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error(`Error saving ${filePath}:`, error);
    }
}

// Helper to format names (replace underscores with spaces and capitalize)
function formatName(name) {
    if (!name) return 'None';
    return name.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('Manage your clan or view clan info.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View information about your current clan.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new clan (Cost: 1000 SS).')
                .addStringOption(option => option.setName('name').setDescription('The name of your clan.').setRequired(true))
                .addStringOption(option => option.setName('image').setDescription('URL for the clan profile picture.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('Update clan settings.')
                .addStringOption(option => option.setName('name').setDescription('New clan name.'))
                .addStringOption(option => option.setName('image').setDescription('New clan image URL.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invite a user to your clan.')
                .addUserOption(option => option.setName('user').setDescription('The user to invite.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kick a user from your clan.')
                .addUserOption(option => option.setName('user').setDescription('The user to kick.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disband')
                .setDescription('Disband your clan.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave your current clan.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('appoint')
                .setDescription('Appoint a member to a role.')
                .addUserOption(option => option.setName('user').setDescription('The user to appoint.').setRequired(true))
                .addStringOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Co-Leader', value: 'co-leader' },
                            { name: 'Elder', value: 'elder' },
                            { name: 'Member', value: 'member' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('lab')
                .setDescription('Access the clan laboratory to craft weapons.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View clan contribution leaderboard.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rules')
                .setDescription('Set clan rules.')
                .addStringOption(option => option.setName('text').setDescription('The rules text.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('capture')
                .setDescription('Attempt to capture a territory.')
                .addStringOption(option => option.setName('territory').setDescription('The territory to capture.').setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('buff')
                .setDescription('Purchase Clan Buffs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shop')
                .setDescription('Access the clan shop.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy')
                .setDescription('Buy an item from the clan shop.')
                .addStringOption(option => option.setName('item').setDescription('Item ID to buy.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('war')
                .setDescription('Declare war on a territory.')
                .addStringOption(option => option.setName('territory').setDescription('The territory to attack.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('distribute')
                .setDescription('Distribute clan rewards (Leader only).'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bank')
                .setDescription('View clan bank or contribute money.')
                .addIntegerOption(option => option.setName('add').setDescription('Amount of Ryo to contribute.').setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand() || 'info';
        const userId = interaction.user.id;

        // Load Data
        let users = await loadJson(USERS_FILE);
        let players = await loadJson(PLAYERS_FILE);
        let clans = await loadJson(CLANS_FILE);
        let territories = await loadJson(TERRITORIES_FILE);
        let blueprints = await loadJson(BLUEPRINTS_FILE);
        let clanTokens = await loadJson(CLAN_TOKENS_FILE);
        let clanContributions = await loadJson(CLAN_CONTRIBUTIONS_FILE);

        const userClanName = users[userId]?.clan === 'None' ? null : users[userId]?.clan;
        const userClan = userClanName ? clans[userClanName] : null;

        // --- INFO ---
        if (subcommand === 'info') {
            if (!userClan) {
                return interaction.reply({ content: 'You are not in a clan.', ephemeral: true });
            }

            // Calculate clan power
            let clanPower = 0;
            if (userClan.weapons) {
                for (const [wName, count] of Object.entries(userClan.weapons)) {
                    const bp = blueprints.find(b => b.name === wName);
                    if (bp) clanPower += bp.power * count;
                }
            }
            // Apply Penalty
            clanPower = Math.max(0, clanPower - (userClan.power_penalty || 0));

            // Calculate total materials
            let totalMaterials = 0;
            if (userClan.materials) {
                totalMaterials = Object.values(userClan.materials).reduce((sum, val) => sum + val, 0);
            }

            const materials = userClan.materials && Object.keys(userClan.materials).length > 0
                ? Object.entries(userClan.materials).map(([k, v]) => `• ${formatName(k)}: ${v}`).join('\n')
                : 'None';

            const weapons = userClan.weapons && Object.keys(userClan.weapons).length > 0
                ? Object.entries(userClan.weapons).map(([k, v]) => `• ${formatName(k)}: ${v}`).join('\n')
                : 'None';

            // Tier requirements for next level
            const TIER_REQUIREMENTS = {
                2: { members: 3, materials: 500, power: 1000 },
                3: { members: 5, materials: 2000, power: 5000 },
                4: { members: 8, materials: 5000, power: 15000 },
                5: { members: 12, materials: 10000, power: 30000 }
            };

            const currentTier = userClan.level || 1;
            const nextTier = currentTier + 1;
            let tierProgress = '';

            if (TIER_REQUIREMENTS[nextTier]) {
                const req = TIER_REQUIREMENTS[nextTier];
                tierProgress = `**Next Tier (${nextTier}) Requirements:**\n` +
                    `Members: ${userClan.members.length}/${req.members} ${userClan.members.length >= req.members ? '✅' : '❌'}\n` +
                    `Materials: ${totalMaterials}/${req.materials} ${totalMaterials >= req.materials ? '✅' : '❌'}\n` +
                    `Power: ${clanPower}/${req.power} ${clanPower >= req.power ? '✅' : '❌'}`;
            } else {
                tierProgress = '**Max Tier Reached!**';
            }

            const embed = new EmbedBuilder()
                .setTitle(`${userClan.name} [Tier ${userClan.level}]`)
                .setDescription(`**Leader:** <@${userClan.leader}>\n**Members:** ${userClan.members.length}\n**Treasury:** ${userClan.treasury.toLocaleString()} Ryo\n**Clan Power:** ${clanPower.toLocaleString()}`)
                .addFields(
                    { name: 'Territories', value: userClan.controlledTerritories.length > 0 ? userClan.controlledTerritories.map(formatName).join(', ') : 'None', inline: true },
                    { name: 'Co-Leader', value: userClan.coLeader ? `<@${userClan.coLeader}>` : 'None', inline: true },
                    { name: 'Elders', value: userClan.elders.length > 0 ? userClan.elders.map(id => `<@${id}>`).join(', ') : 'None', inline: true },
                    { name: 'Tier Progress', value: tierProgress, inline: false },
                    { name: 'Weapons', value: weapons, inline: false },
                    { name: 'Materials', value: materials, inline: false }
                )
                .setColor(userClan.color || '#0099ff');

            if (userClan.image) embed.setThumbnail(userClan.image);

            return interaction.reply({ embeds: [embed] });
        }

        // --- CREATE ---
        if (subcommand === 'create') {
            if (userClan) return interaction.reply({ content: 'You are already in a clan.', ephemeral: true });

            const name = interaction.options.getString('name');
            const image = interaction.options.getString('image');

            if (clans[name]) return interaction.reply({ content: 'A clan with this name already exists.', ephemeral: true });

            // Check SS
            const playerSS = players[userId]?.ss || 0;
            if (playerSS < 1000) return interaction.reply({ content: `You need 1000 SS to create a clan. You have ${playerSS}.`, ephemeral: true });

            // Deduct SS
            players[userId].ss -= 1000;

            // Create Clan
            clans[name] = {
                name: name,
                image: image,
                leader: userId,
                coLeader: null,
                elders: [],
                members: [userId],
                treasury: 0,
                level: 1,
                xp: 0,
                controlledTerritories: [],
                rules: "No rules set.",
                materials: {},
                weapons: {},
                contributions: {}
            };

            // Update User
            if (!users[userId]) users[userId] = {};
            users[userId].clan = name;

            await saveJson(PLAYERS_FILE, players);
            await saveJson(CLANS_FILE, clans);
            await saveJson(USERS_FILE, users);

            return interaction.reply({ content: `Clan **${name}** created successfully! 1000 SS deducted.` });
        }

        // --- SETTINGS ---
        if (subcommand === 'settings') {
            if (!userClan || userClan.leader !== userId) return interaction.reply({ content: 'You must be the clan leader to change settings.', ephemeral: true });

            const newName = interaction.options.getString('name');
            const newImage = interaction.options.getString('image');

            if (newName) {
                if (clans[newName]) return interaction.reply({ content: 'Name already taken.', ephemeral: true });
                clans[newName] = { ...userClan, name: newName };
                delete clans[userClanName];
                userClan.members.forEach(memberId => {
                    if (users[memberId]) users[memberId].clan = newName;
                });
                userClan.name = newName;
            }

            if (newImage) clans[userClan.name].image = newImage;

            await saveJson(CLANS_FILE, clans);
            await saveJson(USERS_FILE, users);

            return interaction.reply({ content: 'Clan settings updated.' });
        }

        // --- INVITE ---
        if (subcommand === 'invite') {
            if (!userClan) return interaction.reply({ content: 'You are not in a clan.', ephemeral: true });
            const isAuth = userClan.leader === userId || userClan.coLeader === userId || userClan.elders.includes(userId);
            if (!isAuth) return interaction.reply({ content: 'You do not have permission to invite.', ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            if (users[targetUser.id]?.clan && users[targetUser.id].clan !== 'None') return interaction.reply({ content: 'User is already in a clan.', ephemeral: true });

            const canvas = Canvas.createCanvas(400, 600);
            const ctx = canvas.getContext('2d');

            // --- Background ---
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#1a0505'); // Very dark red/black
            gradient.addColorStop(1, '#000000'); // Black
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- Crimson Red Border ---
            const borderColor = '#8B0000'; // Crimson Red
            ctx.lineWidth = 10;
            ctx.strokeStyle = borderColor;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

            // Inner thin border
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ff4444'; // Lighter red for accent
            ctx.globalAlpha = 0.5;
            ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
            ctx.globalAlpha = 1.0;

            // --- Text Styling ---
            ctx.textAlign = 'center';

            // Header
            ctx.font = 'italic 20px "Times New Roman", serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText('You have been invited to join', 200, 60);

            // --- Clan Image ---
            if (userClan.image) {
                try {
                    const avatar = await Canvas.loadImage(userClan.image);
                    const imgSize = 150;
                    const imgX = 200 - (imgSize / 2);
                    const imgY = 90;

                    // Save context for clipping
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(200, imgY + (imgSize / 2), imgSize / 2, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(avatar, imgX, imgY, imgSize, imgSize);
                    ctx.restore();

                    // Draw Red Circle Border around image
                    ctx.beginPath();
                    ctx.arc(200, imgY + (imgSize / 2), imgSize / 2, 0, Math.PI * 2, true);
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = borderColor;
                    ctx.stroke();
                } catch (e) {
                    console.log('Failed to load clan image for invite');
                }
            }

            // --- Clan Name ---
            ctx.font = 'bold 40px "Times New Roman", serif';
            ctx.shadowColor = '#500000';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ff3333'; // Bright red text
            ctx.fillText(userClan.name.toUpperCase(), 200, 290);
            ctx.shadowBlur = 0;

            // --- Divider ---
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(100, 310);
            ctx.lineTo(300, 310);
            ctx.stroke();

            // --- Rules Section ---
            ctx.font = 'bold 22px "Times New Roman", serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('CLAN RULES', 200, 340);

            ctx.font = '16px "Arial", sans-serif';
            ctx.fillStyle = '#aaaaaa';

            // Simple text wrapping for rules
            const rules = userClan.rules !== "No rules set." ? userClan.rules : "No specific rules set. Respect the leader and have fun!";
            const words = rules.split(' ');
            let line = '';
            let y = 370;
            const maxWidth = 340;
            const lineHeight = 20;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, 200, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                    if (y > 550) break; // Prevent overflow
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 200, y);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'invite.png' });
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`clan_accept_${userClan.name}`).setLabel('Accept').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`clan_decline`).setLabel('Decline').setStyle(ButtonStyle.Danger)
                );

            // Send to channel, but ping user
            const msg = await interaction.reply({ content: `<@${targetUser.id}>`, files: [attachment], components: [row], fetchReply: true });

            const filter = i => i.user.id === targetUser.id;
            const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    if (i.customId.startsWith('clan_accept')) {
                        let currentUsers = await loadJson(USERS_FILE);
                        let currentClans = await loadJson(CLANS_FILE);
                        if (currentUsers[targetUser.id]?.clan && currentUsers[targetUser.id].clan !== 'None') return i.reply({ content: 'You joined another clan already.', ephemeral: true });

                        currentUsers[targetUser.id].clan = userClan.name;
                        currentClans[userClan.name].members.push(targetUser.id);

                        await saveJson(USERS_FILE, currentUsers);
                        await saveJson(CLANS_FILE, currentClans);
                        await i.update({ content: `Welcome to **${userClan.name}**, <@${targetUser.id}>!`, components: [] });
                    } else {
                        await i.update({ content: 'Invitation declined.', components: [] });
                    }
                } catch (err) {
                    console.error("Invite interaction error:", err);
                    if (!i.replied) await i.reply({ content: 'An error occurred.', ephemeral: true });
                }
            });
            return;
        }

        // --- KICK ---
        if (subcommand === 'kick') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            const isLeader = userClan.leader === userId;
            const isCo = userClan.coLeader === userId;
            if (!isLeader && !isCo) return interaction.reply({ content: 'No permission.', ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            if (!userClan.members.includes(targetUser.id)) return interaction.reply({ content: 'User not in your clan.', ephemeral: true });
            if (targetUser.id === userClan.leader) return interaction.reply({ content: 'Cannot kick the leader.', ephemeral: true });

            userClan.members = userClan.members.filter(id => id !== targetUser.id);
            userClan.elders = userClan.elders.filter(id => id !== targetUser.id);
            if (userClan.coLeader === targetUser.id) userClan.coLeader = null;
            users[targetUser.id].clan = 'None';

            await saveJson(CLANS_FILE, clans);
            await saveJson(USERS_FILE, users);
            return interaction.reply({ content: `<@${targetUser.id}> has been kicked.` });
        }

        // --- LEAVE ---
        if (subcommand === 'leave') {
            if (!userClan) {
                return interaction.reply({ content: 'You are not in a clan.', ephemeral: true });
            }

            if (userClan.leader === userId) {
                if (userClan.members.length > 1) {
                    return interaction.reply({ content: 'You are the clan leader. Please appoint a new leader before leaving.', ephemeral: true });
                } else {
                    // Last member, disband the clan
                    delete clans[userClanName];
                    users[userId].clan = 'None';
                    await saveJson(CLANS_FILE, clans);
                    await saveJson(USERS_FILE, users);
                    return interaction.reply({ content: 'You have left and disbanded the clan.' });
                }
            }

            // Remove user from clan
            clans[userClanName].members = clans[userClanName].members.filter(id => id !== userId);
            clans[userClanName].elders = clans[userClanName].elders.filter(id => id !== userId);
            if (clans[userClanName].coLeader === userId) {
                clans[userClanName].coLeader = null;
            }
            users[userId].clan = 'None';

            await saveJson(CLANS_FILE, clans);
            await saveJson(USERS_FILE, users);

            return interaction.reply({ content: `You have left the clan **${userClanName}**.` });
        }

        // --- DISBAND ---
        if (subcommand === 'disband') {
            if (!userClan || userClan.leader !== userId) return interaction.reply({ content: 'Only the leader can disband.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId('disband_modal').setTitle('Disband Clan');
            const confirmInput = new TextInputBuilder().setCustomId('confirm_text').setLabel('Type "i wish to disband my clan"').setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(confirmInput));
            await interaction.showModal(modal);
            try {
                const submission = await interaction.awaitModalSubmit({ time: 60000, filter: i => i.user.id === userId });
                if (submission.fields.getTextInputValue('confirm_text').toLowerCase() === 'i wish to disband my clan') {
                    userClan.members.forEach(m => { if (users[m]) users[m].clan = 'None'; });
                    delete clans[userClan.name];
                    await saveJson(CLANS_FILE, clans);
                    await saveJson(USERS_FILE, users);
                    await submission.reply({ content: 'Clan disbanded successfully.' });
                } else {
                    await submission.reply({ content: 'Incorrect confirmation text.', ephemeral: true });
                }
            } catch (e) { }
            return;
        }

        // --- APPOINT ---
        if (subcommand === 'appoint') {
            if (!userClan || userClan.leader !== userId) return interaction.reply({ content: 'Only leader can appoint.', ephemeral: true });
            const targetUser = interaction.options.getUser('user');
            const role = interaction.options.getString('role');
            if (!userClan.members.includes(targetUser.id)) return interaction.reply({ content: 'User not in clan.', ephemeral: true });

            if (role === 'co-leader') {
                userClan.coLeader = targetUser.id;
                userClan.elders = userClan.elders.filter(id => id !== targetUser.id);
            } else if (role === 'elder') {
                if (userClan.elders.length >= 3) return interaction.reply({ content: 'Max 3 elders.', ephemeral: true });
                if (!userClan.elders.includes(targetUser.id)) userClan.elders.push(targetUser.id);
                if (userClan.coLeader === targetUser.id) userClan.coLeader = null;
            } else {
                if (userClan.coLeader === targetUser.id) userClan.coLeader = null;
                userClan.elders = userClan.elders.filter(id => id !== targetUser.id);
            }
            await saveJson(CLANS_FILE, clans);
            return interaction.reply({ content: `<@${targetUser.id}> is now a **${role}**.` });
        }

        // --- RULES ---
        if (subcommand === 'rules') {
            if (!userClan || userClan.leader !== userId) return interaction.reply({ content: 'Only leader can set rules.', ephemeral: true });
            userClan.rules = interaction.options.getString('text');
            await saveJson(CLANS_FILE, clans);
            return interaction.reply({ content: 'Clan rules updated.' });
        }

        // --- BUFF ---
        if (subcommand === 'buff') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });

            // Check if buff is already active
            if (userClan.buffs && userClan.buffs.active) {
                return interaction.reply({ content: `Clan Buff Tier ${userClan.buffs.tier} is already active!`, ephemeral: true });
            }

            const cost = 20000000; // 20 Million Ryo
            if ((userClan.treasury || 0) < cost) {
                return interaction.reply({ content: `The Clan Bank needs ${cost.toLocaleString()} Ryo to purchase the Clan Buff. Current Balance: ${(userClan.treasury || 0).toLocaleString()} Ryo.`, ephemeral: true });
            }

            // Confirm purchase
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('buff_confirm').setLabel(`Buy Tier 1 Buff (${cost.toLocaleString()} Ryo)`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buff_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

            const msg = await interaction.reply({
                content: `**Clan Buff Tier 1**\nEffects: 20x Power & Defense for all members in battle.\nDuration: Permanent (until deactivated/expired).\nCost: ${cost.toLocaleString()} Ryo (from Clan Bank).`,
                components: [row],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'buff_confirm') {
                    // Re-check funds (reload clans to be safe)
                    let currentClans = await loadJson(CLANS_FILE);
                    let currentClan = currentClans[userClan.name];

                    if ((currentClan.treasury || 0) < cost) {
                        return i.update({ content: 'Insufficient funds in Clan Bank.', components: [] });
                    }

                    // Deduct money from treasury
                    currentClan.treasury -= cost;

                    // Activate Buff
                    currentClan.buffs = {
                        tier: 1,
                        active: true,
                        multiplier: 20
                    };

                    await saveJson(CLANS_FILE, currentClans);

                    await i.update({ content: `**Clan Buff Tier 1 Activated!**\nAll clan members now have 20x stats in battle!`, components: [] });
                } else {
                    await i.update({ content: 'Purchase cancelled.', components: [] });
                }
            });
            return;
        }

        // --- LAB ---
        if (subcommand === 'lab') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            const isAuth = userClan.leader === userId || userClan.coLeader === userId || userClan.elders.includes(userId);
            if (!isAuth) return interaction.reply({ content: 'Only elders+ can access the lab.', ephemeral: true });

            if (!Array.isArray(blueprints) || blueprints.length === 0) return interaction.reply({ content: 'No blueprints available.', ephemeral: true });

            let page = 0;
            const generateEmbed = (pageIndex) => {
                const bp = blueprints[pageIndex];
                const embed = new EmbedBuilder()
                    .setTitle(`Clan Lab: ${bp.name}`)
                    .setDescription(`**Power:** ${bp.power}\n**Description:** ${bp.power_description}\n**Materials Required:**\n${bp.materials.map(m => `- ${formatName(m.item)}: ${m.qty}`).join('\n')}`)
                    .setColor('#00FFFF') // Cyan
                    .setFooter({ text: `Page ${pageIndex + 1}/${blueprints.length}` });
                if (bp.image_url) embed.setImage(bp.image_url);
                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lab_prev').setLabel('Previous').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lab_craft').setLabel('Craft').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('lab_next').setLabel('Next').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [generateEmbed(page)], components: [row], fetchReply: true });
            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'lab_prev') {
                    page = page > 0 ? page - 1 : blueprints.length - 1;
                    await i.update({ embeds: [generateEmbed(page)] });
                } else if (i.customId === 'lab_next') {
                    page = page < blueprints.length - 1 ? page + 1 : 0;
                    await i.update({ embeds: [generateEmbed(page)] });
                } else if (i.customId === 'lab_craft') {
                    const bp = blueprints[page];

                    const modal = new ModalBuilder()
                        .setCustomId('craft_qty_modal')
                        .setTitle(`Craft ${bp.name}`);

                    const qtyInput = new TextInputBuilder()
                        .setCustomId('qty')
                        .setLabel('Quantity')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('1')
                        .setValue('1')
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));

                    await i.showModal(modal);

                    try {
                        const submission = await i.awaitModalSubmit({ time: 60000, filter: s => s.user.id === userId });
                        const qty = parseInt(submission.fields.getTextInputValue('qty'));

                        if (isNaN(qty) || qty < 1) {
                            return submission.reply({ content: 'Invalid quantity.', ephemeral: true });
                        }

                        // Check materials for TOTAL quantity
                        const missing = [];
                        for (const mat of bp.materials) {
                            const clanHas = userClan.materials[mat.item] || 0;
                            const needed = mat.qty * qty;
                            if (clanHas < needed) missing.push(`${mat.item} (${clanHas}/${needed})`);
                        }

                        if (missing.length > 0) {
                            return submission.reply({ content: `Missing materials for ${qty}x ${bp.name}:\n${missing.join('\n')}`, ephemeral: true });
                        }

                        // Deduct materials
                        for (const mat of bp.materials) {
                            userClan.materials[mat.item] -= mat.qty * qty;
                        }

                        if (!userClan.weapons) userClan.weapons = {};
                        userClan.weapons[bp.name] = (userClan.weapons[bp.name] || 0) + qty;

                        await saveJson(CLANS_FILE, clans);
                        await submission.reply({ content: `Crafted **${qty}x ${bp.name}**!` });

                    } catch (e) {
                        // Modal timeout or error
                    }
                }
            });
            return;
        }

        // --- SHOP ---
        if (subcommand === 'shop') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });

            const shopItems = [
                { id: 'ramen_10', name: '10 Ramen', cost: 2, type: 'item', item: 'ramen', amount: 10, desc: "Food for your clan." },
                { id: 'ss_100', name: '100 SS', cost: 25, type: 'currency', currency: 'ss', amount: 100, desc: "Premium currency." },
                { id: 'role_custom', name: 'Custom Clan Role', cost: 50, type: 'role', desc: "Create a custom role for members." },
                { id: 'channel_private', name: 'Private Clan Channel', cost: 100, type: 'channel', desc: "A private channel for your clan." }
            ];

            const embed = new EmbedBuilder()
                .setTitle('Clan Shop')
                .setDescription(`Buy items using **Clan Tokens**.\nYour Balance: **${clanTokens[userId] || 0} Tokens**\nUse \`/clan buy item:<id>\` to purchase.`)
                .setColor('#0099ff');

            shopItems.forEach(item => {
                embed.addFields({ name: `${item.name} (ID: ${item.id})`, value: `Cost: ${item.cost} Tokens\n${item.desc}`, inline: false });
            });

            return interaction.reply({ embeds: [embed] });
        }

        // --- BUY ---
        if (subcommand === 'buy') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            // Removed leader check, anyone with tokens can buy? Or still leader only?
            // "So we need to change the clan shop currency from ryo to clan tokens" implies individual currency.
            // Let's allow anyone to buy for themselves/clan.

            const itemId = interaction.options.getString('item');
            const shopItems = [
                { id: 'ramen_10', name: '10 Ramen', cost: 2, type: 'item', item: 'ramen', amount: 10 },
                { id: 'ss_100', name: '100 SS', cost: 25, type: 'currency', currency: 'ss', amount: 100 },
                { id: 'role_custom', name: 'Custom Clan Role', cost: 50, type: 'role' },
                { id: 'channel_private', name: 'Private Clan Channel', cost: 100, type: 'channel' }
            ];

            const item = shopItems.find(i => i.id === itemId);
            if (!item) return interaction.reply({ content: 'Item not found.', ephemeral: true });

            const userTokens = clanTokens[userId] || 0;
            if (userTokens < item.cost) return interaction.reply({ content: `Insufficient Clan Tokens. You have ${userTokens}, need ${item.cost}.`, ephemeral: true });

            clanTokens[userId] = userTokens - item.cost;
            await saveJson(CLAN_TOKENS_FILE, clanTokens);

            // Effect logic
            if (item.type === 'item') {
                // Add to clan inventory? Or distribute? For now, just say bought.
                // Assuming clan has inventory for ramen?
                // userClan.inventory...
                // Add to user inventory
                if (!users[userId].inventory) users[userId].inventory = [];
                for (let k = 0; k < item.amount; k++) users[userId].inventory.push(item.item);
                await saveJson(USERS_FILE, users);
                return interaction.reply({ content: `Bought ${item.name}. Added to your inventory.` });
            } else if (item.type === 'currency') {
                // Add SS to leader? Or distribute?
                players[userId].ss = (players[userId].ss || 0) + item.amount;
                await saveJson(PLAYERS_FILE, players);
                return interaction.reply({ content: `Bought ${item.name}. Added to your balance.` });
            } else {
                return interaction.reply({ content: `Bought ${item.name}. Please contact admin to set up.` });
            }
        }

        // --- DISTRIBUTE ---
        if (subcommand === 'distribute') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            if (userClan.leader !== userId) return interaction.reply({ content: 'Only the clan leader can distribute rewards.', ephemeral: true });

            // Check Cooldown (Monthly)
            const now = Date.now();
            const lastDist = userClan.lastDistribution || 0;
            const cooldown = 30 * 24 * 60 * 60 * 1000; // 30 days
            if (now - lastDist < cooldown) {
                const remaining = Math.ceil((cooldown - (now - lastDist)) / (1000 * 60 * 60 * 24));
                return interaction.reply({ content: `Rewards can only be distributed once a month. Please wait ${remaining} days.`, ephemeral: true });
            }

            // Calculate Tier and Rewards
            const territoryCount = userClan.controlledTerritories.length;
            const tier = Math.max(1, territoryCount);

            if (tier === 0 && territoryCount === 0) {
                return interaction.reply({ content: 'Your clan needs to capture at least 1 territory to receive rewards.', ephemeral: true });
            }

            const rewardMoney = 1000000 * tier;
            const rewardSS = 100 * tier;
            const rewardRamen = 200 * tier;
            const rewardTokens = 25 * tier;

            let memberCount = 0;

            // Load gift data
            const GIFT_FILE = path.join(__dirname, '../data/gift.json');
            let giftData = await loadJson(GIFT_FILE);

            // Distribute
            for (const memberId of userClan.members) {
                // Ensure players[memberId] and players[memberId].money exist
                if (!players[memberId]) players[memberId] = {};
                if (typeof players[memberId].money !== 'number') players[memberId].money = 0;
                players[memberId].money = (players[memberId].money || 0) + rewardMoney;

                // Send Ramen as Gift
                if (!giftData[memberId]) giftData[memberId] = [];

                // Simple ID generation: Timestamp + random to avoid collisions in this batch
                let giftId = Date.now() + Math.floor(Math.random() * 10000);

                giftData[memberId].push({
                    id: giftId,
                    type: 'ramen',
                    amount: rewardRamen,
                    from: userClan.name, // Marked as from Clan
                    date: Date.now(),
                    desc: `Clan Distribution Reward (Tier ${tier})`
                });

                if (players[memberId]) {
                    players[memberId].ss = (players[memberId].ss || 0) + rewardSS;
                }

                clanTokens[memberId] = (clanTokens[memberId] || 0) + rewardTokens;
                memberCount++;
            }

            // Update Clan Data
            userClan.lastDistribution = now;

            await saveJson(USERS_FILE, users);
            await saveJson(PLAYERS_FILE, players);
            await saveJson(CLAN_TOKENS_FILE, clanTokens);
            await saveJson(CLANS_FILE, clans);
            await saveJson(GIFT_FILE, giftData);

            const embed = new EmbedBuilder()
                .setTitle('Clan Rewards Distributed!')
                .setDescription(`Distributed rewards to ${memberCount} members based on Tier ${tier} (${territoryCount} Territories).`)
                .addFields(
                    { name: 'Money', value: `${rewardMoney.toLocaleString()} Ryo`, inline: true },
                    { name: 'Shinobi Shards', value: `${rewardSS} SS`, inline: true },
                    { name: 'Ramen', value: `${rewardRamen} Bowls`, inline: true },
                    { name: 'Clan Tokens', value: `${rewardTokens} Tokens`, inline: true }
                )
                .setColor('#00FF00');

            return interaction.reply({ embeds: [embed] });
        }

        // --- LEADERBOARD ---
        if (subcommand === 'leaderboard') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });

            const clanContribs = clanContributions[userClan.name] || {};

            const sorted = Object.entries(clanContribs).sort(([, a], [, b]) => {
                // Calculate total score (money + sum of materials)
                // Assuming 1 material = 1 point, 1 Ryo = 0.001 point? Or just display separately.
                // Let's sort by money for now as it's the main contribution
                const moneyA = a.money || 0;
                const moneyB = b.money || 0;
                return moneyB - moneyA;
            }).slice(0, 10);

            const desc = sorted.map(([uid, data], i) => {
                const money = data.money || 0;
                // Count materials excluding money key
                const materials = Object.entries(data).reduce((sum, [key, val]) => key !== 'money' ? sum + val : sum, 0);
                return `${i + 1}. <@${uid}> - **${money.toLocaleString()} Ryo** | ${materials} Materials`;
            }).join('\n') || 'No contributions yet.';

            const embed = new EmbedBuilder()
                .setTitle(`${userClan.name} Contribution Leaderboard`)
                .setDescription(desc)
                .setColor(userClan.color || '#0099ff');
            return interaction.reply({ embeds: [embed] });
        }

        // --- BANK ---
        if (subcommand === 'bank') {
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });

            const amountToAdd = interaction.options.getInteger('add');

            if (amountToAdd) {
                // Contribute Money
                // Ensure the 'money' field exists in players[userId]
                if (!players[userId]) players[userId] = {};
                if (typeof players[userId].money !== 'number') players[userId].money = 0;

                if ((players[userId].money || 0) < amountToAdd) {
                    return interaction.reply({ content: `You don't have enough Ryo. You have ${(players[userId].money || 0).toLocaleString()} Ryo.`, ephemeral: true });
                }

                // Deduct from user
                players[userId].money -= amountToAdd;

                // Add to clan treasury
                userClan.treasury = (userClan.treasury || 0) + amountToAdd;

                // Track contribution
                if (!clanContributions[userClan.name]) clanContributions[userClan.name] = {};
                if (!clanContributions[userClan.name][userId]) clanContributions[userClan.name][userId] = {};

                clanContributions[userClan.name][userId].money = (clanContributions[userClan.name][userId].money || 0) + amountToAdd;

                // Calculate Clan Power for tier requirements
                let clanPower = 0;
                if (userClan.weapons) {
                    for (const [wName, count] of Object.entries(userClan.weapons)) {
                        const bp = blueprints.find(b => b.name === wName);
                        if (bp) clanPower += bp.power * count;
                    }
                }
                // Apply Penalty
                clanPower = Math.max(0, clanPower - (userClan.power_penalty || 0));

                // Calculate total materials gathered
                let totalMaterials = 0;
                if (userClan.materials) {
                    totalMaterials = Object.values(userClan.materials).reduce((sum, val) => sum + val, 0);
                }

                // Check for Tier Upgrade with comprehensive requirements
                // Tier requirements: members, materials gathered, clan power
                const TIER_REQUIREMENTS = {
                    2: { members: 3, materials: 500, power: 1000 },
                    3: { members: 5, materials: 2000, power: 5000 },
                    4: { members: 8, materials: 5000, power: 15000 },
                    5: { members: 12, materials: 10000, power: 30000 }
                };

                let upgraded = false;
                const currentTier = userClan.level || 1;
                const nextTier = currentTier + 1;

                if (TIER_REQUIREMENTS[nextTier]) {
                    const req = TIER_REQUIREMENTS[nextTier];
                    const memberCount = userClan.members.length;

                    if (memberCount >= req.members && totalMaterials >= req.materials && clanPower >= req.power) {
                        userClan.level = nextTier;
                        upgraded = true;
                    }
                }

                // Store clan power for leaderboard
                userClan.power = clanPower;

                await saveJson(PLAYERS_FILE, players);
                await saveJson(USERS_FILE, users);
                await saveJson(CLANS_FILE, clans);
                await saveJson(CLAN_CONTRIBUTIONS_FILE, clanContributions);

                let msg = `You contributed **${amountToAdd.toLocaleString()} Ryo** to the clan bank.\nNew Balance: **${userClan.treasury.toLocaleString()} Ryo**`;
                if (upgraded) {
                    msg += `\n\n🎉 **CLAN LEVEL UP!**\n${userClan.name} has reached **Tier ${userClan.level}**!`;
                    // Optional: Announce to channel if not ephemeral? But we usually reply ephemeral or public. 
                    // Let's make this reply public so everyone sees the upgrade.
                }

                return interaction.reply({ content: msg });

            } else {
                // View Balance
                const embed = new EmbedBuilder()
                    .setTitle(`${userClan.name} Bank`)
                    .setDescription(`**Treasury Balance:** ${userClan.treasury.toLocaleString()} Ryo\n\nUse \`/clan bank add:<amount>\` to contribute.`)
                    .setColor('#FFD700'); // Gold
                return interaction.reply({ embeds: [embed] });
            }
        }

        // --- WAR & CAPTURE ---
        if (subcommand === 'capture' || subcommand === 'war') {
            const territoryName = interaction.options.getString('territory').toLowerCase().replace(/ /g, '_');
            const territory = territories.territories[territoryName];

            if (!territory) return interaction.reply({ content: 'Territory not found.', ephemeral: true });
            if (!userClan) return interaction.reply({ content: 'Not in a clan.', ephemeral: true });
            const isAuth = userClan.leader === userId || userClan.coLeader === userId;
            if (!isAuth) return interaction.reply({ content: 'Only Leader/Co-Leader can declare war.', ephemeral: true });

            if (territory.controlledBy === userClan.name) return interaction.reply({ content: 'You already control this territory.', ephemeral: true });

            // War Logic
            // 1. Check if territory is defended (controlled by another clan)
            // 2. If yes, notify other clan?
            // 3. Start battle simulation (Weapons vs Weapons/Defenses)

            const enemyClanName = territory.controlledBy;
            const enemyClan = enemyClanName ? clans[enemyClanName] : null;

            // Calculate Power
            let myPower = 0;
            if (userClan.weapons) {
                for (const [wName, count] of Object.entries(userClan.weapons)) {
                    const bp = blueprints.find(b => b.name === wName);
                    if (bp) myPower += bp.power * count;
                }
            }
            // Apply Penalty to Attacker
            myPower = Math.max(0, myPower - (userClan.power_penalty || 0));

            let enemyPower = 0;
            if (enemyClan && enemyClan.weapons) {
                for (const [wName, count] of Object.entries(enemyClan.weapons)) {
                    const bp = blueprints.find(b => b.name === wName);
                    if (bp) enemyPower += bp.power * count;
                }
                // Apply Penalty to Enemy
                enemyPower = Math.max(0, enemyPower - (enemyClan.power_penalty || 0));
            } else {
                // Neutral territory base defense
                enemyPower = 500;
            }

            const embed = new EmbedBuilder()
                .setTitle(`War for ${territory.displayName}`)
                .setDescription(`**${userClan.name}** vs **${enemyClanName || 'Neutral Defense'}**`)
                .addFields(
                    { name: 'Your Power', value: myPower.toString(), inline: true },
                    { name: 'Enemy Power', value: enemyPower.toString(), inline: true }
                )
                .setColor('#FF0000');

            await interaction.reply({ embeds: [embed] });

            // Simple resolution for now
            setTimeout(async () => {
                if (myPower > enemyPower) {
                    // Win
                    territory.controlledBy = userClan.name;
                    if (!userClan.controlledTerritories.includes(territory.name)) {
                        userClan.controlledTerritories.push(territory.name);
                    }
                    if (enemyClan) {
                        enemyClan.controlledTerritories = enemyClan.controlledTerritories.filter(t => t !== territory.name);

                        // Apply Power Penalty to Defender (Defender Power = Defender Power - Attacker Power)
                        // This means Penalty increases by Attacker Power
                        enemyClan.power_penalty = (enemyClan.power_penalty || 0) + myPower;
                    }

                    await saveJson(TERRITORIES_FILE, territories);
                    await saveJson(CLANS_FILE, clans);

                    await interaction.followUp({ content: `**Victory!** ${userClan.name} has captured ${territory.displayName}!\nThe **${enemyClanName || 'Neutral'}** forces have suffered a crushing defeat!` });
                } else {
                    // Lose
                    // Apply Power Penalty to Attacker? (Attacker Power = Attacker Power - Defender Power)
                    // If the user wants symmetric penalties:
                    // userClan.power_penalty = (userClan.power_penalty || 0) + enemyPower;

                    await interaction.followUp({ content: `**Defeat!** ${userClan.name} failed to capture ${territory.displayName}.` });
                }
            }, 5000);
            return;
        }
    }
}
