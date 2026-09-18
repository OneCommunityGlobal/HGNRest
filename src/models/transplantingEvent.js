const mongoose = require('mongoose');

const { Schema } = mongoose;

const TransplantingEventSchema = new Schema({
  name: { type: String, required: true },
  related_to: {
    type: String,
    enum: ['Garden', 'Orchard', 'Animals'],
    required: true,
  },
  date: { type: Date, required: true },
  position_from: { type: String, required: true },
  position_to: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model(
  'transplantingEvent',
  TransplantingEventSchema,
  'transplantingEvents',
);
