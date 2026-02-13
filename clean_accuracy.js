const fs = require('fs');
const path = require('path');

/**
 * This script removes the 'accuracy' field from all users in users.json and e.json
 * because accuracy should only be calculated dynamically in battle (base 60 + accessory bonuses),
 * not stored permanently in user data.
 */

const usersPath = path.join(__dirname, 'data', 'users.json');
const ePath = path.join(__dirname, 'data', 'e.json');

function cleanAccuracyFromFile(filePath, fileName) {
    console.log(`\nProcessing ${fileName}...`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modifiedCount = 0;

    for (const userId in data) {
        if (data[userId].accuracy !== undefined) {
            const accuracyValue = data[userId].accuracy;
            delete data[userId].accuracy;
            modifiedCount++;
            console.log(`  Removed accuracy (${accuracyValue}) from user ${userId}`);
        }
    }

    if (modifiedCount > 0) {
        // Create backup before modifying
        const backupPath = `${filePath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, JSON.stringify(JSON.parse(fs.readFileSync(filePath, 'utf8')), null, 2));
        console.log(`  Created backup: ${backupPath}`);

        // Write cleaned data
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`  Successfully cleaned ${modifiedCount} users in ${fileName}`);
    } else {
        console.log(`  No accuracy fields found in ${fileName}`);
    }
}

console.log('=== Accuracy Field Cleanup Script ===');
console.log('This script removes accuracy fields from user data files.');
console.log('Accuracy should only be calculated dynamically in battle (base 60 + accessory bonuses).\n');

cleanAccuracyFromFile(usersPath, 'users.json');
cleanAccuracyFromFile(ePath, 'e.json');

console.log('\n=== Cleanup Complete ===');
