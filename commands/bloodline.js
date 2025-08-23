const { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const shrineGif = 'https://static.wikia.nocookie.net/naruto/images/7/76/Naka_Shrine.png/revision/latest/scale-to-width-down/1200?cb=20150816111302'; // Replace with your shrine GIF URL
// Bloodline data
const BLOODLINES = {
	'Uchiha': {
		title: 'Sharingan',
		description: 'Unlocks the Sharinga, Uchiha clans trademark.',
		cost: 100000,
		emoji: '<:uchiha:1396464893183393814>', // Replace with your emoji ID
		shrine: shrineGif
	},
	'Hyuga': {
		title: 'Byakugan',
		description: 'Has the ability to attack pressure points and drain chakra.',
		cost: 100000,
		emoji: '<:hyuga:1396465419589517466>', // Replace with your emoji ID
		shrine: shrineGif
	},
	'Uzumaki': {
		title: 'Uzumaki Will',
		description: 'Plot armor bloodline.',
		cost: 100000,
		emoji: '<:uzumaki:1396465034548350997>', // Replace with your emoji ID
		shrine: shrineGif
	},
	'Senju': {
		title: 'Hyper Regeneration',
		description: 'Grants incredible healing effects.',
		cost: 100000,
		emoji: '<:senju:1396465123589099623>', // Replace with your emoji ID
		shrine: shrineGif
	},
	'Nara': {
		title: 'Battle IQ',
		description: 'Nobody beats a nara when its about battle iq.',
		cost: 100000,
		emoji: '<:nara:1396465561189355742>', // Replace with your emoji ID
		shrine: shrineGif
	}
};

const REMOVAL_COST = 250000;
const SHRINE_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours in ms

// Helper functions
function loadUserData(userId) {
	const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
	if (!users[userId]) {
		users[userId] = { money: 0, level: 0 };
		fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
	}
	return users[userId];
}

function saveUserData(userId, data) {
	const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
	users[userId] = { ...users[userId], ...data };
	fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

async function getAsumaWebhook(channel) {
	const webhooks = await channel.fetchWebhooks();
	let asumaWebhook = webhooks.find(wh => wh.name === 'Asuma');
	if (!asumaWebhook) {
		asumaWebhook = await channel.createWebhook({
			name: 'Asuma',
			avatar: 'https://pm1.aminoapps.com/7847/98cca195c3bc0047d813f25357661be5f67818b3r1-750-754v2_hq.jpg',
		});
	}
	return asumaWebhook;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bloodline')
		.setDescription('Manage your ninja bloodline abilities')
		.addStringOption(option =>
			option.setName('option')
				.setDescription('Choose an action')
				.setRequired(false)
				.addChoices(
					{ name: 'awaken', value: 'awaken' },
					{ name: 'remove', value: 'remove' },
					{ name: 'shrine', value: 'shrine' }
				)
		)
		.addStringOption(option =>
			option.setName('bloodline')
				.setDescription('Bloodline to awaken')
				.setRequired(false)
				.addChoices(
					{ name: 'Uchiha', value: 'Uchiha' },
					{ name: 'Hyuga', value: 'Hyuga' },
					{ name: 'Uzumaki', value: 'Uzumaki' },
					{ name: 'Senju', value: 'Senju' },
					{ name: 'Nara', value: 'Nara' }
				)
		),

	async execute(interaction) {
		const userId = interaction.user.id;
		const user = loadUserData(userId);

		// Tutorial check
		if (!user.bloodlineTuto) {
			return await this.handleTutorial(interaction);
		}

		const option = interaction.options.getString('option');
		const bloodline = interaction.options.getString('bloodline');

		if (!option) {
			return await this.showBloodlines(interaction);
		}

		if (option === 'awaken') {
			if (user.bloodline) {
				return interaction.reply({
					content: `You already have the ${user.bloodline} bloodline! Use \`/bloodline remove\` first.`,
					ephemeral: true
				});
			}
			if (!bloodline || !BLOODLINES[bloodline]) {
				return interaction.reply({
					content: "Please specify a valid bloodline to awaken.",
					ephemeral: true
				});
			}
			if (user.money < BLOODLINES[bloodline].cost) {
				return interaction.reply({
					content: `You need ${BLOODLINES[bloodline].cost.toLocaleString()} Ryo to awaken the ${bloodline} bloodline!`,
					ephemeral: true
				});
			}
			// Generate random shrine visits needed
			const shrineVisitsNeeded = Math.floor(Math.random() * 10) + 1;
			saveUserData(userId, {
				bloodline_pending: bloodline,
				bloodline_shrine_visits_needed: shrineVisitsNeeded,
				bloodline_shrine_visits: 0
			});
			return interaction.reply({
				content: `To awaken the ${BLOODLINES[bloodline].emoji} **${bloodline}** bloodline, you must visit its shrine **${shrineVisitsNeeded}** times using \`/bloodline option:shrine\`.`,
				ephemeral: false
			});
		}

		if (option === 'shrine') {
			// Only need to check user's pending bloodline
			const pendingBloodline = user.bloodline_pending;
			if (!pendingBloodline || !BLOODLINES[pendingBloodline]) {
				return interaction.reply({
					content: "You are not currently awakening any bloodline. Use `/bloodline option:awaken bloodline:<name>` first.",
					ephemeral: true
				});
			}
			// Shrine cooldown check
			const now = Date.now();
			if (user.lastShrineVisit && now - user.lastShrineVisit < SHRINE_COOLDOWN) {
				const remaining = Math.ceil((SHRINE_COOLDOWN - (now - user.lastShrineVisit)) / (1000 * 60 * 60));
				return interaction.reply({
					content: `You can only visit a shrine once every 2 hours. Please wait ${remaining} more hours.`,
					ephemeral: true
				});
			}
			// Update shrine visit count
			const visits = (user.bloodline_shrine_visits || 0) + 1;
			saveUserData(userId, {
				lastShrineVisit: now,
				bloodline_shrine_visits: visits
			});

			// 40% chance to reset a cooldown
			let bonusText = "Nothing special happened this time.";
			if (Math.random() < 0.4) {
				const cooldowns = ['lastdrank', 'lastbrank', 'lastsrank', 'lastArank'].filter(cd => user[cd]);
			 if (cooldowns.length > 0) {
					const resetCD = cooldowns[Math.floor(Math.random() * cooldowns.length)];
					saveUserData(userId, { [resetCD]: null });
					bonusText = `Your ${resetCD.replace('last', '')} cooldown has been reset!`;
				}
			}

			// Use shrine GIF from bloodline config
			const shrineGif = BLOODLINES[pendingBloodline].shrine;

			const embed = new EmbedBuilder()
				.setTitle(`Visiting the ${pendingBloodline} Shrine`)
				.setDescription(`You pray at the ${BLOODLINES[pendingBloodline].emoji} ${pendingBloodline} shrine and perform the blood ritual.\n\n${bonusText}`)
				.setImage(shrineGif)
				.setColor(0x8B4513); // Brown color for shrine

			if (visits >= user.bloodline_shrine_visits_needed) {
				// Grant bloodline
				saveUserData(userId, {
					bloodline: pendingBloodline,
					bloodline_pending: null,
					bloodline_shrine_visits_needed: null,
					bloodline_shrine_visits: null,
					money: user.money - BLOODLINES[pendingBloodline].cost
				});
				return interaction.reply({
					embeds: [embed],
					content: `Congratulations! You've awakened the ${BLOODLINES[pendingBloodline].emoji} **${pendingBloodline}** bloodline and gained **${BLOODLINES[pendingBloodline].title}**!\n${BLOODLINES[pendingBloodline].description}`,
					ephemeral: false
				});
			} else {
				return interaction.reply({
					embeds: [embed],
					content: `You prayed at the ${BLOODLINES[pendingBloodline].emoji} ${pendingBloodline} shrine. (${visits}/${user.bloodline_shrine_visits_needed} visits)\nKeep visiting until you reach the required number!`,
					ephemeral: false
				});
			}
		}

		if (option === 'remove') {
			if (!user.bloodline) {
				return interaction.reply({
					content: "You don't have a bloodline to remove!",
					ephemeral: true
				});
			}
			// If bloodline is 'unknown', removal is free
			if (user.bloodline === 'unknown') {
				saveUserData(userId, {
					bloodline: null
				});
				return interaction.reply({
					content: `You've removed your unknown bloodline for free.`,
					ephemeral: false
				});
			}
			if (user.money < REMOVAL_COST) {
				return interaction.reply({
					content: `You need ${REMOVAL_COST.toLocaleString()} Ryo to remove your bloodline!`,
					ephemeral: true
				});
			}
			const removedBloodline = user.bloodline;
			saveUserData(userId, {
				bloodline: null,
				money: user.money - REMOVAL_COST
			});
			return interaction.reply({
				content: `You've removed your ${removedBloodline} bloodline for ${REMOVAL_COST.toLocaleString()} Ryo.`,
				ephemeral: false
			});
		}
	},

	async handleTutorial(interaction) {
		const asumaWebhook = await getAsumaWebhook(interaction.channel);

		// Step 1: Introduction
		await asumaWebhook.send({
			content: "**Asuma:** Hold up! Are you here to learn about bloodlines? I'll guide you.",
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId('bloodline_continue_1')
						.setLabel('Continue')
						.setStyle(ButtonStyle.Primary)
				)
			]
		});

		const collector = interaction.channel.createMessageComponentCollector({
			filter: i => i.customId.startsWith('bloodline_continue_') || i.customId === 'bloodline_finish',
			time: 60000
		});

		let step = 1;
		collector.on('collect', async i => {
			await i.deferUpdate();
			step++;
			if (step === 2) {
				await asumaWebhook.send({
					content: "**Asuma:** Bloodlines are a strange awakening that have been passed down the generations. The first ever bloodline was the Otsutsuki Bloodline. It then divided into various bloodlines through Hagoromo and Hamura.",
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId('bloodline_continue_2')
								.setLabel('Continue')
								.setStyle(ButtonStyle.Primary)
						)
					]
				});
			} else if (step === 3) {
				await asumaWebhook.send({
					content: "**Asuma:** But before I give you a history class, I must warn you that awakening a bloodline is not simple! Each bloodline has its own traditions and limits. First, you must prove your loyalty by visiting the bloodline's shrine with `/bloodline shrine`.",
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId('bloodline_continue_3')
								.setLabel('Continue')
								.setStyle(ButtonStyle.Primary)
						)
					]
				});
			} else if (step === 4) {
				await asumaWebhook.send({
					content: "**Asuma:** The tradition involves dropping your blood on Karui Kami, a substance lighter than paper. It moves to check your worth and determines how many shrine visits you need. Also, awakening costs 100,000 Ryo and removing costs 250,000 Ryo. Good luck!",
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId('bloodline_finish')
								.setLabel('Complete')
								.setStyle(ButtonStyle.Success)
						)
					]
				});
			} else if (step === 5 || i.customId === 'bloodline_finish') {
				saveUserData(interaction.user.id, { bloodlineTuto: true });
				await asumaWebhook.send("**Asuma:** You're all set! Use `/bloodline` to get started.");
				collector.stop();
			}
		});
	},

	async showBloodlines(interaction) {
		const user = loadUserData(interaction.user.id);
		const embed = new EmbedBuilder()
			.setTitle(' Available Bloodlines')
			.setDescription('Each bloodline grants unique abilities. Use `/bloodline awaken` to begin.')
			.setColor(0x9b59b6);

		for (const [name, data] of Object.entries(BLOODLINES)) {
			embed.addFields({
				name: `${data.emoji} ${name} - ${data.title}`,
				value: `${data.description}\n**Cost:** ${data.cost.toLocaleString()} Ryo`,
				inline: false
			});
		}

		embed.addFields({
			name: 'Removal Cost',
			value: `${REMOVAL_COST.toLocaleString()} Ryo`,
			inline: true
		});

		await interaction.reply({ embeds: [embed] });
	},

	async handleAwaken(interaction, user) {
		if (user.bloodline) {
			return interaction.reply({
				content: `You already have the ${user.bloodline} bloodline! Use \`/bloodline remove\` first.`,
				ephemeral: true
			});
		}

		await interaction.reply({
			content: "What bloodline are you here to awaken? (Uchiha, Hyuga, Uzumaki, Senju, or Nara)",
			ephemeral: true
		});

		const filter = m => m.author.id === interaction.user.id;
		const collector = interaction.channel.createMessageCollector({ filter, time: 30000 });

		collector.on('collect', async m => {
			const choice = m.content.toLowerCase();
			const bloodline = Object.keys(BLOODLINES).find(bl => bl.toLowerCase() === choice);

			if (!bloodline) {
				await interaction.followUp({
					content: "Invalid bloodline choice. Please try again with a valid bloodline name.",
					ephemeral: true
				});
				return;
			}

			collector.stop();

			const bloodlineData = BLOODLINES[bloodline];
			if (user.money < bloodlineData.cost) {
				return interaction.followUp({
					content: `You need ${bloodlineData.cost.toLocaleString()} Ryo to awaken the ${bloodline} bloodline!`,
					ephemeral: true
				});
			}

			saveUserData(interaction.user.id, {
				bloodline,
				money: user.money - bloodlineData.cost
			});

			await interaction.followUp({
				content: `Congratulations! You've awakened the ${bloodlineData.emoji} **${bloodline}** bloodline and gained **${bloodlineData.title}**!\n${bloodlineData.description}`,
				ephemeral: false
			});
		});
	},

	async handleRemove(interaction, user) {
		if (!user.bloodline) {
			return interaction.reply({
				content: "You don't have a bloodline to remove!",
				ephemeral: true
			});
		}

		// If bloodline is 'unknown', removal is free
		if (user.bloodline === 'unknown') {
			saveUserData(userId, {
				bloodline: null
			});
			return interaction.reply({
				content: `You've removed your unknown bloodline for free.`,
				ephemeral: false
			});
		}
		if (user.money < REMOVAL_COST) {
			return interaction.reply({
				content: `You need ${REMOVAL_COST.toLocaleString()} Ryo to remove your bloodline!`,
				ephemeral: true
			});
		}

		const removedBloodline = user.bloodline;
		saveUserData(interaction.user.id, {
			bloodline: null,
			money: user.money - REMOVAL_COST
		});

		await interaction.reply({
			content: `You've removed your ${removedBloodline} bloodline for ${REMOVAL_COST.toLocaleString()} Ryo.`,
			ephemeral: false
		});
	},

	async handleShrine(interaction, user) {
		const bloodline = interaction.options.getString('bloodline');
		const bloodlineData = BLOODLINES[bloodline];

		// Check cooldown
		const now = Date.now();
		if (user.lastShrineVisit && now - user.lastShrineVisit < SHRINE_COOLDOWN) {
			const remaining = Math.ceil((SHRINE_COOLDOWN - (now - user.lastShrineVisit)) / (1000 * 60 * 60));
			return interaction.reply({
				content: `You can only visit a shrine once every 2 hours. Please wait ${remaining} more hours.`,
				ephemeral: true
			});
		}

		// Update last visit time
		saveUserData(interaction.user.id, { lastShrineVisit: now });

		// 40% chance to reset a cooldown
		const resetCooldown = Math.random() < 0.4;
		let bonusText = "Nothing special happened this time.";

		if (resetCooldown) {
			const cooldowns = ['drank', 'brank', 'srank', 'arank'].filter(cd => user[`last${cd}`]);
			if (cooldowns.length > 0) {
				const resetCD = cooldowns[Math.floor(Math.random() * cooldowns.length)];
				saveUserData(interaction.user.id, { [`last${resetCD}`]: 0 });
				bonusText = `Your ${resetCD} cooldown has been reset!`;
			}
		}

		const embed = new EmbedBuilder()
			.setTitle(`Visiting the ${bloodline} Shrine`)
			.setDescription(`You pray at the ${bloodlineData.emoji} ${bloodline} shrine and perform the blood ritual.\n\n${bonusText}`)
			.setImage(bloodlineData.shrine)
			.setColor(0x8B4513); // Brown color for shrine

		await interaction.reply({ embeds: [embed] });
	}
};