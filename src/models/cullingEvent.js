const mongoose = require('mongoose');

const { Schema } = mongoose;

const CullingEventSchema = new Schema({
  name: { type: String, required: true },
  related_to: {
    type: String,
    enum: ['Garden', 'Orchard', 'Animals'],
    required: true,
  },
  count: { type: Number, required: true },
  purpose: { type: String, required: true },
  notes: { type: String },
  scheduled_date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('cullingEvent', CullingEventSchema, 'cullingEvents');
