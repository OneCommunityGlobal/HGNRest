const mongoose = require('mongoose');

const { Schema } = mongoose;

const ProcessingProject = new Schema({
  item_name: { type: String, required: true },
  process_name: { type: String, required: true },
  quantity: { type: Number, required: true },
  supplies_quantity: { type: Number },
  supplies_type: { type: String },
  scheduled_date: { type: Date },
  priority: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('processingProject', ProcessingProject, 'processingProject');
