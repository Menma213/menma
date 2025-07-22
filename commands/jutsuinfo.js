const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const jutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jutsuinfo')
        .setDescription('Get detailed info about a jutsu.')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Name of the jutsu')
                .setRequired(true)
        ),
    async execute(interaction) {
        const name = interaction.options.getString('name');
        const jutsus = JSON.parse(fs.readFileSync(jutsusPath, 'utf8'));
        // Try exact match, then case-insensitive match
        let jutsu = jutsus[name] || Object.values(jutsus).find(j => j.name.toLowerCase() === name.toLowerCase());
        if (!jutsu) {
            await interaction.reply({ content: 'Jutsu not found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(jutsu.name)
            .setDescription(jutsu.info || 'No description.')
            .setColor(0x2ecc71);

        if (jutsu.chakraCost !== undefined)
            embed.addFields({ name: 'Chakra Cost', value: String(jutsu.chakraCost), inline: true });

        // Effects summary
        if (Array.isArray(jutsu.effects)) {
            let effectsDesc = jutsu.effects.map(e => {
                let effectStr = `• **Type:** ${e.type}`;
                if (e.formula) effectStr += `\n   • Formula: \`${e.formula}\``;
                if (e.stats) effectStr += `\n   • Stats: \`${JSON.stringify(e.stats)}\``;
                if (e.status) effectStr += `\n   • Status: \`${e.status}\``;
                if (e.duration) effectStr += `\n   • Duration: ${e.duration}`;
                if (e.chance !== undefined) effectStr += `\n   • Chance: ${e.chance * 100}%`;
                if (e.damagePerTurn) effectStr += `\n   • Damage/Turn: \`${e.damagePerTurn}\``;
                if (e.amount !== undefined) effectStr += `\n   • Amount: ${e.amount}`;
                return effectStr;
            }).join('\n\n');
            embed.addFields({ name: 'Effects', value: effectsDesc });
        }

        if (jutsu.image_url) embed.setImage(jutsu.image_url);

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};
