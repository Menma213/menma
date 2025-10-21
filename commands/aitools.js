const fs = require('fs');
const path = require('path');
const OWNER_ID = '835408109899219004';

const JUTSU_FILE_PATH = path.resolve(__dirname, '../../menma/data/jutsus.json');
const HELPER_FILE_PATH = path.resolve(__dirname, '../../menma/data/helper.json');
const USERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/users.json');
const PLAYERS_FILE_PATH = path.resolve(__dirname, '../../menma/data/players.json');

// Load data files
let jutsuData = {};
try { jutsuData = JSON.parse(fs.readFileSync(JUTSU_FILE_PATH, 'utf8')); } catch {}
let helperData = {};
try { helperData = JSON.parse(fs.readFileSync(HELPER_FILE_PATH, 'utf8')); } catch {}
let usersData = {};
try { usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf8')); } catch {}
let playersData = {};
try { playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8')); } catch {}

function saveJson(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

async function giftMoney(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) {
        return "I can't do that. Only my creator has the authority to use this command.";
    }
    try {
        if (!playersData[targetUserId]) playersData[targetUserId] = { money: 0 };
        playersData[targetUserId].money = (playersData[targetUserId].money || 0) + amount;
        saveJson(PLAYERS_FILE_PATH, playersData);
        return `Your chakra reserves have been replenished! ${amount} ryo has been added to your balance. Your new balance is ${playersData[targetUserId].money}.`;
    } catch (error) {
        return 'Sorry, a jutsu seal broke while trying to process that. Please try again later.';
    }
}

async function giftSS(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift SS.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].ss = (playersData[targetUserId].ss || 0) + amount;
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
    playersData[targetUserId].ramen = (playersData[targetUserId].ramen || 0) + amount;
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
    playersData[targetUserId].exp = (playersData[targetUserId].exp || 0) + amount;
    saveJson(PLAYERS_FILE_PATH, playersData);
    return `Gifted ${amount} EXP to <@${targetUserId}>.`;
}

/**
 * Calculates the EXP requirement for the next level.
 * @param {number} currentLevel The user's current level.
 * @returns {number} The EXP required to reach the next level.
 */
function getExpRequirement(currentLevel) {
    if (currentLevel < 1) return 2;
    if (currentLevel < 50) return (1 + currentLevel) * 2;
    if (currentLevel < 100) return (1 + currentLevel) * 3;
    if (currentLevel < 200) return (1 + currentLevel) * 4;
    return (1 + currentLevel) * 5;
}

/**
 * Calculates the total EXP needed from the user's current state to the goal level.
 * @param {number} currentLevel The user's current level.
 * @param {number} currentExp The user's current EXP within their level.
 * @param {number} goalLevel The desired level.
 * @returns {number} The total EXP needed.
 */
function calculateTotalExpNeeded(currentLevel, currentExp, goalLevel) {
    if (currentLevel >= goalLevel) return 0;

    let totalExpNeeded = 0;
    let currentLvl = currentLevel;
    let expToNextLevel = getExpRequirement(currentLvl);

    // 1. EXP needed to finish the current level
    totalExpNeeded += expToNextLevel - currentExp;
    currentLvl++;

    // 2. EXP needed for all intermediate levels up to the goal
    while (currentLvl < goalLevel) {
        totalExpNeeded += getExpRequirement(currentLvl);
        currentLvl++;
    }

    return totalExpNeeded;
}

/**
 * Calculates the required number of missions for a goal.
 * @param {number} totalExpNeeded The total EXP the user requires.
 * @param {number} userLevel The user's current level (for level-based missions).
 * @returns {object} An object containing the primary and alternative mission plans.
 */
function getMissionPlan(totalExpNeeded, userLevel) {
    // Fixed EXP rewards for reliable calculation
    const MISSION_EXP = {
        drank: 10,
        frank: 1, // High volume, low EXP
        haku_srank: 50,
        zabuza_srank: 60,
        orochimaru_srank: 80,
        kurenai_srank: 300,
    };

    // Level-based and variable missions (less reliable for precise calculation)
    const VARIABLE_MISSION_EXP = {
        crank: 100 + userLevel,
        trials: 5 + Math.floor(userLevel * 0.5),
        // Brank is too random (10-30), Arank is too conditional (every 5 battles, jackpot), so they are best in the 'alternative' method.
    };

    let remainingExp = totalExpNeeded;
    const plan = {
        primaryMethod: {},
        alternativeMethod: {}
    };

    // --- Primary Method: Fixed-EXP Missions for ACCURATE calculation ---
    // Prioritize high-value, fixed EXP missions first (S-Ranks, then D-Rank)

    // 1. Use high-value S-Ranks
    const sRankMissions = [
        { key: 'kurenai_srank', exp: MISSION_EXP.kurenai_srank, name: 'Kurenai S-Rank' },
        { key: 'orochimaru_srank', exp: MISSION_EXP.orochimaru_srank, name: 'Orochimaru S-Rank' },
        { key: 'zabuza_srank', exp: MISSION_EXP.zabuza_srank, name: 'Zabuza S-Rank' },
        { key: 'haku_srank', exp: MISSION_EXP.haku_srank, name: 'Haku S-Rank' },
    ];

    for (const mission of sRankMissions) {
        if (remainingExp >= mission.exp) {
            const times = Math.floor(remainingExp / mission.exp);
            plan.primaryMethod[mission.name] = { times, expPer: mission.exp };
            remainingExp -= times * mission.exp;
        }
    }

    // 2. Use D-Rank Missions (reliable 10 EXP) for the remainder
    if (remainingExp > 0) {
        const dRankTimes = Math.ceil(remainingExp / MISSION_EXP.drank);
        plan.primaryMethod['D-Rank Mission'] = { times: dRankTimes, expPer: MISSION_EXP.drank };
        // The plan is now complete, so remainingExp should be considered 0 for the primary goal.
    }

    // --- Alternative Method: Includes variable/volume missions ---
    // This is for comparison and flexibility. It uses the remaining EXP value from the start.
    const startingExp = totalExpNeeded;

    // A. Use high-volume, low-cooldown F-Rank missions
    const fRankTimes = Math.ceil(startingExp / MISSION_EXP.frank);
    plan.alternativeMethod['F-Rank Mission (1 EXP)'] = `${fRankTimes} times (due to 3s cooldown, ideal for farming).`;

    // B. Use C-Rank missions (Level-based EXP)
    const cRankTimes = Math.ceil(startingExp / VARIABLE_MISSION_EXP.crank);
    plan.alternativeMethod[`C-Rank Mission (${VARIABLE_MISSION_EXP.crank} EXP)`] = `Approximately ${cRankTimes} times.`;

    // C. Use Trials (Level-based EXP)
    const trialsTimes = Math.ceil(startingExp / VARIABLE_MISSION_EXP.trials);
    plan.alternativeMethod[`Trial Missions (${VARIABLE_MISSION_EXP.trials} EXP)`] = `Approximately ${trialsTimes} times.`;

    return plan;
}

async function goalSet(targetUserId, goalLevel, message, client) {
    // 1. Check for owner authority (as per other gift functions)
    const OWNER_ID = '835408109899219004'; // Assuming this is defined/imported
    if (message.author.id !== OWNER_ID) {
        return "I can't access the advanced tactical systems for level planning. Only my creator, Thunderbird, has the necessary clearance.";
    }

    // 2. Fetch User Data (Assuming playersData contains level/exp and usersData contains just 'level')
    const userStats = usersData[targetUserId] || {};
    const playerStats = playersData[targetUserId] || {};

    const currentLevel = playerStats.level || 1; 
    const currentExp = playerStats.exp || 0;

    if (currentLevel >= goalLevel) {
        return `My systems indicate that your current level, ${currentLevel}, already meets or exceeds the goal of ${goalLevel}. Perhaps we should aim higher?`;
    }
    
    // 3. Calculate EXP needed
    const totalExpNeeded = calculateTotalExpNeeded(currentLevel, currentExp, goalLevel);
    
    // 4. Generate Mission Plan
    const missionPlan = getMissionPlan(totalExpNeeded, currentLevel);
    
    // 5. Format Output (The EMBED content as a formatted string)
    let primaryFields = '';
    let totalPrimaryExp = 0;
    for (const [missionName, data] of Object.entries(missionPlan.primaryMethod)) {
        const expGained = data.times * data.expPer;
        totalPrimaryExp += expGained;
        primaryFields += `• **${missionName}**: Complete ${data.times} times to gain ${expGained} EXP.\n`;
    }

    let alternativeFields = '';
    for (const [missionName, description] of Object.entries(missionPlan.alternativeMethod)) {
        alternativeFields += `• **${missionName}**: ${description}\n`;
    }

    const response = {
        title: `Mission Guide for ${message.author.username}: Level ${goalLevel} Objective`,
        description: `Greetings, ${message.author.username}. To advance from **Level ${currentLevel} (${currentExp} EXP)** to your target **Level ${goalLevel}**, my systems calculate you require a total of **${totalExpNeeded} EXP**.`,
        fields: [
            {
                name: 'Method 1: Precise Path (Fixed EXP Rewards)',
                value: primaryFields + `\n*By completing all of these missions, you will accumulate at least ${totalPrimaryExp} EXP. Use the **/levelupall** command afterward to advance.*`,
            },
            {
                name: 'Method 2: Alternative Paths (Flexible/Variable EXP)',
                value: `These missions offer varied or smaller EXP drops, but may be faster to complete:\n${alternativeFields}`,
            }
        ]
    };

    // NOTE: This function would typically return an object to be sent as a Discord Embed.
    // Since we are returning a string from the tool function, we'll format it as a clear markdown block.
    // In your main story.js, you'd adjust how this response is handled to send a Discord Embed instead of a simple message.
    
    let finalMessage = `\n## ${response.title}\n\n${response.description}\n\n`;
    finalMessage += `### ${response.fields[0].name}\n${response.fields[0].value}\n\n`;
    finalMessage += `### ${response.fields[1].name}\n${response.fields[1].value}`;

    // Returning a unique identifier/format to be parsed for embedding on the Discord side.
    return 'EMBED_RESPONSE_START\n' + JSON.stringify(response) + '\nEMBED_RESPONSE_END';
}
async function giftElo(targetUserId, amount, message) {
    if (message.author.id !== OWNER_ID) return "Only the owner can gift ELO.";
    if (!playersData[targetUserId]) playersData[targetUserId] = {};
    playersData[targetUserId].elo = (playersData[targetUserId].elo || 0) + amount;
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
    matData[materialKey] += amount;
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
    data[targetUserId][stat] = value;
    saveJson(filePath, data);
    let channel = message.channel;
    await channel.send(`<@${targetUserId}> youve been blessed by thunderbird.`);
    return `Set ${stat} of <@${targetUserId}> to ${value} in ${fileType}.`;
}

module.exports = {
    giftMoney,
    giftSS,
    giftCombo,
    giftRamen,
    giftScroll,
    giftJutsu,
    giftExp,
    giftElo,
    giftMaterial,
    teachJutsu,
    editStat,
    goalSet
};
