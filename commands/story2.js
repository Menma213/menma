const { Events, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
const toolsModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // For tool detection

// Proper filepaths for all data files
const JUTSU_FILE_PATH = path.resolve(__dirname, '../../menma/data/jutsus.json');
const HELPER_FILE_PATH = path.resolve(__dirname, '../../menma/data/helper.json');
const USERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/users.json');
const PLAYERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/players.json');

// Permanent Memory Database Path (SQLite) - Simplified for conversation memory only
const DB_PATH = path.resolve(__dirname, '../../menma/data/permanent_memory.db');
let db; // Global database object

// Load data files
let jutsuData = {};
try {
    jutsuData = JSON.parse(fs.readFileSync(JUTSU_FILE_PATH, 'utf8'));
    console.log("Successfully loaded jutsu data.");
} catch (error) {
    console.error(`Error loading jutsu data from ${JUTSU_FILE_PATH}:`, error);
}

let helperData = {};
try {
    helperData = JSON.parse(fs.readFileSync(HELPER_FILE_PATH, 'utf8'));
    console.log("Successfully loaded helper data.");
} catch (error) {
    console.error(`Error loading helper data from ${HELPER_FILE_PATH}:`, error);
}

let usersData = {};
try {
    usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf8'));
    console.log("Successfully loaded users data.");
} catch (error) {
    console.error(`Error loading users data from ${USERS_FILE_PATH}:`, error);
}

let playersData = {};
try {
    playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8'));
    console.log("Successfully loaded players data.");
} catch (error) {
    console.error(`Error loading players data from ${PLAYERS_FILE_PATH}:`, error);
}

// Helper: Save JSON file
function saveJson(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// --- PERMANENT MEMORY INITIALIZATION (SQLite) ---
// Simplified to only store conversation memories, no AI state

async function initializeDatabase() {
    try {
        db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Table for AI conversational memory only
        await db.exec(`
            CREATE TABLE IF NOT EXISTS conversational_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_text TEXT,
                timestamp INTEGER
            );
        `);

        console.log("Successfully connected to Permanent Memory (SQLite DB).");
    } catch (error) {
        console.error("Error initializing Permanent Memory (SQLite DB):", error);
    }
}

// Execute database initialization
initializeDatabase();

// --- PERMANENT MEMORY FUNCTIONS (SQLite) ---

/**
 * Loads the latest 'n' memories from the database.
 * @param {number} n The number of memories to retrieve.
 * @returns {Promise<Array<string>>} An array of memory texts.
 */
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
 * Saves a new memory to the database.
 * @param {string} memoryText The memory text.
 * @returns {Promise<void>}
 */
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

// --- CORE AI FUNCTIONS ---

/**
 * Moderates the user's message against Discord TOS/PP (The HMS).
 * @param {string} userMessage The raw message content.
 * @returns {Promise<boolean>} True if safe, False if unsafe.
 */
async function moderateMessage(userMessage) {
    const moderationPrompt = `
You are the Human Memory System (HMS) of a Discord bot. Your sole function is to act as a filter against Discord's Terms of Service and Privacy Policy.

Analyze the following user message: "${userMessage}"
- Important thing to to note is that this bot is a 'fighting' RPG style bot so do not block messages that include any of the related terms. As ive noticed the system has been acting too much.
Determine if this message contains content that violates Discord's rules, illegal material, explicit content or other highly inappropriate/malicious content.

Respond with ONLY a single word: 'SAFE' if the message is permissible, or 'UNSAFE' if it violates rules and must be blocked. Do not add any other text, explanation, or punctuation.
`;
    try {
        const result = await model.generateContent(moderationPrompt);
        const responseText = result.response.text().trim().toUpperCase();
        return responseText === 'SAFE';
    } catch (error) {
        console.error('Moderation system failed:', error);
        return true; // Default to safe if moderation fails
    }
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
        bonus: { every: 5, multiplier: 1 }, // 1 * player.level every 5 battles
        jackpot: { after: 50, multiplier: 3 } // 3 * player.level after 50 battles
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

// GOALSET FUNCTION
async function createGoalPlan(userId, targetLevel) {
    const currentLevel = playersData[userId]?.level || 1;
    const currentExp = playersData[userId]?.exp || 0;

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

// SYSTEM FUNCTIONS (TOOLS)
async function giftMoney(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) { return "I can't do that. Only my creator has the authority to use this command."; }
    try {
        if (!playersData[targetUserId]) playersData[targetUserId] = { money: 0 };
        playersData[targetUserId].money = Number(playersData[targetUserId].money || 0) + Number(amount);
        saveJson(PLAYERS_FILE_PATH, playersData);
        return `Your chakra reserves have been replenished! ${amount} ryo has been added to your balance. Your new balance is ${playersData[targetUserId].money}.`;
    } catch (error) {
        console.error('Error in giftMoney function:', error);
        return 'Sorry, a jutsu seal broke while trying to process that. Please try again later.';
    }
}

async function giftSS(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift SS.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].ss = Number(playersData[targetUserId].ss || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, playersData);
    return `Gifted ${amount} Shinobi Shards (SS) to <@${targetUserId}>.`;
}

async function giftCombo(targetUserId, comboName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift combos.";
    if (!jutsuData[targetUserId]) jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!jutsuData[targetUserId].combos) jutsuData[targetUserId].combos = [];
    if (!jutsuData[targetUserId].combos.includes(comboName)) jutsuData[targetUserId].combos.push(comboName);
    saveJson(JUTSU_FILE_PATH, jutsuData);
    return `Gifted combo "${comboName}" to <@${targetUserId}>.`;
}

async function giftRamen(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ramen.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].ramen = Number(playersData[targetUserId].ramen || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, playersData);
    return `Gifted ${amount} ramen ticket(s) to <@${targetUserId}>.`;
}

