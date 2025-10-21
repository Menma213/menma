const { Events, SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// --- MINIGAME ENGINE SETUP ---
const MINIGAMES_DIR = __dirname;

// Ensure minigames directory exists (current directory)
if (!fs.existsSync(MINIGAMES_DIR)) {
    fs.mkdirSync(MINIGAMES_DIR);
    console.log(`[Minigame Engine] Created directory: ${MINIGAMES_DIR}`);
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
            if (client.commands.has(commandName)) {
                client.commands.delete(commandName);
            }
            
            fs.unlinkSync(filePath);
            delete require.cache[require.resolve(filePath)];
            
            return `Successfully deleted minigame "${commandName}" and unregistered the command.`;
        } catch (error) {
            console.error(`Error deleting minigame ${commandName}:`, error);
            return `Failed to delete minigame "${commandName}": ${error.message}`;
        }
    },
    
    async listMinigames() {
        try {
            const files = fs.readdirSync(MINIGAMES_DIR);
            const minigameFiles = files.filter(file => 
                file.endsWith('.js') && file !== path.basename(__filename)
            );
            
            if (minigameFiles.length === 0) {
                return "No active minigames found.";
            }
            
            return `**Active Minigames:**\n${minigameFiles.map(file => `• ${file.replace('.js', '')}`).join('\n')}`;
        } catch (error) {
            console.error('Error listing minigames:', error);
            return "Failed to list minigames.";
        }
    },
    
    async reloadMinigame(commandName, client) {
        if (!commandName) return "Please specify a command name to reload.";
        
        const filePath = path.join(MINIGAMES_DIR, `${commandName}.js`);
        
        if (!fs.existsSync(filePath)) {
            return `Minigame "${commandName}" not found.`;
        }
        
        try {
            delete require.cache[require.resolve(filePath)];
            const success = registerNewCommand(client, filePath);
            
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
 * Registers a new command dynamically
 */
function registerNewCommand(client, filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        const newCommand = require(filePath);
        
        if (newCommand.data && newCommand.execute) {
            if (newCommand.data.description && newCommand.data.description.length > 100) {
                console.error(`[Minigame Engine] Command description too long: ${newCommand.data.description.length} chars`);
                return false;
            }
            
            if (client.commands instanceof Collection) {
                client.commands.set(newCommand.data.name, newCommand);
                console.log(`[Minigame Engine] Successfully registered new command: /${newCommand.data.name}`);
                return true;
            } else {
                console.error("[Minigame Engine] Client does not have a 'commands' Collection");
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

/**
 * Tool function: Creates a new minigame command
 */
async function createMinigame(targetUserId, gameName, gameDescription, message, client) {
    if (message.author.id !== OWNER_ID) { 
        return "I can't let just anyone create new commands. This feature is restricted to my creator."; 
    }
    
    if (!gameName || gameName.trim().length < 3 || gameName.length > 50) {
        return "Game name must be between 3 and 50 characters.";
    }
    
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
    
    const amoebaSystemPrompt = `
You are Amoeba, a world-class professional developer who specializes in coding minigames for Discord.

CRITICAL REQUIREMENTS:
1. Use 'discord.js' v14 (SlashCommandBuilder, EmbedBuilder, interaction.reply with components)
2. Command name MUST be exactly: '${commandName}'
3. Description MUST be short (under 100 characters): '${gameDescription}'
4. NO external file system operations (fs, path, require('../'))
5. NO forbidden modules - only use discord.js and built-in Node.js modules
6. All game logic must be contained within the 'execute' function
7. Use EmbedBuilder for main game display
8. Keep code simple and self-contained

Respond with ONLY the JavaScript code in a markdown block.
`;

    const amoebaUserPrompt = `
Generate a Discord.js v14 Slash Command for a minigame named "${gameName}".
Game concept: "${gameDescription}"
Command name: "${commandName}"
Description: "${gameDescription}"
Make it single-player and fun!
`;
    
    let generatedCode = '';
    
    try {
        const result = await model.generateContent({
            contents: [{ parts: [{ text: amoebaUserPrompt }] }],
            systemInstruction: { parts: [{ text: amoebaSystemPrompt }] },
        });

        const responseText = result.response.text();
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
        return "Amoeba encountered a bug while trying to write your game. Please try again.";
    }

    if (!generatedCode) {
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
        const success = registerNewCommand(client, filePath);
        
        if (success) {
            return `Amoeba says: "Finished! New minigame deployed: **/${commandName}**! It's live now."`;
        } else {
            return `Amoeba made the code, but command registration failed. Check console for details.`;
        }
    } catch (error) {
        console.error('File saving or command registration failed:', error);
        return `Amoeba failed to deploy the command: ${error.message}`;
    }
}

// --- DATA MANAGEMENT FUNCTIONS ---
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
        dataCache.playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8'));
        dataCache.lastRefresh = Date.now();
    } catch (error) {
        console.error("Error refreshing data:", error);
    }
}

// Initial data load
refreshData();

/**
 * Saves JSON file with data refresh
 */
function saveJson(filepath, data) {
    refreshData();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
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

        await db.exec(`
            CREATE TABLE IF NOT EXISTS conversational_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_text TEXT,
                timestamp INTEGER
            );
        `);

        console.log("Successfully connected to Permanent Memory (SQLite DB).");
    } catch (error) {
        console.error("Error initializing Permanent Memory:", error);
    }
}

initializeDatabase();

// --- PERMANENT MEMORY FUNCTIONS ---
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

async function savePermanentMemory(memoryText) {
    if (!db || !memoryText) return;
    try {
        await db.run(`
            INSERT INTO conversational_memory (memory_text, timestamp)
            VALUES (?, ?)
        `, [memoryText, Date.now()]);
    } catch (error) {
        console.error("Error saving Permanent Memory:", error);
    }
}

// --- CORE SCRIPTING FUNCTIONS ---

/**
 * Moderation Script - Silent filter
 */
async function moderateMessage(userMessage) {
    const moderationPrompt = `
You are the Human Memory System (HMS) of a Discord bot. Your sole function is to act as a filter against Discord's Terms of Service and Privacy Policy.

Analyze: "${userMessage}"
This bot is a 'fighting' RPG style bot so do not block messages that include related terms.

Determine if this message contains content that violates Discord's rules.

Respond with ONLY a single word: 'SAFE' if permissible, or 'UNSAFE' if it violates rules.
`;
    try {
        const result = await model.generateContent(moderationPrompt);
        const responseText = result.response.text().trim().toUpperCase();
        return responseText === 'SAFE';
    } catch (error) {
        console.error('Moderation system failed:', error);
        return true;
    }
}

/**
 * Goal Setter Script
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
    drank: { exp: 10, type: 'fixed' },
    brank: { exp: { min: 10, max: 30 }, type: 'random' },
    arank: { 
        exp: 9, 
        type: 'fixed',
        bonus: { every: 5, multiplier: 1 },
        jackpot: { after: 50, multiplier: 3 }
    },
    crank: { exp: (level) => 100 + level, type: 'level_based' },
    frank: { exp: 1, type: 'fixed', cooldown: 3 },
    srank: {
        haku: { total: 50, normal: 25, corrupted: 25 },
        zabuza: { total: 60 },
        orochimaru: { total: 80 },
        kurenai: { total: 300, corrupted_orochimaru: 100, survival: 100, kurenai_vs_kagami: 100 }
    },
    trials: { exp: (level) => 5 + Math.floor(level * 0.5), type: 'level_based' }
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

    const missionTypes = [
        { name: 'D-Rank', exp: missionRewards.drank.exp, cooldown: 10 * 60, weight: 1, key: 'drank' },
        { name: 'F-Rank', exp: missionRewards.frank.exp, cooldown: 3, weight: 0.5, key: 'frank' },
        { name: 'B-Rank', exp: (missionRewards.brank.exp.min + missionRewards.brank.exp.max) / 2, cooldown: 13 * 60, weight: 2, key: 'brank' },
        { name: 'A-Rank', exp: missionRewards.arank.exp, cooldown: 18 * 60, weight: 3, key: 'arank' },
        { name: 'Trials', exp: missionRewards.trials.exp(currentLevel), cooldown: 20 * 60, weight: 2.5, key: 'trials' },
        { name: 'S-Rank Haku', exp: missionRewards.srank.haku.total, cooldown: 20 * 60, weight: 4, key: 'srank_haku' },
        { name: 'S-Rank Zabuza', exp: missionRewards.srank.zabuza.total, cooldown: 20 * 60, weight: 4, key: 'srank_zabuza' },
        { name: 'S-Rank Orochimaru', exp: missionRewards.srank.orochimaru.total, cooldown: 20 * 60, weight: 5, key: 'srank_orochimaru' },
        { name: 'S-Rank Kurenai', exp: missionRewards.srank.kurenai.total, cooldown: 20 * 60, weight: 5, key: 'srank_kurenai' },
        { name: 'C-Rank', exp: missionRewards.crank.exp(currentLevel), cooldown: 12 * 60 * 60, weight: 10, key: 'crank' }
    ];

    const filteredMissions = missionTypes.filter(m => m.weight < 8);
    const totalWeight = filteredMissions.reduce((sum, m) => sum + (1 / m.weight), 0);

    let planSteps = [];
    let missionCounts = {};
    let remainingExp = totalExpNeeded;

    filteredMissions.forEach(mission => {
        let share = (1 / mission.weight) / totalWeight;
        let expForThis = Math.floor(totalExpNeeded * share);
        let count = Math.floor(expForThis / mission.exp);
        let expPerMission = mission.exp;

        if (mission.key === 'arank' && count > 0) {
            let baseExp = missionRewards.arank.exp;
            let bonusExp = currentLevel;
            let jackpotExp = currentLevel * 3;
            let bonusBattles = Math.floor(count / 5);
            let jackpotBattles = Math.floor(count / 50);
            let totalExpWithBonuses = (count * baseExp) + (bonusBattles * bonusExp) + (jackpotBattles * jackpotExp);
            expPerMission = totalExpWithBonuses / count;
        }

        if (count > 0) {
            planSteps.push({
                mission: mission.name,
                count: count,
                expEach: Math.round(expPerMission),
                totalExp: Math.round(count * expPerMission)
            });
            missionCounts[mission.key] = count;
            remainingExp -= Math.round(count * expPerMission);
        }
    });

    if (remainingExp > 0) {
        let fMission = missionTypes.find(m => m.key === 'frank');
        let fCount = Math.ceil(remainingExp / fMission.exp);
        planSteps.push({
            mission: fMission.name,
            count: fCount,
            expEach: fMission.exp,
            totalExp: fCount * fMission.exp
        });
        missionCounts['frank'] = (missionCounts['frank'] || 0) + fCount;
        remainingExp = 0;
    }

    let cMission = missionTypes.find(m => m.key === 'crank');
    if (remainingExp > 0 && remainingExp >= cMission.exp) {
        let cCount = Math.floor(remainingExp / cMission.exp);
        planSteps.push({
            mission: cMission.name,
            count: cCount,
            expEach: cMission.exp,
            totalExp: cCount * cMission.exp
        });
        missionCounts['crank'] = (missionCounts['crank'] || 0) + cCount;
        remainingExp -= cCount * cMission.exp;
    }

    return {
        currentLevel,
        targetLevel,
        currentExp,
        totalExpNeeded,
        planSteps,
        missionCounts
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

    const embed = new EmbedBuilder()
        .setColor('#ffffff')
        .setTitle(`Level Up Guide for ${message.author.username}`)
        .setDescription(`**Current Level:** ${plan.currentLevel} | **Target Level:** ${plan.targetLevel}\n**EXP Needed:** ${plan.totalExpNeeded.toLocaleString()}`)
        .addFields({
            name: 'Step-by-Step Mission Plan',
            value: `Follow this plan to reach your goal:\n${planStr}`,
            inline: false
        })
        .setFooter({ text: 'Use /levelup all after completing missions to level up!' })
        .setTimestamp();

    return { embed: embed };
}

// --- TOOL ROUTER SCRIPT ---
/**
 * Enhanced editStat function that preserves existing data
 */
async function editStat(targetUserId, stat, value, fileType, message, client) {
    if (message.author.id !== OWNER_ID) return "Only the owner can edit stats.";
    
    refreshData();
    
    let filePath = fileType === 'players' ? PLAYERS_FILE_PATH : USERS_FILE_PATH;
    let data = fileType === 'players' ? dataCache.playersData : dataCache.usersData;
    
    if (!data[targetUserId]) {
        data[targetUserId] = {};
    }
    
    const currentData = { ...data[targetUserId] };
    data[targetUserId][stat] = isNaN(value) ? value : Number(value);
    data[targetUserId] = { ...currentData, ...data[targetUserId] };
    
    saveJson(filePath, data);
    
    let channel = message.channel;
    await channel.send(`<@${targetUserId}> you've been blessed by thunderbird.`);
    return `Set ${stat} of <@${targetUserId}> to ${data[targetUserId][stat]} in ${fileType}.`;
}

// Other tool functions with data refresh
async function giftMoney(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only my creator can use this command.";
    refreshData();
    if (!dataCache.playersData[targetUserId]) dataCache.playersData[targetUserId] = { money: 0 };
    dataCache.playersData[targetUserId].money = Number(dataCache.playersData[targetUserId].money || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, dataCache.playersData);
    return `Your chakra reserves have been replenished! ${amount} ryo added. New balance: ${dataCache.playersData[targetUserId].money}.`;
}

async function giftSS(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift SS.";
    refreshData();
    if (!dataCache.playersData[targetUserId]) dataCache.playersData[targetUserId] = {};
    dataCache.playersData[targetUserId].ss = Number(dataCache.playersData[targetUserId].ss || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, dataCache.playersData);
    return `Gifted ${amount} Shinobi Shards (SS) to <@${targetUserId}>.`;
}

async function giftRamen(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ramen.";
    refreshData();
    if (!dataCache.playersData[targetUserId]) dataCache.playersData[targetUserId] = {};
    dataCache.playersData[targetUserId].ramen = Number(dataCache.playersData[targetUserId].ramen || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, dataCache.playersData);
    return `Gifted ${amount} ramen ticket(s) to <@${targetUserId}>.`;
}

async function giftScroll(targetUserId, scrollName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift scrolls.";
    refreshData();
    if (!dataCache.jutsuData[targetUserId]) dataCache.jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!dataCache.jutsuData[targetUserId].scrolls) dataCache.jutsuData[targetUserId].scrolls = [];
    if (!dataCache.jutsuData[targetUserId].scrolls.includes(scrollName)) dataCache.jutsuData[targetUserId].scrolls.push(scrollName);
    saveJson(JUTSU_FILE_PATH, dataCache.jutsuData);
    return `Gifted scroll "${scrollName}" to <@${targetUserId}>.`;
}

async function giftJutsu(targetUserId, jutsuName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift jutsus.";
    refreshData();
    if (!dataCache.jutsuData[targetUserId]) dataCache.jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!dataCache.jutsuData[targetUserId].usersjutsu.includes(jutsuName)) dataCache.jutsuData[targetUserId].usersjutsu.push(jutsuName);
    saveJson(JUTSU_FILE_PATH, dataCache.jutsuData);
    return `Gifted jutsu "${jutsuName}" to <@${targetUserId}>.`;
}

