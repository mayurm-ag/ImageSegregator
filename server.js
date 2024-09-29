const express = require('express');
const config = require('./config');

const app = express();

// ... other imports and middleware

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://${config.serverIP}:${PORT}`);
});