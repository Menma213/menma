const { JSDOM, ResourceLoader } = require("jsdom");
const { createCanvas, loadImage } = require("canvas");
const fs = require('fs');
const path = require('path');

const GWENT_PATH = path.join(__dirname, '../temporary');
const IMG_PATH = path.join(GWENT_PATH, 'img');

class GwentBridge {
    constructor() {
        this.dom = null;
        this.canvas = createCanvas(1920, 1080);
        this.ctx = this.canvas.getContext('2d');
        this.isInitialized = false;
        this.window = null;
    }

    async init() {
        if (this.isInitialized) return;
        console.log("[Bridge] Initializing JSDOM...");

        const resourceLoader = new ResourceLoader();
        resourceLoader.fetch = (url) => Promise.resolve(Buffer.from(""));

        this.dom = await JSDOM.fromFile(path.join(GWENT_PATH, 'index.html'), {
            runScripts: "dangerously",
            resources: resourceLoader,
            pretendToBeVisual: true
        });

        this.window = this.dom.window;
        const { window } = this.dom;

        // Force Globals to be visible to Node and each other
        global.window = window;
        global.document = window.document;
        // Note: global.navigator is read-only, but window.navigator exists from JSDOM
        global.Image = window.Image;
        global.Audio = class {
            constructor() { this.src = ""; this.volume = 1; }
            play() { return Promise.resolve(); }
            pause() { }
            load() { }
            addEventListener() { }
        };
        global.localStorage = { getItem: () => "{}", setItem: () => { }, removeItem: () => { } };
        global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
        global.cancelAnimationFrame = (id) => clearTimeout(id);
        global.location = window.location;
        window.Audio = global.Audio;
        window.alert = (msg) => console.log("[Gwent Alert]", msg);
        window.confirm = () => true;

        // Load Scripts - combine them all into one eval to share scope
        const scripts = ['cards.js', 'decks.js', 'abilities.js', 'factions.js', 'gwent.js'];
        let combinedScript = '';
        for (const s of scripts) {
            let content = fs.readFileSync(path.join(GWENT_PATH, s), 'utf8');

            // Fix: Change 'let dm' to 'var dm' so it attaches to window (gwent.js line 2681)
            if (s === 'gwent.js') {
                content = content.replace('let dm = new DeckMaker();', 'var dm = new DeckMaker();');
            }

            // Fix: Change 'let premade_deck' to 'var premade_deck' (decks.js)
            if (s === 'decks.js') {
                content = content.replace('let premade_deck =', 'var premade_deck =');
            }

            combinedScript += `\n// === ${s} ===\n${content}\n`;
        }

        try {
            window.eval(combinedScript);

            // Expose let-scoped variables to window (dm is defined with 'let' in gwent.js line 2681)
            // We need to explicitly check if they exist in the eval scope and expose them
            window.eval(`
                if (typeof dm !== 'undefined') window.dm = dm;
                if (typeof ui !== 'undefined') window.ui = ui;
                if (typeof board !== 'undefined') window.board = board;
                if (typeof game !== 'undefined') window.game = game;
                if (typeof weather !== 'undefined') window.weather = weather;
            `);

            console.log('[Bridge] All Gwent scripts loaded successfully');
            console.log('[Bridge] Exposed variables:', {
                dm: !!window.dm,
                ui: !!window.ui,
                board: !!window.board,
                game: !!window.game
            });
        } catch (err) {
            console.error(`[Bridge] Script error:`, err.message);
            throw err;
        }

        this.isInitialized = true;
        console.log("[Bridge] ✅ Initialization Complete");
    }