async function giftCombo(targetUserId, comboName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift combos.";
    refreshData();
    if (!dataCache.jutsuData[targetUserId]) dataCache.jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!dataCache.jutsuData[targetUserId].combos) dataCache.jutsuData[targetUserId].combos = [];
    if (!dataCache.jutsuData[targetUserId].combos.includes(comboName)) dataCache.jutsuData[targetUserId].combos.push(comboName);
    saveJson(JUTSU_FILE_PATH, dataCache.jutsuData);
    return `Gifted combo "${comboName}" to <@${targetUserId}>.`;
}

async function giftExp(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift EXP.";
    refreshData();
    if (!dataCache.playersData[targetUserId]) dataCache.playersData[targetUserId] = {};
    dataCache.playersData[targetUserId].exp = Number(dataCache.playersData[targetUserId].exp || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, dataCache.playersData);
    return `Gifted ${amount} EXP to <@${targetUserId}>.`;
}

async function giftElo(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ELO.";
    refreshData();
    if (!dataCache.playersData[targetUserId]) dataCache.playersData[targetUserId] = {};
    dataCache.playersData[targetUserId].elo = Number(dataCache.playersData[targetUserId].elo || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, dataCache.playersData);
    return `Gifted ${amount} ELO to <@${targetUserId}>.`;
}

