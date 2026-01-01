const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// --- Configuration for Canvas Theme ---
const CANVAS_WIDTH = 900; // Slightly wider for more content
const CANVAS_HEIGHT = 550; // Taller
const FONT_FAMILY = 'Arial, sans-serif'; // A common, clean font
const BG_COLOR_DARK = '#1a1a1a'; // Very dark background
const BG_COLOR_LIGHT = '#2d2d2d'; // Slightly lighter section background
const TEXT_COLOR_PRIMARY = '#e0e0e0'; // Light text for main info
const TEXT_COLOR_SECONDARY = '#b0b0b0'; // Slightly muted for details/subtext
const ACCENT_COLOR_ORANGE = '#ff7b25'; // Brighter orange accent
const ACCENT_COLOR_YELLOW = '#ffcc00'; // Secondary accent for highlights
const BORDER_COLOR = '#444444'; // Subtle border/divider color

const JUTSU_PER_PAGE = 4; // Still 4 jutsu per learned page for good spacing

// --- Helper function to create the Equipped Jutsu Canvas ---
async function createEquippedCanvas(user, equippedJutsuDetails) {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Main Background
    ctx.fillStyle = BG_COLOR_DARK;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Header Area
    ctx.fillStyle = BG_COLOR_LIGHT;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 100); // Header band

    // Accent Line
    ctx.fillStyle = ACCENT_COLOR_ORANGE;
    ctx.fillRect(0, 95, CANVAS_WIDTH, 5); // Bottom border of header

    // Title
    ctx.font = `bold 48px ${FONT_FAMILY}`;
    ctx.fillStyle = ACCENT_COLOR_YELLOW;
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPPED JUTSU', 40, 65);

    // User Info
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_COLOR_SECONDARY;
    ctx.fillText(`User: ${user.username}`, CANVAS_WIDTH - 250, 65); // Align right conceptually

    // Main Content Area
    let yPos = 140; // Starting Y position for content
    const xOffset = 60; // Left padding for list items
    const lineHeight = 50;

    if (equippedJutsuDetails.length === 0) {
        ctx.font = `italic 30px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR_SECONDARY;
        ctx.textAlign = 'center';
        ctx.fillText('No jutsu equipped.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    } else {
        equippedJutsuDetails.forEach((jutsu, index) => {

            // Slots 1-5
            const slotNum = index + 1;
            const slotLabel = `Slot ${slotNum}:`;

            // Draw a subtle divider
            if (index > 0) { // Draw divider starting before Slot 1 (internal index 1)
                ctx.fillStyle = BORDER_COLOR;
                ctx.fillRect(xOffset, yPos - lineHeight / 2 - 5, CANVAS_WIDTH - (xOffset * 2), 1);
            }

            // Slot Number / Label
            ctx.font = `bold 28px ${FONT_FAMILY}`;
            ctx.fillStyle = ACCENT_COLOR_ORANGE;
            ctx.textAlign = 'left';
            ctx.fillText(slotLabel, xOffset, yPos);

            // Jutsu Name and Cost
            const name = jutsu.name;
            const cost = jutsu.chakraCost;
            let nameText = name;
            let costText = cost > 0 ? ` (${cost} Chakra)` : ' (0 Chakra)';

            // Measure name and cost to right-align cost while keeping name left
            ctx.font = `28px ${FONT_FAMILY}`;
            ctx.fillStyle = TEXT_COLOR_PRIMARY;
            const nameWidth = ctx.measureText(nameText).width;

            // If the jutsu name is too long, truncate and add ellipsis
            let maxNameWidth = CANVAS_WIDTH - xOffset - ctx.measureText(costText).width - ctx.measureText(slotLabel).width - 30; // Space for slot, cost, and margin
            if (nameWidth > maxNameWidth) {
                let tempName = nameText;
                while (ctx.measureText(tempName + "...").width > maxNameWidth && tempName.length > 0) {
                    tempName = tempName.slice(0, -1);
                }
                nameText = tempName + "...";
            }

            // Position the Jutsu Name based on the length of the dynamic slotLabel
            ctx.fillText(nameText, xOffset + ctx.measureText(slotLabel).width + 15, yPos);

            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = TEXT_COLOR_SECONDARY;
            ctx.textAlign = 'right';
            ctx.fillText(costText, CANVAS_WIDTH - xOffset, yPos);

            yPos += lineHeight;
        });
    }

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'equipped_jutsu.png' });
}


// --- Helper function to paginate and create Learned Jutsu Canvases ---
async function createLearnedCanvasPage(user, learnedJutsuList, pageIndex, totalPages) {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Main Background
    ctx.fillStyle = BG_COLOR_DARK;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Header Area
    ctx.fillStyle = BG_COLOR_LIGHT;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 100);

    // Accent Line
    ctx.fillStyle = ACCENT_COLOR_ORANGE;
    ctx.fillRect(0, 95, CANVAS_WIDTH, 5);

    // Title
    ctx.font = `bold 48px ${FONT_FAMILY}`;
    ctx.fillStyle = ACCENT_COLOR_YELLOW;
    ctx.textAlign = 'left';
    ctx.fillText('JUTSU LIBRARY', 40, 65);

    // Pagination Info
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_COLOR_SECONDARY;
    ctx.textAlign = 'right';
    ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, CANVAS_WIDTH - 40, 65);

    // Main Content Area
    let yPos = 140;
    const xOffset = 40;
    const jutsuEntryHeight = 110; // Approximate height for each jutsu with info

    if (learnedJutsuList.length === 0) {
        ctx.font = `italic 30px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR_SECONDARY;
        ctx.textAlign = 'center';
        ctx.fillText('No jutsu learned yet!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    } else {
        const start = pageIndex * JUTSU_PER_PAGE;
        const end = Math.min(start + JUTSU_PER_PAGE, learnedJutsuList.length);
        const pageJutsu = learnedJutsuList.slice(start, end);

        pageJutsu.forEach((jutsu, index) => {
            if (index > 0) {
                ctx.fillStyle = BORDER_COLOR;
                ctx.fillRect(xOffset, yPos - jutsuEntryHeight / 2 - 10, CANVAS_WIDTH - (xOffset * 2), 1);
            }

            // Jutsu Name
            ctx.font = `bold 30px ${FONT_FAMILY}`;
            ctx.fillStyle = ACCENT_COLOR_ORANGE;
            ctx.textAlign = 'left';
            ctx.fillText(jutsu.name, xOffset, yPos);

            // Chakra Cost
            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = TEXT_COLOR_SECONDARY;
            ctx.textAlign = 'right';
            ctx.fillText(`(${jutsu.chakraCost} Chakra)`, CANVAS_WIDTH - xOffset, yPos);

            yPos += 35; // Move down for info

            // Jutsu Info (wrapped)
            ctx.font = `18px ${FONT_FAMILY}`;
            ctx.fillStyle = TEXT_COLOR_PRIMARY;
            ctx.textAlign = 'left';

            const maxWidth = CANVAS_WIDTH - (xOffset * 2);
            const words = (jutsu.info || 'No description available.').split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
                    ctx.fillText(currentLine.trim(), xOffset, yPos);
                    yPos += 25; // Line height for info text
                    currentLine = word + ' ';
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine.trim()) {
                ctx.fillText(currentLine.trim(), xOffset, yPos);
            }
            yPos += 50; // Space after each jutsu entry
        });
    }

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: `learned_jutsu_p${pageIndex + 1}.png` });
}


