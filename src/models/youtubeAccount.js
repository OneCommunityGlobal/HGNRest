const mongoose = require('mongoose');

const youtubeAccountSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  clientId: { type: String, required: true },
  clientSecret: { type: String, required: true },
  redirectUri: { type: String, required: true },
  refreshToken: { type: String, required: true },
  channelId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('YoutubeAccount', youtubeAccountSchema); 