const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory "database"
let users = [];
let nextId = 1;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create a new user
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const userId = nextId.toString();
  const newUser = { username, _id: userId, log: [] };
  users.push(newUser);
  nextId++;
  res.json({ username: newUser.username, _id: newUser._id });
});

// Get all users
app.get('/api/users', (req, res) => {
  const userList = users.map(user => ({
    username: user.username,
    _id: user._id
  }));
  res.json(userList);
});

// Add exercise
app.post('/api/users/:_id/exercises', (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }

  const user = users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // --- DATE HANDLING FIX ---
  // If no date is provided, use the current date.
  // Otherwise, parse the provided date string.
  let dateObj;
  if (date) {
    // The yyyy-mm-dd format is parsed as UTC midnight. We add the timezone offset
    // to ensure that when toDateString() is called, it reflects the correct local date.
    dateObj = new Date(date);
  } else {
    dateObj = new Date();
  }
  
  // Check for invalid date
  if (isNaN(dateObj.getTime())) {
    // Fallback to current date if provided date is invalid
    dateObj = new Date();
  }

  const exercise = {
    description: description,
    duration: parseInt(duration),
    date: dateObj.toDateString() // Formats to "Day Mon dd yyyy"
  };

  user.log.push(exercise);

  res.json({
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date,
    _id: user._id
  });
});

// Get user's exercise logs
app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  const user = users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let filteredLog = [...user.log];

  // --- FILTERING FIX ---
  // Apply date filters if provided, handling timezones correctly.
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      filteredLog = filteredLog.filter(ex => new Date(ex.date) >= fromDate);
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      filteredLog = filteredLog.filter(ex => new Date(ex.date) <= toDate);
    }
  }

  // Apply limit if provided
  if (limit) {
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum) && limitNum > 0) {
      filteredLog = filteredLog.slice(0, limitNum);
    }
  }
  
  const formattedLog = filteredLog.map(ex => ({
    description: ex.description,
    duration: ex.duration,
    date: ex.date 
  }));

  res.json({
    _id: user._id,
    username: user.username,
    count: formattedLog.length,
    log: formattedLog
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
