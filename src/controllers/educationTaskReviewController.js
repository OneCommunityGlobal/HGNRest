const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const LessonPlan = require('../models/lessonPlan'); // eslint-disable-line no-unused-vars
const UserProfile = require('../models/userProfile'); // eslint-disable-line no-unused-vars

const REVIEWABLE_STATUSES = new Set(['submitted', 'in_review', 'changes_requested', 'graded']);
const SUBMIT_ACTIONS = new Set(['mark_as_graded', 'request_changes']);

const buildStudentName = (student) => {
  if (!student || !(student.firstName || student.lastName)) {
    return 'Unknown Student';
  }
  return `${student.firstName || ''} ${student.lastName || ''}`.trim();
};

const resolveReviewerId = (requestorId) =>
  mongoose.Types.ObjectId.isValid(requestorId)
    ? requestorId
    : new mongoose.Types.ObjectId(requestorId);

const getTotalMarks = (submission) => (submission.totalMarks > 0 ? submission.totalMarks : 100);

const validateMarksGiven = (marksGiven, totalMarks) => {
  if (typeof marksGiven !== 'number' || Number.isNaN(marksGiven)) {
    return { ok: false, message: 'Marks given must be a valid number' };
  }
  if (marksGiven < 0 || marksGiven > totalMarks) {
    return { ok: false, message: `Marks given must be between 0 and ${totalMarks}` };
  }
  return { ok: true };
};

