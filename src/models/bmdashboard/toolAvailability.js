const mongoose = require('mongoose');

const { Schema } = mongoose;

const toolAvailabilitySchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'buildingProject',
      required: true,
    },
    toolName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['In Use', 'Needs to be replaced', 'Yet to receive'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'toolAvailability' },
);

module.exports = mongoose.model('toolAvailability', toolAvailabilitySchema);
