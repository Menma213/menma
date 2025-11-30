const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { analyzeCode } = require('./utils/code_analyzer'); // Import the new analyzer

const app = express();
const port = 3001; // Using a different port to avoid conflict with webserver.js

// --- Database Setup ---
const dbPromise = open({
    filename: path.join(__dirname, 'data', 'second_brain.sqlite'),
    driver: sqlite3.Database
});

(async () => {
    try {
        const db = await dbPromise;
        await db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id TEXT NOT NULL,
                user_prompt TEXT NOT NULL,
                ai_response TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS knowledge_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                query_trigger TEXT NOT NULL UNIQUE,
                context_summary TEXT NOT NULL,
                source_files TEXT
            );
        `);
        console.log('🧠 Second Brain database tables created/ensured.');
    } catch (error) {
        console.error('❌ Error setting up Second Brain database:', error);
    }
})();
// --------------------

// Basic server setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Main route to render the frontend
app.get('/', (req, res) => {
    res.render('secondbrain');
});

// API endpoint for the AI assistant
app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    const userId = 'webapp'; // User is always the same in this context

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    console.log(`Received prompt: "${prompt}"`);

    try {
        const db = await dbPromise;
        const cachedResult = await db.get('SELECT * FROM knowledge_cache WHERE query_trigger = ?', [prompt]);

        if (cachedResult) {
            // CACHE HIT
            console.log('Cache hit.');
            await db.run(
                'INSERT INTO conversations (user_id, user_prompt, ai_response) VALUES (?, ?, ?)',
                [userId, prompt, cachedResult.context_summary]
            );
            res.json({ message: cachedResult.context_summary, source: 'cache' });
        } else {
            // CACHE MISS
            console.log('Cache miss. Researching...');
            const analysisResult = await analyzeCode(prompt); // Call the new local analyzer

            console.log('Code Analyzer Result:', analysisResult);

            let summary;
            let sourceFiles;

            if (analysisResult.files && analysisResult.files.length > 0) {
                summary = `Based on my analysis, I have identified several key files related to your prompt: ${analysisResult.files.join(', ')}. This information can be used to brainstorm innovative ideas.`;
                sourceFiles = JSON.stringify(analysisResult.files);
            } else {
                summary = `I couldn't find any specific files directly related to your prompt: "${prompt}". Perhaps try a different phrasing or a broader topic.`;
                sourceFiles = '[]';
            }

            await db.run(
                'INSERT INTO knowledge_cache (query_trigger, context_summary, source_files) VALUES (?, ?, ?)',
                [prompt, summary, sourceFiles]
            );

            await db.run(
                'INSERT INTO conversations (user_id, user_prompt, ai_response) VALUES (?, ?, ?)',
                [userId, prompt, summary]
            );
            
            console.log('New knowledge saved to cache.');
            res.json({ message: summary, source: 'new_research' });
        }
    } catch (error) {
        console.error('Error in /ask endpoint:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// Defensive: ensure `codebase_investigator` exists.
// Place this block after other `require` statements at the top of the file.
let codebase_investigator;
try {
	// Try known/common paths — adjust if your module lives elsewhere.
	// If you have a module file like './codebase_investigator.js', update the path below.
	codebase_investigator = require('./codebase_investigator');
} catch (err) {
	try {
		// Try alternative path if your project uses another layout
		codebase_investigator = require('./lib/codebase_investigator');
	} catch (innerErr) {
		// Fallback stub to prevent server crash. The stub returns an informative error.
		codebase_investigator = {
			async investigate(/* params */) {
				// Return an object/response consistent with how /ask expects results.
				// Adjust shape if your real implementation returns something different.
				return {
					ok: false,
					error: 'codebase_investigator module not found. Install or provide the module at ./codebase_investigator.js'
				};
			}
		};
	}
}

// Start the server
app.listen(port, () => {
    console.log(`🧠 Second Brain server running at http://localhost:${port}`);
});
