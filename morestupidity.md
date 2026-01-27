The Innovation: The JSDOM + Canvas Bridge
Since that Gwent repo is pure HTML/JS, you can "mock" the browser environment inside your bot using JSDOM and node-canvas. This runs natively in a Pterodactyl Node.js egg without needing a chrome-executable.
1. How it works as a "Wrapper"
Instead of a browser, JSDOM creates a "fake" window and document in your RAM.
You load the index.js from the gwent-classic repo.
The Gwent code thinks it’s talking to a browser <div>.
You use node-canvas to "paint" the pixels that the HTML elements represent.
2. The Technical Workflow
Environment Setup:
javascript
const { JSDOM } = require("jsdom");
const { createCanvas, loadImage } = require("canvas");

// Create a virtual window
const dom = new JSDOM(`<!DOCTYPE html><div id="game-board"></div>`);
global.window = dom.window;
global.document = dom.window.document;
Use code with caution.

The Code Injector: You require() the JS files from the repo. Because you defined global.document, the Gwent scripts will execute against your virtual DOM.
The Renderer: Since Pterodactyl can't "see" the HTML, you write a small helper that loops through the document.querySelectorAll('.card') and draws their corresponding images onto a Node-Canvas buffer.
The Output:
javascript
const buffer = canvas.toBuffer('image/png');
message.edit({ files: [new AttachmentBuilder(buffer)] });
Use code with caution.

3. Why this is "Out of the Box"
Pterodactyl Friendly: It’s just a standard Node.js dependency. No extra binaries or root access needed.
Real-Time: State changes happen in RAM. When a player clicks a Discord button, you trigger the corresponding event in JSDOM, re-draw the canvas, and update.
Asset Reuse: You can pull the card images directly from the local repo folder.
The Challenge
The Gwent-Classic repo uses Drag-and-Drop API, which JSDOM doesn't support perfectly. You would need to "hack" the script by replacing the drag event listeners with a simple function call like playCard(cardId, row).
Do you want the boilerplate for setting up the JSDOM environment to load that repo's specific .js files?