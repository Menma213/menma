const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Paths ---
const usersPath = path.join(__dirname, '../data/users.json');
const anbuPath = path.join(__dirname, '../data/anbu.json');
const accessoriesPath = path.join(__dirname, '../data/accessories.json');
const userAccessoryPath = path.join(__dirname, '../data/userAccessory.json');

// --- Helper Functions ---
function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
    }
    return {};
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
    }
}

// --- Main Command Logic ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('accessory')
        .setDescription('Manage and view your ANBU accessories.')
        .addStringOption(option =>
            option.setName('equip')
                .setDescription('The name of the accessory to equip.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('unequip')
                .setDescription('The name of the accessory to unequip.')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const equipName = interaction.options.getString('equip');
        const unequipName = interaction.options.getString('unequip');

        // 1. ANBU Check
        const anbuData = readJsonFile(anbuPath);
        if (!anbuData.members || !anbuData.members[userId]) {
            return interaction.editReply({ content: 'This command is for ANBU members only.' });
        }

        // 2. Data Loading & Migration
        let usersData = readJsonFile(usersPath);
        let userAccessoryData = readJsonFile(userAccessoryPath);

        // --- Migration Logic ---
        let migrationOccurred = false;
        if (!userAccessoryData[userId] && usersData[userId]?.inventory?.accessories) {
            console.log(`Migrating accessory data for user ${userId}...`);
            migrationOccurred = true;
            userAccessoryData[userId] = {
                inventory: usersData[userId].inventory.accessories || [],
                equipped: usersData[userId].equippedAccessory || null,
                bonusStats: {} // Will be calculated on first equip
            };
            delete usersData[userId].inventory.accessories;
            delete usersData[userId].equippedAccessory;

            writeJsonFile(userAccessoryPath, userAccessoryData);
            writeJsonFile(usersPath, usersData);
        }
        // --- End Migration ---

        const userAcc = userAccessoryData[userId] || { inventory: [], equipped: null, bonusStats: {} };
        const userData = usersData[userId];

        if (!userData) {
            return interaction.editReply({ content: 'You are not registered in the game.' });
        }

        // 3. Equip Logic
        if (equipName) {
            const accessories = readJsonFile(accessoriesPath);
            const accessoryToEquip = accessories.find(acc => acc.name.toLowerCase() === equipName.toLowerCase());

            if (!accessoryToEquip) {
                return interaction.editReply({ content: `Accessory "${equipName}" not found.` });
            }
            if (!userAcc.inventory.some(invAcc => invAcc.toLowerCase() === equipName.toLowerCase())) {
                return interaction.editReply({ content: `You do not own the accessory "${equipName}".` });
            }

            // --- Stat Change Logic ---
            // a) Unequip current item first
            if (userAcc.equipped && userAcc.bonusStats) {
                for (const [stat, value] of Object.entries(userAcc.bonusStats)) {
                    userData[stat] = (userData[stat] || 0) - value;
                }
            }

            // b) Equip new item
            const newBonusStats = accessoryToEquip.stats || {};
            for (const [stat, value] of Object.entries(newBonusStats)) {
                userData[stat] = (userData[stat] || 0) + value;
            }

            // c) Update user accessory data
            userAcc.equipped = accessoryToEquip.name;
            userAcc.bonusStats = newBonusStats;
            userAccessoryData[userId] = userAcc;

            // d) Save files
            writeJsonFile(usersPath, usersData);
            writeJsonFile(userAccessoryPath, userAccessoryData);

            return interaction.editReply({ content: `Successfully equipped **${accessoryToEquip.name}**.` });
        }

        // 4. Unequip Logic
        if (unequipName) {
            if (!userAcc.equipped || userAcc.equipped.toLowerCase() !== unequipName.toLowerCase()) {
                return interaction.editReply({ content: `You do not have "${unequipName}" equipped.` });
            }

            // --- Stat Change Logic ---
            if (userAcc.bonusStats) {
                for (const [stat, value] of Object.entries(userAcc.bonusStats)) {
                    userData[stat] = (userData[stat] || 0) - value;
                }
            }

            const unequippedItemName = userAcc.equipped;
            userAcc.equipped = null;
            userAcc.bonusStats = {};
            userAccessoryData[userId] = userAcc;

            // Save files
            writeJsonFile(usersPath, usersData);
            writeJsonFile(userAccessoryPath, userAccessoryData);

            return interaction.editReply({ content: `Successfully unequipped **${unequippedItemName}**.` });
        }

        // 5. Default Action: Display Inventory
        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Accessories`)
            .setColor(0x808080); // ANBU Grey

        if (userAcc.equipped) {
            const accessories = readJsonFile(accessoriesPath);
            const equippedData = accessories.find(a => a.name === userAcc.equipped);
            let statsText = 'No direct stat boosts.';
            if (equippedData && equippedData.stats) {
                statsText = Object.entries(equippedData.stats)
                    .map(([stat, value]) => `**${stat.charAt(0).toUpperCase() + stat.slice(1)}**: +${value}`)
                    .join('\n');
            }
            embed.addFields({ name: 'Equipped: ' + userAcc.equipped, value: statsText });
        } else {
            embed.addFields({ name: 'Equipped', value: 'None' });
        }

        if (userAcc.inventory.length > 0) {
            embed.addFields({ name: 'Inventory', value: userAcc.inventory.join('\n') });
        } else {
            embed.addFields({ name: 'Inventory', value: 'You do not own any accessories.' });
        }

        let replyOptions = { embeds: [embed] };
        if (migrationOccurred) {
            replyOptions.content = 'Your accessory data has been migrated to the new system!';
        }

        return interaction.editReply(replyOptions);
    },
};