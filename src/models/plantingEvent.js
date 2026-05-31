const mongoose = require('mongoose');

const { Schema } = mongoose;

const PlantingEventSchema = new Schema({
  name: { type: String, required: true },
  related_to: {
    type: String,
    enum: ['Garden', 'Orchard', 'Animals'],
    required: true,
  },
  count: { type: Number, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('plantingEvent', PlantingEventSchema, 'plantingEvents');
