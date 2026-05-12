require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/db');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// allow requests from frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// all routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/interview', require('./routes/interview'));

// health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server running fine' });
});

// init database first then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
});
