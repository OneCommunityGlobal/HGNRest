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
    trim: true,
    validate: {
      validator: (value) => {
        const atIndex = value.indexOf('@');
        const dotIndex = value.lastIndexOf('.');

        return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < value.length - 1;
      },
      message: 'Provide valid email address',
    },
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
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  created: {
    type: Date,
    default: Date.now,
  },

  updated: {
    type: Date,
    default: Date.now,
  },
});

Supplier.pre('save', function updateTimestamp(next) {
  this.updated = new Date();
  next();
});

module.exports = mongoose.model('supplier', Supplier, 'suppliers');
