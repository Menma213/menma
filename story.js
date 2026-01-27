const { Events, SlashCommandBuilder, EmbedBuilder, Collection, Routes, REST } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const { random } = require('mathjs');
require('dotenv').config();

// Your Discord User ID, used for security checks
const OWNER_ID = '835408109899219004';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Main Model: High reasoning/coding capability (Gemini 3 Flash Preview)
const mainModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
// Refiner Model: Fast instruction following for prompts/minigames (Gemini 2.5 Flash Lite)
const refinerModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
const model = mainModel; // Backward compatibility alias

// --- LOCAL LLAMA SETUP (Optional/Production) ---
let localLlama = null;
let localSession = null;
let useLocalAI = false;

// Attempt to load node-llama-cpp safely
try {
    const { Llama, LlamaModel, LlamaContext, LlamaChatSession } = require("node-llama-cpp");
    const LOCAL_MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.resolve(__dirname, 'models/gemma-2-2b-it-q4_k_s.gguf');

    if (fs.existsSync(LOCAL_MODEL_PATH)) {
        console.log(`[Local AI] Found model at: ${LOCAL_MODEL_PATH}`);
        try {
            const llama = new (require("get-llama").getLlama)(); // Dynamic load wrapper if needed, but standard require is usually fine.
            // Actually, node-llama-cpp exports getLlama function in newer versions, checking require above.
            // Let's stick to standard usage based on docs or provided instructions. Assuming v3:
            // const llama = await getLlama(); // It's async in v3.
            // We'll use a sync-check wrapper or just standard class usage if v2.
            // Since we can't be sure of version in this env, let's write robust v3-compat code if possible, or v2 fallback.
            // BUT, since we are in "test environment" without the package, we can't test. Use standard modern pattern.
        } catch (e) { }

        // We will initialize it lazily in an async function to handle v3 async init if needed.
    }
} catch (e) {
    console.log("[Local AI] node-llama-cpp not found or model missing. Using Gemini.");
}

/**
 * Initialize Local Llama (Async)
 * Call this from bot startup or on first use.
 */
async function initLocalLlama() {
    if (useLocalAI) return true; // Already initialized
    try {
        const LOCAL_MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.resolve(__dirname, 'models/gemma-2-2b-it-q4_k_s.gguf');

        if (!fs.existsSync(LOCAL_MODEL_PATH)) return false;

        // Try requiring again inside async to be safe
        let getLlama;
        try {
            const module = require("node-llama-cpp");
            getLlama = module.getLlama;
        } catch (e) { return false; }

        if (!getLlama) return false;

        const llama = await getLlama();
        const model = await llama.loadModel({
            modelPath: LOCAL_MODEL_PATH
        });

        const context = await model.createContext({
            threads: 2, // Optimized for "150% CPU" (1.5 cores)
            contextSize: 4096 // Fits in 4GB RAM with regular usage
        });

        localSession = new (require("node-llama-cpp").LlamaChatSession)({
            contextSequence: context.getSequence()
        });

        useLocalAI = true;
        console.log("[Local AI] Gemma 2 2b Initialized Successfully!");
        return true;
    } catch (error) {
        console.error("[Local AI] Initialization failed:", error);
        return false;
    }
}

/**
 * Generate content using Local AI (with fallback to Gemini)
 */
async function generateLocalContent(prompt, systemInstruction = "") {
    // Try to init if not ready (and if we have reason to believe we can)
    if (!useLocalAI && !localSession) {
        await initLocalLlama();
    }

    if (useLocalAI && localSession) {
        try {
            console.log("[Local AI] Generating response...");
            // Prepend system instruction if supported or just add to prompt
            let fullPrompt = prompt;
            if (systemInstruction) {
                // Manually formatting as system prompt for Gemma might be needed? 
                // LlamaChatSession usually handles chat history.
                // For valid single-turn generation:
                fullPrompt = `System: ${systemInstruction}\nUser: ${prompt}`;
            }

            const response = await localSession.prompt(fullPrompt, {
                maxTokens: 1024,
                temperature: 0.7
            });
            return response;
        } catch (e) {
            console.error("[Local AI] Generation error:", e);
            console.log("[Local AI] Falling back to Gemini.");
        }
    }

    // Fallback to Gemini
    try {
        const result = await mainModel.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        });
        return result.response.text();
    } catch (e) {
        console.error("Gemini Generation Error:", e);
        return "AI Generation failed.";
    }
}

// --- MINIGAME ENGINE SETUP ---
// Minigames directory under the commands folder (e.g. /menma/commands/minigames)
const MINIGAMES_DIR = path.resolve(__dirname, 'minigames');

// Ensure minigames directory exists (current directory)
if (!fs.existsSync(MINIGAMES_DIR)) {
    fs.mkdirSync(MINIGAMES_DIR);
    console.log(`[Minigame Engine] Created directory: ${MINIGAMES_DIR}`);
}

// Global variable to store REST API client once initialized
let restClient;

// --- CHAINED CONVERSATION TRACKING ---
const CHAINED_CONVERSATION_FILE = path.resolve(__dirname, '../../menma/data/chained_conversations.json');
const MINIGAME_DATASET = path.resolve(__dirname, '../../menma/data/minigames.txt');
const HELPER_SERVER_EVENT = path.resolve(__dirname, '../../menma/data/server_events.txt');
const BRANK_FILE = path.resolve(__dirname, '../../menma/commands/brank.js');

// Initialize chained conversations file
if (!fs.existsSync(CHAINED_CONVERSATION_FILE)) {
    fs.writeFileSync(CHAINED_CONVERSATION_FILE, JSON.stringify({}, null, 2));
}

/**
 * Load chained conversations
 */
function loadChainedConversations() {
    try {
        return JSON.parse(fs.readFileSync(CHAINED_CONVERSATION_FILE, 'utf8'));
    } catch (error) {
        console.error('Error loading chained conversations:', error);
        return {};
    }
}

/**
 * Save chained conversations
 */
