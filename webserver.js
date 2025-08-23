const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Set up EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Path to your users.json file
const usersPath = path.resolve(__dirname, 'C:\\Users\\HI\\Downloads\\menma\\data\\users.json');

app.get('/users', (req, res) => {
    try {
        console.log(`Attempting to read file at: ${usersPath}`);
        const usersData = fs.readFileSync(usersPath, 'utf8');
        console.log('File content read successfully. Parsing JSON...');
        const parsedData = JSON.parse(usersData);
        console.log('JSON parsed successfully.');
        res.render('users', { users: parsedData });
    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).send('Error loading user data. Check the bot\'s console for details!');
    }
});


// Add this new route before the app.listen() block
app.get('/', (req, res) => {
    res.redirect('/users');
});

// Start the server
app.listen(port, () => {
    console.log(`Web server running at http://localhost:${port}`);
});