async function giftMaterial(targetUserId, materialKey, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift materials.";
    refreshData();
    let occupation = dataCache.usersData[targetUserId]?.occupation?.toLowerCase() || '';
    let matFile = null;
    if (["anbu", "hokage", "right hand man", "guard", "spy", "village"].some(role => occupation.includes(role))) {
        matFile = path.resolve(__dirname, '../../menma/data/village.json');
    } else if (["akatsuki", "rogue"].some(role => occupation.includes(role))) {
        matFile = path.resolve(__dirname, '../../menma/data/akatsuki.json');
    }
    if (!matFile) return "User's occupation is not eligible for material storage.";
    let matData = fs.existsSync(matFile) ? JSON.parse(fs.readFileSync(matFile, 'utf8')) : {};
    if (!matData[materialKey]) matData[materialKey] = 0;
    matData[materialKey] = Number(matData[materialKey]) + Number(amount);
    saveJson(matFile, matData);
    return `Gifted ${amount} ${materialKey} to <@${targetUserId}> (${occupation}).`;
}

async function teachJutsu(targetUserId, jutsuKey, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can teach jutsus.";
    refreshData();
    if (!dataCache.jutsuData[targetUserId]) dataCache.jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!dataCache.jutsuData[targetUserId].usersjutsu.includes(jutsuKey)) dataCache.jutsuData[targetUserId].usersjutsu.push(jutsuKey);
    saveJson(JUTSU_FILE_PATH, dataCache.jutsuData);
    return `Taught jutsu "${jutsuKey}" to <@${targetUserId}>.`;
}

