const mongoose = require('mongoose');

// A durable receipt is committed with the entries. Its built-in unique _id also
// serializes concurrent retries, without requiring a separate index migration.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  personId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fingerprint: { type: String, required: true },
  entryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'timeEntry' }],
  allocations: [
    {
      taskId: { type: mongoose.Schema.Types.ObjectId, required: true },
      minutes: { type: Number, required: true },
      notes: { type: String, required: true },
    },
  ],
  totalMinutes: { type: Number, required: true },
  dateOfWork: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('timeEntryBatch', schema, 'timeEntryBatches');
