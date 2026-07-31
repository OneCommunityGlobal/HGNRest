const { mockReq, mockRes } = require('../test');
const evaluationResultsService = require('../services/studentEvaluationResultsService');
const studentEvaluationResultsController = require('./studentEvaluationResultsController');

const makeSut = () => studentEvaluationResultsController();

describe('studentEvaluationResultsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.body = {
      requestor: {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Student',
      },
    };
  });

  describe('getEvaluationResults', () => {
    test('returns 401 when requestor is missing', async () => {
      const { getEvaluationResults } = makeSut();
      mockReq.body = {};

      await getEvaluationResults(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    test('returns evaluation results and marks them viewed', async () => {
      const { getEvaluationResults } = makeSut();
      const resultsPayload = {
        summary: { overallScore: 91 },
        categories: [],
        taskResults: [],
      };

      evaluationResultsService.getStudentEvaluationResults = jest
        .fn()
        .mockResolvedValue(resultsPayload);
      evaluationResultsService.markEvaluationResultsViewed = jest.fn().mockResolvedValue({});

      await getEvaluationResults(mockReq, mockRes);

      expect(evaluationResultsService.getStudentEvaluationResults).toHaveBeenCalledWith(
        '65cf6c3706d8ac105827bb2e',
      );
      expect(evaluationResultsService.markEvaluationResultsViewed).toHaveBeenCalledWith(
        '65cf6c3706d8ac105827bb2e',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(resultsPayload);
    });

    test('maps missing student profile to 404', async () => {
      const { getEvaluationResults } = makeSut();

      evaluationResultsService.getStudentEvaluationResults = jest
        .fn()
        .mockRejectedValue(new Error('Student profile not found.'));

      await getEvaluationResults(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Student profile not found.' });
    });
  });

  describe('getEvaluationResultNotifications', () => {
    test('returns notification state for the authenticated student', async () => {
      const { getEvaluationResultNotifications } = makeSut();
      const notificationPayload = {
        hasNewResults: true,
        unreadCount: 2,
        lastViewedAt: null,
        latestNotificationAt: new Date('2026-04-22T00:00:00.000Z'),
      };

      evaluationResultsService.getEvaluationResultNotifications = jest
        .fn()
        .mockResolvedValue(notificationPayload);

      await getEvaluationResultNotifications(mockReq, mockRes);

      expect(evaluationResultsService.getEvaluationResultNotifications).toHaveBeenCalledWith(
        '65cf6c3706d8ac105827bb2e',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(notificationPayload);
    });

    test('maps invalid student id errors to 400', async () => {
      const { getEvaluationResultNotifications } = makeSut();

      evaluationResultsService.getEvaluationResultNotifications = jest
        .fn()
        .mockRejectedValue(new Error('Invalid student ID provided.'));

      await getEvaluationResultNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid student ID provided.' });
    });
  });
});
