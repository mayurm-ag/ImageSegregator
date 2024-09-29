const mongoose = require('mongoose');
const config = require('./config');

mongoose.connect(`mongodb://${config.serverIP}:27017/your_database_name`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});