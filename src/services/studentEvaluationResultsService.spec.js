jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../models/notification', () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/studentEvaluation', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/evaluationTask', () => ({
  find: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn(),
}));

const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const Notification = require('../models/notification');
const StudentEvaluation = require('../models/studentEvaluation');
const EvaluationTask = require('../models/evaluationTask');
const service = require('./studentEvaluationResultsService');

const validStudentId = '65cf6c3706d8ac105827bb2e';
const validTeacherId = '65cf6c3706d8ac105827bb2f';

describe('studentEvaluationResultsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: validStudentId,
          educationProfiles: {
            student: {
              lastEvaluationResultsViewedAt: null,
            },
          },
        }),
      }),
    });

    StudentEvaluation.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    Notification.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    UserProfile.findByIdAndUpdate.mockResolvedValue({});
    Notification.updateMany.mockResolvedValue({});
    Notification.create.mockResolvedValue({});
    StudentEvaluation.findOneAndUpdate.mockResolvedValue({ _id: validStudentId, category: 'Math' });
    EvaluationTask.deleteMany.mockResolvedValue({});
    EvaluationTask.insertMany.mockResolvedValue([]);
  });

  test('uses a sanitized ObjectId when querying student evaluations', async () => {
    await service.getStudentEvaluationResults(validStudentId);

    expect(StudentEvaluation.find).toHaveBeenCalledWith({
      studentId: expect.any(mongoose.Types.ObjectId),
    });
    expect(StudentEvaluation.find.mock.calls[0][0].studentId.toString()).toBe(validStudentId);
  });

  test('uses a sanitized ObjectId when querying notifications', async () => {
    await service.getEvaluationResultNotifications(validStudentId);

    expect(Notification.find).toHaveBeenCalledWith({
      recipient: expect.any(mongoose.Types.ObjectId),
      type: 'evaluation_results',
    });
    expect(Notification.find.mock.calls[0][0].recipient.toString()).toBe(validStudentId);
  });

  test('uses a sanitized ObjectId when marking notifications as viewed', async () => {
    await service.markEvaluationResultsViewed(validStudentId);

    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        recipient: expect.any(mongoose.Types.ObjectId),
        type: 'evaluation_results',
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    );
    expect(Notification.updateMany.mock.calls[0][0].recipient.toString()).toBe(validStudentId);
  });

  test('uses sanitized ObjectIds when publishing evaluation results', async () => {
    await service.publishStudentEvaluationResults({
      studentId: validStudentId,
      teacherId: validTeacherId,
      evaluations: [
        {
          category: 'Math',
          weightage: 100,
          totalItems: 5,
          completedItems: 5,
          marks: 90,
          percentage: 90,
          performanceLevel: 'Excellent',
          feedback: 'Strong work',
          tasks: [],
        },
      ],
    });

    expect(StudentEvaluation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: expect.any(mongoose.Types.ObjectId),
        category: 'Math',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          publishedBy: expect.any(mongoose.Types.ObjectId),
        }),
      }),
      expect.any(Object),
    );
    expect(StudentEvaluation.findOneAndUpdate.mock.calls[0][0].studentId.toString()).toBe(
      validStudentId,
    );
    expect(StudentEvaluation.findOneAndUpdate.mock.calls[0][1].$set.publishedBy.toString()).toBe(
      validTeacherId,
    );
  });
});
