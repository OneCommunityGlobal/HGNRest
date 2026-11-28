jest.mock('../../models/lessonPlan', () => ({}));
jest.mock('../../models/activity', () => ({}));
jest.mock('../../models/educationTask', () => ({ find: jest.fn() }));
jest.mock('../../models/progress', () => ({}));
jest.mock('../../models/atom', () => ({}));
jest.mock('../../models/userProfile', () => ({ findById: jest.fn() }));
jest.mock('../../models/studentAtom', () => ({}));
jest.mock('../../services/studentEvaluationResultsService', () => ({}));

const mongoose = require('mongoose');
const EducationTask = require('../../models/educationTask');
const UserProfile = require('../../models/userProfile');
const educatorController = require('../educatorController')();

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('reports unique students using the assignment summary', async () => {
  const tasks = [
    { status: 'assigned', studentId: { _id: 'student-1' } },
    { status: 'completed', studentId: { _id: 'student-1' } },
    { status: 'assigned', studentId: { _id: 'student-2' } },
  ];
  const query = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(tasks),
  };
  EducationTask.find.mockReturnValue(query);
  const res = response();

  await educatorController.getAssignmentSummary({ params: { lessonPlanId: 'plan-1' } }, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ students: 2 }));
});

test('does not log an unsanitized database error during atom assignment', async () => {
  const sensitiveDetails = 'untrusted student data';
  UserProfile.findById.mockRejectedValue(new Error(sensitiveDetails));
  const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = response();

  await educatorController.assignAtoms(
    {
      body: {
        requestor: { requestorId: '507f1f77bcf86cd799439011', role: 'Educator' },
        studentId: '507f1f77bcf86cd799439012',
        atomType: '507f1f77bcf86cd799439013',
      },
    },
    res,
  );

  expect(res.status).toHaveBeenCalledWith(500);
  expect(logError).toHaveBeenCalledWith('Atom assignment failed');
  expect(JSON.stringify(logError.mock.calls)).not.toContain(sensitiveDetails);
});

test('starts the MongoDB transaction before validating the assignment request', async () => {
  const session = {
    startTransaction: jest.fn(),
    endSession: jest.fn(),
  };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  const res = response();

  await educatorController.assignTasks({ body: {} }, res);

  expect(session.startTransaction).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(session.endSession).toHaveBeenCalledTimes(1);
});
