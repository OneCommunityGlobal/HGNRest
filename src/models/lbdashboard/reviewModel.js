const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile', // Reference to the UserProfile model
    required: true,
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'listings', // Reference to the listings model
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 500, // Set a reasonable limit for review text
  },
  imageUrls: {
    type: [String],
  },
  stars: {
    type: Number,
    min: 1,
    max: 5,
  },
  username: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ReviewSchema.index({ user: 1, unitId: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);