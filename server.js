const express = require('express');
const mysql = require('mysql');
const dotenv = require('dotenv');
const path = require('path');
const app = express();


dotenv.config();


// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


app.get('/movies', (req, res) => {
    db.query('SELECT * FROM movies', (err, results) => {
        if (err) {
            console.error(err); // Log error details
            return res.status(500).send('Database query failed');
        }
        res.json(results);
    });
});

app.get('/', (req, res) => {
    res.render('index'); // Render index.ejs
});

//404 errors
app.get('*', (req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});