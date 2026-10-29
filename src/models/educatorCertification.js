const mongoose = require('mongoose');
require('./userProfile');
require('./certification');

const { Schema } = mongoose;

const educatorCertificationSchema = new Schema({
  educatorId: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
  certificationId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Certification',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'in-progress'],
    default: 'in-progress',
  },
  expiryDate: { type: Date },
  assignedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  assignedAt: { type: Date, default: Date.now },
});

educatorCertificationSchema.index({ certificationId: 1 });

module.exports = mongoose.model('EducatorCertification', educatorCertificationSchema);