// --- Main Command Execution ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('myjutsu')
        .setDescription('Display your learned jutsu and current loadout'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const usersPath = path.resolve(__dirname, '../../menma/data/users.json');
        const learnedJutsuListPath = path.resolve(__dirname, '../../menma/data/jutsu.json');
        const allJutsusPath = path.resolve(__dirname, '../../menma/data/jutsus.json');

        let users = {};
        let learnedJutsuData = {};
        let allJutsus = {};

        try {
            if (fs.existsSync(usersPath)) {
                users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            } else {
                return interaction.reply({ content: 'Error: User data file not found.', ephemeral: true });
            }

            if (fs.existsSync(learnedJutsuListPath)) {
                learnedJutsuData = JSON.parse(fs.readFileSync(learnedJutsuListPath, 'utf8'));
            }

            if (fs.existsSync(allJutsusPath)) {
                allJutsus = JSON.parse(fs.readFileSync(allJutsusPath, 'utf8'));
            } else {
                return interaction.reply({ content: 'Error: Jutsu details file not found.', ephemeral: true });
            }

        } catch (error) {
            console.error("Error reading or parsing JSON data:", error);
            return interaction.reply({ content: 'Error accessing necessary data files.', ephemeral: true });
        }

        if (!users[userId]) {
            return interaction.reply({ content: 'You need to enroll first! Use `/enroll`.', ephemeral: true });
        }

        // --- Equipped Jutsu Data Preparation ---
        const equippedJutsuSlots = users[userId]?.jutsu || {};

        // Filter for slots 1-5 only
        const equippedJutsuDetails = [1, 2, 3, 4, 5].map(i => {
            const slotKey = `slot_${i}`;
            const jutsuKey = equippedJutsuSlots[slotKey];
            if (jutsuKey && jutsuKey !== 'None' && jutsuKey !== 'Attack') {
                const jutsuDetails = allJutsus[jutsuKey];
                return jutsuDetails ? {
                    name: jutsuDetails.name ?? jutsuKey,
                    chakraCost: jutsuDetails.chakraCost ?? '?'
                } : {
                    name: `${jutsuKey} (*Unknown*)`,
                    chakraCost: '0'
                };
            }
            return { name: '*Empty Slot*', chakraCost: null };
        });

        const equippedAttachment = await createEquippedCanvas(interaction.user, equippedJutsuDetails);

        // --- Learned Jutsu Data Preparation ---
        const learnedJutsuKeys = learnedJutsuData[userId]?.usersjutsu || [];
        const learnedJutsuList = learnedJutsuKeys
            .map(jutsuKey => {
                const jutsuDetails = allJutsus[jutsuKey];
                if (jutsuDetails) {
                    return {
                        name: jutsuDetails.name ?? jutsuKey,
                        chakraCost: jutsuDetails.chakraCost ?? '?',
                        info: jutsuDetails.info ?? 'No description available.'
                    };
                } else {
                    return {
                        name: `${jutsuKey} (*Unknown*)`,
                        chakraCost: '0',
                        info: 'Jutsu not found in master list.'
                    };
                }
            })
            .filter(j => j !== null); // Filter out any issues


        // --- Initial Reply Setup ---
        let currentPageType = 'equipped';
        let learnedPageIndex = 0;
        const totalLearnedPages = Math.ceil(learnedJutsuList.length / JUTSU_PER_PAGE);

        function getActionRow(pageType, index, totalPages) {
            const row = new ActionRowBuilder();

            if (pageType === 'equipped') {
                // Only show "Jutsu Library" if there are learned jutsu to display
                if (learnedJutsuList.length > 0) {
                    row.addComponents(
                        new ButtonBuilder().setCustomId('switch_learned').setLabel('Jutsu Library →').setStyle(ButtonStyle.Primary)
                    );
                } else {
                    row.addComponents(
                        new ButtonBuilder().setCustomId('no_learned_info').setLabel('No Jutsu Learned').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                }
            } else if (pageType === 'learned') {
                row.addComponents(
                    new ButtonBuilder().setCustomId('switch_equipped').setLabel('← Equipped').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('prev_learned').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
                    new ButtonBuilder().setCustomId('next_learned').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(index >= totalPages - 1)
                );
            }
            return row;
        }

        let currentAttachment;
        if (currentPageType === 'equipped') {
            currentAttachment = equippedAttachment;
        } else {
            // This path might not be strictly needed for initial, but good for consistency
            currentAttachment = await createLearnedCanvasPage(
                interaction.user,
                learnedJutsuList,
                learnedPageIndex,
                totalLearnedPages
            );
        }

        const initialRow = getActionRow(currentPageType, learnedPageIndex, totalLearnedPages);

        const response = await interaction.reply({
            files: [currentAttachment],
            components: [initialRow],
            fetchReply: true
        });

        // --- Collector Logic ---
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async i => {
            let newAttachment;

            if (i.customId === 'switch_learned') {
                currentPageType = 'learned';
                learnedPageIndex = 0; // Reset to first page of learned jutsu
            } else if (i.customId === 'switch_equipped') {
                currentPageType = 'equipped';
            } else if (i.customId === 'prev_learned') {
                if (learnedPageIndex > 0) learnedPageIndex--;
            } else if (i.customId === 'next_learned') {
                if (learnedPageIndex < totalLearnedPages - 1) learnedPageIndex++;
            }

            if (currentPageType === 'equipped') {
                newAttachment = equippedAttachment;
            } else { // 'learned'
                newAttachment = await createLearnedCanvasPage(
                    interaction.user,
                    learnedJutsuList,
                    learnedPageIndex,
                    totalLearnedPages
                );
            }

            // Update components for the new state
            const newRow = getActionRow(currentPageType, learnedPageIndex, totalLearnedPages);

            await i.update({
                files: [newAttachment],
                components: [newRow]
            });
        });

        collector.on('end', () => {
            if (response.editable) {
                const disabledRow = getActionRow(currentPageType, learnedPageIndex, totalLearnedPages).components.map(btn =>
                    ButtonBuilder.from(btn).setDisabled(true)
                );
                response.edit({ components: [new ActionRowBuilder().addComponents(disabledRow)] }).catch(console.error);
            }
        });
    }
};
