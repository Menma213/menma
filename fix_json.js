const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'temporary/cards.js');
const outputPath = path.join(__dirname, 'data/gwent_cards.json');

const content = fs.readFileSync(inputPath, 'utf8');
const start = content.indexOf("'[") + 1;
const end = content.lastIndexOf("]'") + 1;

let rawJson = content.substring(start, end);
// Replace escaped single quotes with actual single quotes
rawJson = rawJson.replace(/\\'/g, "'");

try {
    const data = JSON.parse(rawJson);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 4), 'utf8');
    console.log('Successfully fixed and saved JSON card data.');
} catch (e) {
    console.error('JSON Parse error:', e.message);
}