const calculateGrade = (marksGiven, totalMarks) => {
  if (typeof totalMarks !== 'number' || Number.isNaN(totalMarks) || totalMarks <= 0) {
    throw new TypeError('totalMarks must be a positive number');
  }

  if (typeof marksGiven !== 'number' || Number.isNaN(marksGiven)) {
    throw new TypeError('marksGiven must be a number');
  }

  const percentage = (marksGiven / totalMarks) * 100;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

const applyMarkAsGraded = (submission, { marksGiven, grade, reviewerId, now }) => {
  if (marksGiven === undefined && !grade) {
    return { error: 'Either marks or grade must be provided to mark as graded', status: 400 };
  }

  const totalMarks = getTotalMarks(submission);

  if (marksGiven !== undefined) {
    const validation = validateMarksGiven(marksGiven, totalMarks);
    if (!validation.ok) {
      return { error: validation.message, status: 400 };
    }
  }

  const finalGrade =
    marksGiven !== undefined && !grade ? calculateGrade(marksGiven, totalMarks) : grade;

  submission.status = 'graded';
  submission.reviewStatus = 'graded';
  submission.marksGiven = marksGiven;
  submission.grade = finalGrade;
  submission.reviewedAt = now;
  submission.reviewedBy = reviewerId;
  submission.completedAt = now;
  submission.draftSaved = false;

  return null;
};

const applyRequestChanges = (submission, { collaborativeFeedback, reviewerId, now }) => {
  if (!collaborativeFeedback) {
    return { error: 'Feedback is required when requesting changes', status: 400 };
  }

  submission.status = 'changes_requested';
  submission.reviewStatus = 'changes_requested';
  // Clear prior grading when moving back to changes_requested
  submission.grade = 'pending';
  submission.marksGiven = null;
  submission.reviewedAt = null;
  submission.completedAt = null;

  submission.changeRequests.push({
    requestedAt: now,
    reason: collaborativeFeedback,
    requestedBy: reviewerId,
    resolved: false,
  });

  return null;
};

const maybeStartReview = (target) => {
  if (target.reviewStatus === 'pending_review') {
    target.reviewStatus = 'in_review';
    target.reviewStartedAt = new Date();
  }
};

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
        .populate('pageComments.createdBy', 'firstName lastName')
        .populate('reviewedBy', 'firstName lastName')
        .lean();

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      if (!REVIEWABLE_STATUSES.has(submission.status)) {
        return res.status(400).json({
          message: 'This task has not been submitted yet',
          currentStatus: submission.status,
        });
      }

      if (!submission.studentId) {
        return res.status(404).json({ message: 'Student not found for this submission' });
      }

      let { reviewStatus } = submission;
      let { reviewStartedAt } = submission;

      if (reviewStatus === 'pending_review') {
        reviewStatus = 'in_review';
        reviewStartedAt = new Date();
        await EducationTask.findByIdAndUpdate(submissionId, {
          reviewStatus,
          reviewStartedAt,
        });
      }

      const response = {
        _id: submission._id,
        student: {
          id: submission.studentId._id,
          name: buildStudentName(submission.studentId),
          email: submission.studentId.email,
          profilePic: submission.studentId.profilePic,
        },
        assignment: {
          name: submission.name || 'Untitled Assignment',
          type: submission.type,
          weightage: submission.weightage || 0,
          course: submission.lessonPlanId?.title || 'Unknown Course',
          description: submission.lessonPlanId?.description || '',
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
        reviewStatus,
        grading: {
          totalMarks: submission.totalMarks || 100,
          marksGiven: submission.marksGiven ?? null,
          grade: submission.grade === 'pending' ? null : submission.grade,
        },
        feedback: {
          collaborative: submission.collaborativeFeedback || '',
          privateNotes: submission.privateNotes || '',
          pageComments: submission.pageComments || [],
        },
        changeRequests: submission.changeRequests || [],
        review: {
          startedAt: reviewStartedAt,
          reviewedAt: submission.reviewedAt,
          reviewedBy: submission.reviewedBy
            ? {
                id: submission.reviewedBy._id,
                name: buildStudentName(submission.reviewedBy),
              }
            : null,
          lastSavedAt: submission.lastSavedAt,
          draftSaved: submission.draftSaved,
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

  const saveReviewProgress = async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { collaborativeFeedback, privateNotes, marksGiven, pageComments } = req.body;

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        return res.status(400).json({ message: 'Invalid submission ID' });
      }

      const submission = await EducationTask.findById(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const updates = {
        lastSavedAt: new Date(),
        draftSaved: true,
      };

      if (collaborativeFeedback !== undefined) {
        updates.collaborativeFeedback = collaborativeFeedback;
      }
      if (privateNotes !== undefined) {
        updates.privateNotes = privateNotes;
      }

      if (pageComments !== undefined && Array.isArray(pageComments)) {
        updates.pageComments = pageComments.map((pc) => ({
          ...pc,
          createdBy: pc.createdBy || req.body.requestor?.requestorId,
          createdAt: pc.createdAt || new Date(),
          updatedAt: new Date(),
        }));
      }

      if (marksGiven !== undefined) {
        const validation = validateMarksGiven(marksGiven, getTotalMarks(submission));
        if (!validation.ok) {
          return res.status(400).json({ message: validation.message });
        }
        updates.marksGiven = marksGiven;
      }

      if (submission.reviewStatus === 'pending_review') {
        updates.reviewStatus = 'in_review';
        updates.reviewStartedAt = new Date();
      }

      await EducationTask.findByIdAndUpdate(submissionId, updates);

      return res.status(200).json({
        message: 'Progress saved successfully',
        savedAt: updates.lastSavedAt,
      });
    } catch (error) {
      console.error('Error saving progress:', error);
      return res.status(500).json({
        message: 'Failed to save progress',
        error: error.message,
      });
    }
  };

  const addPageComment = async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { pageNumber, comment, isPrivate } = req.body;

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        return res.status(400).json({ message: 'Invalid submission ID' });
      }

      if (!pageNumber || !comment) {
        return res.status(400).json({
          message: 'Page number and comment are required',
        });
      }

      const submission = await EducationTask.findById(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      if (!req.body.requestor?.requestorId) {
        return res.status(401).json({
          message: 'Authentication required to add comments',
        });
      }

      const newComment = {
        pageNumber: Number.parseInt(pageNumber, 10),
        comment,
        isPrivate: isPrivate || false,
        createdBy: req.body.requestor.requestorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      submission.pageComments.push(newComment);
      submission.lastSavedAt = new Date();
      submission.draftSaved = true;
      maybeStartReview(submission);

      await submission.save();
      await submission.populate('pageComments.createdBy', 'firstName lastName');

      const addedComment = submission.pageComments[submission.pageComments.length - 1];

      return res.status(201).json({
        message: 'Comment added successfully',
        comment: addedComment,
      });
    } catch (error) {
      console.error('Error adding page comment:', error);
      return res.status(500).json({
        message: 'Failed to add comment',
        error: error.message,
      });
    }
  };

  const updatePageComment = async (req, res) => {
    try {
      const { submissionId, commentId } = req.params;
      const { comment, isPrivate } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(submissionId) ||
        !mongoose.Types.ObjectId.isValid(commentId)
      ) {
        return res.status(400).json({ message: 'Invalid IDs' });
      }

      const submission = await EducationTask.findById(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const commentToUpdate = submission.pageComments.id(commentId);

      if (!commentToUpdate) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (!req.body.requestor?.requestorId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (
        !commentToUpdate.createdBy ||
        commentToUpdate.createdBy.toString() !== req.body.requestor.requestorId.toString()
      ) {
        return res.status(403).json({ message: 'Unauthorized to update this comment' });
      }

      if (comment !== undefined) commentToUpdate.comment = comment;
      if (isPrivate !== undefined) commentToUpdate.isPrivate = isPrivate;
      commentToUpdate.updatedAt = new Date();
      submission.lastSavedAt = new Date();

      await submission.save();

      return res.status(200).json({
        message: 'Comment updated successfully',
        comment: commentToUpdate,
      });
    } catch (error) {
      console.error('Error updating page comment:', error);
      return res.status(500).json({
        message: 'Failed to update comment',
        error: error.message,
      });
    }
  };

  const deletePageComment = async (req, res) => {
    try {
      const { submissionId, commentId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(submissionId) ||
        !mongoose.Types.ObjectId.isValid(commentId)
      ) {
        return res.status(400).json({ message: 'Invalid IDs' });
      }

      const submission = await EducationTask.findById(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const commentToDelete = submission.pageComments.id(commentId);
      if (!commentToDelete) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (!req.body.requestor?.requestorId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (
        !commentToDelete.createdBy ||
        commentToDelete.createdBy.toString() !== req.body.requestor.requestorId.toString()
      ) {
        return res.status(403).json({ message: 'Unauthorized to delete this comment' });
      }

      submission.pageComments.pull(commentId);
      submission.lastSavedAt = new Date();

      await submission.save();

      return res.status(200).json({
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting page comment:', error);
      return res.status(500).json({
        message: 'Failed to delete comment',
        error: error.message,
      });
    }
  };

  const submitFinalReview = async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { action, collaborativeFeedback, privateNotes, marksGiven, grade } = req.body;

      if (!req.body.requestor?.requestorId) {
        return res.status(401).json({
          message: 'Authentication required to submit reviews',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        return res.status(400).json({ message: 'Invalid submission ID' });
      }

      if (!action || !SUBMIT_ACTIONS.has(action)) {
        return res.status(400).json({
          message: 'Action must be either "mark_as_graded" or "request_changes"',
        });
      }

      const submission = await EducationTask.findById(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const now = new Date();
      const reviewerId = resolveReviewerId(req.body.requestor.requestorId);
      const actionResult =
        action === 'mark_as_graded'
          ? applyMarkAsGraded(submission, { marksGiven, grade, reviewerId, now })
          : applyRequestChanges(submission, { collaborativeFeedback, reviewerId, now });

      if (actionResult) {
        return res.status(actionResult.status).json({ message: actionResult.error });
      }

      if (collaborativeFeedback) submission.collaborativeFeedback = collaborativeFeedback;
      if (privateNotes) submission.privateNotes = privateNotes;
      submission.lastSavedAt = now;

      await submission.save();

      const populatedSubmission = await EducationTask.findById(submission._id)
        .populate('studentId', 'firstName lastName email')
        .populate('lessonPlanId', 'title')
        .lean();

      return res.status(200).json({
        message:
          action === 'mark_as_graded'
            ? 'Submission graded successfully'
            : 'Changes requested successfully',
        submission: {
          _id: submission._id,
          status: submission.status,
          reviewStatus: submission.reviewStatus,
          grade: submission.grade,
          marksGiven: submission.marksGiven ?? null,
          studentName: buildStudentName(populatedSubmission?.studentId),
          assignmentName: submission.name || populatedSubmission?.lessonPlanId?.title || 'Untitled',
        },
      });
    } catch (error) {
      console.error('Error submitting final review:', error);
      return res.status(500).json({
        message: 'Failed to submit review',
        error: error.message,
      });
    }
  };

  return {
    getSubmissionForReview,
    saveReviewProgress,
    addPageComment,
    updatePageComment,
    deletePageComment,
    submitFinalReview,
  };
};

module.exports = educationTaskReviewController;
