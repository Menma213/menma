/**
 * VOTE_STREAK_REWARDS
 * Defines the rewards for days 1 through 30 of a vote streak.
 * Note: Static SS rewards have been removed in favor of the dynamic SS chance.
 * The system loops back to Day 1 after Day 30.
 */
const VOTE_STREAK_REWARDS = [
    { day: 1, money: 100000, ramen: 5 },
    { day: 2, money: 120000, ramen: 2 },
    { day: 3, money: 150000, ramen: 3 },
    { day: 4, money: 180000, ramen: 3 },
    { day: 5, money: 200000, ramen: 25 },
    { day: 6, money: 220000, ramen: 2 },
    { day: 7, money: 250000, ramen: 4 },
    { day: 8, money: 270000, ramen: 3 },
    { day: 9, money: 300000, ramen: 5 },
    { day: 10, money: 350000, ramen: 50 },
    { day: 11, money: 370000, ramen: 2 },
    { day: 12, money: 400000, ramen: 4 },
    { day: 13, money: 500000, ramen: 5 },
    { day: 14, money: 600000, ramen: 6 },
    { day: 15, money: 650000, ramen: 25 },
    { day: 16, money: 700000, ramen: 4 },
    { day: 17, money: 800000, ramen: 5 },
    { day: 18, money: 900000, ramen: 6 },
    { day: 19, money: 1000000, ramen: 7 },
    { day: 20, money: 1100000, ramen: 50 },
    { day: 21, money: 1200000, ramen: 8 },
    { day: 22, money: 1300000, ramen: 7 },
    { day: 23, money: 1400000, ramen: 8 },
    { day: 24, money: 1500000, ramen: 9 },
    { day: 25, money: 1550000, ramen: 100 },
    { day: 26, money: 1600000, ramen: 6 },
    { day: 27, money: 1700000, ramen: 7 },
    { day: 28, money: 2000000, ramen: 10 },
    { day: 29, money: 2500000, ramen: 12 },
    { day: 30, money: 5000000, ramen: 150 },
];

/**
 * Retrieves the base reward object for a given streak day.
 * @param {number} streakDay The current consecutive vote streak day (1 or higher).
 * @returns {{day: number, money: number, ramen: number}} The reward object.
 */
function getStreakReward(streakDay) {
    // The streak loops back after 30 days. Uses modulo for this.
    // (streakDay - 1) % 30 ensures the index is 0-29.
    const index = (streakDay - 1) % VOTE_STREAK_REWARDS.length;
    return VOTE_STREAK_REWARDS[index];
}

/**
 * Calculates the chance-based SS reward.
 * @returns {{ss: number, isBonus: boolean}} The SS reward and whether it was a bonus.
 */
function calculateBonusSSReward() {
    const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = today === 0 || today === 6;
    const dropChance = isWeekend ? 0.30 : 0.10; // 30% on weekend, 10% daily
    const ssAmount = 100;
    
    const isBonus = Math.random() < dropChance;

    return {
        ss: isBonus ? ssAmount : 0,
        isBonus: isBonus
    };
}

module.exports = {
    getStreakReward,
    calculateBonusSSReward,
    VOTE_STREAK_REWARDS // Exported for displaying the calendar
};
