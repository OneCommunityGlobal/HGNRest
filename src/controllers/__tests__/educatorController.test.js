jest.mock('../../services/studentEvaluationResultsService', () => ({
  publishStudentEvaluationResults: jest.fn(),
}));

const educatorController = require('../educatorController');
const evaluationResultsService = require('../../services/studentEvaluationResultsService');

describe('educatorController - publishEvaluationResults', () => {
  let controller;
  let req;
  let res;

  const validEvaluations = [{ category: 'Coding', tasks: [{ taskName: 'Task 1' }] }];

  beforeEach(() => {
    jest.clearAllMocks();
    controller = educatorController();

    req = {
      body: {
        requestor: { requestorId: 'teacher123', role: 'educator' },
        studentId: 'student123',
        evaluations: validEvaluations,
        message: 'Great work',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('should return 401 if requestor is missing', async () => {
    req.body.requestor = null;

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 403 if requestor lacks educator access', async () => {
    req.body.requestor.role = 'Student';

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Insufficient permissions. Educator, admin, teacher, or owner role required.',
      }),
    );
  });

  it('should return 400 if studentId is missing', async () => {
    req.body.studentId = undefined;

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'studentId is required' });
  });

  it('should return 400 if evaluations is not a non-empty array', async () => {
    req.body.evaluations = [];

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'evaluations must be a non-empty array' });
  });

  it('should return 400 if an evaluation is missing category or tasks', async () => {
    req.body.evaluations = [{ category: 'Coding' }, { tasks: ['Task 1'] }];

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Each evaluation must include category and tasks array',
    });
    expect(evaluationResultsService.publishStudentEvaluationResults).not.toHaveBeenCalled();
  });

  it('should publish evaluation results successfully when all evaluations are valid', async () => {
    evaluationResultsService.publishStudentEvaluationResults.mockResolvedValue([
      { category: 'Coding' },
    ]);

    await controller.publishEvaluationResults(req, res);

    expect(evaluationResultsService.publishStudentEvaluationResults).toHaveBeenCalledWith({
      studentId: 'student123',
      teacherId: 'teacher123',
      evaluations: validEvaluations,
      message: 'Great work',
      teacherFeedback: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Evaluation results published successfully',
        studentId: 'student123',
        evaluationsPublished: 1,
        categories: ['Coding'],
      }),
    );
  });

  it('should return 400 when the service throws an invalid student ID error', async () => {
    evaluationResultsService.publishStudentEvaluationResults.mockRejectedValue(
      new Error('Invalid student ID provided.'),
    );

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid student ID provided.' });
  });

  it('should return 404 when the service reports student profile not found', async () => {
    evaluationResultsService.publishStudentEvaluationResults.mockRejectedValue(
      new Error('Student profile not found.'),
    );

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Student profile not found.' });
  });

  it('should return 500 for unexpected service errors', async () => {
    evaluationResultsService.publishStudentEvaluationResults.mockRejectedValue(
      new Error('Unexpected failure'),
    );

    await controller.publishEvaluationResults(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      details: 'Unexpected failure',
    });
  });
  it('forwards general feedback and uses only the authenticated publisher identity', async () => {
    req.body.teacherFeedback = {
      overall: 'Progress',
      strengths: [],
      improvements: [],
      teacherTitle: null,
    };
    req.body.teacherId = 'spoofed';
    evaluationResultsService.publishStudentEvaluationResults.mockResolvedValue([
      { category: 'Coding' },
    ]);
    await controller.publishEvaluationResults(req, res);
    expect(evaluationResultsService.publishStudentEvaluationResults).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 'teacher123',
        teacherFeedback: req.body.teacherFeedback,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns HTTP 400 for complete-payload validation errors', async () => {
    const error = new Error('Invalid task status');
    error.statusCode = 400;
    evaluationResultsService.publishStudentEvaluationResults.mockRejectedValue(error);
    await controller.publishEvaluationResults(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid task status' });
  });

  it('rejects null evaluation entries with HTTP 400', async () => {
    req.body.evaluations = [null];
    await controller.publishEvaluationResults(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(evaluationResultsService.publishStudentEvaluationResults).not.toHaveBeenCalled();
  });
});
