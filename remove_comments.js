const fs = require('fs');
const path = require('path');

const filePath = path.resolve('commands/srank.js');
let content = fs.readFileSync(filePath, 'utf8');

// Regex to remove comments while avoiding URLs (http:// or https://)
// This is a common pattern for stripping comments in JS
// 1. Strings (single, double, backtick) - skip them
// 2. Comments (single line starting with // not preceded by : )
// 3. Comments (multi line /* ... */)

const commentStripper = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*)/g;

content = content.replace(commentStripper, (match, string, comment) => {
    if (string) return string; // Return the string unchanged
    return ''; // Return empty string for comments
});

// Clean up extra blank lines that might be left behind
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(filePath, content);
console.log('Comments removed from srank.js');
