require('dotenv').config();
const express = require('express');
const router = express();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Create a MySQL connection pool 
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Middleware to verify token and check admin role
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.redirect('/');;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to the request

    // Check if the user is the admin
    if (decoded.email !== 'melkylie8@gmail.com') {
      return res.redirect('/');
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(403).send('Forbidden');
  }
};

// Admin dashboard route
router.get('/admin', verifyToken, async (req, res) => {
  const userEmail = req.user.email;
  const [userData] = await pool.query('SELECT * FROM users WHERE email = ?', [userEmail]);

  if (userData.length === 0) {
    return res.status(404).send('User not found');
  }

  res.render('admin_dashboard', { user: req.user, error: null, message: null });
});


// Insert Movie route
router.post('/admin/movie', async (req, res) => {
  try {    
    const { title, url, file_title, poster, bg_poster, duration, rating, year, genres, rate, cast, description, release_date, country, director, trailer, position, color } = req.body;

    if (!title || !url || !file_title || !poster || !bg_poster || !duration || !rating || !year ||!genres ||!rate || !cast || !description || !release_date || !director || !trailer || !position || !color) {
      return res.render('/admin', { error: 'All fields are required.' });
    }
   

// Ensure referral_code is included in the insert statement
await pool.query('INSERT INTO movies (title, url, file_title, poster, bg_poster, duration, rating, year, genres, rate, cast, description, release_date, country, director, trailer, position, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
  title,
  url,
  file_title,
  poster,
  bg_poster,
  duration,
  rating, // Store as null if not provided
  year,
  genres,
  rate,
  cast,
  description,
  release_date,
  country,
  director,
  trailer,
  position,
  color
]);  

    res.render('successes', { message: 'Successfully inserted Movie!!!', error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});



// Insert Movie route
router.post('/admin/series', async (req, res) => {
  try {    
    const { title, url, file_title, poster, bg_poster, duration, rating, years, genres, rate, cast, description, release_date, country, creator, trailer, position, color } = req.body;

    if (!title || !url || !file_title || !poster || !bg_poster || !duration || !rating || !years ||!genres ||!rate || !cast || !description || !release_date || !trailer || !position || !color) {
      return res.render('/admin', { error: 'All fields are required.' });
    }
    
    await pool.query('INSERT INTO series (title, url, file_title, poster, bg_poster, duration, rating, years, genres, rate, cast, description, release_date, country, creator, trailer, position, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [ title, url, file_title, poster, bg_poster, duration, rating, years, genres, rate, cast, description, release_date, country, creator, trailer, position, color ]);  

    res.render('successes', { message: 'Successfully inserted Series!!!', error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


function generateRandomString(length) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_@$';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
}


function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9.#'_-]/g, ''); // Allows letters, numbers, dots, underscores, and hyphens
}


// Insert Movie route
router.post('/admin/seasons', async (req, res) => {
  try {
    const { series_id, season_number, poster, bg_poster, release_date, season_description, trailer, color } = req.body;


    if (!series_id || !season_number || !poster || !bg_poster || !release_date || !season_description || !trailer || !color) {
      return res.render('/admin', { error: 'All fields are required.' });
    }

    const uniqueId = generateRandomString(20);
    const sanitizedUniqueId = sanitizeInput(uniqueId);

    await pool.query('INSERT INTO seasons (series_id, season_number, poster, bg_poster, release_date, season_description, trailer, color, unique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      series_id, season_number, poster, bg_poster, release_date, season_description, trailer, color, sanitizedUniqueId
    ]);

    res.render('successes', { message: 'Successfully inserted Seasons!!!', error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Insert Episode route
router.post('/admin/episodes', verifyToken, async (req, res) => {
  const { season_id, title, file_title, rate, description, episode_number, release_date } = req.body;

  const uniqueId = generateRandomString(20);
  const sanitizedUniqueId = sanitizeInput(uniqueId);

  

  try {
    const [result] = await pool.query('INSERT INTO episodes (season_id, title, file_title, rate, description, episode_number, release_date, unique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [season_id, title, file_title, rate, description, episode_number, release_date, sanitizedUniqueId]);

    res.render('successes', { message: 'Successfully inserted Episode!!!', error: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// Update Movie route
router.post('/admin/movie/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, url, file_title, poster, bg_poster, duration, rating, genres, rate,  cast, description, release_date, country, director, trailer, position, color, trending } = req.body;

  try {
    await pool.query(
      'UPDATE movies SET title = ?, url = ?, file_title = ?, poster = ?, bg_poster = ?, duration = ?, rating = ?, genres = ?, rate = ?, cast = ?, description = ?, release_date = ?, country = ?, director = ?, trailer = ?, position = ?, color = ?, trending = ? WHERE id = ?',
      [title, url, file_title, poster, bg_poster, duration, rating, genres, rate, cast, description, release_date, country, director, trailer, position, color, trending, id]
    );

    res.redirect(`/movies/${url}`); // Redirect back to the movie details page
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Update Movie route
router.post('/admin/series/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, url, file_title, poster, bg_poster, duration, rating, years, genres, rate,  cast, description, release_date, country, creator, trailer, position, color, trending } = req.body;

  try {
    await pool.query(
      'UPDATE series SET title = ?, url = ?, file_title = ?, poster = ?, bg_poster = ?, duration = ?, rating = ?, years = ?, genres = ?, rate = ?, cast = ?, description = ?, release_date = ?, country = ?, creator = ?, trailer = ?, position = ?, color = ?, trending = ? WHERE id = ?',
      [title, url, file_title, poster, bg_poster, duration, rating, years, genres, rate, cast, description, release_date, country, creator, trailer, position, color, trending, id]
    );

    res.redirect(`/shows/${url}`); // Redirect back to the movie details page
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Update Season route
router.post('/admin/seasons/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { series_id, season_number, poster, bg_poster, release_date, season_description, trailer, unique_id, position, color } = req.body;

  try {
    await pool.query(
      'UPDATE seasons SET series_id = ?, season_number = ?, poster = ?, bg_poster = ?, release_date = ?, season_description = ?, trailer = ?, unique_id = ?, position = ?, color = ? WHERE id = ?',
      [series_id, season_number, poster, bg_poster, release_date, season_description, trailer, unique_id, position, color, id]
    );

     // Fetch the series URL after updating
    const [seriesData] = await pool.query('SELECT url FROM series WHERE id = ?', [series_id]);
    const seriesUrl = seriesData[0].url;


    // Redirect back to the season details page or series page
    res.redirect(`/shows/${seriesUrl}/S${unique_id}`); // Ensure seriesUrl is passed in the form
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Update Episode route
router.post('/admin/episodes/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { season_id, title, file_title, rate, description, episode_number, release_date, unique_id, seriesUrl } = req.body;

  try {
    await pool.query(
      'UPDATE episodes SET season_id = ?, title = ?, file_title = ?, rate = ?, description = ?, episode_number = ?, release_date = ?, unique_id = ? WHERE id = ?',
      [season_id, title, file_title, rate, description, episode_number, release_date, unique_id, id]
    );

    // Fetch the unique_id of the season after updating
    const [seasonData] = await pool.query('SELECT unique_id FROM seasons WHERE id = ?', [season_id]);

    const seasonUnique = seasonData[0].unique_id; // Correctly referencing unique_id
    res.redirect(`/shows/${seriesUrl}/S${seasonUnique}/E${unique_id}`); // Redirecting to the episode page
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Delete Movie route
router.get('/admin/movie/delete/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM movies WHERE id = ?', [id]);
    res.redirect('/movies'); // Redirect to the movies list page
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Delete Series route
router.get('/admin/series/delete/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM series WHERE id = ?', [id]);
    res.redirect('/shows'); // Redirect to the series list page
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Delete Season route
router.get('/admin/seasons/delete/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  
  try {
    // Fetch the season data to get the series ID
    const [seasonData] = await pool.query('SELECT series_id FROM seasons WHERE id = ?', [id]);
    const seriesId = seasonData[0].series_id;

    // Fetch the series URL
    const [seriesData] = await pool.query('SELECT url FROM series WHERE id = ?', [seriesId]);
    const seriesUrl = seriesData[0].url;

    // Delete the season
    await pool.query('DELETE FROM seasons WHERE id = ?', [id]);

    // Redirect to the corresponding series page
    res.redirect(`/shows/${seriesUrl}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


// Delete Episode route
router.get('/admin/episodes/delete/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the episode data to get the season ID
    const [episodeData] = await pool.query('SELECT season_id FROM episodes WHERE id = ?', [id]);
    const seasonId = episodeData[0].season_id;

    // Fetch the season data to get the series ID and unique_id
    const [seasonData] = await pool.query('SELECT series_id, unique_id FROM seasons WHERE id = ?', [seasonId]);
    const seriesId = seasonData[0].series_id;
    const seasonUniqueId = seasonData[0].unique_id;

    // Fetch the series URL
    const [seriesData] = await pool.query('SELECT url FROM series WHERE id = ?', [seriesId]);
    const seriesUrl = seriesData[0].url;

    // Delete the episode
    await pool.query('DELETE FROM episodes WHERE id = ?', [id]);
    
    // Redirect to the corresponding season page
    res.redirect(`/shows/${seriesUrl}/S${seasonUniqueId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});


module.exports = {
  routes: router
};