const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  wishlistListings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      // ref: 'listings',
      required: true,
    },
  ],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  dateAdded: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('wishlist', WishlistSchema);