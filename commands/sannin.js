const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { format } = require('util');

// Constants
const CONFIG = {
    USERS_PATH: path.resolve(__dirname, '../../menma/data/users.json'),
    SANNIN_ROLE_ID: '1349245907467505755',
    AUTHORIZED_USERS: ['961918563382362122', '835408109899219004'],
    BUFF_MULTIPLIER: 1,
    TIMEOUT_DURATION: 300000, // 5 minutes
    MAX_SANNIN: 3,
    LOG_CHANNEL_ID: '123456789012345678' // Your logging channel ID
};

// Utility Functions
function loadUserData() {
    if (!fs.existsSync(CONFIG.USERS_PATH)) {
        throw new Error('User database not found');
    }
    return JSON.parse(fs.readFileSync(CONFIG.USERS_PATH, 'utf8'));
}

function saveUserData(users) {
    fs.writeFileSync(CONFIG.USERS_PATH, JSON.stringify(users, null, 2));
}

function createActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_sannin')
                .setLabel('Accept Sannin Title')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('view_code')
                .setLabel('View Sannin Code')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('view_requirements')
                .setLabel('View Requirements')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('decline_title')
                .setLabel('Decline Honor')
                .setStyle(ButtonStyle.Danger)
        );
}

function createAdminActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_confirm')
                .setLabel('Finalize Promotion')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_view_code')
                .setLabel('Review Sannin Code')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_cancel')
                .setLabel('Cancel Ceremony')
                .setStyle(ButtonStyle.Danger)
        );
}

