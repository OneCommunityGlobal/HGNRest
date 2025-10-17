const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');

const educationTaskReviewController = function () {
  const getSubmissionForReview = async (req, res) => {
    try {
      const { submissionId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        return res.status(400).json({ message: 'Invalid submission ID' });
      }

      const submission = await EducationTask.findById(submissionId)
        .populate('studentId', 'firstName lastName email profilePic')
        .populate('lessonPlanId', 'title description')
        .lean();

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      if (!['submitted', 'in_review', 'changes_requested', 'graded'].includes(submission.status)) {
        return res.status(400).json({
          message: 'This task has not been submitted yet',
          currentStatus: submission.status,
        });
      }

      if (submission.reviewStatus === 'pending_review') {
        await EducationTask.findByIdAndUpdate(submissionId, {
          reviewStatus: 'in_review',
          reviewStartedAt: new Date(),
        });
      }

      const response = {
        _id: submission._id,
        student: {
          id: submission.studentId._id,
          name: `${submission.studentId.firstName} ${submission.studentId.lastName}`,
          email: submission.studentId.email,
          profilePic: submission.studentId.profilePic,
        },
        assignment: {
          name: submission.name || 'Untitled Assignment',
          type: submission.type,
          course: submission.lessonPlanId.title,
          description: submission.lessonPlanId.description,
        },
        submission: {
          uploadedFiles: submission.uploadUrls || [],
          submittedAt: submission.submittedAt,
          dueAt: submission.dueAt,
          isLate:
            submission.submittedAt && submission.dueAt
              ? submission.submittedAt > submission.dueAt
              : false,
        },
        status: submission.status,
        reviewStatus: submission.reviewStatus,
        grading: {
          totalMarks: submission.totalMarks || 100,
          marksGiven: submission.marksGiven || null,
          grade: submission.grade === 'pending' ? null : submission.grade,
        },
        feedback: {
          collaborative: submission.collaborativeFeedback || '',
          privateNotes: submission.privateNotes || '',
        },
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching submission for review:', error);
      return res.status(500).json({
        message: 'Failed to fetch submission',
        error: error.message,
      });
    }
  };

  console.log(LessonPlan, UserProfile);

  return {
    getSubmissionForReview,
  };
};

module.exports = educationTaskReviewController;
