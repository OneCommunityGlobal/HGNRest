/* eslint-disable quotes */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const emailSubscriptionListSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  emailSubscriptions: {
    type: Boolean,
    default: true,
  },
  isConfirmed: {
    type: Boolean,
    default: false,
    index: true,
  },
  subscribedAt: {
    type: Date,
    default: () => new Date(),
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
});

// Compound index for common queries (isConfirmed + emailSubscriptions)
emailSubscriptionListSchema.index({ isConfirmed: 1, emailSubscriptions: 1 });

module.exports = mongoose.model(
  'emailSubscriptions',
  emailSubscriptionListSchema,
  'emailSubscriptions',
);
