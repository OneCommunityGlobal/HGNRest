const mongoose = require('mongoose');

const { Schema } = mongoose;

const StudentGroupSchema = new Schema(
  {
    educator_id: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('studentgroups', StudentGroupSchema);
