const mongoose = require('mongoose');

const unansweredFaqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  normalizedQuestion: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile' },
  createdAt: { type: Date, default: Date.now }
});

unansweredFaqSchema.index({ normalizedQuestion: 1 }, { unique: true });

module.exports = mongoose.model('UnansweredFAQ', unansweredFaqSchema);
