import mongoose from 'mongoose';

const TaskCommentSchema = new mongoose.Schema({
  task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTasks',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  comment_text: {
    type: String,
    required: [true, 'Comment text is required'],
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },

  is_deleted: {
    type: Boolean,
    default: false,
  },
});

TaskCommentSchema.pre(/^find/, function (next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ is_deleted: false });
  }
  next();
});

export default mongoose.model('TaskComment', TaskCommentSchema);
