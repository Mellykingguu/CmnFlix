require('dotenv').config();

const express = require('express');
const app = express();
const ejs = require('ejs')
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise'); 
const B2 = require('backblaze-b2');


// Create a MySQL connection pool 
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});


const b2 = new B2({
  applicationKeyId: process.env.B2_ACCOUNT_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});


app.use(cors()); // Optional: If making requests from a different origin
app.use(bodyParser.json()); // This is crucial for parsing JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Optional: If you need to parse URL-encoded bodies
app.use(cookieParser());

app.use('/Movie', express.static('Movie'));


const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');
const movieRoutes = require('./routes/movieRoutes');
const showRoutes = require('./routes/showRourtes');
const adminRoutes = require('./routes/adminRoutes');

// Use the imported route modules
app.use(authRoutes.routes);
app.use(homeRoutes.routes);
app.use(movieRoutes.routes); 
app.use(showRoutes.routes);
app.use(adminRoutes.routes);


app.use(express.static('public'));
app.set('view engine', 'ejs'); 


//404 errors
app.get('*', (req, res) => {
  res.status(404).render('404');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});