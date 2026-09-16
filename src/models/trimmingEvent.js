const mongoose = require('mongoose');

const { Schema } = mongoose;

const TrimmingEventSchema = new Schema({
  name: { type: String, required: true },
  related_to: {
    type: String,
    enum: ['Garden', 'Orchard', 'Animals'],
    required: true,
  },
  pruning_type: { type: String, required: true },
  last_trim_date: { type: Date, required: true },
  next_trim_date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('trimmingEvent', TrimmingEventSchema, 'trimmingEvents');