// Tool detection prompt
const toolDetectionPrompt = `
You are a tool-using AI. Determine if the user's request explicitly matches one of the available tools.

If the request doesn't match any tool, respond with ONLY "NOTOOL".

If it matches, respond with JSON: {"action": "toolName", "payload": {...}}

Available Tools:
- giftMoney: { "userId": "target_id", "amount": number }
- giftSS: { "userId": "target_id", "amount": number }
- giftRamen: { "userId": "target_id", "amount": number }
- giftScroll: { "userId": "target_id", "scrollName": "string" }
- giftJutsu: { "userId": "target_id", "jutsuName": "string" }
- giftCombo: { "userId": "target_id", "comboName": "string" }
- giftExp: { "userId": "target_id", "amount": number }
- giftElo: { "userId": "target_id", "amount": number }
- giftMaterial: { "userId": "target_id", "materialKey": "string", "amount": number }
- teachJutsu: { "userId": "target_id", "jutsuKey": "string" }
- editStat: { "userId": "target_id", "stat": "string", "value": "any", "fileType": "players|users" }
- createMinigame: { "userId": "target_id", "gameName": "string", "gameDescription": "string" }
- deleteMinigame: { "commandName": "string" }
- listMinigames: {}
- reloadMinigame: { "commandName": "string" }

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
    
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        if (message.mentions.users.has(client.user.id)) {
            const userId = message.author.id;
            
            // Prevent multiple processing for same user
            if (processingUsers.has(userId)) {
                return;
            }
            processingUsers.add(userId);
            
            try {
                userPromptCounts[userId] = (userPromptCounts[userId] || 0) + 1;
                const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

                await message.channel.sendTyping();

                // 1. MODERATION SCRIPT (Blocking Filter)
                const isMessageSafe = await moderateMessage(userMessage);
                if (!isMessageSafe) {
                    await message.reply("Message blocked by HMS as it violates Discord regulations.");
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
                
                // 3. TOOL ROUTER SCRIPT
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

                            // Execute Tool
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
                                case 'giftCombo':
                                    replyMessage = await giftCombo(payload.userId, payload.comboName, message);
                                    break;
                                case 'giftExp':
                                    replyMessage = await giftExp(payload.userId, payload.amount, message);
                                    break;
                                case 'giftElo':
                                    replyMessage = await giftElo(payload.userId, payload.amount, message);
                                    break;
                                case 'giftMaterial':
                                    replyMessage = await giftMaterial(payload.userId, payload.materialKey, payload.amount, message);
                                    break;
                                case 'teachJutsu':
                                    replyMessage = await teachJutsu(payload.userId, payload.jutsuKey, message);
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
                                case 'listMinigames':
                                    replyMessage = await minigameTools.listMinigames();
                                    break;
                                case 'reloadMinigame':
                                    replyMessage = await minigameTools.reloadMinigame(payload.commandName, client);
                                    break;
                                default:
                                    replyMessage = 'Unknown tool action.';
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

                // 4. MAIN CONVERSATION (Only if no scripts triggered)
                const conversationPrompt = `

