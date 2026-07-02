const mongoose = require('mongoose');

const expenditureSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'buildingProject',
    required: true,
  },
  category: {
    type: String,
    enum: ['Labor', 'Equipment', 'Materials'],
    required: true,
  },
  type: {
    type: String,
    enum: ['actual', 'planned'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('Expenditure', expenditureSchema, 'expenditurePie');
