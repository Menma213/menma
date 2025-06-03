const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Create tests directory if it doesn't exist
const testsDir = path.join(__dirname, '..');
const screenshotsDir = path.join(testsDir, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function createScrollAnimation() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    const html = `
        <html>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    background: #2c2c2c;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .scroll-container {
                    width: 800px;
                    height: 400px;
                    position: relative;
                    perspective: 1000px;
                }
                .scroll {
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    transform-origin: right center;
                    animation: unroll 2s ease-out forwards;
                    background: url('https://i.imgur.com/pZrKzGD.png') repeat;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5);
                }
                .scroll::before {
                    content: '';
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: 40px;
                    background: linear-gradient(to left, #8B4513, #D2691E);
                    border-radius: 0 10px 10px 0;
                }
                .scroll-content {
                    position: absolute;
                    left: 40px;
                    right: 40px;
                    top: 20px;
                    bottom: 20px;
                    background: rgba(255, 253, 240, 0.9);
                    opacity: 0;
                    animation: fadeIn 1s ease-out 1s forwards;
                    padding: 20px;
                    font-family: 'Arial', sans-serif;
                }
                @keyframes unroll {
                    0% {
                        transform: scaleX(0.1) rotateY(-30deg);
                    }
                    100% {
                        transform: scaleX(1) rotateY(0deg);
                    }
                }
                @keyframes fadeIn {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
            </style>
            <body>
                <div class="scroll-container">
                    <div class="scroll">
                        <div class="scroll-content">
                            <!-- Content goes here -->
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;

    await page.setContent(html);
    await page.setViewport({ width: 1000, height: 600 });

    // Wait for animations to complete
    await page.waitForTimeout(3000);

    // Update screenshot path to use screenshots directory
    const screenshotPath = path.join(screenshotsDir, 'scroll_test.png');
    await page.screenshot({ path: screenshotPath });

    await browser.close();
    console.log(`Scroll animation saved to: ${screenshotPath}`);
}

// Execute immediately if run directly
if (require.main === module) {
    createScrollAnimation().catch(console.error);
}

module.exports = createScrollAnimation;
