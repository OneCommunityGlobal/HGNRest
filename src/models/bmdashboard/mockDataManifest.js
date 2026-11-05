const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Records the IDs inserted by a mock data seeder so its reset removes only those records.
 * Used by src/scripts/seedTcsMockData.js.
 */
const mockDataManifest = new Schema({
  name: { type: String, required: true, unique: true },
  entries: [
    {
      _id: false,
      collection: { type: String, required: true },
      ids: [{ type: Schema.Types.ObjectId }],
    },
  ],
  seededAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('mockDataManifest', mockDataManifest, 'mockDataManifests');
