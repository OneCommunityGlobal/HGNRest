const request = require('supertest');
const express = require('express');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));
jest.mock('../models/lessonPlan');
jest.mock('../models/educationTask');
jest.mock('../models/userProfile');
jest.mock('../models/lessonPlanLog');
jest.mock('../controllers/educatorController', () => () => ({
  assignAtoms: (req, res) => res.status(200).json({}),
  publishEvaluationResults: (req, res) => res.status(200).json({}),
}));

const { hasPermission } = require('../utilities/permissions');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const EducationTask = require('../models/educationTask');
const LessonPlanLog = require('../models/lessonPlanLog');
const educatorRouter = require('./educatorRouter');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/educator', educatorRouter);
  return app;
};

describe('POST /api/educator/assign-tasks', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it('returns 403 when the requestor lacks the assignLessonTasks permission', async () => {
    hasPermission.mockResolvedValue(false);

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        lesson_plan_id: '507f1f77bcf86cd799439011',
        lessonPlanId: '507f1f77bcf86cd799439011',
        assignmentDate: '2026-09-16',
        isAutoAssigned: false,
        requestor: { requestorId: 'user1', role: 'Volunteer' },
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You are not authorized to assign tasks for this lesson plan.',
    });
    expect(hasPermission).toHaveBeenCalledWith(
      { requestorId: 'user1', role: 'Volunteer' },
      'assignLessonTasks',
    );
  });

  it('returns 400 when lessonPlanId is missing', async () => {
    hasPermission.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        assignmentDate: '2026-09-16',
        isAutoAssigned: false,
        requestor: { requestorId: 'admin1', role: 'Administrator' },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Request is missing lesson_plan_id.' });
  });

  it('returns 404 when the lesson plan has no sub-tasks', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlan.findById.mockResolvedValue({ subTasks: [] });

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        lessonPlanId: '507f1f77bcf86cd799439011',
        assignmentDate: '2026-09-16',
        isAutoAssigned: false,
        requestor: { requestorId: 'admin1', role: 'Administrator' },
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'Lesson plan not found or it has no sub-tasks to assign.',
    });
  });

  it('returns 404 when there are no eligible students', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlan.findById.mockResolvedValue({
      subTasks: [{ name: 'Task 1', dueDate: '2026-09-20' }],
    });
    UserProfile.find.mockResolvedValue([]);

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        lessonPlanId: '507f1f77bcf86cd799439011',
        assignmentDate: '2026-09-16',
        isAutoAssigned: false,
        requestor: { requestorId: 'admin1', role: 'Administrator' },
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No eligible students found to assign tasks to.' });
  });

  it('returns 200 with assignedCount when an Administrator successfully assigns tasks', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlan.findById.mockResolvedValue({
      subTasks: [{ name: 'Task 1', dueDate: '2026-09-20' }],
    });
    UserProfile.find.mockResolvedValue([{ _id: 'student1' }, { _id: 'student2' }]);
    EducationTask.insertMany.mockResolvedValue([]);
    LessonPlanLog.create.mockResolvedValue({});

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        lessonPlanId: '507f1f77bcf86cd799439011',
        assignmentDate: '2026-09-16',
        isAutoAssigned: false,
        requestor: { requestorId: 'admin1', role: 'Administrator' },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ assignedCount: 2, skippedCount: 0 });
    expect(EducationTask.insertMany).toHaveBeenCalled();
    expect(LessonPlanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonPlanId: '507f1f77bcf86cd799439011',
        action: 'Manual Assignment',
      }),
    );
  });

  it('logs "Auto-Assigned (On Save)" when isAutoAssigned is true', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlan.findById.mockResolvedValue({
      subTasks: [{ name: 'Task 1', dueDate: '2026-09-20' }],
    });
    UserProfile.find.mockResolvedValue([{ _id: 'student1' }]);
    EducationTask.insertMany.mockResolvedValue([]);
    LessonPlanLog.create.mockResolvedValue({});

    const response = await request(app)
      .post('/api/educator/assign-tasks')
      .send({
        lessonPlanId: '507f1f77bcf86cd799439011',
        assignmentDate: '2026-09-16',
        isAutoAssigned: true,
        requestor: { requestorId: 'admin1', role: 'Administrator' },
      });

    expect(response.status).toBe(200);
    expect(LessonPlanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Auto-Assigned (On Save)' }),
    );
  });
});
