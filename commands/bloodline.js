const {
	SlashCommandBuilder,
	ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { userMutex } = require('../utils/locks');

// Path setup
const dataPath = path.resolve(__dirname, '../../menma/data');
const usersPath = path.join(dataPath, 'users.json');
const playersPath = path.join(dataPath, 'players.json');
const shrineGif = 'https://static.wikia.nocookie.net/naruto/images/7/76/Naka_Shrine.png/revision/latest/scale-to-width-down/1200?cb=20150816111302';

// Bloodline data
const BLOODLINES = {
	'Uchiha': {
		title: 'Sharingan',
		description: 'Unlocks the Sharingan, the Uchiha clan\'s legendary ocular power.',
		cost: 100000,
		emoji: '<:uchiha:1396464893183393814>',
		shrine: shrineGif
	},
	'Hyuga': {
		title: 'Byakugan',
		description: 'Grants the ability to see chakra points and exhaust enemy energy.',
		cost: 100000,
		emoji: '<:hyuga:1396465419589517466>',
		shrine: shrineGif
	},
	'Uzumaki': {
		title: 'Uzumaki Will',
		description: 'Grants immense vitality and the power to survive lethal strikes.',
		cost: 100000,
		emoji: '<:uzumaki:1396465034548350997>',
		shrine: shrineGif
	},
	'Senju': {
		title: 'Hyper Regeneration',
		description: 'Grants incredible passive healing and physical endurance.',
		cost: 100000,
		emoji: '<:senju:1396465123589099623>',
		shrine: shrineGif
	},
	'Nara': {
		title: 'Battle IQ',
		description: 'Unmatched tactical prowess and shadow manipulation energy.',
		cost: 100000,
		emoji: '<:nara:1396465561189355742>',
		shrine: shrineGif
	}
};

const REMOVAL_COST = 250000;
const SHRINE_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours

module.exports = {
	BLOODLINES,
	data: new SlashCommandBuilder()
		.setName('bloodline')
		.setDescription('Manage your ninja bloodline abilities'),

	async execute(interaction) {
		const userId = interaction.user.id;

		await userMutex.runExclusive(async () => {
			const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
			const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

			if (!users[userId] || !players[userId]) {
				return interaction.reply({ content: "You must enroll first!", ephemeral: true });
			}

			const user = users[userId];

			// Tutorial check
			if (!user.bloodlineTuto) {
				return await this.handleTutorial(interaction, userId);
			}

			await this.showMainUI(interaction, userId);
		});
	},

	async showMainUI(interaction, userId, followUp = false) {
		const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
		const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
		const user = users[userId];
		const player = players[userId];

		const embed = new EmbedBuilder()
			.setTitle('Bloodline Management')
			.setColor(0x9b59b6)
			.setThumbnail(interaction.user.displayAvatarURL())
			.setDescription('Manage your bloodline abilities at the Shrine.');

		let statusText = `**Current Bloodline:** ${user.bloodline || 'None'}`;
		if (user.bloodline_pending) {
			statusText += `\n**Awakening In Progress:** ${user.bloodline_pending}\n**Progress:** ${user.bloodline_shrine_visits || 0}/${user.bloodline_shrine_visits_needed} Shrine Visits`;
		}

		embed.addFields({ name: 'Status', value: statusText });

		const row = new ActionRowBuilder();

		// Awaken Button
		const canAwaken = !user.bloodline && !user.bloodline_pending;
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`bl_menu_awaken_${userId}`)
				.setLabel('Awaken')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!canAwaken)
		);

		// Shrine Button
		const canShrine = !!user.bloodline_pending;
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`bl_menu_shrine_${userId}`)
				.setLabel('Visit Shrine')
				.setStyle(ButtonStyle.Success)
				.setDisabled(!canShrine)
		);

		// Remove Button
		const canRemove = !!user.bloodline;
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`bl_menu_remove_${userId}`)
				.setLabel('Remove')
				.setStyle(ButtonStyle.Danger)
				.setDisabled(!canRemove)
		);

		const response = followUp
			? await interaction.followUp({ embeds: [embed], components: [row] })
			: await interaction.reply({ embeds: [embed], components: [row] });

		const collector = response.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async i => {
			if (i.user.id !== userId) return i.reply({ content: "This isn't your menu!", ephemeral: true });

			if (i.customId.startsWith('bl_menu_awaken')) {
				await this.showAwakenMenu(i, userId);
			} else if (i.customId.startsWith('bl_menu_shrine')) {
				await this.handleShrine(i, userId);
			} else if (i.customId.startsWith('bl_menu_remove')) {
				await this.handleRemove(i, userId);
			}
			collector.stop();
		});
	},

	async showAwakenMenu(interaction, userId) {
		const embed = new EmbedBuilder()
			.setTitle('Select Bloodline to Awaken')
			.setColor(0x9b59b6)
			.setDescription('Choose a bloodline to begin your awakening. This requires 100,000 Ryo and multiple shrine visits.');

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`bl_select_${userId}`)
			.setPlaceholder('Choose your bloodline.')
			.addOptions(Object.entries(BLOODLINES).map(([name, data]) => ({
				label: name,
				description: data.title,
				value: name,
				emoji: data.emoji.match(/\d+/)[0] // Extract ID from emoji string
			})));

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const response = await interaction.update({ embeds: [embed], components: [row] });

		const collector = response.createMessageComponentCollector({ time: 30000 });

		collector.on('collect', async i => {
			if (i.user.id !== userId) return i.reply({ content: "Not yours!", ephemeral: true });

			const selected = i.values[0];
			await this.handleAwakenChoice(i, userId, selected);
			collector.stop();
		});
	},

	async handleAwakenChoice(interaction, userId, bloodline) {
		await userMutex.runExclusive(async () => {
			const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
			const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
			const user = users[userId];
			const player = players[userId];

			if (player.money < BLOODLINES[bloodline].cost) {
				return interaction.update({
					content: `You need ${BLOODLINES[bloodline].cost.toLocaleString()} Ryo to begin awakening ${bloodline}!`,
					embeds: [],
					components: []
				});
			}

			const visitsNeeded = Math.floor(Math.random() * 10) + 1;
			users[userId].bloodline_pending = bloodline;
			users[userId].bloodline_shrine_visits_needed = visitsNeeded;
			users[userId].bloodline_shrine_visits = 0;

			fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

			await interaction.update({
				content: `You have chosen to awaken the **${bloodline}** bloodline! You must visit its shrine **${visitsNeeded}** times to complete the ritual.`,
				embeds: [],
				components: []
			});

			// Re-show main UI as follow-up
			await this.showMainUI(interaction, userId, true);
		});
	},

	async handleShrine(interaction, userId) {
		await userMutex.runExclusive(async () => {
			const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
			const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
			const user = users[userId];
			const player = players[userId];

			const pending = user.bloodline_pending;
			if (!pending) return interaction.update({ content: "No pending bloodline.", components: [], embeds: [] });

			const now = Date.now();
			if (user.lastShrineVisit && now - user.lastShrineVisit < SHRINE_COOLDOWN) {
				const remainingRaw = SHRINE_COOLDOWN - (now - user.lastShrineVisit);
				const hours = Math.floor(remainingRaw / (1000 * 60 * 60));
				const mins = Math.floor((remainingRaw % (1000 * 60 * 60)) / (1000 * 60));
				return interaction.reply({
					content: `The shrine is closed... Come back in ${hours}h ${mins}m.`,
					ephemeral: true
				});
			}

			user.bloodline_shrine_visits = (user.bloodline_shrine_visits || 0) + 1;
			user.lastShrineVisit = now;

			let message = `You pray at the ${BLOODLINES[pending].emoji} **${pending}** shrine. (${user.bloodline_shrine_visits}/${user.bloodline_shrine_visits_needed})`;
			let bonusText = "";

			// Chance to reset cooldowns
			if (Math.random() < 0.4) {
				const cooldownKeys = ['lastdrank', 'lastbrank', 'lastsrank', 'lastArank'];
				const activeCDs = cooldownKeys.filter(k => user[k]);
				if (activeCDs.length > 0) {
					const randomCD = activeCDs[Math.floor(Math.random() * activeCDs.length)];
					user[randomCD] = null;
					bonusText = `\n A cute elf resets your **${randomCD.replace('last', '').toUpperCase()}** cooldown!`;
				}
			}

			if (user.bloodline_shrine_visits >= user.bloodline_shrine_visits_needed) {
				player.money -= BLOODLINES[pending].cost;
				user.bloodline = pending;
				user.bloodline_pending = null;
				user.bloodline_shrine_visits = null;
				user.bloodline_shrine_visits_needed = null;

				message = `**Ritual Complete!** You have awakened the ${BLOODLINES[pending].emoji} **${pending}** bloodline!\n${BLOODLINES[pending].description}`;
			}

			fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
			fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

			const embed = new EmbedBuilder()
				.setTitle('Shrine Visit')
				.setDescription(`${message}${bonusText}`)
				.setImage(BLOODLINES[pending].shrine)
				.setColor(0x8B4513);

			await interaction.update({ embeds: [embed], components: [] });
			await this.showMainUI(interaction, userId, true);
		});
	},

	async handleRemove(interaction, userId) {
		await userMutex.runExclusive(async () => {
			const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
			const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
			const user = users[userId];
			const player = players[userId];

			if (!user.bloodline) return interaction.update({ content: "No bloodline to remove.", embeds: [], components: [] });

			if (player.money < REMOVAL_COST) {
				return interaction.reply({ content: `Removing a bloodline costs ${REMOVAL_COST.toLocaleString()} Ryo.`, ephemeral: true });
			}

			const oldBl = user.bloodline;
			player.money -= REMOVAL_COST;
			user.bloodline = null;

			fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
			fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));

			await interaction.update({
				content: `You have severed your connection with the **${oldBl}** bloodline for ${REMOVAL_COST.toLocaleString()} Ryo.`,
				embeds: [],
				components: []
			});
			await this.showMainUI(interaction, userId, true);
		});
	},

	async handleTutorial(interaction, userId) {
		// Find Asuma helper or use standard reply if not found
		const embed = new EmbedBuilder()
			.setTitle('**Bloodlines Tutorial**')
			.setColor(0x9b59b6)
			.setDescription("**Asuma:** Welcome, kid. Bloodlines are rare traits passed through generations. Awakening one requires you to do the following steps.")
			.addFields(
				{ name: '1. Awakening', value: 'If its your first time, you must remove your `Unknown Bloodline` first.\nThen Awakening Costs 100,000 Ryo. You must visit a shrine multiple times to complete the ritual.' },
				{ name: '2. The Shrine', value: 'Visiting a shrine has a cooldown but has a chance to reset your cooldowns.' },
				{ name: '3. Removal', value: `Costs ${REMOVAL_COST.toLocaleString()} Ryo. You can only possess one bloodline at a time.` }
			);

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`bl_tuto_finish_${userId}`)
				.setLabel('Begin Journey')
				.setStyle(ButtonStyle.Success)
		);

		const response = await interaction.reply({ embeds: [embed], components: [row] });

		const collector = response.createMessageComponentCollector({ time: 60000 });
		collector.on('collect', async i => {
			if (i.user.id !== userId) return;

			await userMutex.runExclusive(async () => {
				const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
				users[userId].bloodlineTuto = true;
				fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
			});

			await i.update({ content: "Good luck with your awakening.", embeds: [], components: [] });
			await this.showMainUI(i, userId, true);
			collector.stop();
		});
	}
};