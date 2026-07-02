const mongoose = require('mongoose');

const { Schema } = mongoose;

const memberRatingSchema = new Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  userId: { type: Schema.Types.ObjectId, ref: 'userProfile' },
});

const helpFeedbackSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },
  helpRequestId: { type: Schema.Types.ObjectId, ref: 'HelpRequest' }, // ADD THIS LINE
  receivedHelp: { type: String, enum: ['yes', 'no'], required: true },
  activeMembers: [memberRatingSchema],
  inactiveMembers: [memberRatingSchema],
  comments: { type: String, default: '' },
  closedPermanently: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('HelpFeedback', helpFeedbackSchema, 'helpFeedback');
