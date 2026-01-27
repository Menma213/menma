const bridge = require('./utils/gwent_bridge');
const fs = require('fs');
const path = require('path');

async function test() {
    try {
        await bridge.init();
        console.log("Initial load complete.");

        await bridge.startMatch('realms');
        console.log("Match started.");

        // Wait a bit for engine to process setup
        await new Promise(r => setTimeout(r, 1000));

        console.log("Rendering...");
        const buffer = await bridge.render();
        fs.writeFileSync('gwent-test-render.png', buffer);
        console.log("✅ Verification image saved as gwent-test-render.png");

        const hand = bridge.getHand();
        console.log("Current Hand:", hand.map(c => c.name).join(', '));

    } catch (err) {
        console.error("❌ Verification failed:", err);
    }
}

test();
