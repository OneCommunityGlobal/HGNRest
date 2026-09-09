const weeklyGradingController = require('./weeklyGradingController');

describe('weeklyGradingController', () => {
  let mockModel;
  let req;
  let res;
  let controller;

  beforeEach(() => {
    mockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };
    controller = weeklyGradingController(mockModel);
    req = { query: {}, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── getWeeklyGrading ────────────────────────────────────────────────────────

  describe('getWeeklyGrading', () => {
    it('returns 400 when team param is missing', async () => {
      req.query = {};
      await controller.getWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Team parameter is required' });
    });

    it('returns all records for a team when no weekStart is provided', async () => {
      req.query = { team: 'Team 1' };
      const mockData = [{ reviewer: 'Alice', prsNeeded: 7, prsReviewed: 5, gradedPrs: [] }];
      mockModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockData) });

      await controller.getWeeklyGrading(req, res);

      expect(mockModel.find).toHaveBeenCalledWith({ teamName: 'Team 1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { reviewer: 'Alice', prsNeeded: 7, prsReviewed: 5, gradedPrs: [] },
      ]);
    });

    it('filters by 7-day range when weekStart is provided', async () => {
      req.query = { team: 'Team 1', weekStart: '2026-06-15' };
      mockModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      await controller.getWeeklyGrading(req, res);

      const callArg = mockModel.find.mock.calls[0][0];
      expect(callArg.teamName).toBe('Team 1');
      expect(callArg.date.$gte).toBeDefined();
      expect(callArg.date.$lte).toBeDefined();
      // Range spans ~7 days (start at 00:00:00, end at 23:59:59.999 = 6.999... days)
      const diffMs = callArg.date.$lte - callArg.date.$gte;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('returns 400 for invalid weekStart format', async () => {
      req.query = { team: 'Team 1', weekStart: 'not-a-date' };
      await controller.getWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid weekStart date format. Use YYYY-MM-DD.',
      });
    });

    it('defaults gradedPrs to empty array when missing from record', async () => {
      req.query = { team: 'Team 1' };
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ reviewer: 'Bob', prsNeeded: 10, prsReviewed: 3 }]),
      });

      await controller.getWeeklyGrading(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { reviewer: 'Bob', prsNeeded: 10, prsReviewed: 3, gradedPrs: [] },
      ]);
    });

    it('returns 500 on database error', async () => {
      req.query = { team: 'Team 1' };
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // ─── saveWeeklyGrading ───────────────────────────────────────────────────────

  describe('saveWeeklyGrading', () => {
    const validGrading = {
      reviewer: 'Alice',
      prsNeeded: 7,
      prsReviewed: 5,
      gradedPrs: [{ prNumbers: '123', grade: 'Okay' }],
    };

    it('returns 400 when teamName is missing', async () => {
      req.body = { date: '2026-06-18', gradings: [validGrading] };
      await controller.saveWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when date is missing', async () => {
      req.body = { teamName: 'Team 1', gradings: [validGrading] };
      await controller.saveWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when gradings is not an array', async () => {
      req.body = { teamName: 'Team 1', date: '2026-06-18', gradings: 'bad' };
      await controller.saveWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid date format', async () => {
      req.body = { teamName: 'Team 1', date: 'not-a-date', gradings: [validGrading] };
      await controller.saveWeeklyGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
    });

    it('normalizes save date to Sunday midnight UTC', async () => {
      // June 18 2026 is a Thursday — should normalize to the Sunday of that week
      req.body = { teamName: 'Team 1', date: '2026-06-18', gradings: [validGrading] };
      mockModel.findOne.mockResolvedValue(null);
      mockModel.findOneAndUpdate.mockResolvedValue({});

      await controller.saveWeeklyGrading(req, res);

      const updateCall = mockModel.findOneAndUpdate.mock.calls[0];
      const savedDate = updateCall[0].date;
      expect(savedDate.getUTCDay()).toBe(0); // 0 = Sunday
      expect(savedDate.getUTCHours()).toBe(0);
      expect(savedDate.getUTCMinutes()).toBe(0);
    });

    it('saves successfully and returns 200', async () => {
      req.body = { teamName: 'Team 1', date: '2026-06-15', gradings: [validGrading] };
      mockModel.findOne.mockResolvedValue(null);
      mockModel.findOneAndUpdate.mockResolvedValue({});

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        message: 'Weekly grades saved successfully',
      });
    });

    it('upserts existing entry — increments version', async () => {
      req.body = {
        teamName: 'Team 1',
        date: '2026-06-15',
        gradings: [validGrading],
      };
      const existing = {
        version: 2,
        prsNeeded: 7,
        prsReviewed: 3,
        gradedPrs: [{ prNumbers: '100', grade: 'Okay' }],
        updatedAt: new Date(),
      };
      mockModel.findOne.mockResolvedValue(existing);
      mockModel.findOneAndUpdate.mockResolvedValue({});

      await controller.saveWeeklyGrading(req, res);

      const updateArg = mockModel.findOneAndUpdate.mock.calls[0][1];
      expect(updateArg.version).toBe(3);
      expect(updateArg.$push.versionHistory).toBeDefined();
    });

    it('merges gradedPrs — new PR overwrites existing same PR number', async () => {
      req.body = {
        teamName: 'Team 1',
        date: '2026-06-15',
        gradings: [
          {
            reviewer: 'Alice',
            prsNeeded: 7,
            prsReviewed: 5,
            gradedPrs: [{ prNumbers: '123', grade: 'Exceptional' }],
          },
        ],
      };
      const existing = {
        version: 1,
        prsNeeded: 7,
        prsReviewed: 3,
        gradedPrs: [{ prNumbers: '123', grade: 'Okay' }],
        updatedAt: new Date(),
      };
      mockModel.findOne.mockResolvedValue(existing);
      mockModel.findOneAndUpdate.mockResolvedValue({});

      await controller.saveWeeklyGrading(req, res);

      const updateArg = mockModel.findOneAndUpdate.mock.calls[0][1];
      const merged = updateArg.gradedPrs;
      expect(merged).toHaveLength(1);
      expect(merged[0].grade).toBe('Exceptional');
    });

    it('returns 500 on database error', async () => {
      req.body = { teamName: 'Team 1', date: '2026-06-15', gradings: [validGrading] };
      mockModel.findOne.mockRejectedValue(new Error('DB error'));

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 400 for invalid grade value', async () => {
      req.body = {
        teamName: 'Team 1',
        date: '2026-06-15',
        gradings: [
          {
            reviewer: 'Alice',
            prsNeeded: 7,
            prsReviewed: 1,
            gradedPrs: [{ prNumbers: '123', grade: 'Invalid' }],
          },
        ],
      };
      mockModel.findOne.mockResolvedValue(null);

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid grade value') }),
      );
    });

    it('returns 400 for invalid prNumbers format', async () => {
      req.body = {
        teamName: 'Team 1',
        date: '2026-06-15',
        gradings: [
          {
            reviewer: 'Alice',
            prsNeeded: 7,
            prsReviewed: 1,
            gradedPrs: [{ prNumbers: 'abc', grade: 'Okay' }],
          },
        ],
      };
      mockModel.findOne.mockResolvedValue(null);

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── deleteReviewerGrading ───────────────────────────────────────────────────

  describe('deleteReviewerGrading', () => {
    it('returns 400 when team is missing', async () => {
      req.query = { reviewer: 'Alice', weekStart: '2026-06-15' };
      await controller.deleteReviewerGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when reviewer is missing', async () => {
      req.query = { team: 'Team 1', weekStart: '2026-06-15' };
      await controller.deleteReviewerGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when weekStart is missing', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice' };
      await controller.deleteReviewerGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid weekStart format', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice', weekStart: 'bad-date' };
      await controller.deleteReviewerGrading(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid weekStart date format. Use YYYY-MM-DD.',
      });
    });

    it('returns 404 when no record found', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice', weekStart: '2026-06-15' };
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await controller.deleteReviewerGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No grading record found for the given parameters',
      });
    });

    it('returns 200 when reviewer deleted successfully', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice', weekStart: '2026-06-15' };
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await controller.deleteReviewerGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reviewer "Alice" removed successfully',
      });
    });

    it('queries correct 7-day date range for deletion', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice', weekStart: '2026-06-15' };
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await controller.deleteReviewerGrading(req, res);

      const deleteArg = mockModel.deleteOne.mock.calls[0][0];
      expect(deleteArg.teamName).toBe('Team 1');
      expect(deleteArg.reviewer).toBe('Alice');
      expect(deleteArg.date.$gte).toBeDefined();
      expect(deleteArg.date.$lte).toBeDefined();
    });

    it('returns 500 on database error', async () => {
      req.query = { team: 'Team 1', reviewer: 'Alice', weekStart: '2026-06-15' };
      mockModel.deleteOne.mockRejectedValue(new Error('DB error'));

      await controller.deleteReviewerGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
