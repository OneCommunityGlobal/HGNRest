const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema(
  {
    listingId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'listings',
        required: true,
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Wishlist', WishlistSchema);
