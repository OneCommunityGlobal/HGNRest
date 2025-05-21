const mongoose = require('mongoose');

const {Schema} = mongoose;

const costBreakdownSchema = new Schema({
  projectId: {
    type: String,  // Changed from ObjectId to String to match your data
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'],
    required: true
  },
  amount: {  // Changed from cost to amount to match your data
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('CostBreakdown', costBreakdownSchema);
