const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const baseMapPath = path.resolve(__dirname, '../worldmap.jpg');
const territoriesPath = path.resolve(__dirname, '../data/territories.json');
const clansPath = path.resolve(__dirname, '../data/clans.json');

/**
 * Generate a dynamic territory map showing clan control
 * @param {Object} options - Configuration options
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateTerritoryMap(options = {}) {
    const {
        showLabels = true,
        showControlPercentage = true,
        highlightTerritory = null,
        clanColors = {},
        userLocation = null
    } = options;

    // Load data
    const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
    const clans = fs.existsSync(clansPath) ? JSON.parse(fs.readFileSync(clansPath, 'utf8')) : {};

    // Create canvas (base on your map dimensions)
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    // Load and draw base map
    const baseMap = await loadImage(baseMapPath);
    ctx.drawImage(baseMap, 0, 0, 800, 600);

    // Add semi-transparent overlay for better contrast
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, 800, 600);

    // Draw territories
    for (const [territoryId, territory] of Object.entries(territories.territories)) {
        const { position, radius, controlledBy, controlPoints, maxControlPoints } = territory;

        // Determine territory color
        let fillColor = 'rgba(128, 128, 128, 0.3)'; // Default: unclaimed (gray)
        let strokeColor = '#FFFFFF';

        if (controlledBy) {
            // Get clan color
            const clan = clans[controlledBy];
            const clanColor = clanColors[controlledBy] || clan?.color || territory.color;

            // Control percentage determines opacity
            const controlPercentage = controlPoints / maxControlPoints;
            const alpha = 0.2 + (controlPercentage * 0.4); // 20% to 60% opacity

            fillColor = hexToRgba(clanColor, alpha);
            strokeColor = clanColor;
        }

        // Highlight effect for selected territory
        if (highlightTerritory === territoryId) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FFD700';
        }

        // Draw territory circle
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.lineWidth = controlledBy ? 4 : 2;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw legendary territory marker
        if (territory.legendary) {
            ctx.save();
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.textAlign = 'center';
            ctx.strokeText('★', position.x, position.y - radius - 10);
            ctx.fillText('★', position.x, position.y - radius - 10);
            ctx.restore();
        }

        // Draw control progress bar (only if valid control data exists)
        if (controlledBy && showControlPercentage &&
            typeof controlPoints === 'number' && typeof maxControlPoints === 'number' &&
            maxControlPoints > 0 && !isNaN(controlPoints) && !isNaN(maxControlPoints)) {

            const barWidth = radius * 1.5;
            const barHeight = 8;
            const barX = position.x - barWidth / 2;
            const barY = position.y + radius + 10;
            const controlPercentage = Math.min(1, Math.max(0, controlPoints / maxControlPoints));

            // Background bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            roundRect(ctx, barX, barY, barWidth, barHeight, 4);
            ctx.fill();

            // Progress bar
            ctx.fillStyle = strokeColor;
            roundRect(ctx, barX, barY, barWidth * controlPercentage, barHeight, 4);
            ctx.fill();

            // Percentage text
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            const percentText = `${Math.floor(controlPercentage * 100)}%`;
            ctx.strokeText(percentText, position.x, barY + barHeight + 15);
            ctx.fillText(percentText, position.x, barY + barHeight + 15);
        }

        // Draw labels
        if (showLabels) {
            ctx.save();
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;

            // Territory name
            ctx.strokeText(territory.displayName, position.x, position.y - 5);
            ctx.fillText(territory.displayName, position.x, position.y - 5);

            // Clan name if controlled
            if (controlledBy) {
                const clan = clans[controlledBy];
                const clanName = clan?.name || controlledBy;
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = '#FFD700';
                ctx.strokeText(clanName, position.x, position.y + 15);
                ctx.fillText(clanName, position.x, position.y + 15);
            }

            ctx.restore();
        }
    }

    // Draw user location marker
    if (userLocation) {
        const { x, y } = userLocation;
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('You are here', x, y - 15);
    }

    // Draw legend
    drawLegend(ctx, territories, clans, clanColors);

    return canvas.toBuffer('image/png');
}

/**
 * Draw map legend showing clan colors
 */
