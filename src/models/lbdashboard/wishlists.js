const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  villageName: {
    type: String,
    required: true,
  },
  unitName: {
    type: String,
  },
  images: {
    type: [String],
  },
  unitAmenities: {
    type: [String],
  },
  villageAmenities: {
    type: [String],
  },
  location: {
    type: String,
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
  price: {
    type: Number,
    required: true,
  }
});

module.exports = mongoose.model('Wishlist', WishlistSchema);