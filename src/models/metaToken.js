// models/metaToken.js
const mongoose = require('mongoose');

const metaTokenSchema = new mongoose.Schema(
  {
    platform: { type: String, default: 'instagram', unique: true },
    accessToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastRefreshedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('MetaToken', metaTokenSchema);
