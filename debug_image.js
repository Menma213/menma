const fetch = require('node-fetch');
const { loadImage } = require('canvas');

const url = "https://static.wikia.nocookie.net/naruto/images/6/60/Kyodaigumo.png/revision/latest/scale-to-width-down/1200?cb=20150826054336&format=png";

const fs = require('fs');

async function test() {
    try {
        const log = [];
        log.push(`Fetching ${url}...`);
        const response = await fetch(url);
        log.push(`Status: ${response.status} ${response.statusText}`);
        log.push(`Content-Type: ${response.headers.get('content-type')}`);

        const buffer = await response.buffer();
        log.push(`Buffer length: ${buffer.length}`);
        log.push(`Buffer start: ${buffer.slice(0, 16).toString('hex')}`);

        try {
            const img = await loadImage(buffer);
            log.push(`Successfully loaded image. Width: ${img.width}, Height: ${img.height}`);
        } catch (err) {
            log.push(`loadImage failed: ${err.message}`);
        }

        fs.writeFileSync('debug_output.txt', log.join('\n'));

    } catch (err) {
        fs.writeFileSync('debug_output.txt', `Fetch failed: ${err.message}`);
    }
}

test();
