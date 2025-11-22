const mongoose = require('mongoose');

const devSignupLogSchema = new mongoose.Schema({
  productionEmail: { type: String, required: true },
  devEmail: { type: String, required: true },

  ipAddress: { type: String, default: null },

  status: {
    type: String,
    enum: ['success', 'error'],
    required: true,
  },

  reason: { type: String, default: null },

  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DevSignupLog', devSignupLogSchema);
