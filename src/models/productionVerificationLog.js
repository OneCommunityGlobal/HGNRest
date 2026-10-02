const mongoose = require('mongoose');

const { Schema } = mongoose;

const productionVerificationLogSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    ip: { type: String },
    reason: {
      type: String,
      enum: [
        'invalid_credentials',
        'user_not_found',
        'user_inactive',
        'production_unavailable',
        'token_invalid',
        'identity_mismatch',
        'webhook_deactivation',
        'webhook_reactivation',
      ],
      required: true,
    },
    attemptedEmail: { type: String },
    requestorId: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    action: {
      type: String,
      enum: ['verify_identity', 'create_user', 'webhook_sync'],
      default: 'verify_identity',
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { collection: 'productionVerificationLogs' },
);

module.exports = mongoose.model('ProductionVerificationLog', productionVerificationLogSchema);
