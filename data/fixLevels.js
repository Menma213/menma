const fs = require('fs');
const path = require('path');

const usersPath = path.resolve(__dirname, '..', 'data', 'e.json');

if (!fs.existsSync(usersPath)) {
  console.error('e.json not found at:', usersPath);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(usersPath, 'utf8');
} catch (err) {
  console.error('Failed to read users.json:', err);
  process.exit(1);
}

let users;
try {
  users = JSON.parse(raw);
} catch (err) {
  console.error('Invalid JSON in users.json:', err);
  process.exit(1);
}

const backupPath = `${usersPath}.bak.${Date.now()}`;
try {
  fs.copyFileSync(usersPath, backupPath);
  console.log('Backup created at', backupPath);
} catch (err) {
  console.warn('Could not create backup:', err);
}

let fixed = 0;
const total = Object.keys(users).length;

for (const id of Object.keys(users)) {
  const u = users[id];
  if (u && Object.prototype.hasOwnProperty.call(u, 'level')) {
    const lvl = Number(u.level);
    if (!Number.isNaN(lvl) && lvl > 200) {
      u.level = 200;
      fixed++;
    }
  }
}

if (fixed > 0) {
  try {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    console.log(`Fixed ${fixed} user level(s). Wrote changes to users.json`);
  } catch (err) {
    console.error('Failed to write users.json:', err);
    process.exit(1);
  }
} else {
  console.log(`No levels above 200 found. Checked ${total} user(s).`);
}