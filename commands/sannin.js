const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType,
    PermissionFlagsBits,
    Colors
} = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
const { format } = require('util');

// Configuration
const CONFIG = {
    USERS_PATH: path.resolve(__dirname, '../../menma/data/users.json'),
    SANNIN_ROLE_ID: '1349245907467505755',
    AUTHORIZED_USERS: ['961918563382362122', '835408109899219004'],
    BUFF_MULTIPLIER: 1.5, // Increased from 1 to make it more impactful
    TIMEOUT_DURATION: 300000, // 5 minutes
    MAX_SANNIN: 3,
    LOG_CHANNEL_ID: '123456789012345678',
    ANNOUNCEMENT_CHANNEL_ID: '123456789012345679',
    BACKUP_INTERVAL: 5 // Number of operations between backups
};

// State management
let operationCount = 0;
const activeCeremonies = new Map();

// Utility Functions
async function loadUserData() {
    try {
        const data = await fs.readFile(CONFIG.USERS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('User database not found');
        }
        throw error;
    }
}

async function saveUserData(users) {
    try {
        // Create backup if we've hit the interval
        if (operationCount % CONFIG.BACKUP_INTERVAL === 0) {
            const backupPath = `${CONFIG.USERS_PATH}.bak`;
            await fs.copyFile(CONFIG.USERS_PATH, backupPath);
        }
        
        const tempPath = `${CONFIG.USERS_PATH}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(users, null, 2));
        await fs.rename(tempPath, CONFIG.USERS_PATH);
        operationCount++;
    } catch (error) {
        console.error('Failed to save user data:', error);
        throw error;
    }
}

function createNomineeActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_sannin')
                .setLabel('Accept Sannin Title')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎭'),
            new ButtonBuilder()
                .setCustomId('view_code')
                .setLabel('View Sannin Code')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📜'),
            new ButtonBuilder()
                .setCustomId('view_requirements')
                .setLabel('Requirements')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('decline_title')
                .setLabel('Decline Honor')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✖')
        );
}

function createAdminActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_confirm')
                .setLabel('Finalize Promotion')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚔️'),
            new ButtonBuilder()
                .setCustomId('admin_view_stats')
                .setLabel('View Stats')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊'),
            new ButtonBuilder()
                .setCustomId('admin_cancel')
                .setLabel('Cancel Ceremony')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🛑')
        );
}

async function logAction(guild, action, details, color = Colors.Blurple) {
    try {
        const channel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (channel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(`Sannin System Log: ${action}`)
                .setColor(color)
                .setDescription(details)
                .setTimestamp();
            await channel.send({ embeds: [logEmbed] });
        }
    } catch (error) {
        console.error('Failed to log action:', error);
    }
}

function getSanninCodeEmbed() {
    return new EmbedBuilder()
        .setTitle('The Sacred Code of the Sannin')
        .setColor(Colors.Purple)
        .setDescription(`
**The Sannin Code is the foundation of our village's survival. These laws are absolute and inviolable.**

1. **Protection Above All**: The Sannin exist first to protect the village and its people. No personal ambition may supersede this duty.

2. **Mentorship**: Each Sannin must take at least one apprentice every five years, ensuring the continuation of our techniques and values.

3. **Judgment**: In matters of village security, the Sannin's word is law. They may override any order except those from the reigning Kage.

4. **Restraint**: Never use more force than necessary. The full might of a Sannin may only be unleashed when facing existential threats.

5. **Legacy**: A Sannin's actions reflect on all who came before them. Dishonorable conduct will result in immediate stripping of title and power.

6. **Succession**: Only three may hold the title at once. Should a fourth prove worthy, the weakest must either voluntarily step down or face trial by combat.

7. **Sacrifice**: When the village is threatened, a Sannin must be willing to give their life without hesitation to protect it.

8. **Knowledge**: All techniques developed by a Sannin must be recorded in the village archives before their death or retirement.

9. **Neutrality**: Sannin must remain above clan politics and village factions, serving only the greater good.

10. **Accountability**: Any Sannin who breaks this code must either commit seppuku or face execution by their peers.

*These laws were first written by the Sage of Six Paths and have remained unchanged for centuries.*
        `)
        .setFooter({ text: 'The Code is absolute - there are no exceptions' });
}

function getRequirementsEmbed() {
    return new EmbedBuilder()
        .setTitle('Path to Becoming a Sannin')
        .setColor(Colors.DarkPurple)
        .setDescription(`
**The road to becoming a Sannin is long and arduous. Few possess the combination of strength, wisdom, and dedication required.**

**Minimum Qualifications:**
- Completion of at least 50 S-rank missions
- Mastery of at least three nature transformations
- Creation of at least one original jutsu
- Successful defense of the village in times of crisis
- Unwavering loyalty demonstrated over decades of service

**Evaluation Criteria:**
1. **Combat Prowess**: Must be among the top 0.1% of all shinobi
2. **Strategic Mind**: Ability to lead large-scale operations
3. **Moral Character**: Impeccable judgment and self-control
4. **Teaching Ability**: Proven capacity to mentor others
5. **Village Contribution**: Significant impact on village security and prosperity

**The Selection Process:**
1. Nomination by the Hokage or unanimous vote of current Sannin
2. Review by the Jonin Council
3. Trial by combat against at least one current Sannin
4. Final approval by the Daimyo

*The entire process typically takes no less than six months of intensive evaluation.*
        `)
        .setFooter({ text: 'Few are called, fewer still are chosen' });
}

function createStatsEmbed(userData, targetUser) {
    return new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Current Stats`)
        .setColor(Colors.Gold)
        .addFields(
            { name: 'Health', value: userData.health.toLocaleString(), inline: true },
            { name: 'Power', value: userData.power.toLocaleString(), inline: true },
            { name: 'Defense', value: userData.defense.toLocaleString(), inline: true },
            { name: 'Chakra', value: userData.chakra.toLocaleString(), inline: true },
            { name: 'Speed', value: userData.speed.toLocaleString(), inline: true },
            { name: 'Current Role', value: userData.role || 'Unknown', inline: true }
        )
        .setFooter({ text: 'Stats before Sannin transformation' });
}

