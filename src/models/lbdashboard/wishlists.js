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
    },
  },
  { timestamps: true },
);

// Partial so that legacy documents without userId cannot make the unique index build fail
WishlistSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } },
);

module.exports = mongoose.model('Wishlist', WishlistSchema);
