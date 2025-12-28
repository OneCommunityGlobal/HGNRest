const mongoose = require('mongoose');

const { Schema } = mongoose;

const StudentGroupMemberSchema = new Schema(
  {
    group_id: {
      type: Schema.Types.ObjectId,
      ref: 'StudentGroup',
      required: true,
      index: true,
    },
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'userProfiles',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate student entries in the same group
StudentGroupMemberSchema.index({ group_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model('StudentGroupMembers', StudentGroupMemberSchema);