async function logAction(guild, action, details) {
    const channel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (channel) {
        const logEmbed = new EmbedBuilder()
            .setTitle(`Sannin System Log: ${action}`)
            .setColor(0x7289DA)
            .setDescription(details)
            .setTimestamp();
        await channel.send({ embeds: [logEmbed] });
    }
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Authorization Check
            if (!CONFIG.AUTHORIZED_USERS.includes(interaction.user.id)) {
                await logAction(interaction.guild, 'Unauthorized Access', 
                    `${interaction.user} attempted to use the Sannin command without authorization`);
                return interaction.reply({
                    content: 'Only the Hokage and ANBU Commander can perform this sacred ritual.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const guild = interaction.guild;

            // Validation Checks
            if (targetUser.bot) {
                await logAction(interaction.guild, 'Invalid Target', 
                    `${interaction.user} attempted to promote a bot to Sannin`);
                return interaction.reply({
                    content: 'Machines cannot become Sannin. Only living shinobi may ascend.',
                    ephemeral: true
                });
            }

            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                await logAction(interaction.guild, 'Target Not Found', 
                    `${interaction.user} attempted to promote ${targetUser} who isn't in the server`);
                return interaction.reply({
                    content: 'The target shinobi could not be found within our village.',
                    ephemeral: true
                });
            }

            // Load User Data
            let users;
            try {
                users = loadUserData();
            } catch (error) {
                console.error('Error loading user data:', error);
                await logAction(interaction.guild, 'Database Error', 
                    'Failed to access user database during Sannin promotion');
                return interaction.reply({
                    content: 'The village archives are currently inaccessible. Please try again later.',
                    ephemeral: true
                });
            }

            const userData = users[targetUser.id];
            if (!userData) {
                await logAction(interaction.guild, 'Unregistered User', 
                    `${interaction.user} attempted to promote unregistered user ${targetUser}`);
                return interaction.reply({
                    content: 'This shinobi is not registered in our village records.',
                    ephemeral: true
                });
            }

            // Check Existing Sannin Count
            const currentSannin = Object.values(users).filter(u => u.role === 'Sannin').length;
            if (currentSannin >= CONFIG.MAX_SANNIN) {
                await logAction(interaction.guild, 'Sannin Limit Reached', 
                    `${interaction.user} attempted to exceed Sannin limit`);
                return interaction.reply({
                    content: `There can only be ${CONFIG.MAX_SANNIN} Sannin at any time. One must step down before another can ascend.`,
                    ephemeral: true
                });
            }

            // Main Ceremony Embeds
            const ceremonyEmbed = new EmbedBuilder()
                .setTitle('The Sacred Sannin Ascension Ceremony')
                .setColor(0x4B0082)
                .setDescription(`
**By the ancient laws of our village, we gather today to witness the ascension of a new Sannin.**

Before us stands ${targetUser}, a shinobi who has proven themselves worthy through countless battles and unwavering dedication to our village. The path to becoming a Sannin is paved with sacrifice, and few possess the strength to walk it.

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
                .setColor(0x800080)
                .setDescription(`
**${targetUser},**

${interaction.user} has deemed you worthy of becoming one of the legendary Sannin. This is the highest honor our village can bestow upon a shinobi.

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
            const adminMessage = await interaction.reply({
                embeds: [ceremonyEmbed],
                components: [createAdminActionRow()],
                fetchReply: true
            });

            let nomineeMessage;
            try {
                nomineeMessage = await targetUser.send({
                    embeds: [nomineeEmbed],
                    components: [createActionRow()]
                });
            } catch (dmError) {
                console.error('Failed to DM nominee:', dmError);
                await interaction.followUp({
                    content: `Could not send the nomination to ${targetUser}. They may have DMs disabled.`,
                    ephemeral: true
                });
                await adminMessage.edit({
                    components: []
                });
                return;
            }

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
                                    .setColor(0x32CD32)
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
                                    .setColor(0xFF0000)
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
                                    .setColor(0xFF0000)
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

                        await logAction(guild, 'Nomination Declined', 
                            `${targetUser} declined the Sannin nomination from ${interaction.user}`);
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
                                    .setColor(0x32CD32)
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
                    else if (i.customId === 'admin_view_code') {
                        await i.reply({
                            embeds: [getSanninCodeEmbed()],
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
                                    .setColor(0xFF0000)
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
                                    .setColor(0xFF0000)
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

                        await logAction(guild, 'Ceremony Cancelled', 
                            `${interaction.user} cancelled the Sannin nomination for ${targetUser}`);
                    }
                } catch (error) {
                    console.error('Admin interaction error:', error);
                }
            });

            // Complete Ceremony Function
            async function completeCeremony() {
                try {
                    // Apply Sannin Transformation
                    userData.health *= CONFIG.BUFF_MULTIPLIER;
                    userData.power *= CONFIG.BUFF_MULTIPLIER;
                    userData.defense *= CONFIG.BUFF_MULTIPLIER;
                    userData.chakra *= CONFIG.BUFF_MULTIPLIER;
                    userData.speed *= CONFIG.BUFF_MULTIPLIER;
                    userData.role = 'Sannin';
                    userData.sanninSince = new Date().toISOString();

                    saveUserData(users);
                    await member.roles.add(CONFIG.SANNIN_ROLE_ID);

                    // Success Embeds
                    const adminSuccessEmbed = new EmbedBuilder()
                        .setTitle('Sannin Transformation Complete')
                        .setColor(0x32CD32)
                        .setDescription(`
**The ritual is complete!**

${targetUser} has officially ascended to the rank of Sannin. 

Their powers have been magnified ${CONFIG.BUFF_MULTIPLIER.toLocaleString()} times beyond normal limits.

**New Statistics:**
- Health: ${userData.health.toLocaleString()}
- Power: ${userData.power.toLocaleString()}
- Defense: ${userData.defense.toLocaleString()}
- Chakra: ${userData.chakra.toLocaleString()}
- Speed: ${userData.speed.toLocaleString()}

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
                        .setColor(0x9400D3)
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
Health: ${userData.health.toLocaleString()}
Power: ${userData.power.toLocaleString()}
Defense: ${userData.defense.toLocaleString()}
Chakra: ${userData.chakra.toLocaleString()}
Speed: ${userData.speed.toLocaleString()}
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
                        .setColor(0xFFD700)
                        .setDescription(`
**Villagers, rejoice!**

Today we celebrate the ascension of ${targetUser} to the legendary rank of Sannin!

After demonstrating unparalleled skill and dedication to our village, they have undergone the ancient transformation ritual and emerged with power beyond mortal limits.

All hail our new protector!
                        `)
                        .setImage('https://i.imgur.com/KjyYl5a.png')
                        .setFooter({
                            text: 'A historic day for our village',
                            iconURL: guild.iconURL()
                        })
                        .setTimestamp();

                    await guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID)?.send({
                        content: '@everyone',
                        embeds: [announcementEmbed]
                    });

                    await logAction(guild, 'New Sannin Appointed', 
                        `${targetUser} was promoted to Sannin by ${interaction.user}`);

                } catch (error) {
                    console.error('Ceremony completion error:', error);
                    await interaction.followUp({
                        content: 'A grave error occurred during the transformation ritual. The sages must be consulted immediately.',
                        ephemeral: true
                    });
                    await logAction(guild, 'Ceremony Failed', 
                        `The Sannin promotion for ${targetUser} failed due to an error: ${error.message}`);
                }
            }

            // Sannin Code Embed
            function getSanninCodeEmbed() {
                return new EmbedBuilder()
                    .setTitle('The Sacred Code of the Sannin')
                    .setColor(0x4B0082)
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
                    .setFooter({
                        text: 'The Code is absolute - there are no exceptions',
                        iconURL: guild.iconURL()
                    });
            }

            // Requirements Embed
            function getRequirementsEmbed() {
                return new EmbedBuilder()
                    .setTitle('Path to Becoming a Sannin')
                    .setColor(0x800080)
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
                    .setFooter({
                        text: 'Few are called, fewer still are chosen',
                        iconURL: guild.iconURL()
                    });
            }

            // Timeout Handling
            nomineeCollector.on('end', collected => {
                if (collected.size === 0) {
                    nomineeMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Nomination Expired')
                                .setColor(0xFFA500)
                                .setDescription('You did not respond to the Sannin nomination in time.')
                                .setFooter({
                                    text: 'Opportunity lost',
                                    iconURL: guild.iconURL()
                                })
                        ],
                        components: []
                    }).catch(console.error);
                }
            });

            adminCollector.on('end', collected => {
                if (collected.size === 0) {
                    adminMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Ceremony Expired')
                                .setColor(0xFFA500)
                                .setDescription('The ritual energies have dissipated due to inactivity.')
                                .setFooter({
                                    text: 'No action was taken in time',
                                    iconURL: guild.iconURL()
                                })
                        ],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('Sannin command error:', error);
            await interaction.followUp({
                content: 'A grave error has disrupted the ceremony. The sages must be consulted.',
                ephemeral: true
            });
            await logAction(interaction.guild, 'System Failure', 
                `The Sannin command failed due to an error: ${error.message}`);
        }
    }
};