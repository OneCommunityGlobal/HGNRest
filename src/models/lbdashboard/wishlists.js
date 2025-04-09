const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  wishlistVillageListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'listings',
    required: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dateAdded: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('wishlist', WishlistSchema);