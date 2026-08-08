const mongoose = require('mongoose');

const { Schema } = mongoose;

const CalendarEventSchema = new Schema({
  title: { type: String, required: true },
  module: {
    type: String,
    enum: ['garden', 'orchard', 'animals', 'kitchen'],
    required: true,
  },
  event_type: { type: String, required: true },
  scheduled_date: { type: Date, required: true },
  description: { type: String },
  assigned_to: { type: String },
  related_item: { type: String },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed'],
    default: 'scheduled',
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('calendarEvent', CalendarEventSchema, 'calendarEvents');
