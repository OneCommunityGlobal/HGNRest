
const mongoose = require('mongoose');
mongoose.connect = async () => {
  console.log('⚠️  Skipping MongoDB connection for local review...');
  return Promise.resolve();
};
