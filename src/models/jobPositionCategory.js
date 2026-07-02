const mongoose = require('mongoose');

const { Schema } = mongoose;

const jobPositionCategorySchema = new Schema({
  position: [{ type: String, required: true }], // Job title
  category: { type: String, required: true }, // General category (e.g., Engineering, Marketing)
});

module.exports = mongoose.model(
  'JobPositionCategory',
  jobPositionCategorySchema,
  // ,    'JobPositionCategory' // exact collection name in MongoDB
);
