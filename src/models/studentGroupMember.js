const mongoose = require('mongoose');

const { Schema } = mongoose;

const StudentGroupMemberSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'StudentGroup', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

StudentGroupMemberSchema.index({ groupId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('StudentGroupMember', StudentGroupMemberSchema);
