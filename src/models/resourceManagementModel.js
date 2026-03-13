const mongoose = require('mongoose');

const { Schema } = mongoose;

const resourceManagementSchema = new Schema(
  {
    user: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    facilities: {
      type: String,
      required: true,
    },
    materials: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('resourceManagement', resourceManagementSchema);
