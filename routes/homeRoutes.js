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


router.get('/', verifyToken, async (req, res) => {
    
    const [trendingMovies] = await pool.query('SELECT * FROM movies WHERE trending = 1 ORDER BY updated_at DESC LIMIT 12');
    const [trendingSeries] = await pool.query('SELECT * FROM series WHERE trending = 1 ORDER BY updated_at DESC LIMIT 12');
  
    const [popularMovies] = await pool.query('SELECT * FROM movies ORDER BY rate DESC');
    const [popularSeries] = await pool.query('SELECT * FROM series ORDER BY rate DESC');
  
    const [latestMovies] = await pool.query('SELECT * FROM movies ORDER BY release_date DESC');
    const [latestSeries] = await pool.query('SELECT * FROM series ORDER BY release_date DESC');
    
  
    // Combine results for trending
    const trending = [
      ...trendingMovies.map(movie => ({ ...movie, type: 'movie' })),
      ...trendingSeries.map(serie => ({ ...serie, type: 'series' }))
    ];  
    trending.sort((a, b) => b.updated_at - a.updated_at);
    const top10 = trending.slice(0, 10);
  
  
    // Combine results for popular
    const popular = [
      ...popularMovies.map(movie => ({ ...movie, type: 'movie' })),
      ...popularSeries.map(serie => ({ ...serie, type: 'series' }))
    ];
    popular.sort((a, b) => b.rate - a.rate);
    const top102 = popular.slice(0, 10);
  
  
    // Combine results for latest
    const latest = [
      ...latestMovies.map(movie => ({ ...movie, type: 'movie' })),
      ...latestSeries.map(serie => ({ ...serie, type: 'series' }))
    ];
    latest.sort((a, b) => b.updated_at - a.updated_at);
    const top103 = latest.slice(0, 10);
  
  
  
    res.render('index', { trending: top10, popular: top102, latest: top103, user: req.user }); 
});


router.get('/trending', verifyToken, async (req, res) => {
  const [movies] = await pool.query('SELECT * FROM movies WHERE trending = 1 ORDER BY updated_at');
  const [series] = await pool.query('SELECT * FROM series WHERE trending = 1 ORDER BY updated_at');

  // Combine results and mark their type
  const trendingMovies = [
    ...movies.map(movie => ({ ...movie, type: 'movie' })),
    ...series.map(serie => ({ ...serie, type: 'series' }))
  ];

  trendingMovies.sort((a, b) => b.updated_at - a.updated_at);

  // Limit to top 48 entries
  const top48 = trendingMovies.slice(0, 48);

  res.render('trending', { trendingMovies: top48, user: req.user }); 
});


router.get('/popular', verifyToken, async (req, res) => {
  // Get movies and series ordered by rate
  const [movies] = await pool.query('SELECT * FROM movies ORDER BY rate DESC');
  const [series] = await pool.query('SELECT * FROM series ORDER BY rate DESC');

  // Combine results and mark their type
  const popularMovies = [
    ...movies.map(movie => ({ ...movie, type: 'movie' })),
    ...series.map(serie => ({ ...serie, type: 'series' }))
  ];

  // Sort combined results by rate
  popularMovies.sort((a, b) => b.rate - a.rate);

  // Limit to top 48 entries
  const top48 = popularMovies.slice(0, 48);

  // Render the popular view with limited results
  res.render('popular', { popularMovies: top48, user: req.user });
});


router.get('/latest', verifyToken, async (req, res) => {
  const [movies] = await pool.query('SELECT * FROM movies ORDER BY release_date');
  const [series] = await pool.query('SELECT * FROM series ORDER BY release_date');

  // Combine results and mark their type
  const latestMovies = [
    ...movies.map(movie => ({ ...movie, type: 'movie' })),
    ...series.map(serie => ({ ...serie, type: 'series' }))
  ];

  latestMovies.sort((a, b) => b.updated_at - a.updated_at);

  // Limit to top 48 entries
  const top48 = latestMovies.slice(0, 48);

  res.render('latest', { latestMovies: top48, user: req.user }); 
});


router.post('/submit-review', async (req, res) => {
  console.log(req.body); // Log the request body for debugging
  const { content, userName, movieId, seriesId } = req.body;
  const ipAddress = req.ip; // Capture the user's IP address

  try {
      const [result] = await pool.query(
          'INSERT INTO reviews (content, user_name, movie_id, series_id, ip_address) VALUES (?, ?, ?, ?, ?)',
          [content, userName, movieId || null, seriesId || null, ipAddress]
      );
      
      res.json({ success: true, reviewId: result.insertId });
  } catch (err) {
      console.error(err); // Log error for debugging
      res.status(500).json({ success: false, message: 'Database error' });
  }
});


router.delete('/delete-review/:id', async (req, res) => {
  const reviewId = req.params.id;
  const ipAddress = req.ip; // Capture the user's IP address

  try {
      const [review] = await pool.query('SELECT * FROM reviews WHERE id = ?', [reviewId]);

      if (review.length === 0 || review[0].ip_address !== ipAddress) {
          return res.status(403).send('You cannot delete this review.');
      }

      await pool.query('DELETE FROM reviews WHERE id = ?', [reviewId]);
      res.sendStatus(204); // No content
  } catch (err) {
      console.error(err);
      res.status(500).send('Internal server error');
  }
});


// Search route
router.get('/search', async (req, res) => {
  const query = req.query.q || '';
  try {
    const [movies] = await pool.execute('SELECT * FROM movies WHERE title LIKE ? OR file_title LIKE ?', [`%${query}%`, `%${query}%`]);
    const [series] = await pool.execute('SELECT * FROM series WHERE title LIKE ? OR file_title LIKE ?', [`%${query}%`, `%${query}%`]);

    // Combine results and mark their type
    const results = [
      ...movies.map(movie => ({ ...movie, type: 'movie' })),
      ...series.map(serie => ({ ...serie, type: 'series' }))
    ];

    // Sort results alphabetically by title
    results.sort((a, b) => a.title.localeCompare(b.title));

    res.render('search', { results, query });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



module.exports = {
  routes: router
};