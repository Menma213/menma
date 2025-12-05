const { Mutex } = require('async-mutex');

const userMutex = new Mutex();
const territoryMutex = new Mutex();
const clanMutex = new Mutex();
const giftMutex = new Mutex();
const anbuMutex = new Mutex();
const bountyMutex = new Mutex();
const jutsuMutex = new Mutex();

module.exports = {
    userMutex,
    territoryMutex,
    clanMutex,
    giftMutex,
    anbuMutex,
    bountyMutex,
    jutsuMutex
};
