jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('../../utilities/permissions');
const weeklyGradingControllerFactory = require('./weeklyGradingController');

const makeMockModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const initController = (model) => {
  const controller = weeklyGradingControllerFactory(model);
  return {
    getWeeklyGrading: controller.getWeeklyGrading,
    saveWeeklyGrading: controller.saveWeeklyGrading,
    deleteWeeklyGrading: controller.deleteWeeklyGrading,
  };
};

describe('weeklyGradingController', () => {
  let model;
  let controller;
  let res;

  beforeEach(() => {
    model = makeMockModel();
    controller = initController(model);
    res = makeRes();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── deleteWeeklyGrading ────────────────────────────────────────────────────

  describe('deleteWeeklyGrading', () => {
    it('returns 400 when team, date, or reviewer query params are missing', async () => {
      const req = { query: { team: 'TeamA', date: '2026-10-13' }, body: {} };

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'team, date, and reviewer query params are required',
      });
    });

    it('returns 400 when requestor is missing from body', async () => {
      const req = {
        query: { team: 'TeamA', date: '2026-10-13', reviewer: 'Alice' },
        body: {},
      };

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'requestor is required' });
    });

    it('returns 403 when requestor does not have accessPRTeamDashboard permission', async () => {
      const req = {
        query: { team: 'TeamA', date: '2026-10-13', reviewer: 'Alice' },
        body: { requestor: { requestorId: 'abc123' } },
      };
      hasPermission.mockResolvedValue(false);

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You are not authorized to remove a reviewer.',
      });
    });

    it('returns 400 when date is invalid', async () => {
      const req = {
        query: { team: 'TeamA', date: 'not-a-date', reviewer: 'Alice' },
        body: { requestor: { requestorId: 'abc123' } },
      };
      hasPermission.mockResolvedValue(true);

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
    });

    it('returns 404 when grading record is not found', async () => {
      const req = {
        query: { team: 'TeamA', date: '2026-10-13', reviewer: 'Alice' },
        body: { requestor: { requestorId: 'abc123' } },
      };
      hasPermission.mockResolvedValue(true);
      model.findOneAndDelete.mockResolvedValue(null);

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Grading record not found' });
    });

    it('returns 200 when reviewer is successfully deleted', async () => {
      const req = {
        query: { team: 'TeamA', date: '2026-10-13', reviewer: 'Alice' },
        body: { requestor: { requestorId: 'abc123' } },
      };
      hasPermission.mockResolvedValue(true);
      model.findOneAndDelete.mockResolvedValue({ reviewer: 'Alice' });

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Reviewer "Alice" removed successfully',
      });
    });

    it('returns 500 on unexpected database error', async () => {
      const req = {
        query: { team: 'TeamA', date: '2026-10-13', reviewer: 'Alice' },
        body: { requestor: { requestorId: 'abc123' } },
      };
      hasPermission.mockResolvedValue(true);
      model.findOneAndDelete.mockRejectedValue(new Error('DB error'));

      await controller.deleteWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // ─── getWeeklyGrading ───────────────────────────────────────────────────────

  describe('getWeeklyGrading', () => {
    it('returns 400 when team param is missing', async () => {
      const req = { query: {} };

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Team parameter is required' });
    });

    it('returns 400 when date is invalid', async () => {
      const req = { query: { team: 'TeamA', date: 'bad-date' } };

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
    });

    it('returns 200 with formatted grading data', async () => {
      const req = { query: { team: 'TeamA', date: '2026-10-13' } };
      const dbData = [{ reviewer: 'Alice', prsNeeded: 5, prsReviewed: 3, gradedPrs: [] }];
      model.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(dbData) });

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { reviewer: 'Alice', prsNeeded: 5, prsReviewed: 3, gradedPrs: [] },
      ]);
    });

    it('returns 200 with all records when no date is provided', async () => {
      const req = { query: { team: 'TeamA' } };
      const dbData = [{ reviewer: 'Bob', prsNeeded: 8, prsReviewed: 6, gradedPrs: [] }];
      model.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(dbData) });

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 on unexpected database error', async () => {
      const req = { query: { team: 'TeamA' } };
      model.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await controller.getWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // ─── saveWeeklyGrading ──────────────────────────────────────────────────────

  describe('saveWeeklyGrading', () => {
    it('returns 400 when required fields are missing', async () => {
      const req = { body: { teamCode: 'TeamA' } };

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields: teamCode, date, and gradings array',
      });
    });

    it('returns 400 when date is invalid', async () => {
      const req = {
        body: { teamCode: 'TeamA', date: 'bad-date', gradings: [] },
      };

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
    });

    it('returns 200 when gradings are saved successfully', async () => {
      const req = {
        body: {
          teamCode: 'TeamA',
          date: '2026-10-13',
          gradings: [
            {
              reviewer: 'Alice',
              prsReviewed: 3,
              prsNeeded: 5,
              gradedPrs: [{ prNumbers: '123', grade: 'Okay' }],
            },
          ],
        },
      };
      model.findOne.mockResolvedValue(null);
      model.findOneAndUpdate.mockResolvedValue({});

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        message: 'Weekly grades saved successfully',
      });
    });

    it('returns 500 on unexpected database error', async () => {
      const req = {
        body: {
          teamCode: 'TeamA',
          date: '2026-10-13',
          gradings: [
            {
              reviewer: 'Alice',
              prsReviewed: 3,
              prsNeeded: 5,
              gradedPrs: [{ prNumbers: '123', grade: 'Okay' }],
            },
          ],
        },
      };
      model.findOne.mockRejectedValue(new Error('DB error'));

      await controller.saveWeeklyGrading(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