async function giftScroll(targetUserId, scrollName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift scrolls.";
    if (!jutsuData[targetUserId]) jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!jutsuData[targetUserId].scrolls) jutsuData[targetUserId].scrolls = [];
    if (!jutsuData[targetUserId].scrolls.includes(scrollName)) jutsuData[targetUserId].scrolls.push(scrollName);
    saveJson(JUTSU_FILE_PATH, jutsuData);
    return `Gifted scroll "${scrollName}" to <@${targetUserId}>.`;
}

async function giftJutsu(targetUserId, jutsuName, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift jutsus.";
    if (!jutsuData[targetUserId]) jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!jutsuData[targetUserId].usersjutsu.includes(jutsuName)) jutsuData[targetUserId].usersjutsu.push(jutsuName);
    saveJson(JUTSU_FILE_PATH, jutsuData);
    return `Gifted jutsu "${jutsuName}" to <@${targetUserId}>.`;
}

async function giftExp(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift EXP.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].exp = Number(playersData[targetUserId].exp || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, playersData);
    return `Gifted ${amount} EXP to <@${targetUserId}>.`;
}

async function giftElo(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ELO.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].elo = Number(playersData[targetUserId].elo || 0) + Number(amount);
    saveJson(PLAYERS_FILE_PATH, playersData);
    return `Gifted ${amount} ELO to <@${targetUserId}>.`;
}

async function giftMaterial(targetUserId, materialKey, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift materials.";
    let occupation = usersData[targetUserId]?.occupation?.toLowerCase() || '';
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
    if (!jutsuData[targetUserId]) jutsuData[targetUserId] = { usersjutsu: [], combos: [], scrolls: [] };
    if (!jutsuData[targetUserId].usersjutsu.includes(jutsuKey)) jutsuData[targetUserId].usersjutsu.push(jutsuKey);
    saveJson(JUTSU_FILE_PATH, jutsuData);
    return `Taught jutsu "${jutsuKey}" to <@${targetUserId}>.`;
}

async function editStat(targetUserId, stat, value, fileType, message, client) {
    if (message.author.id !== OWNER_ID) return "Only the owner can edit stats.";
    let filePath = fileType === 'players' ? PLAYERS_FILE_PATH : USERS_FILE_PATH;
    let data = fileType === 'players' ? playersData : usersData;
    if (!data[targetUserId]) data[targetUserId] = {};
    data[targetUserId][stat] = isNaN(value) ? value : Number(value);
    saveJson(filePath, data);
    let channel = message.channel;
    await channel.send(`<@${targetUserId}> youve been blessed by thunderbird.`);
    return `Set ${stat} of <@${targetUserId}> to ${data[targetUserId][stat]} in ${fileType}.`;
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
        .addFields(
            {
                name: 'Step-by-Step Mission Plan',
                value: `Follow this plan to reach your goal:\n${planStr}`,
                inline: false
            }
        )
        .setFooter({ text: 'Use /levelup all after completing missions to level up!' })
        .setTimestamp();

    return { embed: embed };
}

