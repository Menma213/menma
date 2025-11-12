const { createCanvas } = require('canvas');

function generateBracket(players, winners = []) {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#2C2F33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tournament Bracket', canvas.width / 2, 50);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#FFFFFF';

    if (players.length === 4) {
        // Round 1
        ctx.fillText(players[0], 100, 100);
        ctx.fillText(players[1], 100, 200);
        ctx.fillText(players[2], 100, 400);
        ctx.fillText(players[3], 100, 500);

        // Lines
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(200, 100);
        ctx.lineTo(300, 100);
        ctx.lineTo(300, 150);
        ctx.lineTo(200, 200);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(200, 400);
        ctx.lineTo(300, 400);
        ctx.lineTo(300, 450);
        ctx.lineTo(200, 500);
        ctx.stroke();

        // Round 2
        if (winners.length > 0) {
            ctx.fillText(winners[0], 400, 150);
        }
        if (winners.length > 1) {
            ctx.fillText(winners[1], 400, 450);
        }

        // Lines
        ctx.beginPath();
        ctx.moveTo(300, 150);
        ctx.lineTo(400, 150);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(300, 450);
        ctx.lineTo(400, 450);
        ctx.stroke();

        // Final
        if (winners.length > 2) {
            ctx.fillText(winners[2], 600, 300);
        }

        // Lines
        ctx.beginPath();
        ctx.moveTo(500, 150);
        ctx.lineTo(500, 300);
        ctx.lineTo(500, 450);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(500, 300);
        ctx.lineTo(600, 300);
        ctx.stroke();
    }

    return canvas.toBuffer();
}

module.exports = { generateBracket };