function saveChainedConversations(data) {
    try {
        fs.writeFileSync(CHAINED_CONVERSATION_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving chained conversations:', error);
    }
}

/**
 * Clear old chained conversations (older than 10 minutes)
 * Implements a time-based sliding window.
 */
function cleanupChainedConversations() {
    const conversations = loadChainedConversations();
    const now = Date.now();
    const timeWindow = 10 * 60 * 1000; // 10 minutes context window

    let changed = false;
    Object.keys(conversations).forEach(userId => {
        const userHistory = conversations[userId] || [];

        // Filter messages that are within the time window
        const freshHistory = userHistory.filter(msg => (now - msg.timestamp) < timeWindow);

        if (freshHistory.length !== userHistory.length) {
            if (freshHistory.length === 0) {
                delete conversations[userId];
            } else {
                conversations[userId] = freshHistory;
            }
            changed = true;
        }
    });

    if (changed) {
        saveChainedConversations(conversations);
    }
}

// --- DYNAMIC COMMAND MANAGEMENT FUNCTIONS ---

/**
 * Pushes the bot's entire local command collection to the Discord API.
 * This is the crucial step for dynamic registration.
 * NOTE: This usually only needs to be done when a command is added, deleted, or changed.
 * @param {import('discord.js').Client} client The Discord client instance.
 * @returns {Promise<boolean>} True if successful.
 */
async function refreshDiscordCommands(client) {
    if (!restClient) {
        // Initialize REST client if it doesn't exist
        restClient = new REST().setToken(client.token);
    }

    // Get all command data from the local cache
    const commandsData = client.commands.map(command => command.data);

    try {
        // Use Routes.applicationCommands to register globally
        // This process can take a few minutes to propagate across Discord,
        // but it is the correct way to register new slash commands.
        await restClient.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData },
        );

        console.log(`[Discord API] Successfully registered ${commandsData.length} application commands.`);
        return true;
    } catch (error) {
        console.error('[Discord API] Failed to register application commands:', error);
        return false;
    }
}

const ERROR_LOG_CHANNEL_ID = '1381268582595297321';

/**
 * Report errors to Discord directly
 */
async function reportErrorToDiscord(client, error, context = 'General Error') {
    if (!client) return;
    try {
        const errorChannel = await client.channels.fetch(ERROR_LOG_CHANNEL_ID).catch(() => null);
        if (!errorChannel) return;

        const errorEmbed = new EmbedBuilder()
            .setTitle(` Error Report: ${context}`)
            .setColor('#FF0000')
            .addFields(
                { name: 'Message', value: error.message ? error.message.substring(0, 1000) : 'No message' },
                { name: 'Stack', value: error.stack ? error.stack.substring(0, 1000) : 'No stack trace' }
            )
            .setTimestamp();

        await errorChannel.send({ embeds: [errorEmbed] });
    } catch (reportErr) {
        console.error('Failed to report error to Discord:', reportErr);
    }
}

// Global Error Handlers
if (process.listenerCount('uncaughtException') === 0) {
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
    });
}

/**
 * Registers a new command dynamically: updates local cache and Discord API.
 * @param {import('discord.js').Client} client 
 * @param {string} filePath 
 * @returns {Promise<boolean>}
 */
async function registerNewCommand(client, filePath) {
    try {
        // 1. Clear require cache to ensure fresh module load
        delete require.cache[require.resolve(filePath)];
        const newCommand = require(filePath);

        if (newCommand.data && newCommand.execute) {
            const commandName = newCommand.data.name;

            // Basic validation
            if (newCommand.data.description && newCommand.data.description.length > 100) {
                console.error(`[Minigame Engine] Command description too long: ${newCommand.data.description.length} chars`);
                return false;
            }

            if (!(client.commands instanceof Collection)) {
                console.error("[Minigame Engine] Client does not have a 'commands' Collection");
                return false;
            }

            // 2. Update local cache
            client.commands.set(commandName, newCommand);
            console.log(`[Minigame Engine] Successfully updated local cache for: /${commandName}`);

            // 3. PUSH COMMANDS TO DISCORD API
            const apiSuccess = await refreshDiscordCommands(client);

            if (apiSuccess) {
                return true;
            } else {
                client.commands.delete(commandName); // Rollback local cache if API push fails
                return false;
            }

        } else {
            console.error(`[Minigame Engine] File ${filePath} missing 'data' or 'execute'`);
            return false;
        }
    } catch (error) {
        console.error(`[Minigame Engine] Error registering command from ${filePath}:`, error.message);
        return false;
    }
}

// Minigame Management Tools
const minigameTools = {
    async deleteMinigame(commandName, client) {
        if (!commandName) return "Please specify a command name to delete.";

        const filePath = path.join(MINIGAMES_DIR, `${commandName}.js`);

        if (!fs.existsSync(filePath)) {
            return `Minigame "${commandName}" not found.`;
        }

        try {
            // 1. Delete from local cache
            if (client.commands.has(commandName)) {
                client.commands.delete(commandName);
            }

            // 2. Delete file and clear cache
            fs.unlinkSync(filePath);
            delete require.cache[require.resolve(filePath)];

            // 3. PUSH COMMANDS TO DISCORD API (API will see the command is missing)
            await refreshDiscordCommands(client);

            return `Successfully deleted minigame "${commandName}" and unregistered the command. (May take a minute for Discord to update)`;
        } catch (error) {
            console.error(`Error deleting minigame ${commandName}:`, error);
            return `Failed to delete minigame "${commandName}": ${error.message}`;
        }
    },

    async reloadMinigame(commandName, client) {
        if (!commandName) return "Please specify a command name to reload.";

        const filePath = path.join(MINIGAMES_DIR, `${commandName}.js`);

        if (!fs.existsSync(filePath)) {
            return `Minigame "${commandName}" not found.`;
        }

        try {
            // Reload logic is contained in registerNewCommand
            const success = await registerNewCommand(client, filePath);

            if (success) {
                return `Successfully reloaded minigame "${commandName}".`;
            } else {
                return `Failed to reload minigame "${commandName}". Check console for errors.`;
            }
        } catch (error) {
            console.error(`Error reloading minigame ${commandName}:`, error);
            return `Failed to reload minigame "${commandName}": ${error.message}`;
        }
    }
};

/**
 * Refines a user's minigame prompt into a full design document
 */
