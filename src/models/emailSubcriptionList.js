/* eslint-disable quotes */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const emailSubscriptionSchema = new Schema({
  email: { type: String, required: true, unique: true },
  emailSubscriptions: {
    type: Boolean,
    default: true,
  },
  isConfirmed: {
    type: Boolean,
    default: false,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model(
  'emailSubscriptions',
  emailSubscriptionSchema,
  'emailSubscriptions',
);
