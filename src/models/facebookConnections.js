const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Stores the organization's Facebook Page connection.
 * Single shared token approach - one connection used by all authorized users.
 */
const FacebookConnectionSchema = new Schema(
  {
    // Page details
    pageId: { type: String, required: true, unique: true },
    pageName: { type: String },
    pageAccessToken: { type: String, required: true },

    // Token metadata
    tokenExpiresAt: { type: Date }, // Long-lived tokens expire in ~60 days
    tokenType: { type: String, default: 'page_access_token' },

    // User token (used to refresh page token if needed)
    userAccessToken: { type: String },
    userTokenExpiresAt: { type: Date },
    userId: { type: String }, // Facebook user ID who connected

    // Connection status
    isActive: { type: Boolean, default: true },
    lastVerifiedAt: { type: Date },
    lastError: { type: String },

    // Audit trail
    connectedBy: {
      odUserId: { type: String }, // HGN user ID
      name: { type: String },
      role: { type: String },
    },
    disconnectedBy: {
      odUserId: { type: String },
      name: { type: String },
      role: { type: String },
      disconnectedAt: { type: Date },
    },

    // Permissions granted during OAuth
    grantedPermissions: [{ type: String }],
  },
  { timestamps: true },
);

// Index for quick lookup of active connection
FacebookConnectionSchema.index({ isActive: 1, pageId: 1 });

/**
 * Static method to get the active connection (if any)
 */
FacebookConnectionSchema.statics.getActiveConnection = async function () {
  return this.findOne({ isActive: true }).sort({ createdAt: -1 }).exec();
};

/**
 * Static method to deactivate all connections (used before creating new one)
 */
FacebookConnectionSchema.statics.deactivateAll = async function (disconnectedBy) {
  return this.updateMany(
    { isActive: true },
    {
      isActive: false,
      disconnectedBy: {
        ...disconnectedBy,
        disconnectedAt: new Date(),
      },
    },
  );
};

module.exports = mongoose.model('FacebookConnection', FacebookConnectionSchema);
