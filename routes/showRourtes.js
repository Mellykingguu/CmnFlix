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

// Route for the series page
router.get('/shows', verifyToken, async (req, res) => {
  try { 
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = 12;
    const offset = (page - 1) * limit;

    // Fetch all series from the database
    const [seriesData] = await pool.query('SELECT * FROM series ORDER BY updated_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    const [totalCount] = await pool.query('SELECT COUNT(*) as total FROM series');
    const totalPages = Math.ceil(totalCount[0].total / limit);

    // Generate URLs for show posters based on the poster field
    const showPosters = seriesData.map(serie => {
      return `https://f005.backblazeb2.com/file/CmnFlix/${encodeURIComponent(serie.poster)}`;
    });

    // Render the series page with the data
    res.render('shows', { series: seriesData, currentPage: page, totalPages, showPosters, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});
  
// Route for a specific series
router.get('/shows/:seriesUrl', verifyToken, async (req, res) => {
  try {
      const seriesUrl = req.params.seriesUrl;
  
      // Fetch the series details using the seriesUrl
      const [seriesData] = await pool.query('SELECT * FROM series WHERE url = ?', [seriesUrl]);    
     
  
      if (seriesData.length === 0) {
        return res.status(404).send('Series not found');
      }
  
      const [reviews] = await pool.query('SELECT * FROM reviews WHERE series_id = ? ORDER BY created_at DESC', [seriesData[0].id]);
      // Fetch seasons for the series
      const [seasonsData] = await pool.query('SELECT * FROM seasons WHERE series_id = ?  ORDER BY season_number', [seriesData[0].id]); // Assuming series_id is the column name for series ID
  
      // Split genres to get the first two
      const seriesGenres = seriesData[0].genres.split(' / ');
      const firstGenre = seriesGenres[0];
  
      // Check if the movie has only one genre
      const hasSingleGenre = seriesGenres.length === 1;
  
      // Construct a dynamic query to find similar movies
      let query;
      let queryParams;
  
      if (hasSingleGenre) {
        // Logic for movies with only one genre
        query = `
          SELECT * FROM series
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
          seriesData[0].id,
          seriesData[0].genres, // Exact match for single genre
          `${firstGenre} /%` // Match any genre that starts with the first genre
        ];
      } else {
        // Existing logic for movies with two or more genres
        query = `
          SELECT * FROM series
          WHERE 
            id != ? AND 
            (
              (SUBSTRING_INDEX(genres, ' / ', 2) = ?)
            )
          ORDER BY RAND()    
          LIMIT 5;
        `;
        
        // Create the exact match string for the first two genres
        const genreMatch = `${firstGenre} / ${seriesGenres[1]}`;
        queryParams = [
          seriesData[0].id,
          genreMatch
        ];
      }
  
  
      // Pass the user's IP address to the template
      const userIp = req.ip;
  
  
      // Execute the query with the current movie ID and genre match
      const [similarSeries] = await pool.query(query, queryParams);
  
  
      // Render the series details page with the data
      res.render('series_details', { series: seriesData[0], seasons: seasonsData, similarSeries, reviews, userIp, user: req.user  });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    }
});

// Route for a specific season
router.get('/shows/:url/S:seasonUnique', verifyToken, async (req, res) => {
    try {
      const seriesUrl = req.params.url;
      const seasonUnique = req.params.seasonUnique; // Capture season number from the URL
  
      // Fetch the series details using the seriesUrl
      const [seriesData] = await pool.query('SELECT * FROM series WHERE url = ?', [seriesUrl]);
  
      if (seriesData.length === 0) {
        
        return res.status(404).send('Series not found');
      }
  
      // Fetch the season details using the seasonNumber
      const [seasonsData] = await pool.query('SELECT * FROM seasons WHERE series_id = ? AND unique_id = ?', [seriesData[0].id, seasonUnique]); // Assuming series_id is the column name for series ID
  
      if (seasonsData.length === 0) {
        return res.status(404).send('Season not found');
      }
  
      // Fetch episodes for the season
      const [episodesData] = await pool.query('SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number', [seasonsData[0].id]); 
  
      // Calculate average rating
      const averageRating = episodesData.length > 0
      ? (episodesData.reduce((acc, episode) => acc + episode.rate, 0) / episodesData.length).toFixed(1) 
      : 0;
      
      // Add average rating to season data
      seasonsData[0].averageRate = averageRating;

      // Render the season details page with the data
      res.render('season_details', { season: seasonsData[0], episodes: episodesData, series: seriesData[0], user: req.user  }); 
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    } 
});

  
// Route for a specific episode
router.get('/shows/:url/S:seasonUnique/E:episodeUnique', verifyToken, async (req, res) => {
    try {
      const seriesUrl = req.params.url;
      const seasonUnique = req.params.seasonUnique;
      const episodeUnique = req.params.episodeUnique; // Capture episode number from the URL
  
      // Fetch the series details using the seriesUrl
      const [seriesData] = await pool.query('SELECT * FROM series WHERE url = ?', [seriesUrl]);
  
      if (seriesData.length === 0) { 
        return res.status(404).send('Series not found');
      }
  
      // Fetch the season details using the seasonNumber
      const [seasonsData] = await pool.query('SELECT * FROM seasons WHERE series_id = ? AND unique_id = ?', [seriesData[0].id, seasonUnique]); 
  
      if (seasonsData.length === 0) {
        return res.status(404).send('Season not found');
      } 
  
      // Fetch the episode details using the episodeNumber
      const [episodeData] = await pool.query('SELECT * FROM episodes WHERE season_id = ? AND unique_id = ?', [seasonsData[0].id, episodeUnique]);
  
      if (episodeData.length === 0) {
        return res.status(404).send('Episode not found');
      }
  
      // Render the episode details page with the data
      res.render('episode_details', { episode: episodeData[0],  season: seasonsData[0], series: seriesData[0], user: req.user  });
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


router.get('/shows/:url/S:seasonUnique/E:episodeUnique/play', verifyToken, async (req, res) => {
  const seriesUrl = req.params.url;
  const seasonUnique = req.params.seasonUnique;
  const episodeUnique = req.params.episodeUnique;
  const userEmail = req.user?.email;

  console.log

  try {
    const [seriesData] = await pool.query('SELECT * FROM series WHERE url = ?', [seriesUrl]);

    if (seriesData.length === 0) {
      return res.status(404).send('Movie not found');
    }

    const [seasonsData] = await pool.query('SELECT * FROM seasons WHERE series_id = ? AND unique_id = ?', [seriesData[0].id, seasonUnique]); // Assuming series_id is the column name for series ID
  
    if (seasonsData.length === 0) {
      return res.status(404).send('Season not found');
    }

    // Fetch the episode details using the episodeNumber
    const [episodeData] = await pool.query('SELECT * FROM episodes WHERE season_id = ? AND unique_id = ?', [seasonsData[0].id, episodeUnique]);
  
    if (episodeData.length === 0) {
      return res.status(404).send('Episode not found');
    }
 
    const seriesUrl2 = req.params.url + 'S' + req.params.seasonUnique + 'E' + req.params.episodeUnique + '(s_p)';
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, seriesUrl2]);

    if (existingAnswer.length > 0) {
      return res.render('series_play', { series: seriesData[0], season: seasonsData[0], episode: episodeData[0], captchaAnswered: true, user: req.user });
    }

    const { question, answer } = generateCaptcha();
    res.render('series_play', { series: seriesData[0], season: seasonsData[0], episode: episodeData[0], captchaQuestion: question, captchaAnswer: answer, captchaAnswered: false, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


router.post('/shows/:url/S:seasonUnique/E:episodeUnique/play/captcha', verifyToken, async (req, res) => {
  const userAnswer = req.body.answer;
  const correctAnswer = parseInt(req.body.captchaAnswer);
  const seriesUrl = req.params.url + 'S' + req.params.seasonUnique + 'E' + req.params.episodeUnique + '(s_p)';

  // Validate the captcha answer
  if (parseInt(userAnswer) !== correctAnswer) {
    return res.status(401).json({ error: 'Incorrect captcha Answer!' });
  }

  // Check if the user is logged in
  const token = req.cookies?.token; 
  if (!token) {
    return res.status(401).json({ error: 'You must be logged in to submitcaptcha.' });
  }

  const userEmail = req.user.email;     

  try {
    // Check user analytics to see pages visited
    const [userData] = await pool.query('SELECT pages_visited FROM user_analytics WHERE email= ?', [userEmail]);

    
    if (userData.length === 0) {
      await pool.query('INSERT INTO user_analytics (email, pages_visited) VALUES (?, 0)', [userEmail]);
      userData[0] = { pages_visited: 0 };
    }

    // Check if pages_visited has reached the limit
    if (userData[0].pages_visited >= 200000) {
      return res.status(403).json({ error: 'Sorry, captcha limit has been reached. Try again next month.' });
    }

    // Check if the user has already answered the captcha for this movie
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, seriesUrl]);

    if (existingAnswer.length > 0) {
      return res.status(400).send('You have already answered this captcha for this movie this month.');
    }

    // Store the captcha answer in the database
    await pool.query('INSERT INTO captcha_answers (email, movie_url, answer) VALUES (?, ?, ?)', [userEmail, seriesUrl, userAnswer]);

    await pool.query('UPDATE user_analytics SET pages_visited = pages_visited + 1 WHERE email = ?', [userEmail]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.get('/shows/:url/S:seasonUnique/E:episodeUnique/download', verifyToken, async (req, res) => {
  const seriesUrl = req.params.url;
  const seasonUnique = req.params.seasonUnique;
  const episodeUnique = req.params.episodeUnique;
  const userEmail = req.user?.email;


  try {
    const [seriesData] = await pool.query('SELECT * FROM series WHERE url = ?', [seriesUrl]);

    if (seriesData.length === 0) {
      return res.status(404).send('Movie not found');
    }

    const [seasonsData] = await pool.query('SELECT * FROM seasons WHERE series_id = ? AND unique_id = ?', [seriesData[0].id, seasonUnique]); // Assuming series_id is the column name for series ID
  
    if (seasonsData.length === 0) {
      return res.status(404).send('Season not found');
    }

    // Fetch the episode details using the episodeNumber
    const [episodeData] = await pool.query('SELECT * FROM episodes WHERE season_id = ? AND unique_id = ?', [seasonsData[0].id, episodeUnique]);
  
    if (episodeData.length === 0) {
      return res.status(404).send('Episode not found');
    }
 
    const seriesUrl2 = req.params.url + 'S' + req.params.seasonUnique + 'E' + req.params.episodeUnique + '(s_d)';
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, seriesUrl2]);

    if (existingAnswer.length > 0) {
      return res.render('series_download', { series: seriesData[0], season: seasonsData[0], episode: episodeData[0], captchaAnswered: true, user: req.user });
    }

    const { question, answer } = generateCaptcha();
    res.render('series_download', { series: seriesData[0], season: seasonsData[0], episode: episodeData[0], captchaQuestion: question, captchaAnswer: answer, captchaAnswered: false, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


router.post('/shows/:url/S:seasonUnique/E:episodeUnique/download/captcha', verifyToken, async (req, res) => {
  const userAnswer = req.body.answer;
  const correctAnswer = parseInt(req.body.captchaAnswer);
  const seriesUrl = req.params.url + 'S' + req.params.seasonUnique + 'E' + req.params.episodeUnique + '(s_d)';

  // Validate the captcha answer
  if (parseInt(userAnswer) !== correctAnswer) {
    return res.status(401).json({ error: 'Incorrect captcha Answer!' });
  }

  // Check if the user is logged in
  const token = req.cookies?.token; 
  if (!token) {
    return res.status(401).json({ error: 'You must be logged in to submitcaptcha.' });
  }

  const userEmail = req.user.email;     

  try {
    // Check user analytics to see pages visited
    const [userData] = await pool.query('SELECT pages_visited FROM user_analytics WHERE email= ?', [userEmail]);

    
    if (userData.length === 0) {
      await pool.query('INSERT INTO user_analytics (email, pages_visited) VALUES (?, 0)', [userEmail]);
      userData[0] = { pages_visited: 0 };
    }

    // Check if pages_visited has reached the limit
    if (userData[0].pages_visited >= 200000) {
      return res.status(403).json({ error: 'Sorry, captcha limit has been reached. Try again next month.' });
    }

    // Check if the user has already answered the captcha for this movie
    const [existingAnswer] = await pool.query('SELECT * FROM captcha_answers WHERE email = ? AND movie_url = ?', [userEmail, seriesUrl]);

    if (existingAnswer.length > 0) {
      return res.status(400).send('You have already answered this captcha for this movie this month.');
    }

    // Store the captcha answer in the database
    await pool.query('INSERT INTO captcha_answers (email, movie_url, answer) VALUES (?, ?, ?)', [userEmail, seriesUrl, userAnswer]);

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