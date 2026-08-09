jest.mock('../../models/lessonPlan', () => ({}));
jest.mock('../../models/userProfile', () => ({}));

const mockEducationTask = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};
jest.mock('../../models/educationTask', () => mockEducationTask);

const mongoose = require('mongoose');
const educationTaskReviewController = require('../educationTaskReviewController');

const SUBMISSION_ID = '507f1f77bcf86cd799439011';
const COMMENT_ID = '507f1f77bcf86cd799439012';
const REVIEWER_ID = '507f1f77bcf86cd799439013';
const STUDENT_ID = '507f1f77bcf86cd799439014';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makePopulateChain = (result) => {
  const lean = jest.fn().mockResolvedValue(result);
  const chain = {
    populate: jest.fn().mockReturnThis(),
    lean,
  };
  return chain;
};

const baseSubmissionDoc = (overrides = {}) => {
  const comments = [];
  comments.id = jest.fn();
  comments.pull = jest.fn();
  comments.push = jest.fn(function push(comment) {
    Array.prototype.push.call(this, comment);
  });

  return {
    _id: SUBMISSION_ID,
    name: 'Short Story Brainstorm',
    status: 'submitted',
    reviewStatus: 'pending_review',
    totalMarks: 100,
    marksGiven: undefined,
    grade: 'pending',
    uploadUrls: ['https://example.com/file.pdf'],
    submittedAt: new Date('2025-10-10T12:00:00.000Z'),
    dueAt: new Date('2025-11-15T00:00:00.000Z'),
    collaborativeFeedback: '',
    privateNotes: '',
    pageComments: comments,
    changeRequests: [],
    draftSaved: false,
    weightage: 20,
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

describe('educationTaskReviewController', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = educationTaskReviewController();
    req = {
      params: { submissionId: SUBMISSION_ID },
      body: {
        requestor: { requestorId: REVIEWER_ID, role: 'Administrator' },
      },
    };
    res = makeRes();
    jest
      .spyOn(mongoose.Types.ObjectId, 'isValid')
      .mockImplementation((id) => Boolean(id && String(id).length === 24));
  });

  describe('getSubmissionForReview', () => {
    test('returns 400 for invalid submission id', async () => {
      req.params.submissionId = 'bad-id';
      await controller.getSubmissionForReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid submission ID' });
    });

    test('returns 404 when submission is missing', async () => {
      mockEducationTask.findById.mockReturnValue(makePopulateChain(null));
      await controller.getSubmissionForReview(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 400 when task is not submitted yet', async () => {
      mockEducationTask.findById.mockReturnValue(
        makePopulateChain({
          status: 'assigned',
          studentId: { _id: STUDENT_ID, firstName: 'Jane', lastName: 'Doe' },
        }),
      );
      await controller.getSubmissionForReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'This task has not been submitted yet' }),
      );
    });

    test('returns 404 when student is missing', async () => {
      mockEducationTask.findById.mockReturnValue(
        makePopulateChain({
          status: 'submitted',
          studentId: null,
        }),
      );
      await controller.getSubmissionForReview(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Student not found for this submission',
      });
    });

    test('returns 200 and transitions pending_review to in_review', async () => {
      const submission = {
        _id: SUBMISSION_ID,
        status: 'submitted',
        reviewStatus: 'pending_review',
        name: 'Essay',
        type: 'write',
        weightage: 10,
        totalMarks: 100,
        marksGiven: null,
        grade: 'pending',
        uploadUrls: [],
        submittedAt: new Date('2025-10-10T12:00:00.000Z'),
        dueAt: new Date('2025-11-15T00:00:00.000Z'),
        collaborativeFeedback: '',
        privateNotes: '',
        pageComments: [],
        changeRequests: [],
        draftSaved: false,
        studentId: {
          _id: STUDENT_ID,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          profilePic: 'pic.png',
        },
        lessonPlanId: { title: 'Writing 101', description: 'Desc' },
        reviewedBy: null,
      };
      mockEducationTask.findById.mockReturnValue(makePopulateChain(submission));
      mockEducationTask.findByIdAndUpdate.mockResolvedValue({});

      await controller.getSubmissionForReview(req, res);

      expect(mockEducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
        SUBMISSION_ID,
        expect.objectContaining({ reviewStatus: 'in_review' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: 'in_review',
          student: expect.objectContaining({ name: 'Jane Doe' }),
        }),
      );
    });

    test('returns 500 when query throws', async () => {
      mockEducationTask.findById.mockImplementation(() => {
        throw new Error('boom');
      });
      await controller.getSubmissionForReview(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('saveReviewProgress', () => {
    test('returns 400 for invalid id', async () => {
      req.params.submissionId = 'x';
      await controller.saveReviewProgress(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when submission missing', async () => {
      mockEducationTask.findById.mockResolvedValue(null);
      await controller.saveReviewProgress(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 400 for invalid marks', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.marksGiven = 'eighty';
      await controller.saveReviewProgress(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when marks out of range', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.marksGiven = 150;
      await controller.saveReviewProgress(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('saves progress and starts review when pending', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      mockEducationTask.findByIdAndUpdate.mockResolvedValue({});
      req.body.collaborativeFeedback = 'Good analysis';
      req.body.privateNotes = 'Strong student';
      req.body.marksGiven = 85;
      req.body.pageComments = [{ pageNumber: 1, comment: 'Nice intro' }];

      await controller.saveReviewProgress(req, res);

      expect(mockEducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
        SUBMISSION_ID,
        expect.objectContaining({
          collaborativeFeedback: 'Good analysis',
          privateNotes: 'Strong student',
          marksGiven: 85,
          reviewStatus: 'in_review',
          draftSaved: true,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Progress saved successfully' }),
      );
    });

    test('returns 500 on error', async () => {
      mockEducationTask.findById.mockRejectedValue(new Error('db fail'));
      await controller.saveReviewProgress(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addPageComment', () => {
    test('returns 400 for invalid id', async () => {
      req.params.submissionId = 'bad';
      await controller.addPageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when pageNumber or comment missing', async () => {
      req.body.pageNumber = 1;
      await controller.addPageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when submission missing', async () => {
      mockEducationTask.findById.mockResolvedValue(null);
      req.body.pageNumber = 1;
      req.body.comment = 'Nice';
      await controller.addPageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 401 without requestor', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body = { pageNumber: 1, comment: 'Nice' };
      await controller.addPageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('adds comment successfully', async () => {
      const submission = baseSubmissionDoc();
      mockEducationTask.findById.mockResolvedValue(submission);
      req.body.pageNumber = '2';
      req.body.comment = 'Great detail';
      req.body.isPrivate = true;

      await controller.addPageComment(req, res);

      expect(submission.pageComments.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 2,
          comment: 'Great detail',
          isPrivate: true,
          createdBy: REVIEWER_ID,
        }),
      );
      expect(submission.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 500 on error', async () => {
      mockEducationTask.findById.mockRejectedValue(new Error('fail'));
      req.body.pageNumber = 1;
      req.body.comment = 'x';
      await controller.addPageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updatePageComment', () => {
    beforeEach(() => {
      req.params.commentId = COMMENT_ID;
    });

    test('returns 400 for invalid ids', async () => {
      req.params.commentId = 'bad';
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when submission missing', async () => {
      mockEducationTask.findById.mockResolvedValue(null);
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 when comment missing', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue(null);
      mockEducationTask.findById.mockResolvedValue(submission);
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 401 without requestor', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue({
        createdBy: { toString: () => REVIEWER_ID },
      });
      mockEducationTask.findById.mockResolvedValue(submission);
      req.body = { comment: 'Updated' };
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 403 when not comment owner', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue({
        createdBy: { toString: () => '507f1f77bcf86cd799439099' },
      });
      mockEducationTask.findById.mockResolvedValue(submission);
      req.body.comment = 'Updated';
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('updates comment successfully', async () => {
      const commentToUpdate = {
        createdBy: { toString: () => REVIEWER_ID },
        comment: 'Old',
        isPrivate: false,
        updatedAt: null,
      };
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue(commentToUpdate);
      mockEducationTask.findById.mockResolvedValue(submission);
      req.body.comment = 'Updated text';
      req.body.isPrivate = true;

      await controller.updatePageComment(req, res);

      expect(commentToUpdate.comment).toBe('Updated text');
      expect(commentToUpdate.isPrivate).toBe(true);
      expect(submission.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 500 on error', async () => {
      mockEducationTask.findById.mockRejectedValue(new Error('fail'));
      await controller.updatePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deletePageComment', () => {
    beforeEach(() => {
      req.params.commentId = COMMENT_ID;
    });

    test('returns 400 for invalid ids', async () => {
      req.params.submissionId = 'bad';
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when submission missing', async () => {
      mockEducationTask.findById.mockResolvedValue(null);
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 when comment missing', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue(null);
      mockEducationTask.findById.mockResolvedValue(submission);
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 401 without requestor', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue({
        createdBy: { toString: () => REVIEWER_ID },
      });
      mockEducationTask.findById.mockResolvedValue(submission);
      req.body = {};
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 403 when not comment owner', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue({
        createdBy: { toString: () => '507f1f77bcf86cd799439099' },
      });
      mockEducationTask.findById.mockResolvedValue(submission);
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('deletes comment successfully', async () => {
      const submission = baseSubmissionDoc();
      submission.pageComments.id.mockReturnValue({
        createdBy: { toString: () => REVIEWER_ID },
      });
      mockEducationTask.findById.mockResolvedValue(submission);

      await controller.deletePageComment(req, res);

      expect(submission.pageComments.pull).toHaveBeenCalledWith(COMMENT_ID);
      expect(submission.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Comment deleted successfully' });
    });

    test('returns 500 on error', async () => {
      mockEducationTask.findById.mockRejectedValue(new Error('fail'));
      await controller.deletePageComment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('submitFinalReview', () => {
    test('returns 401 without requestor', async () => {
      req.body = { action: 'mark_as_graded', marksGiven: 90 };
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 400 for invalid submission id', async () => {
      req.params.submissionId = 'bad';
      req.body.action = 'mark_as_graded';
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 for invalid action', async () => {
      req.body.action = 'something_else';
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when submission missing', async () => {
      mockEducationTask.findById.mockResolvedValue(null);
      req.body.action = 'mark_as_graded';
      req.body.marksGiven = 90;
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 400 when grading without marks or grade', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.action = 'mark_as_graded';
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Either marks or grade must be provided to mark as graded',
      });
    });

    test('returns 400 when marks invalid for grading', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.action = 'mark_as_graded';
      req.body.marksGiven = 'ninety';
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test.each([
      [92, 'A'],
      [85, 'B'],
      [75, 'C'],
      [65, 'D'],
      [50, 'F'],
    ])('marks as graded with %i calculates grade %s', async (marksGiven, expectedGrade) => {
      const submission = baseSubmissionDoc({ reviewStatus: 'in_review' });
      mockEducationTask.findById.mockResolvedValueOnce(submission).mockReturnValueOnce(
        makePopulateChain({
          studentId: { firstName: 'Jane', lastName: 'Doe' },
          lessonPlanId: { title: 'Writing 101' },
        }),
      );
      req.body.action = 'mark_as_graded';
      req.body.marksGiven = marksGiven;
      req.body.collaborativeFeedback = 'Feedback';

      await controller.submitFinalReview(req, res);

      expect(submission.grade).toBe(expectedGrade);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            grade: expectedGrade,
            marksGiven,
            studentName: 'Jane Doe',
          }),
        }),
      );
    });

    test('returns 400 when marks out of range for grading', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.action = 'mark_as_graded';
      req.body.marksGiven = 120;
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when request_changes lacks feedback', async () => {
      mockEducationTask.findById.mockResolvedValue(baseSubmissionDoc());
      req.body.action = 'request_changes';
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('request_changes clears prior grade and marks', async () => {
      const submission = baseSubmissionDoc({
        status: 'graded',
        reviewStatus: 'graded',
        grade: 'A',
        marksGiven: 92,
        reviewedAt: new Date(),
        completedAt: new Date(),
      });
      mockEducationTask.findById.mockResolvedValueOnce(submission).mockReturnValueOnce(
        makePopulateChain({
          studentId: { firstName: 'Jane', lastName: 'Doe' },
          lessonPlanId: { title: 'Writing 101' },
        }),
      );
      req.body.action = 'request_changes';
      req.body.collaborativeFeedback = 'Please add references';

      await controller.submitFinalReview(req, res);

      expect(submission.status).toBe('changes_requested');
      expect(submission.grade).toBe('pending');
      expect(submission.marksGiven).toBeNull();
      expect(submission.changeRequests).toHaveLength(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Changes requested successfully',
          submission: expect.objectContaining({
            grade: 'pending',
            marksGiven: null,
            studentName: 'Jane Doe',
          }),
        }),
      );
    });

    test('returns Unknown Student when student populate fails', async () => {
      const submission = baseSubmissionDoc();
      mockEducationTask.findById
        .mockResolvedValueOnce(submission)
        .mockReturnValueOnce(makePopulateChain({ studentId: null, lessonPlanId: null }));
      req.body.action = 'mark_as_graded';
      req.body.grade = 'B';

      await controller.submitFinalReview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({ studentName: 'Unknown Student' }),
        }),
      );
    });

    test('returns 500 on error', async () => {
      mockEducationTask.findById.mockRejectedValue(new Error('fail'));
      req.body.action = 'mark_as_graded';
      req.body.marksGiven = 90;
      await controller.submitFinalReview(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
