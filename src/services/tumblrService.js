const Tumblr = require('tumblr.js');

class TumblrService {
  constructor() {
    // Fetch environment variables once
    this.consumerKey = process.env.TUMBLR_CONSUMER_KEY;
    this.consumerSecret = process.env.TUMBLR_CONSUMER_SECRET;
    this.token = process.env.TUMBLR_TOKEN;
    this.tokenSecret = process.env.TUMBLR_TOKEN_SECRET;
    this.blogId = process.env.TUMBLR_BLOG_ID;

    this.client = Tumblr.createClient({
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      token: this.token,
      token_secret: this.tokenSecret,
    });
  }
}

// Create and freeze singleton instance
const instance = new TumblrService();
Object.freeze(instance);

module.exports = instance;
