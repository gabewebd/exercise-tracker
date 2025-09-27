const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

  // Handle the date
  let exerciseDate;
  if (date) {
    exerciseDate = new Date(date);
  } else {
    exerciseDate = new Date();
  }
  
  // Store the raw date object in the log
  const exercise = {
    description: description,
    duration: parseInt(duration),
    date: exerciseDate  // Store as Date object
  };

  user.log.push(exercise);

  // Format the date for response (remove timezone info to avoid UTC offset issues)
  const dateString = new Date(exerciseDate.toISOString().split('T')[0]).toDateString();

  // Return response
  res.json({
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: dateString,
    _id: user._id
  });
});

// Get logs
app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  const user = users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let filteredLog = [...user.log];

  // Filter by from date
  if (from) {
    const fromDate = new Date(from);
    filteredLog = filteredLog.filter(ex => {
      const exerciseDate = new Date(ex.date);
      return exerciseDate >= fromDate;
    });
  }

  // Filter by to date  
  if (to) {
    const toDate = new Date(to);
    filteredLog = filteredLog.filter(ex => {
      const exerciseDate = new Date(ex.date);
      return exerciseDate <= toDate;
    });
  }

  // Apply limit
  if (limit) {
    filteredLog = filteredLog.slice(0, parseInt(limit));
  }

  // Format all dates in the log to avoid timezone issues
  const formattedLog = filteredLog.map(ex => ({
    description: ex.description,
    duration: ex.duration,
    // Remove timezone info before converting to date string
    date: new Date(new Date(ex.date).toISOString().split('T')[0]).toDateString()
  }));

  // Return the response
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