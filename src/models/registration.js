const mongoose = require('mongoose');

const { Schema } = mongoose;
const User = require('./userProfile');


const registrationSchema = new Schema({
    userId: {
      type: mongoose.Types.ObjectId,
      ref: User,
      required: true
    },
    eventId: {
      type: mongoose.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'pending'],
      default: 'confirmed'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    cancellationDate: {
      type: Date
    },
    cancellationReason: {
      type: String
    }
  }, { timestamps: true });
  
 // Add index to improve query performance
 // registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
  
  module.exports = mongoose.model('Registration', registrationSchema);