function drawLegend(ctx, territories, clans, clanColors) {
    const activeClanControls = {};

    // Count territories per clan
    for (const territory of Object.values(territories.territories)) {
        if (territory.controlledBy) {
            if (!activeClanControls[territory.controlledBy]) {
                activeClanControls[territory.controlledBy] = 0;
            }
            activeClanControls[territory.controlledBy]++;
        }
    }

    if (Object.keys(activeClanControls).length === 0) return;

    // Legend background
    const legendX = 10;
    const legendY = 10;
    const legendWidth = 200;
    const legendHeight = 30 + Object.keys(activeClanControls).length * 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    roundRect(ctx, legendX, legendY, legendWidth, legendHeight, 8);
    ctx.fill();

    // Legend title
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText('Territory Control', legendX + 10, legendY + 20);

    // Clan entries
    let yOffset = legendY + 45;
    for (const [clanId, count] of Object.entries(activeClanControls)) {
        const clan = clans[clanId];
        const clanName = clan?.name || clanId;
        const clanColor = clanColors[clanId] || clan?.color || '#FFFFFF';

        // Color indicator
        ctx.fillStyle = clanColor;
        ctx.fillRect(legendX + 10, yOffset - 10, 20, 20);

        // Clan name and count
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${clanName} (${count})`, legendX + 40, yOffset + 5);

        yOffset += 30;
    }
}

/**
 * Generate mini-map for a specific territory (for battle screens)
 */
async function generateTerritoryMiniMap(territoryId) {
    const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
    const territory = territories.territories[territoryId];

    if (!territory) {
        throw new Error(`Territory ${territoryId} not found`);
    }

    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext('2d');

    // Background
    const gradient = ctx.createRadialGradient(200, 150, 0, 200, 150, 200);
    gradient.addColorStop(0, territory.color);
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);

    // Territory name
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.strokeText(territory.displayName, 200, 50);
    ctx.fillText(territory.displayName, 200, 50);

    // Buff description
    ctx.font = '18px Arial';
    ctx.fillStyle = '#FFD700';
    wrapText(ctx, territory.buffs.description, 200, 120, 350, 25);

    // Control info
    if (territory.controlledBy) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        const controlPercentage = Math.floor((territory.controlPoints / territory.maxControlPoints) * 100);
        ctx.fillText(`Controlled by: ${territory.controlledBy}`, 200, 200);
        ctx.fillText(`Control: ${controlPercentage}%`, 200, 230);
    } else {
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#FF4444';
        ctx.fillText('UNCLAIMED', 200, 215);
    }

    return canvas.toBuffer('image/png');
}

/**
 * Update territory control (called when clan wins a battle)
 */
function updateTerritoryControl(territoryId, clanId, pointsToAdd = 5) {
    const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));
    const territory = territories.territories[territoryId];

    if (!territory) {
        throw new Error(`Territory ${territoryId} not found`);
    }

    // If different clan controls it, reduce their points first
    if (territory.controlledBy && territory.controlledBy !== clanId) {
        territory.controlPoints = Math.max(0, territory.controlPoints - pointsToAdd);

        // If points reach 0, territory becomes neutral
        if (territory.controlPoints === 0) {
            territory.controlledBy = null;
        }
    } else {
        // Same clan or neutral - add points
        territory.controlPoints = Math.min(
            territory.maxControlPoints,
            territory.controlPoints + pointsToAdd
        );

        // Capture territory if not already controlled
        if (!territory.controlledBy && territory.controlPoints > 0) {
            territory.controlledBy = clanId;
        }
    }

    // Log history
    territories.history.push({
        timestamp: Date.now(),
        territoryId,
        clanId,
        action: territory.controlledBy === clanId ? 'capture_progress' : 'defense_weakened',
        controlPoints: territory.controlPoints
    });

    // Limit history to last 100 events
    if (territories.history.length > 100) {
        territories.history = territories.history.slice(-100);
    }

    territories.lastUpdate = Date.now();
    fs.writeFileSync(territoriesPath, JSON.stringify(territories, null, 2));

    return {
        territory,
        captured: territory.controlPoints >= territory.maxControlPoints && territory.controlledBy === clanId,
        lost: territory.controlPoints === 0 && territory.controlledBy !== clanId
    };
}

// Helper functions
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yPos = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, yPos);
            line = words[n] + ' ';
            yPos += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, yPos);
}

module.exports = {
    generateTerritoryMap,
    generateTerritoryMiniMap,
    updateTerritoryControl
};
