const mongoose = require('mongoose');

const lessonPlanSubmissionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Task' },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  submissionLink: { type: String, required: true },
  status: { type: String, enum: ['Submitted'], default: 'Submitted' },
  submissionTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LessonPlanSubmission', lessonPlanSubmissionSchema);