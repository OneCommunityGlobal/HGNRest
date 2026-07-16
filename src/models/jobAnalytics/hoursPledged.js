const mongoose = require('mongoose');

const hoursPledgedSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
  },
  pledge_date: {
    type: Date,
    required: true,
  },
  hrsPerRole: {
    type: Number,
    required: true,
    min: 0,
  },
});

hoursPledgedSchema.index({ role: 1, pledge_date: 1 });

module.exports = mongoose.model('HoursPledged', hoursPledgedSchema);
