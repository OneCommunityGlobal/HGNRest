const mongoose = require('mongoose');

const { Schema } = mongoose;

const redditTokenSchema = new Schema({
  access_token: String,
  refresh_token: String,
  expires_in: Number,
  scope: String,
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RedditToken', redditTokenSchema);