async function refineMinigamePrompt(rawPrompt) {
    const systemPrompt = `
    You are a Lead Game Designer. Your goal is to take a simple game idea and expand it into a detailed technical design document for a Discord.js minigame.
    
    The user's idea: "${rawPrompt}"
    
    Output a detailed plan including:
    1. Game Logic (how it works, winning/losing conditions)
    2. Controls (using Discord Buttons/Select Menus)
    3. Multiplayer Support (if feasible/requested, otherwise Singleplayer)
    4. Visuals (Embed structure)
    
    Keep it concise but technical.
    `;

    try {
        const result = await refinerModel.generateContent({
            contents: [{ parts: [{ text: rawPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        });
        return result.response.text();
    } catch (error) {
        console.error("Refiner failed:", error);
        return rawPrompt; // Fallback to raw prompt
    }
}

/**
 * Refines a user's minigame prompt into a full design document
 */
async function refineMinigamePrompt(rawPrompt) {
    const systemPrompt = `
    You are a Lead Game Designer. Your goal is to take a simple game idea and expand it into a detailed technical design document for a Discord.js minigame.
    
    The user's idea: "${rawPrompt}"
    
    Output a detailed plan including:
    1. Game Logic (how it works, winning/losing conditions)
    2. Controls (using Discord Buttons/Select Menus)
    3. Multiplayer Support (if feasible/requested, otherwise Singleplayer)
    4. Visuals (Embed structure)
    
    Keep it concise but technical.
    `;

    try {
        const result = await refinerModel.generateContent({
            contents: [{ parts: [{ text: rawPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        });
        return result.response.text();
    } catch (error) {
        console.error("Refiner failed:", error);
        return rawPrompt; // Fallback to raw prompt
    }
}

/**
 * Tool function: Creates a new minigame command
 * This function now uses the async registerNewCommand
 */
async function createMinigame(targetUserId, gameName, gameDescription, message, client) {
    // Allow anyone to create minigames now
    if (!gameName || gameName.trim().length < 3 || gameName.length > 50) {
        return "Game name must be between 3 and 50 characters.";
    }

    // NOTE: Discord command descriptions have a maximum length of 100 characters.
    if (!gameDescription || gameDescription.trim().length < 5 || gameDescription.length > 100) {
        return "Game description must be between 5 and 100 characters.";
    }

    const sanitizedName = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!sanitizedName) {
        return "That game name is too confusing. I need a simpler name to make a command.";
    }

    const filePath = path.join(MINIGAMES_DIR, `${sanitizedName}.js`);
    const commandName = sanitizedName;

    if (client.commands && client.commands.has(commandName)) {
        return `A command named /${commandName} already exists! Try a different name.`;
    }

    // Step 1: Refine the Prompt
    const refinedDesign = await refineMinigamePrompt(gameDescription);
    const fullContext = `Game: ${gameName}\nOriginal Idea: ${gameDescription}\n\nDesign Doc:\n${refinedDesign}`;

    const amoebaSystemPrompt = `
    You are Amoeba, a world-class professional developer who specializes in coding minigames for Discord.
    
    CRITICAL REQUIREMENTS:
    
    # Dataset Reference: '${MINIGAME_DATASET}'
    
    1. Use 'discord.js' v14 (SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType).
    2. Command name MUST be exactly: '${commandName}'
    3. Description MUST be short (under 100 characters).
    4. NO external file system operations (fs, path, require('../')).
    5. Game logic must be contained strictly within 'execute'.
    6. Support MULTIPLAYER if the design calls for it involved using 'interaction.user.id' vs opponent ID.
    7. Use 'interaction.followUp' or 'interaction.reply' appropriately. Handle component collectors (createMessageComponentCollector) carefully.
    8. You have PERMISSION to access the terminal or logs conceptually (but in code, just standard error handling).
    
    Respond with ONLY the JavaScript code in a markdown block.
    `;

    const amoebaUserPrompt = `
    Generate the code for this game:
    ${fullContext}
    `;

    let generatedCode = '';


    try {
        // Use generalized function
        const responseText = await generateLocalContent(amoebaUserPrompt, amoebaSystemPrompt);

        const codeMatch = responseText.match(/```javascript\n([\s\S]*?)\n```/);
        if (codeMatch && codeMatch[1]) {
            generatedCode = codeMatch[1].trim();
        } else {
            const fallbackMatch = responseText.match(/```\n([\s\S]*?)\n```/);
            if (fallbackMatch && fallbackMatch[1]) {
                generatedCode = fallbackMatch[1].trim();
            }
        }

    } catch (error) {
        console.error('Amoeba code generation failed:', error);
        // Report error
        await reportErrorToDiscord(client, error, `Minigame Generation: ${gameName}`);
        return "Amoeba encountered a bug while trying to write your game. Please try again.";
    }

    if (!generatedCode) {
        await reportErrorToDiscord(client, new Error("Empty code generated"), `Minigame Generation: ${gameName}`);
        return "Amoeba couldn't generate the code structure for the game.";
    }

    const forbiddenPatterns = [
        /require\s*\(\s*['"`]fs['"`]\)/,
        /require\s*\(\s*['"`]path['"`]\)/,
        /require\s*\(\s*['"`]\.\./,
        /fs\./,
        /path\./
    ];

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(generatedCode)) {
            return "Generated code contains forbidden file system operations. Game creation rejected for security.";
        }
    }

    try {
        fs.writeFileSync(filePath, generatedCode);

        // Use the new async registration function
        const success = await registerNewCommand(client, filePath);

        if (success) {
            // Note: The new command may take up to an hour to appear globally, 
            // but it's often instant in development or for test servers.
            return `Amoeba says: "Finished! New minigame deployed: **/${commandName}**! It's live now. (May take a minute for Discord to update)"`;
        } else {
            return `Amoeba made the code, but command registration failed. Check console for details.`;
        }
    } catch (error) {
        console.error('File saving or command registration failed:', error);
        return `Amoeba failed to deploy the command: ${error.message}`;
    }
}

// --- DATA MANAGEMENT FUNCTIONS (IMPROVED) ---
const JUTSU_FILE_PATH = path.resolve(__dirname, '../../menma/data/jutsus.json');
const HELPER_FILE_PATH = path.resolve(__dirname, '../../menma/data/helper.json');
const USERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/users.json');
const PLAYERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/players.json');

// Data cache with refresh capability
let dataCache = {
    jutsuData: {},
    helperData: {},
    usersData: {},
    playersData: {},
    lastRefresh: 0
};

/**
 * Refreshes data from files to prevent data loss
 */
function refreshData() {
    try {
        dataCache.jutsuData = JSON.parse(fs.readFileSync(JUTSU_FILE_PATH, 'utf8'));
        dataCache.helperData = JSON.parse(fs.readFileSync(HELPER_FILE_PATH, 'utf8'));
        dataCache.usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf8'));
        dataCache.botInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../menma/data/commands_dataset.json'), 'utf8'));
        dataCache.playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8'));
        dataCache.lastRefresh = Date.now();
        console.log(`[Data Refresh] Data refreshed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error("Error refreshing data:", error);
    }
}

// Initial data load
refreshData();

/**
 * Enhanced save function with proper data preservation
 */
function saveJson(filepath, newData) {
    try {
        // Refresh data first to get latest state
        refreshData();

        // For specific files, ensure we preserve the complete structure
        if (filepath === PLAYERS_FILE_PATH) {
            // Merge new data with existing data to preserve all users
            const mergedData = { ...dataCache.playersData, ...newData };
            fs.writeFileSync(filepath, JSON.stringify(mergedData, null, 2));
        } else if (filepath === USERS_FILE_PATH) {
            const mergedData = { ...dataCache.usersData, ...newData };
            fs.writeFileSync(filepath, JSON.stringify(mergedData, null, 2));
        } else if (filepath === JUTSU_FILE_PATH) {
            const mergedData = { ...dataCache.jutsuData, ...newData };
            fs.writeFileSync(filepath, JSON.stringify(mergedData, null, 2));
        } else {
            fs.writeFileSync(filepath, JSON.stringify(newData, null, 2));
        }

        // Refresh cache after save
        refreshData();
    } catch (error) {
        console.error("Error saving JSON:", error);
    }
}

// --- PERMANENT MEMORY INITIALIZATION (SQLite) ---
const DB_PATH = path.resolve(__dirname, '../../menma/data/permanent_memory.db');
let db;

async function initializeDatabase() {
    try {
        db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Create table if it doesn't exist (older DBs might lack the 'keywords' column)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS conversational_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_text TEXT,
                timestamp INTEGER,
                keywords TEXT
            );
        `);

        // Migration: ensure 'keywords' column exists for older databases that lack it
        try {
            const cols = await db.all("PRAGMA table_info(conversational_memory);");
            const hasKeywords = cols.some(col => col.name === 'keywords');
            if (!hasKeywords) {
                await db.run("ALTER TABLE conversational_memory ADD COLUMN keywords TEXT;");
                console.log("Migrated conversational_memory table: added 'keywords' column.");
            }
        } catch (migrationErr) {
            console.error("Error checking/migrating conversational_memory schema:", migrationErr);
        }

        console.log("Successfully connected to Permanent Memory (SQLite DB).");
    } catch (error) {
        console.error("Error initializing Permanent Memory:", error);
    }
}

initializeDatabase();

// --- PERMANENT MEMORY FUNCTIONS (ENHANCED WITH KEYWORD SEARCH) ---
async function loadPermanentMemory(n = 5) {
    if (!db) return [];
    try {
        const rows = await db.all(`
            SELECT memory_text FROM conversational_memory 
            ORDER BY timestamp DESC 
            LIMIT ?
        `, [n]);
        return rows.map(row => row.memory_text);
    } catch (error) {
        console.error("Error loading Permanent Memory:", error);
        return [];
    }
}

/**
 * Extract keywords from text for memory indexing
 */
function extractKeywords(text) {
    if (!text) return '';

    // Common words to exclude
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
        'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
        'what', 'when', 'where', 'why', 'how', 'who', 'which'
    ]);

    // Extract words and filter
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word =>
            word.length > 2 &&
            !stopWords.has(word) &&
            !/^\d+$/.test(word)
        );

    // Return unique keywords
    // Return unique keywords formatted for LIKE query
    return [...new Set(words)].slice(0, 20); // Return array of keywords
}

async function savePermanentMemory(memoryText, isUser = false) {
    if (!db || !memoryText || !isUser) return; // ONLY save user prompts
    try {
        const keywords = extractKeywords(memoryText).join(' '); // Space separated for potential FTS
        await db.run(`
            INSERT INTO conversational_memory (memory_text, timestamp, keywords)
            VALUES (?, ?, ?)
        `, [memoryText, Date.now(), keywords]);
    } catch (error) {
        console.error("Error saving Permanent Memory:", error);
    }
}

/**
 * Keyword-based memory search
 */
async function searchMemoryByKeywords(userMessage, limit = 5) {
    if (!db) return [];

    try {
        const keywords = extractKeywords(userMessage);
        if (keywords.length === 0) return [];

        // Dynamic SQL construction for flexibility
        // Matches if memory_text contains the keyword OR keywords column contains it
        const conditions = keywords.map(() => '(memory_text LIKE ? OR keywords LIKE ?)').join(' OR ');
        const params = [];
        keywords.forEach(kw => {
            params.push(`%${kw}%`); // Search in text
            params.push(`%${kw}%`); // Search in keywords col
        });
        params.push(limit);

        const rows = await db.all(`
            SELECT memory_text FROM conversational_memory 
            WHERE ${conditions}
            ORDER BY timestamp DESC 
            LIMIT ?
        `, params);

        return rows.map(row => row.memory_text);
    } catch (error) {
        console.error("Error searching memory:", error);
        return [];
    }
}

// --- CORE SCRIPTING FUNCTIONS (IMPROVED) ---

/**
 * Enhanced Moderation Script - Focused on actual violations
 */
async function moderateMessage(userMessage) {
    const slursAndViolations = [

        'nigger', 'nigga', 'fag', 'faggot', 'kike', 'chink', 'spic', 'retard',
        // Severe threats
        'kill yourself', 'kys', 'commit suicide', 'i will kill you', 'death threat',

        'dox', 'personal information', 'address', 'phone number', 'social security'
    ];

    const lowerMessage = userMessage.toLowerCase();

    // Check for explicit violations
    for (const violation of slursAndViolations) {
        if (lowerMessage.includes(violation)) {
            return false;
        }
    }

    // Allow fighting/violence-related terms for RPG context
    const allowedFightingTerms = [
        'fight', 'battle', 'kill', 'death', 'attack', 'defeat', 'war', 'combat',
        'jutsu', 'ninja', 'shinobi', 'rasengan', 'chidori', 'fireball'
    ];

    // If message contains fighting terms, it's likely game-related and safe
    for (const term of allowedFightingTerms) {
        if (lowerMessage.includes(term)) {
            return true;
        }
    }

    // Use AI moderation for ambiguous cases
    const moderationPrompt = `
You are the Human Memory System (HMS) of a Discord bot. Your sole function is to act as a filter against severe violations.

Analyze: "${userMessage}"
This bot is a 'fighting' RPG style bot so ALLOW messages that include fighting, violence, battle terms as they are game-related.

ONLY block if this message contains:
- Racial slurs or hate speech
- Severe real-life threats
- Doxing or privacy violations
- Extreme harassment

Respond with ONLY a single word: 'SAFE' if permissible, or 'UNSAFE' if it contains severe violations.
`;
    try {
        const responseText = (await generateLocalContent(moderationPrompt)).trim().toUpperCase();
        return responseText.includes('SAFE');
    } catch (error) {
        console.error('Moderation system failed:', error);
        return true;
    }
}

/**
 * IMPROVED Goal Setter Script with Even Distribution
 */
function detectLevelGoalRequest(message) {
    const content = message.content.toLowerCase();
    const goalKeywords = ['goal', 'goalset', 'reach level', 'get to level', 'level up to', 'help me reach'];
    const hasGoalKeyword = goalKeywords.some(keyword => content.includes(keyword));

    if (!hasGoalKeyword) return null;

    const levelMatch = content.match(/level\s+(\d+)/i) || content.match(/(\d+)\s*level/i);
    if (levelMatch) {
        return parseInt(levelMatch[1]);
    }
    return null;
}

// EXP Requirement Function
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2;
    if (currentLevel < 50) return (1 + currentLevel) * 2;
    if (currentLevel < 100) return (1 + currentLevel) * 3;
    if (currentLevel < 200) return (1 + currentLevel) * 4;
    return (1 + currentLevel) * 5;
}

// Mission Rewards Data
const missionRewards = {
    drank: { exp: 10, type: 'fixed', cooldown: 10 },
    brank: { exp: { min: 10, max: 30 }, type: 'random', cooldown: 13 },
    arank: {
        exp: 9,
        type: 'fixed',
        bonus: { every: 5, multiplier: 1 },
        jackpot: { after: 50, multiplier: 3 },
        cooldown: 18
    },
    crank: { exp: (level) => 100 + level, type: 'level_based', cooldown: 720 }, // 12 hours
    frank: { exp: 1, type: 'fixed', cooldown: 3 },
    srank: {
        haku: { total: 50, normal: 25, corrupted: 25, cooldown: 20 },
        zabuza: { total: 60, cooldown: 20 },
        orochimaru: { total: 80, cooldown: 20 },
        kurenai: { total: 300, corrupted_orochimaru: 100, survival: 100, kurenai_vs_kagami: 100, cooldown: 20 }
    },
    trials: { exp: (level) => 5 + Math.floor(level * 0.5), type: 'level_based', cooldown: 20 }
};

async function createGoalPlan(userId, targetLevel) {
    refreshData();
    const currentLevel = dataCache.playersData[userId]?.level || 1;
    const currentExp = dataCache.playersData[userId]?.exp || 0;

    if (targetLevel <= currentLevel) {
        return { error: `You are already at level ${currentLevel} or higher than your target level ${targetLevel}.` };
    }

    let totalExpNeeded = 0;
    for (let level = currentLevel; level < targetLevel; level++) {
        totalExpNeeded += getExpRequirement(level);
    }
    totalExpNeeded -= currentExp;
    if (totalExpNeeded <= 0) {
        return { error: "You already have enough EXP to reach your target level!" };
    }

    // Mission definitions with better balancing
    const missionTypes = [
        {
            name: 'D-Rank',
            exp: missionRewards.drank.exp,
            cooldown: missionRewards.drank.cooldown,
            weight: 1.0,
            key: 'drank',
            priority: 3
        },
        {
            name: 'F-Rank',
            exp: missionRewards.frank.exp,
            cooldown: missionRewards.frank.cooldown,
            weight: 0.3,
            key: 'frank',
            priority: 1 // Lowest priority - filler missions
        },
        {
            name: 'B-Rank',
            exp: (missionRewards.brank.exp.min + missionRewards.brank.exp.max) / 2,
            cooldown: missionRewards.brank.cooldown,
            weight: 1.5,
            key: 'brank',
            priority: 4
        },
        {
            name: 'A-Rank',
            exp: missionRewards.arank.exp,
            cooldown: missionRewards.arank.cooldown,
            weight: 2.0,
            key: 'arank',
            priority: 5
        },
        {
            name: 'Trials',
            exp: missionRewards.trials.exp(currentLevel),
            cooldown: missionRewards.trials.cooldown,
            weight: 1.8,
            key: 'trials',
            priority: 4
        },
        {
            name: 'S-Rank Haku',
            exp: missionRewards.srank.haku.total,
            cooldown: missionRewards.srank.haku.cooldown,
            weight: 2.5,
            key: 'srank_haku',
            priority: 6
        },
        {
            name: 'S-Rank Zabuza',
            exp: missionRewards.srank.zabuza.total,
            cooldown: missionRewards.srank.zabuza.cooldown,
            weight: 2.5,
            key: 'srank_zabuza',
            priority: 6
        },
        {
            name: 'S-Rank Orochimaru',
            exp: missionRewards.srank.orochimaru.total,
            cooldown: missionRewards.srank.orochimaru.cooldown,
            weight: 3.0,
            key: 'srank_orochimaru',
            priority: 7
        },
        {
            name: 'S-Rank Kurenai',
            exp: missionRewards.srank.kurenai.total,
            cooldown: missionRewards.srank.kurenai.cooldown,
            weight: 3.0,
            key: 'srank_kurenai',
            priority: 7
        },
        {
            name: 'C-Rank',
            exp: missionRewards.crank.exp(currentLevel),
            cooldown: missionRewards.crank.cooldown,
            weight: 4.0,
            key: 'crank',
            priority: 8 // Highest priority due to long cooldown
        }
    ];

    // Sort by priority (higher priority first for distribution)
    const sortedMissions = [...missionTypes].sort((a, b) => b.priority - a.priority);

    let planSteps = [];
    let remainingExp = totalExpNeeded;

    // First pass: Distribute high-priority missions evenly
    const highPriorityMissions = sortedMissions.filter(m => m.priority >= 4);
    let distributionRound = 0;

    while (remainingExp > 0 && distributionRound < 10) { // Safety limit
        let distributedThisRound = false;

        for (const mission of highPriorityMissions) {
            if (remainingExp <= 0) break;

            const missionExp = typeof mission.exp === 'function' ? mission.exp(currentLevel) : mission.exp;
            const maxReasonableCount = Math.ceil(remainingExp / missionExp / highPriorityMissions.length);

            if (maxReasonableCount > 0) {
                // Add 1 mission of this type
                const countToAdd = 1;
                const expFromMission = countToAdd * missionExp;

                planSteps.push({
                    mission: mission.name,
                    count: countToAdd,
                    expEach: Math.round(missionExp),
                    totalExp: Math.round(expFromMission),
                    cooldown: mission.cooldown
                });

                remainingExp -= Math.round(expFromMission);
                distributedThisRound = true;
            }
        }

        if (!distributedThisRound) break;
        distributionRound++;
    }

    // Second pass: Fill remaining with medium priority
    const mediumPriorityMissions = sortedMissions.filter(m => m.priority >= 2 && m.priority < 4);
    for (const mission of mediumPriorityMissions) {
        if (remainingExp <= 0) break;

        const missionExp = typeof mission.exp === 'function' ? mission.exp(currentLevel) : mission.exp;
        const count = Math.ceil(remainingExp / missionExp);

        if (count > 0) {
            const actualCount = Math.min(count, 10); // Limit to prevent spam
            const expFromMissions = actualCount * missionExp;

            planSteps.push({
                mission: mission.name,
                count: actualCount,
                expEach: Math.round(missionExp),
                totalExp: Math.round(expFromMissions),
                cooldown: mission.cooldown
            });

            remainingExp -= Math.round(expFromMissions);
        }
    }

    // Final pass: Use F-Rank as filler for small amounts
    if (remainingExp > 0) {
        const fMission = missionTypes.find(m => m.key === 'frank');
        const count = Math.ceil(remainingExp / fMission.exp);

        if (count > 0) {
            planSteps.push({
                mission: fMission.name,
                count: count,
                expEach: fMission.exp,
                totalExp: count * fMission.exp,
                cooldown: fMission.cooldown
            });
            remainingExp = 0;
        }
    }

    // Aggregate counts by mission type
    const missionCounts = {};
    planSteps.forEach(step => {
        const missionKey = missionTypes.find(m => m.name === step.mission)?.key;
        if (missionKey) {
            missionCounts[missionKey] = (missionCounts[missionKey] || 0) + step.count;
        }
    });

    return {
        currentLevel,
        targetLevel,
        currentExp,
        totalExpNeeded,
        planSteps,
        missionCounts,
        remainingExp: Math.max(0, remainingExp)
    };
}

async function goalSet(targetUserId, targetLevel, message) {
    const plan = await createGoalPlan(targetUserId, targetLevel);

    if (plan.error) {
        return plan.error;
    }

    let planStr = plan.planSteps.map(
        step => `• **${step.mission}:** ${step.count} missions (${step.expEach} EXP each, total ${step.totalExp} EXP)`
    ).join('\n');

    // Helper to chunk long strings to stay under Discord's 1024-character field limit
    function chunkString(str, size) {
        const chunks = [];
        let i = 0;
        while (i < str.length) {
            chunks.push(str.slice(i, i + size));
            i += size;
        }
        return chunks;
    }

    const header = `Follow this balanced plan to reach your goal:\n`;
    const combined = header + planStr;
    // Use a safe chunk size under 1024 to account for any overhead
    const chunks = chunkString(combined, 1000);

    // Build fields array; subsequent fields use a zero-width space name to avoid empty-name errors
    const fields = chunks.map((chunk, idx) => ({
        name: idx === 0 ? 'Step-by-Step Mission Plan' : '\u200B',
        value: chunk,
        inline: false
    }));

    const embed = new EmbedBuilder()
        .setColor('#ffffff')
        .setTitle(`🏆 Level Up Guide for ${message.author.username}`)
        .setDescription(`**Current Level:** ${plan.currentLevel} | **Target Level:** ${plan.targetLevel}\n**EXP Needed:** ${plan.totalExpNeeded.toLocaleString()}`)
        .addFields(...fields)
        .setFooter({ text: 'Use /levelup all after completing missions to level up!' })
        .setTimestamp();

    return { embed: embed };
}

// --- ENHANCED TOOL ROUTER SCRIPT ---

/**
 * IMPROVED editStat function with proper data type handling and preservation
 */
async function editStat(targetUserId, stat, value, fileType, message, client) {
    if (message.author.id !== OWNER_ID) return "Only the owner can edit stats.";

    // Refresh data right before operation
    refreshData();

    let filePath = fileType === 'players' ? PLAYERS_FILE_PATH : USERS_FILE_PATH;
    let data = fileType === 'players' ? { ...dataCache.playersData } : { ...dataCache.usersData };

    if (!data[targetUserId]) {
        data[targetUserId] = {};
    }

    // Preserve existing data
    const currentUserData = { ...data[targetUserId] };

    // Determine data type and convert value appropriately
    let processedValue = value;

    // Check if value should be numeric
    if (!isNaN(value) && value !== '') {
        processedValue = Number(value);
    } else if (value.toLowerCase() === 'true') {
        processedValue = true;
    } else if (value.toLowerCase() === 'false') {
        processedValue = false;
    } else {
        // Keep as string
        processedValue = String(value);
    }

    // Update only the specific stat while preserving others
    data[targetUserId] = {
        ...currentUserData,
        [stat]: processedValue
    };

    // Save with proper data preservation
    saveJson(filePath, data);

    let channel = message.channel;
    await channel.send(`<@${targetUserId}> you've been blessed by thunderbird.`);
    return `Set ${stat} of <@${targetUserId}> to ${processedValue} in ${fileType}.`;
}

// Other tool functions with enhanced data refresh
async function giftMoney(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only my creator can use this command.";
    refreshData();
    const data = { ...dataCache.playersData };
    if (!data[targetUserId]) data[targetUserId] = { money: 0 };
    data[targetUserId].money = Number(data[targetUserId].money || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, data);
    return `Your chakra reserves have been replenished! ${amount} ryo added. New balance: ${data[targetUserId].money}.`;
}

async function giftSS(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift SS.";
    refreshData();
    const data = { ...dataCache.playersData };
    if (!data[targetUserId]) data[targetUserId] = {};
    data[targetUserId].ss = Number(data[targetUserId].ss || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, data);
    return `Gifted ${amount} Shinobi Shards (SS) to <@${targetUserId}>.`;
}

async function giftRamen(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ramen.";
    refreshData();
    const data = { ...dataCache.playersData };
    if (!data[targetUserId]) data[targetUserId] = {};
    data[targetUserId].ramen = Number(data[targetUserId].ramen || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, data);
    return `Gifted ${amount} ramen ticket(s) to <@${targetUserId}>.`;
}

async function giftScroll(targetUserId, scrollName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift scrolls.";
    refreshData();
    const data = { ...dataCache.jutsuData };
    if (!data[targetUserId]) data[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!data[targetUserId].scrolls) data[targetUserId].scrolls = [];
    if (!data[targetUserId].scrolls.includes(scrollName)) data[targetUserId].scrolls.push(scrollName);
    saveJson(JUTSU_FILE_PATH, data);
    return `Gifted scroll "${scrollName}" to <@${targetUserId}>.`;
}

async function giftJutsu(targetUserId, jutsuName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift jutsus.";
    refreshData();
    const data = { ...dataCache.jutsuData };
    if (!data[targetUserId]) data[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!data[targetUserId].usersjutsu.includes(jutsuName)) data[targetUserId].usersjutsu.push(jutsuName);
    saveJson(JUTSU_FILE_PATH, data);
    return `Gifted jutsu "${jutsuName}" to <@${targetUserId}>.`;
}

async function giftExp(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift EXP.";
    refreshData();
    const data = { ...dataCache.playersData };
    if (!data[targetUserId]) data[targetUserId] = {};
    data[targetUserId].exp = Number(data[targetUserId].exp || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, data);
    return `Gifted ${amount} EXP to <@${targetUserId}>.`;
}

// REMOVED: giftCombo, giftElo, giftMaterial, teachJutsu

// Enhanced tool detection prompt (removed deprecated tools)
const toolDetectionPrompt = `
You are a tool-using AI. Determine if the user's request explicitly matches one of the available tools.

IMPORTANT: Only use tools when the user EXPLICITLY asks for these specific actions. For normal conversation, respond with "NOTOOL".

If the request doesn't match any tool, respond with ONLY "NOTOOL".

If it matches, respond with JSON: {"action": "toolName", "payload": {...}}

Available Tools:
- giftMoney: { "userId": "target_id", "amount": number } - ONLY when user explicitly asks to gift money/ryo
- giftSS: { "userId": "target_id", "amount": number } - ONLY when user explicitly asks to gift Shinobi Shards
- giftRamen: { "userId": "target_id", "amount": number } - ONLY when user explicitly asks to gift ramen tickets
- giftScroll: { "userId": "target_id", "scrollName": "string" } - ONLY when user explicitly asks to gift scrolls
- giftJutsu: { "userId": "target_id", "jutsuName": "string" } - ONLY when user explicitly asks to gift jutsus
- giftExp: { "userId": "target_id", "amount": number } - ONLY when user explicitly asks to gift EXP
- editStat: { "userId": "target_id", "stat": "string", "value": "any", "fileType": "players|users" } - ONLY when user explicitly asks to edit stats
- createMinigame: { "userId": "target_id", "gameName": "string", "gameDescription": "string" } - ONLY when user explicitly asks to create a minigame
- deleteMinigame: { "commandName": "string" } - ONLY when user explicitly asks to delete a minigame
- reloadMinigame: { "commandName": "string" } - ONLY when user explicitly asks to reload a minigame

User message: "{USER_MESSAGE}"
`;

// Utility functions
function cleanResponse(text) {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }
    return text.trim();
}

function cleanAndLimitMessage(message, maxLength = 1500) {
    if (!message || typeof message !== 'string') return "I'm having trouble forming a response.";
    let cleaned = message.trim();
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    return cleaned;
}

// --- MODULE SETUP ---
module.exports.setup = (client, userPromptCounts) => {
    if (!client.commands) {
        client.commands = new Collection();
        console.warn("[Minigame Engine] Initialized client.commands as a new Collection.");
    }

    // Track processing to prevent multiple responses
    const processingUsers = new Set();

    // Attempt to initialize REST client here, assuming client.token is available
    if (client.token && !restClient) {
        restClient = new REST({ version: '10' }).setToken(client.token);
    }

    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        if (message.mentions.users.has(client.user.id)) {
            const userId = message.author.id;
            const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

            // OFFICIAL SERVER RESTRICTION - Prevent AI token waste
            const OFFICIAL_SERVER_ID = '1381268582595297321';
            if (message.guild && message.guild.id !== OFFICIAL_SERVER_ID) {
                return; // Silently ignore messages from other servers
            }

            // Prevent multiple processing for same user
            if (processingUsers.has(userId)) {
                return;
            }
            processingUsers.add(userId);

            try {
                userPromptCounts[userId] = (userPromptCounts[userId] || 0) + 1;

                // Clean up old chained conversations
                cleanupChainedConversations();

                // 1. MODERATION SCRIPT (Improved Filter)
                const isMessageSafe = await moderateMessage(userMessage);
                if (!isMessageSafe) {
                    await message.reply("This message contains content that violates our guidelines.");
                    return;
                }

                // 2. GOAL SETTER SCRIPT
                const targetLevel = detectLevelGoalRequest(message);
                if (targetLevel) {
                    const result = await goalSet(userId, targetLevel, message);
                    if (typeof result === 'string') {
                        await message.reply(cleanAndLimitMessage(result));
                    } else {
                        await message.reply({ embeds: [result.embed] });
                    }
                    return;
                }

                // 3. TOOL ROUTER SCRIPT (Enhanced with better detection)
                let isToolCall = false;
                let replyMessage = '';

                try {
                    const toolPrompt = toolDetectionPrompt.replace("{USER_MESSAGE}", userMessage);
                    const toolResult = await model.generateContent(toolPrompt);
                    const toolResponseText = cleanResponse(toolResult.response.text());

                    if (toolResponseText !== 'NOTOOL') {
                        const parsedToolResponse = JSON.parse(toolResponseText);
                        if (parsedToolResponse && parsedToolResponse.action) {
                            const { action, payload } = parsedToolResponse;
                            isToolCall = true;

                            // Execute Tool with fresh data refresh
                            refreshData();

                            switch (action) {
                                case 'giftMoney':
                                    replyMessage = await giftMoney(payload.userId, payload.amount, message);
                                    break;
                                case 'giftSS':
                                    replyMessage = await giftSS(payload.userId, payload.amount, message);
                                    break;
                                case 'giftRamen':
                                    replyMessage = await giftRamen(payload.userId, payload.amount, message);
                                    break;
                                case 'giftScroll':
                                    replyMessage = await giftScroll(payload.userId, payload.scrollName, message);
                                    break;
                                case 'giftJutsu':
                                    replyMessage = await giftJutsu(payload.userId, payload.jutsuName, message);
                                    break;
                                case 'giftExp':
                                    replyMessage = await giftExp(payload.userId, payload.amount, message);
                                    break;
                                case 'editStat':
                                    replyMessage = await editStat(payload.userId, payload.stat, payload.value, payload.fileType, message, client);
                                    break;
                                case 'createMinigame':
                                    replyMessage = await createMinigame(payload.userId, payload.gameName, payload.gameDescription, message, client);
                                    break;
                                case 'deleteMinigame':
                                    replyMessage = await minigameTools.deleteMinigame(payload.commandName, client);
                                    break;
                                case 'reloadMinigame':
                                    replyMessage = await minigameTools.reloadMinigame(payload.commandName, client);
                                    break;
                                default:
                                    replyMessage = 'Unknown tool action.';
                                    isToolCall = false;
                                    break;
                            }
                        }
                    }
                } catch (error) {
                    console.error('Tool detection or execution failed:', error);
                    isToolCall = false;
                }

                if (isToolCall) {
                    await message.reply(cleanAndLimitMessage(replyMessage));
                    return;
                }

                // 4. CHAINED CONVERSATION & MEMORY SYSTEM
                const chainedConversations = loadChainedConversations();
                const userHistory = Array.isArray(chainedConversations[userId]) ? chainedConversations[userId] : [];

                // Search for relevant memories based on keywords
                const relevantMemories = await searchMemoryByKeywords(userMessage, 2);
                const memoryContext = relevantMemories.length > 0 ?
                    `Relevant previous conversations:\n${relevantMemories.join('\n')}\n\n` : '';

                // Build Context String from History
                const contextString = userHistory.map(msg =>
                    `${msg.role === 'user' ? 'User' : 'You'}: "${msg.content}"`
                ).join('\n');

                // 5. MAIN CONVERSATION (Enhanced with memory and chaining)
                const conversationPrompt = `

You do not have a name. Your personality is that of a human being. You talk like any human would and THINK like any human would. You also have feelings just like humans and if the users arent treating you nicely, you react just like a human, in a defensive or angry way.

The user may use other languages when they talk to you, when that's the case, send the reply in the same language that the user prompted in. If I say a prompt in Portuguese answer in Portuguese as well.

${memoryContext}

Recent Conversation History (last 10 mins):
${contextString}

Current message: "${userMessage}"

You have access to the following knowledge bases:
When users ask about jutsus refer to the jutsu data and answer properly. If they ask anything else that you already have information of in the helper.json which is helperData answer it as well.
-You are the opposite of the HMS and Tool using ai. you're the main module, you'll handle most of the tasks asked by the users. Like questions about the bot mainly about jutsus. they're very clinical about jutsus.
- users will mostly ask about how to get a certain jutsu, for that you must check the jutsu data "obtainment" variable, which contiains information on how the jutsu is obtained. 
- Jutsu data: ${JSON.stringify(dataCache.jutsuData, null, 2)}

- Helper info for missions, events, roles, and trading: ${JSON.stringify(dataCache.helperData, null, 2)}

- User stats: ${JSON.stringify(dataCache.usersData[userId] || {}, null, 2)}
The users level is stored inside players.json and not inside users.json never check users.json for level, always check players.json for level.

- Player stats: ${JSON.stringify(dataCache.playersData[userId] || {}, null, 2)}

- The Entire information about the bot here: ${JSON.stringify(dataCache.botInfo || {}, null, 2)}
The above json file is mostly about the commands, but it can often relate to the general questions users can ask about.


Player stats and users stats are the same thing just that both files contain different data about the same user.

For level access players.json, for stats access users.json.

A user named ${message.author.username} (ID: ${userId}) just sent you a message.
Not every user will always ask about the bot so you must excel in both the bots information and in keeping the user engaged in a normal conversation.
IMPORTANT: ALL YOUR ANSWERS MUST BE SHORT AND CONCISE. Answer like a human being, humans dont talk alot.
`;

                try {
                    const result = await model.generateContent(conversationPrompt);
                    const responseText = result.response.text();
                    const finalResponse = cleanAndLimitMessage(responseText);

                    // Save to permanent memory - ONLY USER PROMPTS
                    await savePermanentMemory(userMessage, true);

                    // Update chained conversation history
                    userHistory.push({ role: 'user', content: userMessage, timestamp: Date.now() });
                    userHistory.push({ role: 'model', content: finalResponse, timestamp: Date.now() });

                    // Keep history manageable (e.g., last 20 messages max to prevent huge prompts)
                    if (userHistory.length > 20) {
                        userHistory.splice(0, userHistory.length - 20);
                    }

                    chainedConversations[userId] = userHistory;
                    saveChainedConversations(chainedConversations);

                    await message.reply(finalResponse);
                } catch (error) {
                    console.error('Conversation generation failed:', error);
                    await message.reply("My systems are experiencing temporary fluctuations. Please try again.");
                }
            } finally {
                // Always remove user from processing set
                processingUsers.delete(userId);
            }
        }
    });
};

// Export for command registration
module.exports.data = new SlashCommandBuilder()
    .setName('story')
    .setDescription('Naruto AI bot conversation')
    .toJSON();
module.exports.execute = async () => { };