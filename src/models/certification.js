const mongoose = require('mongoose');

const { Schema } = mongoose;

const certificationSchema = new Schema({
  name: { type: String, required: true, index: true },
  description: { type: String },
});

certificationSchema.index({ name: 1 });

module.exports = mongoose.model('Certification', certificationSchema);
