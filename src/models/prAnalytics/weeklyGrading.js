const mongoose = require('mongoose');

const { Schema } = mongoose;

const WeeklyGradingSchema = new Schema({
  teamCode: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  reviewer: { type: String, required: true, index: true },
  prsNeeded: { type: Number, required: true },
  prsReviewed: { type: Number, required: true },
  gradedPrs: [
    {
      prNumbers: { type: String, required: true },
      grade: {
        type: String,
        enum: ['Not approved', 'Low Quality', 'Sufficient', 'Exceptional'],
        required: true,
      },
    },
  ],
});

// Compound unique index to prevent duplicates
WeeklyGradingSchema.index({ teamCode: 1, date: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyGrading', WeeklyGradingSchema, 'weeklyGradings');
