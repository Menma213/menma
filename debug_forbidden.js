const fetch = require('node-fetch');
const { loadImage } = require('canvas');
const fs = require('fs');

const originalUrl = "https://static.wikia.nocookie.net/naruto/images/6/60/Kyodaigumo.png/revision/latest/scale-to-width-down/1200?cb=20150826054336";

async function test() {
    const log = [];
    let buffer;
    let fetchError;

    // Attempt 1: Direct Fetch
    try {
        log.push(`Attempt 1: Direct fetch of ${originalUrl}...`);
        const response = await fetch(originalUrl);
        log.push(`Status: ${response.status}`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        buffer = await response.buffer();
        log.push(`Buffer length: ${buffer.length}`);
    } catch (err) {
        log.push(`Direct fetch failed: ${err.message}`);
        fetchError = err;
    }

    // Attempt 2: Wikia Format Fix
    if (!buffer && originalUrl.includes('wikia.nocookie.net') && !originalUrl.includes('format=png')) {
        try {
            const separator = originalUrl.includes('?') ? '&' : '?';
            const newUrl = `${originalUrl}${separator}format=png`;
            log.push(`Attempt 2: Wikia format fix with ${newUrl}...`);
            const response = await fetch(newUrl);
            log.push(`Status: ${response.status}`);
            if (response.ok) {
                buffer = await response.buffer();
                log.push(`Buffer length: ${buffer.length}`);
            }
        } catch (e) {
            log.push(`Wikia format fix failed: ${e.message}`);
        }
    }

    // Attempt 3: DuckDuckGo Proxy
    if (!buffer) {
        try {
            const proxyUrl = `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`;
            log.push(`Attempt 3: DuckDuckGo proxy with ${proxyUrl}...`);
            const response = await fetch(proxyUrl);
            log.push(`Status: ${response.status}`);
            if (response.ok) {
                buffer = await response.buffer();
                log.push(`Buffer length: ${buffer.length}`);
            }
        } catch (e) {
            log.push(`DDG proxy failed: ${e.message}`);
        }
    }

    // Try to load the image
    if (buffer) {
        try {
            const img = await loadImage(buffer);
            log.push(`SUCCESS! Image loaded. Width: ${img.width}, Height: ${img.height}`);
        } catch (err) {
            log.push(`loadImage failed: ${err.message}`);
        }
    } else {
        log.push('FAILED: No buffer obtained from any method');
    }

    fs.writeFileSync('debug_output.txt', log.join('\n'));
    console.log("Done. Check debug_output.txt");
}

test();
