const mongoose = require('mongoose');

const { Schema } = mongoose;

const helpRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  requestedAt: { type: Date, default: Date.now, required: true },
  topic: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
  feedbackSubmitted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('HelpRequest', helpRequestSchema, 'helpRequests');