// Main Command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sannin')
        .setDescription('Appoint a user as one of the legendary Sannin')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The shinobi worthy of becoming a Sannin')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for this promotion')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Defer reply to give more time for processing
        await interaction.deferReply({ ephemeral: true });

        try {
            // Authorization Check
            if (!CONFIG.AUTHORIZED_USERS.includes(interaction.user.id)) {
                await logAction(
                    interaction.guild, 
                    'Unauthorized Access', 
                    `${interaction.user} attempted to use the Sannin command without authorization`,
                    Colors.Red
                );
                return interaction.editReply({
                    content: 'Only the Hokage and ANBU Commander can perform this sacred ritual.'
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const guild = interaction.guild;

            // Validation Checks
            if (targetUser.bot) {
                await logAction(
                    interaction.guild, 
                    'Invalid Target', 
                    `${interaction.user} attempted to promote a bot to Sannin`,
                    Colors.Red
                );
                return interaction.editReply({
                    content: 'Machines cannot become Sannin. Only living shinobi may ascend.'
                });
            }

            // Check for existing ceremony
            if (activeCeremonies.has(targetUser.id)) {
                return interaction.editReply({
                    content: 'There is already an active Sannin ceremony for this user.'
                });
            }

            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                await logAction(
                    interaction.guild, 
                    'Target Not Found', 
                    `${interaction.user} attempted to promote ${targetUser} who isn't in the server`,
                    Colors.Red
                );
                return interaction.editReply({
                    content: 'The target shinobi could not be found within our village.'
                });
            }

            // Check if already Sannin
            if (member.roles.cache.has(CONFIG.SANNIN_ROLE_ID)) {
                return interaction.editReply({
                    content: 'This shinobi already holds the Sannin title.'
                });
            }

            // Load User Data
            let users;
            try {
                users = await loadUserData();
            } catch (error) {
                console.error('Error loading user data:', error);
                await logAction(
                    interaction.guild, 
                    'Database Error', 
                    'Failed to access user database during Sannin promotion',
                    Colors.Red
                );
                return interaction.editReply({
                    content: 'The village archives are currently inaccessible. Please try again later.'
                });
            }

            const userData = users[targetUser.id];
            if (!userData) {
                await logAction(
                    interaction.guild, 
                    'Unregistered User', 
                    `${interaction.user} attempted to promote unregistered user ${targetUser}`,
                    Colors.Red
                );
                return interaction.editReply({
                    content: 'This shinobi is not registered in our village records.'
                });
            }

            // Check Existing Sannin Count
            const currentSannin = Object.values(users).filter(u => u.role === 'Sannin').length;
            if (currentSannin >= CONFIG.MAX_SANNIN) {
                await logAction(
                    interaction.guild, 
                    'Sannin Limit Reached', 
                    `${interaction.user} attempted to exceed Sannin limit`,
                    Colors.Orange
                );
                return interaction.editReply({
                    content: `There can only be ${CONFIG.MAX_SANNIN} Sannin at any time. One must step down before another can ascend.`
                });
            }

            // Register active ceremony
            const ceremonyId = `${interaction.id}-${targetUser.id}`;
            activeCeremonies.set(targetUser.id, ceremonyId);

            // Main Ceremony Embeds
            const ceremonyEmbed = new EmbedBuilder()
                .setTitle('The Sacred Sannin Ascension Ceremony')
                .setColor(Colors.DarkPurple)
                .setDescription(`
**By the ancient laws of our village, we gather today to witness the ascension of a new Sannin.**

Before us stands ${targetUser}, a shinobi who has proven themselves worthy through countless battles and unwavering dedication to our village. The path to becoming a Sannin is paved with sacrifice, and few possess the strength to walk it.

**Promotion Reason:**
${reason}

**What this promotion entails:**
- A ${CONFIG.BUFF_MULTIPLIER.toLocaleString()}x multiplier to all combat statistics
- The legendary Sannin title and accompanying role
- Access to forbidden techniques and secret knowledge
- A permanent place in the annals of our village's history
- The heavy burden of responsibility that comes with such power

**Ceremony Process:**
1. The nominee must accept the title and its responsibilities
2. The Hokage must confirm the appointment
3. The transformation ritual will be performed
4. The new Sannin will be announced to the village

*This ritual will expire in ${CONFIG.TIMEOUT_DURATION / 60000} minutes if no action is taken.*
                `)
                .setFooter({
                    text: `Ceremony conducted by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            const nomineeEmbed = new EmbedBuilder()
                .setTitle('You Have Been Nominated for Sannin')
                .setColor(Colors.Purple)
                .setDescription(`
**${targetUser},**

${interaction.user} has deemed you worthy of becoming one of the legendary Sannin. This is the highest honor our village can bestow upon a shinobi.

**Reason for nomination:**
${reason}

**Before you decide, consider carefully:**
- This will multiply your abilities ${CONFIG.BUFF_MULTIPLIER.toLocaleString()} times
- You will bear responsibilities beyond those of normal shinobi
- Your actions will reflect on the entire village
- The title is permanent unless you violate the Sannin Code

**You must now choose:**
- Accept this honor and its burdens
- Review the Sannin Code in detail
- Decline the nomination (this decision cannot be undone)

*You have ${CONFIG.TIMEOUT_DURATION / 60000} minutes to make your choice.*
                `)
                .setFooter({
                    text: 'This decision will shape your destiny',
                    iconURL: guild.iconURL()
                })
                .setTimestamp();

            // Send Initial Messages
            const adminMessage = await interaction.channel.send({
                embeds: [ceremonyEmbed],
                components: [createAdminActionRow()]
            });

            let nomineeMessage;
            try {
                nomineeMessage = await targetUser.send({
                    embeds: [nomineeEmbed],
                    components: [createNomineeActionRow()]
                });
            } catch (dmError) {
                console.error('Failed to DM nominee:', dmError);
                activeCeremonies.delete(targetUser.id);
                await interaction.editReply({
                    content: `Could not send the nomination to ${targetUser}. They may have DMs disabled.`
                });
                await adminMessage.edit({
                    components: []
                });
                return;
            }

            // Successfully started ceremony
            await interaction.editReply({
                content: `The Sannin ceremony for ${targetUser} has begun.`
            });

            // Button Collectors
            const adminCollector = adminMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: CONFIG.TIMEOUT_DURATION,
                filter: i => i.user.id === interaction.user.id
            });

            const nomineeCollector = nomineeMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: CONFIG.TIMEOUT_DURATION,
                filter: i => i.user.id === targetUser.id
            });

            let nomineeAccepted = false;
            let adminConfirmed = false;

            // Nominee Collector
            nomineeCollector.on('collect', async i => {
                try {
                    if (i.customId === 'confirm_sannin') {
                        nomineeAccepted = true;
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Nomination Accepted')
                                    .setColor(Colors.Green)
                                    .setDescription(`
You have accepted the nomination to become a Sannin. 

The final decision now rests with ${interaction.user}. 

Should they confirm your appointment, your transformation will begin immediately.
                                    `)
                                    .setFooter({
                                        text: 'Awaiting final confirmation',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        await interaction.followUp({
                            content: `${targetUser} has accepted the Sannin nomination. Use the buttons below to finalize or cancel the ceremony.`,
                            ephemeral: true
                        });

                        if (nomineeAccepted && adminConfirmed) {
                            await completeCeremony();
                        }
                    }
                    else if (i.customId === 'view_code') {
                        await i.reply({
                            embeds: [getSanninCodeEmbed()],
                            ephemeral: true
                        });
                    }
                    else if (i.customId === 'view_requirements') {
                        await i.reply({
                            embeds: [getRequirementsEmbed()],
                            ephemeral: true
                        });
                    }
                    else if (i.customId === 'decline_title') {
                        nomineeCollector.stop();
                        adminCollector.stop();
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Nomination Declined')
                                    .setColor(Colors.Red)
                                    .setDescription(`
You have chosen to decline the Sannin title. 

This decision is final and cannot be undone. 

The ceremony has been concluded.
                                    `)
                                    .setFooter({
                                        text: 'The path not taken',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        await adminMessage.edit({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Ceremony Concluded')
                                    .setColor(Colors.Red)
                                    .setDescription(`
${targetUser} has declined the Sannin title. 

The ceremony has been cancelled.
                                    `)
                                    .setFooter({
                                        text: 'Nomination rejected',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        await logAction(
                            guild, 
                            'Nomination Declined', 
                            `${targetUser} declined the Sannin nomination from ${interaction.user}`,
                            Colors.Red
                        );
                    }
                } catch (error) {
                    console.error('Nominee interaction error:', error);
                }
            });

            // Admin Collector
            adminCollector.on('collect', async i => {
                try {
                    if (i.customId === 'admin_confirm') {
                        if (!nomineeAccepted) {
                            await i.reply({
                                content: 'The nominee has not yet accepted the title. Please wait for their decision.',
                                ephemeral: true
                            });
                            return;
                        }

                        adminConfirmed = true;
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Final Confirmation')
                                    .setColor(Colors.Green)
                                    .setDescription(`
You have confirmed ${targetUser}'s appointment as Sannin. 

The transformation ritual will now commence.
                                    `)
                                    .setFooter({
                                        text: 'Ceremony in progress',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        if (nomineeAccepted && adminConfirmed) {
                            await completeCeremony();
                        }
                    }
                    else if (i.customId === 'admin_view_stats') {
                        await i.reply({
                            embeds: [createStatsEmbed(userData, targetUser)],
                            ephemeral: true
                        });
                    }
                    else if (i.customId === 'admin_cancel') {
                        adminCollector.stop();
                        nomineeCollector.stop();
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Ceremony Cancelled')
                                    .setColor(Colors.Red)
                                    .setDescription(`
You have cancelled the Sannin appointment ceremony. 

${targetUser} will not receive the promotion at this time.
                                    `)
                                    .setFooter({
                                        text: 'Ceremony aborted',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        await nomineeMessage.edit({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Ceremony Cancelled')
                                    .setColor(Colors.Red)
                                    .setDescription(`
${interaction.user} has cancelled your Sannin nomination. 

The ceremony has been concluded.
                                    `)
                                    .setFooter({
                                        text: 'Nomination withdrawn',
                                        iconURL: guild.iconURL()
                                    })
                            ],
                            components: []
                        });

                        await logAction(
                            guild, 
                            'Ceremony Cancelled', 
                            `${interaction.user} cancelled the Sannin nomination for ${targetUser}`,
                            Colors.Red
                        );
                    }
                } catch (error) {
                    console.error('Admin interaction error:', error);
                }
            });

            // Complete Ceremony Function
            async function completeCeremony() {
                try {
                    // Apply Sannin Transformation
                    const newStats = {
                        health: Math.floor(userData.health * CONFIG.BUFF_MULTIPLIER),
                        power: Math.floor(userData.power * CONFIG.BUFF_MULTIPLIER),
                        defense: Math.floor(userData.defense * CONFIG.BUFF_MULTIPLIER),
                        chakra: Math.floor(userData.chakra * CONFIG.BUFF_MULTIPLIER),
                        speed: Math.floor(userData.speed * CONFIG.BUFF_MULTIPLIER)
                    };

                    Object.assign(userData, newStats);
                    userData.role = 'Sannin';
                    userData.sanninSince = new Date().toISOString();

                    await saveUserData(users);
                    await member.roles.add(CONFIG.SANNIN_ROLE_ID);

                    // Success Embeds
                    const adminSuccessEmbed = new EmbedBuilder()
                        .setTitle('Sannin Transformation Complete')
                        .setColor(Colors.Green)
                        .setDescription(`
**The ritual is complete!**

${targetUser} has officially ascended to the rank of Sannin. 

Their powers have been magnified ${CONFIG.BUFF_MULTIPLIER.toLocaleString()} times beyond normal limits.

**New Statistics:**
- Health: ${newStats.health.toLocaleString()} (▲ ${(newStats.health - userData.health).toLocaleString()})
- Power: ${newStats.power.toLocaleString()} (▲ ${(newStats.power - userData.power).toLocaleString()})
- Defense: ${newStats.defense.toLocaleString()} (▲ ${(newStats.defense - userData.defense).toLocaleString()})
- Chakra: ${newStats.chakra.toLocaleString()} (▲ ${(newStats.chakra - userData.chakra).toLocaleString()})
- Speed: ${newStats.speed.toLocaleString()} (▲ ${(newStats.speed - userData.speed).toLocaleString()})

The village has gained a new legendary protector.
                        `)
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setFooter({
                            text: 'A new era begins',
                            iconURL: guild.iconURL()
                        })
                        .setTimestamp();

                    const nomineeSuccessEmbed = new EmbedBuilder()
                        .setTitle('Your Transformation is Complete')
                        .setColor(Colors.Purple)
                        .setDescription(`
**Welcome to the ranks of the Sannin, ${targetUser.username}!**

The ritual has successfully enhanced your abilities ${CONFIG.BUFF_MULTIPLIER.toLocaleString()} times beyond their previous limits.

**Your New Powers:**
- **Combat Prowess**: Increased beyond human limits
- **Vitality**: Wounds heal almost instantly
- **Chakra Reserves**: Nearly inexhaustible
- **Battle Speed**: Comparable to teleportation
- **Sensory Abilities**: Can detect threats miles away

**Responsibilities Begin Immediately:**
1. Report to the Hokage for your first assignment
2. Review the Sannin Archives
3. Begin considering potential apprentices
4. Attend the next War Council meeting

Remember - with great power comes even greater responsibility.
                        `)
                        .addFields(
                            {
                                name: 'Your New Statistics',
                                value: format(`
Health: ${newStats.health.toLocaleString()} (▲ ${(newStats.health - userData.health).toLocaleString()})
Power: ${newStats.power.toLocaleString()} (▲ ${(newStats.power - userData.power).toLocaleString()})
Defense: ${newStats.defense.toLocaleString()} (▲ ${(newStats.defense - userData.defense).toLocaleString()})
Chakra: ${newStats.chakra.toLocaleString()} (▲ ${(newStats.chakra - userData.chakra).toLocaleString()})
Speed: ${newStats.speed.toLocaleString()} (▲ ${(newStats.speed - userData.speed).toLocaleString()})
                                `)
                            },
                            {
                                name: 'Important Reminder',
                                value: 'There can only be three Sannin at any time. Should another rise, the weakest among you must step down or be removed.'
                            }
                        )
                        .setFooter({
                            text: 'Your legend begins today',
                            iconURL: guild.iconURL()
                        })
                        .setTimestamp();

                    // Update Messages
                    await adminMessage.edit({
                        embeds: [adminSuccessEmbed],
                        components: []
                    });

                    await nomineeMessage.edit({
                        embeds: [nomineeSuccessEmbed],
                        components: []
                    });

                    // Announce to Server
                    const announcementEmbed = new EmbedBuilder()
                        .setTitle('A New Sannin Rises!')
                        .setColor(Colors.Gold)
                        .setDescription(`
**Villagers, rejoice!**

Today we celebrate the ascension of ${targetUser} to the legendary rank of Sannin!

After demonstrating unparalleled skill and dedication to our village, they have undergone the ancient transformation ritual and emerged with power beyond mortal limits.

**Reason for promotion:**
${reason}

All hail our new protector!
                        `)
                        .setImage('https://i.imgur.com/KjyYl5a.png')
                        .setFooter({
                            text: 'A historic day for our village',
                            iconURL: guild.iconURL()
                        })
                        .setTimestamp();

                    const announcementChannel = guild.channels.cache.get(CONFIG.ANNOUNCEMENT_CHANNEL_ID);
                    if (announcementChannel) {
                        await announcementChannel.send({
                            content: '@everyone',
                            embeds: [announcementEmbed]
                        });
                    }

                    await logAction(
                        guild, 
                        'New Sannin Appointed', 
                        `${targetUser} was promoted to Sannin by ${interaction.user}\nReason: ${reason}`,
                        Colors.Green
                    );

                } catch (error) {
                    console.error('Ceremony completion error:', error);
                    await interaction.followUp({
                        content: 'A grave error occurred during the transformation ritual. The sages must be consulted immediately.',
                        ephemeral: true
                    });
                    await logAction(
                        guild, 
                        'Ceremony Failed', 
                        `The Sannin promotion for ${targetUser} failed due to an error: ${error.message}`,
                        Colors.Red
                    );
                } finally {
                    activeCeremonies.delete(targetUser.id);
                }
            }

            // Timeout Handling
            nomineeCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    nomineeMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Nomination Expired')
                                .setColor(Colors.Orange)
                                .setDescription('You did not respond to the Sannin nomination in time.')
                                .setFooter({
                                    text: 'Opportunity lost',
                                    iconURL: guild.iconURL()
                                })
                        ],
                        components: []
                    }).catch(console.error);
                }
                activeCeremonies.delete(targetUser.id);
            });

            adminCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    adminMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Ceremony Expired')
                                .setColor(Colors.Orange)
                                .setDescription('The ritual energies have dissipated due to inactivity.')
                                .setFooter({
                                    text: 'No action was taken in time',
                                    iconURL: guild.iconURL()
                                })
                        ],
                        components: []
                    }).catch(console.error);
                }
                activeCeremonies.delete(targetUser.id);
            });

        } catch (error) {
            console.error('Sannin command error:', error);
            await interaction.editReply({
                content: 'A grave error has disrupted the ceremony. The sages must be consulted.'
            });
            await logAction(
                interaction.guild, 
                'System Failure', 
                `The Sannin command failed due to an error: ${error.message}`,
                Colors.Red
            );
            activeCeremonies.delete(targetUser.id);
        }
    }
};