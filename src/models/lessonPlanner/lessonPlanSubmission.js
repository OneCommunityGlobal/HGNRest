const mongoose = require('mongoose');

const lessonPlanSubmissionSchema = new mongoose.Schema({
  task_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Task' },
  student_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  submission_link: { type: String, required: true },
  status: { type: String, enum: ['Submitted'], default: 'Submitted' },
  submission_time: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LessonPlanSubmission', lessonPlanSubmissionSchema);
