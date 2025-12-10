const mongoose = require('mongoose');

const { Schema } = mongoose;

const redditPostSchema = new Schema({
  title: String,
  subreddit: String,
  content: String,
  url: String,
  is_posted: { type: Boolean, default: false },
  scheduled_at: { type: Date },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RedditPost', redditPostSchema);