    async startMatch(faction) {
        if (!this.isInitialized) await this.init();
        const { window } = this;
        const dm = window.dm;

        if (!dm) {
            console.error("[Bridge] Critical: DeckMaker (dm) not found in window");
            return;
        }

        const factionMap = { realms: 0, nilfgaard: 2, monsters: 4, scoiatael: 6, skellige: 8 };
        const idx = factionMap[faction] || 0;

        console.log(`[Bridge] Setting up match for ${faction}...`);

        // 1. Set Faction
        dm.setFaction(faction, true);

        // 2. Select Premade Deck
        const premade = JSON.parse(window.premade_deck[idx]);
        console.log(`[Bridge] Loading premade deck: ${premade.faction}`);

        const mappedCards = premade.cards.map(c => ({ index: c[0], count: Number(c[1]) }));
        dm.makeBank(faction, mappedCards);

        // 3. Update Stats & Trigger Start
        dm.update();
        console.log(`[Bridge] Deck Stats: Units=${dm.stats.units}, Special=${dm.stats.special}`);

        // Ensure player_me is defined globally in the window
        dm.startNewGame();

        if (window.player_me) {
            console.log(`[Bridge] player_me successfully initialized with ${window.player_me.hand.cards.length} cards.`);
        } else {
            console.error("[Bridge] FAILED to initialize player_me. startNewGame might have aborted.");
        }
    }

    async render() {
        if (!this.isInitialized) await this.init();
        const { document, window } = this.window;
        const ctx = this.ctx;

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 1920, 1080);

        try {
            const boardImg = await loadImage(path.join(IMG_PATH, 'board.jpg'));
            ctx.drawImage(boardImg, 0, 0, 1920, 1080);
        } catch (e) { }

        // Scores
        const scoreMe = document.getElementById('score-total-me')?.innerText || "0";
        const scoreOp = document.getElementById('score-total-op')?.innerText || "0";

        ctx.fillStyle = "white"; ctx.font = "bold 60px Arial";
        ctx.fillText(scoreOp, 340, 470);
        ctx.fillText(scoreMe, 340, 830);

        // Render Field Rows
        const rowY = [320, 430, 540, 680, 790, 900];
        const cardW = 80; const cardH = 120;
        const fieldRows = [
            ...document.querySelectorAll('#field-op .field-row'),
            ...document.querySelectorAll('#field-me .field-row')
        ];

        for (let i = 0; i < fieldRows.length; i++) {
            const row = fieldRows[i];
            const cards = row.querySelectorAll('.row-cards .card');
            let x = 520;
            for (const card of cards) {
                const bg = card.style.backgroundImage;
                const filename = bg.match(/url\(".*[\/|\\](.*)\.jpg"\)/)?.[1];

                if (filename) {
                    try {
                        const img = await loadImage(path.join(IMG_PATH, 'sm', `${filename}.jpg`));
                        ctx.drawImage(img, x, rowY[i], cardW, cardH);
                    } catch (e) {
                        ctx.fillStyle = "#eee"; ctx.fillRect(x, rowY[i], cardW, cardH);
                    }
                }
                const pwr = card.querySelector('.card-strength')?.innerText;
                if (pwr) {
                    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.arc(x + 15, rowY[i] + 15, 12, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = "white"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
                    ctx.fillText(pwr, x + 15, rowY[i] + 20); ctx.textAlign = "left";
                }
                x += cardW + 10;
            }
        }

        // Render Hand
        const handCards = document.querySelectorAll('#hand-row .card');
        let hX = 500;
        for (const card of handCards) {
            const bg = card.style.backgroundImage;
            const filename = bg.match(/url\(".*[\/|\\](.*)\.jpg"\)/)?.[1];
            if (filename) {
                try {
                    const img = await loadImage(path.join(IMG_PATH, 'sm', `${filename}.jpg`));
                    ctx.drawImage(img, hX, 980, 80, 120);
                } catch (e) {
                    ctx.fillStyle = "gold"; ctx.fillRect(hX, 980, 80, 120);
                }
            }
            hX += 90;
        }

        return this.canvas.toBuffer('image/png');
    }

    getHand() {
        if (!this.window?.player_me) return [];
        return this.window.player_me.hand.cards.map((c, i) => ({
            name: c.name, power: c.basePower, index: i
        }));
    }

    async playCard(index) {
        if (!this.window?.player_me) return;
        const card = this.window.player_me.hand.cards[index];
        if (card) {
            console.log(`[Bridge] Playing card: ${card.name}`);
            card.elem.click();
        }
    }

    async pass() {
        if (this.window?.player_me) {
            console.log("[Bridge] Player Passing");
            this.window.player_me.passRound();
        }
    }
}

module.exports = new GwentBridge();
