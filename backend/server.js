const express = require('express');
const cors = require('cors');
const app = express();

// Log the FRONTEND_URL for debugging
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

app.use(cors({
  origin: '*', // This allows all origins. For production, replace with specific origin.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add this middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  next();
});

// ... rest of your server code