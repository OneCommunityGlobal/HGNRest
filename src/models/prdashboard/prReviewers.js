const mongoose = require('mongoose');

const { Schema } = mongoose;

const prReviewers = new Schema({
  teamCode: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now() },
  gradings: [
    {
      reviewer: { type: String, required: true },
      prsReviewed: { type: Number, required: true },
      prsNeeded: { type: Number, required: true },
      gradedPrs: [
        {
          prNumbers: { type: String, required: true },
          grade: {
            type: String,
            enum: ['Exceptional', 'Okay', 'Unsatisfactory', 'Cannot find image'],
            required: true,
          },
        },
      ],
    },
  ],
});

module.exports = mongoose.model('prReviewers', prReviewers, 'prReviewers');
