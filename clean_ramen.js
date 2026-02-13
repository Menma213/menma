const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'e.json');

function cleanRamen() {
    console.log('Reading e.json...');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modifiedCount = 0;

    for (const userId in data) {
        if (data[userId].inventory && Array.isArray(data[userId].inventory)) {
            const originalLength = data[userId].inventory.length;
            // Remove all occurrences of "ramen" from the inventory array
            data[userId].inventory = data[userId].inventory.filter(item => item !== 'ramen');

            if (data[userId].inventory.length !== originalLength) {
                modifiedCount++;
                console.log(`Cleaned inventory for user ${userId} (${originalLength - data[userId].inventory.length} ramen removed)`);
            }
        }
    }

    if (modifiedCount > 0) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully cleaned ${modifiedCount} users' inventories.`);
    } else {
        console.log('No user inventories needed cleaning.');
    }
}

cleanRamen();
