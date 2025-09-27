const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config({ path: './sample.env' }); 
const mongoose = require('mongoose'); // Import Mongoose

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// --- Mongoose Schemas and Models ---

// Exercise Schema 
const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  log: [exerciseSchema] // Embeds exercises within the user document
});

// The model name is 'FccUser'. 
// Mongoose will create a collection called 'fcc_users'.
const FccUser = mongoose.model('FccUser', userSchema);

// --- Middleware ---
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// ------------------------------------
// --- Route Handlers using Mongoose ---
// ------------------------------------

// Create a new user (POST /api/users)
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const newUser = new FccUser({ username });
    const savedUser = await newUser.save();
    
    // Respond with the required format
    res.json({ 
      username: savedUser.username, 
      _id: savedUser._id 
    });
  } catch (err) {
    if (err.code === 11000) { // MongoDB duplicate key error (for unique: true on username)
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Get all users (GET /api/users)
app.get('/api/users', async (req, res) => {
  try {
    // USE NEW MODEL NAME
    const users = await FccUser.find({}, 'username _id'); 

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Add exercise (POST /api/users/:_id/exercises)
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }

  try {
    // 1. Validate and format duration and date
    const parsedDuration = parseInt(duration);
    if (isNaN(parsedDuration)) {
      return res.status(400).json({ error: 'Duration must be a number' });
    }

    let exerciseDate = date ? new Date(date) : new Date();

    if (exerciseDate.toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const newExercise = {
      description: description,
      duration: parsedDuration,
      date: exerciseDate 
    };

    // 2. Find user and push the new exercise to the log array
    const updatedUser = await FccUser.findByIdAndUpdate(
      userId,
      { $push: { log: newExercise } },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3. Format date for response 
    const dateString = new Date(exerciseDate.toISOString().split('T')[0]).toDateString();

    // 4. Return the required response format
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      date: dateString,
      duration: newExercise.duration,
      description: newExercise.description
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error adding exercise' });
  }
});

// Get logs (GET /api/users/:_id/logs?from=...&to=...&limit=...)
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    // USE NEW MODEL NAME
    const user = await FccUser.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let dateQuery = {};

    // Build the date query object for filtering
    if (from) {
      const fromDate = new Date(from);
      if (fromDate.toString() !== 'Invalid Date') {
        dateQuery['$gte'] = fromDate; // Greater than or equal to 'from' date
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (toDate.toString() !== 'Invalid Date') {
        dateQuery['$lte'] = toDate; // Less than or equal to 'to' date
      }
    }
    
    // Use the Aggregation Pipeline with the NEW MODEL NAME
    const aggregationPipeline = [
      { $match: { _id: user._id } }, // Match the user ID
      { $unwind: '$log' } // Deconstruct the log array
    ];

    // Apply date filtering to the unwound documents
    if (from || to) {
        aggregationPipeline.push({ $match: { 'log.date': dateQuery } });
    }

    // Sort by date (optional, but good practice)
    aggregationPipeline.push({ $sort: { 'log.date': 1 } }); 

    // Apply limit
    if (limit) {
      const parsedLimit = parseInt(limit);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        aggregationPipeline.push({ $limit: parsedLimit });
      }
    }

    // Group back the results
    aggregationPipeline.push({
      $group: {
        _id: '$_id',
        username: { $first: '$username' },
        log: { $push: '$log' },
        count: { $sum: 1 }
      }
    });

    const results = await FccUser.aggregate(aggregationPipeline);
    const resultUser = results[0];

    if (!resultUser) {
        // If the initial user exists but the log is empty/filtered to empty
        return res.json({
            _id: user._id,
            username: user.username,
            count: 0,
            log: []
        });
    }

    // Format the log dates for the final response
    const formattedLog = resultUser.log.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      // Date formatting logic (removes timezone info)
      date: new Date(new Date(ex.date).toISOString().split('T')[0]).toDateString()
    }));

    // Return the response
    res.json({
      _id: resultUser._id,
      username: resultUser.username,
      count: resultUser.count,
      log: formattedLog
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});


// --- Listener ---
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});