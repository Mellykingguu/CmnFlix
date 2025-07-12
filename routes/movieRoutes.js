require('dotenv').config();

const express = require('express');
const router = express();
const ejs = require('ejs')
const mysql = require('mysql2/promise'); 
const jwt = require('jsonwebtoken');

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});


const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token; // Get the token from cookies
    if (!token) {
      req.user = null; // No user logged in
      return next(); // Proceed without redirecting
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to the request
    next(); // Proceed to the next middleware/route
  } catch (err) {
    console.error(err);
    req.user = null; // No user if there's an error
    next(); // Proceed to the next middleware/route
  }
}
 

router.get('/movies', verifyToken, async (req, res) => {
  try {
    // Get the current page from the query string
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = 12; // Maximum number of movies per page
    const offset = (page - 1) * limit;

    // Fetch the movies from the database
    const [moviesData] = await pool.query('SELECT * FROM movies ORDER BY updated_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    const [totalCount] = await pool.query('SELECT COUNT(*) as total FROM movies');
    const totalPages = Math.ceil(totalCount[0].total / limit);

    // Generate URLs for movie posters based on the poster field
    const moviePosters = moviesData.map(movie => {
      return `https://f005.backblazeb2.com/file/CmnFlix/${encodeURIComponent(movie.poster)}`;
    });

    // Render the movies page with the data
    res.render('movies', { movies: moviesData, currentPage: page, totalPages, moviePosters, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


router.get('/movies/:title', verifyToken, async (req, res) => {
  try {
    const movieName = req.params.title;
    const [movie] = await pool.query('SELECT * FROM movies WHERE url = ?', [movieName]);
    const [reviews] = await pool.query('SELECT * FROM reviews WHERE movie_id = ? ORDER BY created_at DESC', [movie[0].id]);
    
    if (movie.length === 0) {
      return res.status(404).send('Movie not found');
    }

    // Generate URLs for movie posters and background
    const posterUrl = `https://f005.backblazeb2.com/file/CmnFlix/${encodeURIComponent(movie[0].poster)}`;
    const bgPosterUrl = `https://f005.backblazeb2.com/file/CmnFlix/${encodeURIComponent(movie[0].bg_poster)}`;

    // Split genres to get the first two
    const movieGenres = movie[0].genres.split(' / ');
    const firstGenre = movieGenres[0];

    // Check if the movie has only one genre
    const hasSingleGenre = movieGenres.length === 1;

    // Construct a dynamic query to find similar movies
    let query;
    let queryParams;

    if (hasSingleGenre) {
      query = `
        SELECT * FROM movies
        WHERE 
          id != ? AND 
          (
            genres = ? OR
            genres LIKE ?
          )
        ORDER BY RAND()
        LIMIT 5;
      `;
      
      queryParams = [
        movie[0].id,
        movie[0].genres,
        `${firstGenre} /%`
      ];
    } else {
      query = `
        SELECT * FROM movies
        WHERE 
          id != ? AND 
          (
            (SUBSTRING_INDEX(genres, ' / ', 2) = ?)
          )
        ORDER BY RAND()    
        LIMIT 5;
      `;
      
      const genreMatch = `${firstGenre} / ${movieGenres[1]}`;
      queryParams = [
        movie[0].id,
        genreMatch
      ];
    }

    const userIp = req.ip;
    const userEmail = req.user?.email;

    const [similarMovies] = await pool.query(query, queryParams);

    // Pass the product data and similar movies to the template
    res.render('movie_details', { 
      movie: movie[0], // Pass the movie object directly
      reviews, 
      user: { ...req.user }, 
      similarMovies, 
      userIp, 
      userEmail,
      posterUrl,  // Pass the poster URL
      bgPosterUrl  // Pass the background poster URL
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


const generateCaptcha = () => {
  const questionType = Math.floor(Math.random() * 3); // Randomly choose question type (0: addition, 1: subtraction, 2: multiplication)

  let num1 = Math.floor(Math.random() * 10) + 1; // Change to let
  let num2 = Math.floor(Math.random() * 10) + 1; // Change to let
  let question;
  let answer;

  switch (questionType) {
    case 0: // Addition
      question = `What is ${num1} + ${num2}?`;
      answer = num1 + num2;
      break;

    case 1: // Subtraction
      // Ensure num1 is greater than num2 for positive results
      if (num1 < num2) {
        [num1, num2] = [num2, num1]; // Swap to ensure num1 is greater
      }
      question = `What is ${num1} - ${num2}?`;
      answer = num1 - num2;
      break;

    case 2: // Multiplication
      question = `What is ${num1} * ${num2}?`;
      answer = num1 * num2;
      break;
  }

  return { question, answer };
};


router.get('/movies/:url/play', verifyToken, async (req, res) => {
  const movieUrl = req.params.url;
  const userEmail = req.user?.email;

  try {
    const [movie] = await pool.query('SELECT * FROM movies WHERE url = ?', [movieUrl]);

    if (movie.length === 0) {
      return res.status(404).send('Movie not found');
    }
 
    const movieUrl2 = req.params.url + '(m_p)';
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, movieUrl2]);




    if (existingAnswer.length > 0) {
      return res.render('movie_play', { movie: movie[0], captchaAnswered: true, user: req.user });
    }

    const { question, answer } = generateCaptcha();
    res.render('movie_play', { movie: movie[0], captchaQuestion: question, captchaAnswer: answer, captchaAnswered: false, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


router.post('/movies/:url/play/captcha', verifyToken, async (req, res) => {
  const userAnswer = req.body.answer;
  const correctAnswer = parseInt(req.body.captchaAnswer);
  const movieUrl = req.params.url + '(m_p)';

  // Validate the captcha answer
  if (parseInt(userAnswer) !== correctAnswer) {
    return res.status(401).json({ error: 'Incorrect captcha Answer!' });
  }

  // Check if the user is logged in
  const token = req.cookies?.token; 
  if (!token) {
    return res.status(401).json({ error: 'You must be logged in to submit the captcha.' });
  }

  const userEmail = req.user.email;    
  console.log(userEmail);

  try {
    // Check user analytics to see pages visited
    const [userData] = await pool.query('SELECT pages_visited FROM user_analytics WHERE email= ?', [userEmail]);

    if (userData.length === 0) {
      // If no user data, initialize it
      await pool.query('INSERT INTO user_analytics (email, pages_visited) VALUES (?, 0)', [userEmail]);
      userData[0] = { pages_visited: 0 }; // Set pages_visited to 0
    }

    // Check if pages_visited has reached the limit
    if (userData[0].pages_visited >= 200000) {
      return res.status(403).json({ error: 'Sorry, captcha limit has been reached. Try again next month.' });
    }

    // Check if the user has already answered the captcha for this movie
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, movieUrl]);

    if (existingAnswer.length > 0) {
      return res.status(400).send('You have already answered this captcha for this movie this month.');
    }

    // Store the captcha answer in the database
    await pool.query('INSERT INTO captcha_answers (email, movie_url, answer) VALUES (?, ?, ?)', [userEmail, movieUrl, userAnswer]);

    // Update pages visited
    await pool.query('UPDATE user_analytics SET pages_visited = pages_visited + 1 WHERE email = ?', [userEmail]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.get('/movies/:url/download', verifyToken, async (req, res) => {
  const movieUrl = req.params.url;
  const userIp = req.ip;
  const userEmail = req.user?.email;


  try {
    const [movie] = await pool.query('SELECT * FROM movies WHERE url = ?', [movieUrl]);

    if (movie.length === 0) {
      return res.status(404).send('Movie not found');
    }
 
    const movieUrl2 = req.params.url + '(m_d)';
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, movieUrl2]);

    if (existingAnswer.length > 0) {
      return res.render('movie_download', { movie: movie[0], captchaAnswered: true, user: req.user });
    }

    const { question, answer } = generateCaptcha();
    res.render('movie_download', { movie: movie[0], captchaQuestion: question, captchaAnswer: answer, captchaAnswered: false, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


router.post('/movies/:url/download/captcha', verifyToken, async (req, res) => {
  const userAnswer = req.body.answer;
  const correctAnswer = parseInt(req.body.captchaAnswer);
  const userIp = req.ip;
  const movieUrl = req.params.url + '(m_d)';

  // Validate the captcha answer
  if (parseInt(userAnswer) !== correctAnswer) {
    return res.status(401).json({ error: 'Incorrect captcha Answer!' });
  }

  // Check if the user is logged in
  const token = req.cookies?.token; 
  if (!token) {
    return res.status(401).json({ error: 'You must be logged in to submit the captcha.' });
  }

  const userEmail = req.user.email;

  try {
    // Check user analytics to see pages visited
    const [userData] = await pool.query('SELECT pages_visited FROM user_analytics WHERE email= ?', [userEmail]);

    if (userData.length === 0) {
      // If no user data, initialize it
      await pool.query('INSERT INTO user_analytics (email, pages_visited) VALUES (?, 0)', [userEmail]);
      userData[0] = { pages_visited: 0 }; // Set pages_visited to 0
    }

    // Check if pages_visited has reached the limit
    if (userData[0].pages_visited >= 200000) {
      return res.status(403).json({ error: 'Sorry, captcha limit has been reached. Try again next month.' });
    }

    // Check if the user has already answered the captcha for this movie
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, movieUrl]);

    if (existingAnswer.length > 0) {
      return res.status(400).send('You have already answered this captcha for this movie this month.');
    }

    // Store the captcha answer in the database
    await pool.query('INSERT INTO captcha_answers (email, movie_url, answer) VALUES (?, ?, ?)', [userEmail, movieUrl, userAnswer]);

    // Update pages visited
    await pool.query('UPDATE user_analytics SET pages_visited = pages_visited + 1 WHERE email = ?', [userEmail]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = {
  routes: router
};