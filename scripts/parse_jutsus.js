const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const guidePath = path.join(__dirname, '..', 'JUTSU_GUIDE.md');
const outputPath = path.join(__dirname, '..', 'data', 'jutsu_database.json');

function generateHash(name) {
    // Generate a consistent 10-char hash
    return crypto.createHash('sha256').update(name.toLowerCase()).digest('hex').substring(0, 10);
}

function parseGuide() {
    if (!fs.existsSync(guidePath)) {
        console.error('JUTSU_GUIDE.md not found');
        return;
    }

    const content = fs.readFileSync(guidePath, 'utf8');

    const jutsus = {};
    // More flexible regex to handle \r\n, spaces, etc.
    const jutsuRegex = /###\s*(.*?)\r?\n\*\*Chakra Cost:\*\*\s*(.*?)\s*\r?\n\*\*How to Get:\*\*\s*(.*?)\s*\r?\n\*\*What it Does:\*\*\s*([\s\S]*?)(?=\r?\n###|\r?\n---|$)/g;

    let match;
    while ((match = jutsuRegex.exec(content)) !== null) {
        const name = match[1].trim();
        const chakra = match[2].trim();
        const obtainment = match[3].trim();
        const description = match[4].trim();
        const hash = generateHash(name);

        jutsus[hash] = {
            name,
            chakra,
            obtainment,
            description,
            hash
        };
    }

    fs.writeFileSync(outputPath, JSON.stringify(jutsus, null, 2));
    console.log(`Parsed ${Object.keys(jutsus).length} jutsus into ${outputPath}`);
}

parseGuide();
