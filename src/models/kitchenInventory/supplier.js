const mongoose = require('mongoose');

const { Schema } = mongoose;

const Supplier = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  contact: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Provide Valid email address'],
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  specialities: [
    {
      type: String,
      trim: true,
    },
  ],
  website: {
    type: String,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Provide valid website url',
    ],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  created: {
    type: Date,
    required: true,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('supplier', Supplier, 'suppliers');
