const mockSelect = jest.fn();
const mockSort = jest.fn(() => ({ select: mockSelect }));
const mockFind = jest.fn(() => ({ sort: mockSort }));

jest.mock('../../models/activityLog', () => ({
  find: (...args) => mockFind(...args),
}));

const mongoose = require('mongoose');
const controller = require('../activityLogController')();

describe('activityLogController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('fetchStudentDailyLog', () => {
    beforeEach(() => {
      req = {
        body: {
          requestor: { requestorId: new mongoose.Types.ObjectId().toString() },
        },
        query: {},
      };
    });

    it('should return logs for the requestor', async () => {
      const mockLogs = [{ action_type: 'comment', created_at: new Date() }];
      mockSelect.mockResolvedValue(mockLogs);

      await controller.fetchStudentDailyLog(req, res);

      expect(res.json).toHaveBeenCalledWith(mockLogs);
    });

    it('should return 403 if requested studentId differs from requestorId', async () => {
      req.query.studentId = new mongoose.Types.ObjectId().toString();

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden: Cannot access another student's log",
      });
    });

    it('should return 200 if requested studentId matches requestorId', async () => {
      req.query.studentId = req.body.requestor.requestorId;
      mockSelect.mockResolvedValue([]);

      await controller.fetchStudentDailyLog(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return 400 for invalid studentId format', async () => {
      req.body.requestor.requestorId = 'not-a-valid-id';

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid studentId format' });
    });

    it('should return 500 on database error', async () => {
      mockSelect.mockRejectedValue(new Error('DB error'));

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });

    it('should return 500 when req.body.requestor is undefined', async () => {
      req.body = {};

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    it('should use requestorId when query studentId is empty string', async () => {
      req.query.studentId = '';
      mockSelect.mockResolvedValue([{ action_type: 'comment' }]);

      await controller.fetchStudentDailyLog(req, res);

      expect(mockFind).toHaveBeenCalledWith({ actor_id: expect.any(mongoose.Types.ObjectId) });
      expect(res.json).toHaveBeenCalledWith([{ action_type: 'comment' }]);
    });

    it('should call find with correct filter, sort, and select', async () => {
      mockSelect.mockResolvedValue([]);

      await controller.fetchStudentDailyLog(req, res);

      expect(mockFind).toHaveBeenCalledWith({ actor_id: expect.any(mongoose.Types.ObjectId) });
      expect(mockSort).toHaveBeenCalledWith({ created_at: -1 });
      expect(mockSelect).toHaveBeenCalledWith('action_type metadata created_at actor_id');
    });
  });

  describe('fetchEducatorDailyLog', () => {
    beforeEach(() => {
      req = {
        params: { studentId: new mongoose.Types.ObjectId().toString() },
      };
    });

    it('should return logs for the given studentId', async () => {
      const mockLogs = [{ action_type: 'note', created_at: new Date() }];
      mockSelect.mockResolvedValue(mockLogs);

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.json).toHaveBeenCalledWith(mockLogs);
    });

    it('should return 400 when studentId is missing', async () => {
      req.params = {};

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing studentId' });
    });

    it('should return 400 for invalid studentId format', async () => {
      req.params.studentId = 'invalid-id';

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid studentId format' });
    });

    it('should return 500 on database error', async () => {
      mockSelect.mockRejectedValue(new Error('DB failure'));

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB failure' });
    });

    it('should return empty array when no logs exist', async () => {
      mockSelect.mockResolvedValue([]);

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return 400 when studentId is empty string', async () => {
      req.params.studentId = '';

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing studentId' });
    });

    it('should return 400 when studentId is null', async () => {
      req.params.studentId = null;

      await controller.fetchEducatorDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing studentId' });
    });

    it('should call find with correct filter, sort, and select', async () => {
      mockSelect.mockResolvedValue([]);

      await controller.fetchEducatorDailyLog(req, res);

      expect(mockFind).toHaveBeenCalledWith({ actor_id: expect.any(mongoose.Types.ObjectId) });
      expect(mockSort).toHaveBeenCalledWith({ created_at: -1 });
      expect(mockSelect).toHaveBeenCalledWith('action_type metadata created_at actor_id');
    });
  });
});
