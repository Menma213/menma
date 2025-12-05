const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const baseMapPath = path.resolve(__dirname, '../worldmap.jpg');
const outputPath = path.resolve(__dirname, '../tmp/positioning_helper.png');

/**
 * Generate a positioning helper image with grid and markers
 * This helps you identify exact X,Y coordinates for territories
 */
async function generatePositioningHelper() {
    console.log('Loading base map...');
    const baseMap = await loadImage(baseMapPath);

    const width = baseMap.width;
    const height = baseMap.height;

    console.log(`Map dimensions: ${width}x${height}`);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw base map
    ctx.drawImage(baseMap, 0, 0);

    // Add semi-transparent overlay for better grid visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid (every 50 pixels)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw major grid lines (every 100 pixels)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;

    for (let x = 0; x < width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y < height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw coordinate labels
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    // X-axis labels
    for (let x = 0; x < width; x += 100) {
        ctx.strokeText(x.toString(), x + 5, 15);
        ctx.fillText(x.toString(), x + 5, 15);
    }

    // Y-axis labels
    for (let y = 100; y < height; y += 100) {
        ctx.strokeText(y.toString(), 5, y + 15);
        ctx.fillText(y.toString(), 5, y + 15);
    }

    // Draw crosshair at center
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(centerX, centerY + 20);
    ctx.stroke();

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FF0000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(`Center: ${centerX}, ${centerY}`, centerX + 25, centerY - 10);
    ctx.fillText(`Center: ${centerX}, ${centerY}`, centerX + 25, centerY - 10);

    // Draw corner markers
    drawCornerMarker(ctx, 0, 0, 'TOP-LEFT (0, 0)');
    drawCornerMarker(ctx, width, 0, `TOP-RIGHT (${width}, 0)`);
    drawCornerMarker(ctx, 0, height, `BOTTOM-LEFT (0, ${height})`);
    drawCornerMarker(ctx, width, height, `BOTTOM-RIGHT (${width}, ${height})`);

    // Save output
    const buffer = canvas.toBuffer('image/png');

    // Create tmp directory if it doesn't exist
    const tmpDir = path.dirname(outputPath);
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Positioning helper saved to: ${outputPath}`);
    console.log(`Map dimensions: ${width}x${height}`);

    return { width, height, outputPath };
}

/**
 * Generate map with current territory positions marked
 */
async function generateMarkedMap() {
    console.log('Loading base map and territories...');
    const baseMap = await loadImage(baseMapPath);
    const territoriesPath = path.resolve(__dirname, '../data/territories.json');
    const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));

    const width = baseMap.width;
    const height = baseMap.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw base map
    ctx.drawImage(baseMap, 0, 0);

    // Add light overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);

    // Draw each territory marker
    let index = 1;
    for (const [territoryId, territory] of Object.entries(territories.territories)) {
        const { position, radius, color, displayName } = territory;

        // Draw territory circle
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = hexToRgba(color, 0.3);
        ctx.fill();

        // Draw numbered marker
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(index.toString(), position.x, position.y + 8);
        ctx.fillText(index.toString(), position.x, position.y + 8);

        // Draw name label
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(displayName, position.x, position.y - radius - 10);
        ctx.fillText(displayName, position.x, position.y - radius - 10);

        // Draw coordinates
        ctx.font = '12px Arial';
        ctx.strokeText(`(${position.x}, ${position.y})`, position.x, position.y + radius + 20);
        ctx.fillText(`(${position.x}, ${position.y})`, position.x, position.y + radius + 20);

        index++;
    }

    // Draw legend
    drawTerritoryLegend(ctx, territories);

    const buffer = canvas.toBuffer('image/png');
    const markedOutputPath = path.resolve(__dirname, '../tmp/current_positions.png');
    fs.writeFileSync(markedOutputPath, buffer);
    console.log(`✅ Marked map saved to: ${markedOutputPath}`);

    return markedOutputPath;
}

function drawCornerMarker(ctx, x, y, label) {
    ctx.fillStyle = '#00FF00';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    // Adjust position for corner visibility
    const offsetX = x === 0 ? 10 : -150;
    const offsetY = y === 0 ? 20 : -10;

    ctx.font = 'bold 12px Arial';
    ctx.strokeText(label, x + offsetX, y + offsetY);
    ctx.fillText(label, x + offsetX, y + offsetY);
}

function drawTerritoryLegend(ctx, territories) {
    const legendX = 10;
    const legendY = 10;
    const legendWidth = 220;

    const territoryList = Object.entries(territories.territories);
    const legendHeight = 30 + territoryList.length * 25;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    roundRect(ctx, legendX, legendY, legendWidth, legendHeight, 8);
    ctx.fill();

    // Title
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText('Current Territory Positions', legendX + 10, legendY + 20);

    // Territory list
    let yOffset = legendY + 40;
    let index = 1;
    for (const [territoryId, territory] of territoryList) {
        // Number
        ctx.fillStyle = territory.color;
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`${index}.`, legendX + 10, yOffset);

        // Name
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(territory.displayName, legendX + 25, yOffset);

        // Coordinates
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '10px Arial';
        ctx.fillText(`(${territory.position.x}, ${territory.position.y})`, legendX + 140, yOffset);

        yOffset += 25;
        index++;
    }
}

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

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'grid';

    if (command === 'grid') {
        generatePositioningHelper()
            .then(result => {
                console.log('\n📍 Use this image to find coordinates for each territory.');
                console.log('   The grid shows X and Y values every 100 pixels.');
                console.log('   Update territories.json with the exact positions.');
            })
            .catch(err => {
                console.error('Error:', err);
                process.exit(1);
            });
    } else if (command === 'preview') {
        generateMarkedMap()
            .then(path => {
                console.log('\n✅ Preview generated! Check how current positions look.');
            })
            .catch(err => {
                console.error('Error:', err);
                process.exit(1);
            });
    } else if (command === 'both') {
        Promise.all([
            generatePositioningHelper(),
            generateMarkedMap()
        ])
            .then(() => {
                console.log('\n✅ Both images generated!');
                console.log('   1. positioning_helper.png - Use to find coordinates');
                console.log('   2. current_positions.png - Preview current setup');
            })
            .catch(err => {
                console.error('Error:', err);
                process.exit(1);
            });
    } else {
        console.log('Usage: node mapPositioningHelper.js [grid|preview|both]');
    }
}

module.exports = {
    generatePositioningHelper,
    generateMarkedMap
};
