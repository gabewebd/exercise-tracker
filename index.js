const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

// Middleware
app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// In-memory storage (no MongoDB required)
let users = [];
let exercises = [];
let userIdCounter = 1;
let exerciseIdCounter = 1;

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// Create new user
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  // Check if username already exists
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  
  const newUser = {
    username: username,
    _id: userIdCounter.toString()
  };
  
  users.push(newUser);
  userIdCounter++;
  
  res.json(newUser);
})

// Get all users
app.get('/api/users', (req, res) => {
  res.json(users);
})

// Add exercise
app.post('/api/users/:_id/exercises', (req, res) => {
  const { _id } = req.params;
  let { description, duration, date } = req.body;
  
  // Find user
  const user = users.find(u => u._id === _id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Validate required fields
  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }
  
  // Parse duration to number
  duration = parseInt(duration);
  if (isNaN(duration)) {
    return res.status(400).json({ error: 'Duration must be a number' });
  }
  
  // Parse date or use current date
  let exerciseDate;
  if (date) {
    exerciseDate = new Date(date);
    if (isNaN(exerciseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use yyyy-mm-dd' });
    }
  } else {
    exerciseDate = new Date();
  }
  
  // Create exercise
  const exercise = {
    _id: exerciseIdCounter.toString(),
    userId: _id,
    description: description,
    duration: duration,
    date: exerciseDate
  };
  
  exercises.push(exercise);
  exerciseIdCounter++;
  
  res.json({
    _id: user._id,
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date.toDateString()
  });
})

// Get exercise log
app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;
  
  // Find user
  const user = users.find(u => u._id === _id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Get user's exercises
  let userExercises = exercises.filter(ex => ex.userId === _id);
  
  // Apply date filters
  if (from) {
    const fromDate = new Date(from);
    userExercises = userExercises.filter(ex => new Date(ex.date) >= fromDate);
  }
  
  if (to) {
    const toDate = new Date(to);
    userExercises = userExercises.filter(ex => new Date(ex.date) <= toDate);
  }
  
  // Apply limit
  if (limit) {
    userExercises = userExercises.slice(0, parseInt(limit));
  }
  
  // Format log entries
  const log = userExercises.map(exercise => ({
    description: exercise.description,
    duration: exercise.duration,
    date: new Date(exercise.date).toDateString()
  }));
  
  res.json({
    _id: user._id,
    username: user.username,
    count: log.length,
    log: log
  });
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})