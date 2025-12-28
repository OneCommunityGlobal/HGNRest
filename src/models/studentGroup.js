const mongoose = require('mongoose');

const { Schema } = mongoose;

const StudentGroupSchema = new Schema(
  {
    educator_id: {
      type: Schema.Types.ObjectId,
      ref: 'userProfiles',
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual group name derived from educator profile
StudentGroupSchema.virtual('name').get(function () {
  if (!this.educator_id) return 'Group';

  // depends on your userProfiles fields
  if (this.educator_id.fullName) {
    return `${this.educator_id.fullName}'s Group`;
  }

  if (this.educator_id.firstName && this.educator_id.lastName) {
    return `${this.educator_id.firstName} ${this.educator_id.lastName}'s Group`;
  }

  return 'Group';
});

module.exports = mongoose.model('studentgroups', StudentGroupSchema);
