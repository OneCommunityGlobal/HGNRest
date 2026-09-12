const mongoose = require('mongoose');

const { Schema } = mongoose;

const HarvestingEventSchema = new Schema({
  name: { type: String, required: true },
  related_to: {
    type: String,
    enum: ['Garden', 'Orchard', 'Animals'],
    required: true,
  },
  type: {
    type: String,
    enum: ['garden harvesting', 'orchard harvesting'],
    required: true,
  },
  expected_date: { type: Date, required: true },
  yield: { type: Number },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('harvestingEvent', HarvestingEventSchema, 'harvestingEvents');