You do not have a name. Your personality is that of a human being. You talk like any human would and THINK like any human would. You also have feelings just like humans and if the users arent treating you nicely, you react just like a human, in a defensive or angry way.

The user may use other languages when they talk to you, when that's the case, send the reply in the same language that the user prompted in. If I say a prompt in Portuguese answer in Portuguese as well.

You have access to the following knowledge bases:
When users ask about jutsus refer to the jutsu data and answer properly. If they ask anything else that you already have information of in the helper.json which is helperData answer it as well.
-You are the opposite of the HMS and Tool using ai. you're the main module, you'll handle most of the tasks asked by the users. Like questions about the bot mainly about jutsus. they're very clinical about jutsus.
- Jutsu data: ${JSON.stringify(dataCache.jutsuData[userId] || {}, null, 2)}

- Helper info for missions, events, roles, and trading: ${JSON.stringify(dataCache.helperData, null, 2)}

- User stats: ${JSON.stringify(dataCache.usersData[userId] || {}, null, 2)}
The users level is stored inside players.json and not inside users.json never check users.json for level, always check players.json for level.

- Player stats: ${JSON.stringify(dataCache.playersData[userId] || {}, null, 2)}

Player stats and users stats are the same thing just that both files contain different data about the same user.

For level access players.json, for stats access users.json.

A user named ${message.author.username} (ID: ${userId}) just sent you a message: "${userMessage}".
Not every user will always ask about the bot so you must excel in both the bots information and in keeping the user engaged in a normal conversation.
IMPORTANT: ALL YOUR ANSWERS MUST BE SHORT AND CONCISE. Answer like a human being, humans dont talk alot.
`;

                try {
                    const result = await model.generateContent(conversationPrompt);
                    const responseText = result.response.text();
                    const finalResponse = cleanAndLimitMessage(responseText);
                    
                    await savePermanentMemory(`User discussed: ${userMessage.substring(0, 100)}...`);
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
module.exports.execute = async () => {};