const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  iconUrl: {
    type: String,
    trim: true
  },
  sequence: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  atomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Atom'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema); 