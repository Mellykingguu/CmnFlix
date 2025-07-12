require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const router = express();
const ejs = require('ejs')
const mysql = require('mysql2/promise'); 
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');


// Create a MySQL connection pool 
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Create a transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail', // or any other email service you use
  auth: {
    user: 'cmntasks@gmail.com',
    pass: 'znad cppk dqjp bqno'
  }
});


// Define sendEmail function
const sendEmail = async (mailOptions) => {
  return transporter.sendMail(mailOptions);
};



router.get('/register', (req, res) => {
  res.render('register', { error: null, message: null }); // Pass error as null
});


// Register route
router.post('/register', async (req, res) => {
  try {    
    const { firstname, lastname, number, age, email, password, repassword, referralcode } = req.body;

    if (!firstname || !lastname || !number || !age || !email || !password || !repassword) {
      return res.render('register', { error: 'All fields are required.' });
    }
    if (password.length < 8) {
      return res.render('register', { error: 'Password must be at least 8 characters long.' });
    }
    if (password !== repassword) {
      return res.render('register', { error: 'Passwords do not match.' });
    }
    if (number.length !== 9) {
      return res.render('register', { error: 'Invalid phone number.', message: null });
    }
    if (age < 15 || age > 100) {
      return res.render('register', { error: 'Invalid age.', message: null });
    }

    if (password !== repassword) {
      return res.render('register', { error: 'Passwords do not match.', message: null });
    }
    const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.render('register', { error: 'Email already exists.' });
    }

    const [existingNumber] = await pool.query('SELECT * FROM users WHERE number = ?', [number]);
    if (existingNumber.length > 0) {
      return res.render('register', { error: 'Phone Number already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;
    let userIdExists = true;
    while (userIdExists) {
      userId = uuidv4();
      const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      if (existingUser.length === 0) {
        userIdExists = false;
      }
    }
    

// Ensure referral_code is included in the insert statement
await pool.query('INSERT INTO users (id, firstname, lastname, number, age, email, password, referral_code, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
  userId,
  firstname,
  lastname,
  number,
  age,
  email,
  hashedPassword,
  referralcode || null, // Store as null if not provided
  'PENDING'
]);


   

    res.render('success', { message: 'Thank you for registering!!! please wait at least 24 hours for verification email.', error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});
 

router.get('/login', (req, res) => {
  res.render('login', { error: null }); // Pass error as null
}); 


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('login', { error: 'All fields are required.' });
    }

    const [user] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || user.length === 0) {
      return res.render('login', { error: 'This email is not registered. Please register first.' });
    }

    if (user[0].is_verified !== 'ACCEPTED') {
      return res.render('login', { error: 'This email is not registered. Please register first.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
      return res.render('login', { error: 'Invalid credentials.' });
    }

    // Create the token with user ID and email
    const token = jwt.sign({ id: user[0].id, email: user[0].email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, path: '/' });

    const email2 = user[0].email;
    res.redirect('/'); // Redirect to home page after login
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Logout route
router.get('/logout', (req, res) => {
  res.clearCookie('token'); // Clear cookie
  req.user = null; // Optionally set user to null
  res.redirect('/login'); // Redirect to login
});


router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null }); // Pass error as null
});

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const [user] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || user.length === 0) {
        return res.status(404).json({ error: 'No user found with that email.' });
    }

    // Generate a unique token
    const token = crypto.randomBytes(20).toString('hex');

    // Store the token in the database
await pool.query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE email = ?', [
    token,
    new Date(Date.now() + 3600000), // Use Date object for SQL DATETIME
    email
]);


    // Send email with reset link
    const mailOptions = {
        from: 'your-email@example.com',
        to: email,
        subject: 'Password Reset',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
              `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
              `http://localhost:2000/reset/${token}\n\n` +
              `If you did not request this, please ignore this email.\n`
    };

    await sendEmail(mailOptions);
    res.status(200).json({ message: 'An email has been sent with further instructions.' });
});


// GET Reset Password Page
router.get('/reset/:token', async (req, res) => {
    const { token } = req.params;

    const [user] = await pool.query('SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > ?', [token, new Date()]);
    if (!user || user.length === 0) {
        return res.status(400).send('Invalid or expired token.');
    }

    // Render the EJS template for the reset password page
    res.render('reset', { token, error: null }); // Pass the token to the EJS template
});


router.post('/reset-password', async (req, res) => {
    const { newPassword, token } = req.body;

    if (!newPassword || !token) {
        return res.status(400).json({ error: 'New password and token are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const [user] = await pool.query('SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > ?', [token, new Date()]);
    if (!user || user.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password

    // Update user password and clear the reset token
    await pool.query('UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE email = ?', [
        hashedPassword,
        user[0].email
    ]);

    // Redirect to the login page after successful reset
    res.redirect('/login'); // Make sure this path matches your login route
});


module.exports = {
  routes: router
};
