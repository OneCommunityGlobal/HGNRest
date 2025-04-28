// models/Expenditure.js
const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
  date: { type: Date, required: true },
  category: { 
    type: String,
    enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'], // Expected
    required: true
  },
  amount: { type: Number, required: true } // assuming field name is `amount`
});

module.exports = mongoose.model('Expenditure', ExpenditureSchema);
