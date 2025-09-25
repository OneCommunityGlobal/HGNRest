const mongoose = require('mongoose');

const { Schema } = mongoose;

// Store ISO_A3 country codes (USA, IND, DEU) for map geos
const applicationSchema = new Schema(
  {
    country: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      index: true,
    },
    role: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    numberOfApplicants: { type: Number, required: true, default: 1, min: 0 },
  },
  { timestamps: true },
);

applicationSchema.index({ timestamp: 1, country: 1 });
applicationSchema.index({ role: 1, timestamp: 1 });

module.exports = mongoose.model('Application', applicationSchema);