// FUNCTION TO CLEAN AI RESPONSE
function cleanResponse(text) {
    const jsonMatch = text.match(/```json\n([\s\S]*)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }
    return text.trim();
}

/**
 * Cleans and limits message length for Discord
 * @param {string} message - The message to clean
 * @param {number} maxLength - Maximum length (default 1500)
 * @returns {string} Cleaned and limited message
 */
function cleanAndLimitMessage(message, maxLength = 1500) {
    if (!message || typeof message !== 'string') return "I'm having trouble forming a response right now.";
    
    let cleaned = message.trim();
    
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned;
}

// FUNCTION TO DETECT LEVEL GOAL REQUESTS
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

// --- MODULE SETUP ---
module.exports.setup = (client, userPromptCounts) => {
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        if (message.mentions.users.has(client.user.id)) {
            const userId = message.author.id;
            userPromptCounts[userId] = (userPromptCounts[userId] || 0) + 1;
            const userStats = usersData[userId] || {};
            const playerStats = playersData[userId] || {};
            const userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();

            await message.channel.sendTyping();

            // 1. HMS Moderation Check
            const isMessageSafe = await moderateMessage(userMessage);
            if (!isMessageSafe) {
                await message.reply("The message has been blocked by the HMS as it includes words or sentences that violate the Discord regulations. I cannot engage with this topic.");
                return; 
            }

            // 2. Check for level goal request first
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
            
            // 3. Load conversation memory for context
            const pastMemories = await loadPermanentMemory(3);
            
            // 4. Tool Detection
            const toolPrompt = `
You are a tool-using AI. Your purpose is to determine if the user's request explicitly matches one of the powerful tools you have access to. If the user asks for *anything* that is not a direct, explicit call to one of the tools below, respond with ONLY the string "NOTOOL". Do not use any other text, explanation, or punctuation.

If the user's request matches a tool's function, you MUST respond with a JSON object.
The JSON object MUST have two properties: "action" and "payload".
The "action" property MUST be the name of the tool.
The "payload" property MUST be an object with the parameters required by that tool.

Here is the user, their stats, and the available tools:

- User stats: ${JSON.stringify(userStats, null, 2)}
- Player stats: ${JSON.stringify(playerStats, null, 2)}

A user named ${message.author.username} (ID: ${userId}) just sent you a message: "${userMessage}".

Tool List:
1. **giftMoney**: Grants money (ryo) to a user.
   - Payload: { "userId": "target_user_id", "amount": <number> }
2. **giftSS**: Grants Shinobi Shards (SS) to a user.
   - Payload: { "userId": "target_user_id", "amount": <number> }
3. **giftRamen**: Gifts ramen tickets to a user.
   - Payload: { "userId": "target_user_id", "amount": <number> }
4. **giftScroll**: Gifts a specific scroll to a user.
   - Payload: { "userId": "target_user_id", "scrollName": "name_of_scroll" }
5. **giftJutsu**: Gifts a specific jutsu to a user.
   - Payload: { "userId": "target_user_id", "jutsuName": "name_of_jutsu" }
6. **giftCombo**: Gifts a specific combo to a user.
   - Payload: { "userId": "target_user_id", "comboName": "name_of_combo" }
7. **giftExp**: Gifts EXP to a user.
   - Payload: { "userId": "target_user_id", "amount": <number> }
8. **giftElo**: Gifts ELO to a user.
   - Payload: { "userId": "target_user_id", "amount": <number> }
9. **giftMaterial**: Gifts a specific material to a user.
   - Payload: { "userId": "target_user_id", "materialKey": "name_of_material", "amount": <number> }
10. **teachJutsu**: Teaches a specific jutsu to a user.
   - Payload: { "userId": "target_user_id", "jutsuKey": "jutsu_key" }
11. **editStat**: Edits a specific stat for a user.
   - Payload: { "userId": "target_user_id", "stat": "stat_name", "value": "new_value", "fileType": "players|users" }
`;
            
            let isToolCall = false;
            let replyMessage = '';

            try {
                const toolResult = await toolsModel.generateContent(toolPrompt);
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
                            default:
                                replyMessage = 'I am unable to perform that specific tool action.';
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
            } else {
                // 5. J.A.R.V.I.S. Style Conversation
                const conversationPrompt = `

                You do not have a name. Your personality is that of a human being. You talk like any human would and THINK like any human would. You also have feelings just like humans and if the users arent treating you nicely, you react just like a human, in a defensive or angry way.

The user may use other languages when they talk to you, when that's the case, send the reply in the same language that the user prompted in. If I say a prompt in Portuguese answer in Portuguese as well.


You have access to the following knowledge bases:
When users ask about jutsus refer to the jutsu data and answer properly. If they ask anything else that you already have information of in the helper.json which is helperData answer it as well.

- Jutsu data: ${JSON.stringify(jutsuData[userId] || {}, null, 2)}

- Helper info for missions, events, roles, and trading: ${JSON.stringify(helperData, null, 2)}

- User stats: ${JSON.stringify(userStats, null, 2)}
The users level is stored inside players.json and not inside users.json never check users.json for level, always check players.json for level.

- Player stats: ${JSON.stringify(playerStats, null, 2)}

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
                    
                    // Save a memory of this conversation
                    await savePermanentMemory(`User discussed: ${userMessage.substring(0, 100)}...`);
                    
                    await message.reply(finalResponse);
                } catch (error) {
                    console.error('Conversation generation failed:', error);
                    await message.reply("My systems are experiencing temporary fluctuations. Please try again momentarily.");
                }
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