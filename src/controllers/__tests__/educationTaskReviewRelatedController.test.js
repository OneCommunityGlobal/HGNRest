jest.mock('../../models/lessonPlan', () => ({}));
jest.mock('../../models/userProfile', () => ({}));
jest.mock('../../models/atom', () => ({}));
jest.mock('../../models/studentGroup', () => ({}));
jest.mock('../../models/studentGroupMember', () => ({}));
jest.mock('../../models/intermediateTask', () => ({}));

const mockEducationTask = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn(),
};
jest.mock('../../models/educationTask', () => mockEducationTask);

const mongoose = require('mongoose');
const educationTaskController = require('../educationTaskController');

const TASK_ID = '507f1f77bcf86cd799439011';
const STUDENT_ID = '507f1f77bcf86cd799439012';
const LESSON_ID = '507f1f77bcf86cd799439013';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('educationTaskController review-related updates', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = educationTaskController();
    req = { params: { id: TASK_ID }, body: {}, query: {} };
    res = makeRes();
    jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
  });

  describe('updateTaskStatus', () => {
    test('accepts submitted status and sets review fields', async () => {
      const task = { status: 'in_progress', completedAt: null };
      mockEducationTask.findById.mockResolvedValue(task);
      mockEducationTask.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({ status: 'submitted' }),
          }),
        }),
      });
      req.body.status = 'submitted';

      await controller.updateTaskStatus(req, res);

      expect(mockEducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
        TASK_ID,
        expect.objectContaining({
          status: 'submitted',
          reviewStatus: 'pending_review',
        }),
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('rejects invalid status', async () => {
      mockEducationTask.findById.mockResolvedValue({ status: 'assigned' });
      req.body.status = 'not_a_status';
      await controller.updateTaskStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getTaskSubmissions', () => {
    test('includes submitted and in_review tasks with labels', async () => {
      const sort = jest.fn().mockResolvedValue([
        {
          _id: TASK_ID,
          name: 'Essay',
          type: 'write',
          uploadUrls: ['https://example.com/a.pdf'],
          status: 'submitted',
          reviewStatus: 'pending_review',
          submittedAt: new Date('2025-10-10'),
          dueAt: new Date('2025-11-15'),
          assignedAt: new Date('2025-10-01'),
          grade: 'pending',
          feedback: '',
          studentId: {
            _id: STUDENT_ID,
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
          },
          lessonPlanId: { _id: LESSON_ID, title: 'Writing 101' },
        },
      ]);
      mockEducationTask.find.mockReturnValue({
        setOptions: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort,
      });

      await controller.getTaskSubmissions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({
          _id: TASK_ID,
          status: 'Pending Review',
          reviewStatus: 'pending_review',
          studentName: 'Jane Doe',
        }),
      ]);
    });
  });
});
