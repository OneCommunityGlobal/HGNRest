const prGradingConfigController = require('./prGradingConfigController');

describe('prGradingConfigController', () => {
  let mockPRGradingConfig;
  let mockUserProfile;
  let mockHgnFormResponse;
  let mockTeam;
  let req;
  let res;
  let controller;

  beforeEach(() => {
    mockPRGradingConfig = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      save: jest.fn(),
    };

    mockUserProfile = { find: jest.fn() };
    mockHgnFormResponse = { find: jest.fn() };
    mockTeam = { find: jest.fn() };

    // Constructor mock so `new PRGradingConfig(...)` works
    const MockConfigConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'new-id' }),
    }));
    Object.assign(MockConfigConstructor, mockPRGradingConfig);
    MockConfigConstructor.find = mockPRGradingConfig.find;
    MockConfigConstructor.findOne = mockPRGradingConfig.findOne;
    MockConfigConstructor.findOneAndUpdate = mockPRGradingConfig.findOneAndUpdate;
    MockConfigConstructor.findByIdAndDelete = mockPRGradingConfig.findByIdAndDelete;

    controller = prGradingConfigController(
      MockConfigConstructor,
      mockUserProfile,
      mockHgnFormResponse,
      mockTeam,
    );

    req = { query: {}, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── getAllConfigs ───────────────────────────────────────────────────────────

  describe('getAllConfigs', () => {
    it('returns all configs sorted by createdAt descending', async () => {
      const mockConfigs = [{ teamName: 'Team 1' }, { teamName: 'Team 2' }];
      mockPRGradingConfig.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockConfigs),
      });

      await controller.getAllConfigs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockConfigs);
    });

    it('returns 500 on database error', async () => {
      mockPRGradingConfig.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await controller.getAllConfigs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch configurations' }),
      );
    });
  });

  // ─── createConfig ────────────────────────────────────────────────────────────

  describe('createConfig', () => {
    it('returns 400 when teamName is missing', async () => {
      req.body = { reviewerCount: 4, testDataType: 'mixed' };
      await controller.createConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when reviewerCount is missing', async () => {
      req.body = { teamName: 'Team 3', testDataType: 'mixed' };
      await controller.createConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when testDataType is missing', async () => {
      req.body = { teamName: 'Team 3', reviewerCount: 4 };
      await controller.createConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when reviewerCount is not a positive number', async () => {
      req.body = { teamName: 'Team 3', reviewerCount: -1, testDataType: 'mixed' };
      await controller.createConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'reviewerCount must be a positive number.',
      });
    });

    it('returns 409 when config with same teamName already exists', async () => {
      req.body = { teamName: 'Team 1', reviewerCount: 4, testDataType: 'mixed' };
      mockPRGradingConfig.findOne.mockResolvedValue({ teamName: 'Team 1' });

      await controller.createConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Team 1') }),
      );
    });

    it('creates config and returns 201', async () => {
      req.body = { teamName: 'Team 3', reviewerCount: 4, testDataType: 'mixed' };
      mockPRGradingConfig.findOne.mockResolvedValue(null);

      await controller.createConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('defaults reviewerNames to empty array and notes to empty string', async () => {
      req.body = { teamName: 'Team 3', reviewerCount: 4, testDataType: 'mixed' };
      mockPRGradingConfig.findOne.mockResolvedValue(null);

      await controller.createConfig(req, res);

      const savedArg = res.json.mock.calls[0][0];
      expect(savedArg.reviewerNames).toEqual([]);
      expect(savedArg.notes).toBe('');
    });
  });

  // ─── deleteConfig ────────────────────────────────────────────────────────────

  describe('deleteConfig', () => {
    it('returns 404 when config not found', async () => {
      req.params = { id: 'nonexistent-id' };
      mockPRGradingConfig.findByIdAndDelete.mockResolvedValue(null);

      await controller.deleteConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Configuration not found.' });
    });

    it('deletes config and returns 200', async () => {
      req.params = { id: 'valid-id' };
      mockPRGradingConfig.findByIdAndDelete.mockResolvedValue({ teamName: 'Team 3' });

      await controller.deleteConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Configuration deleted successfully.',
      });
    });

    it('returns 500 on database error', async () => {
      req.params = { id: 'valid-id' };
      mockPRGradingConfig.findByIdAndDelete.mockRejectedValue(new Error('DB error'));

      await controller.deleteConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── syncReviewers ───────────────────────────────────────────────────────────

  describe('syncReviewers', () => {
    const mockSQUsers = [{ user_id: '111' }, { user_id: '222' }, { user_id: '333' }];

    const mockProfiles = [
      { _id: '111', firstName: 'Alice', lastName: 'Anderson', weeklycommittedHours: 12 },
      { _id: '222', firstName: 'Bob', lastName: 'Brown', weeklycommittedHours: 20 },
      { _id: '333', firstName: 'Peter', lastName: 'Parker', weeklycommittedHours: 30 },
    ];

    it('returns empty teams when no SQ responses exist', async () => {
      mockHgnFormResponse.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      await controller.syncReviewers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ team1: [], team2: [] }));
    });

    it('returns empty teams when all SQ users are promoted', async () => {
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSQUsers),
      });
      mockTeam.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { members: [{ userId: '111' }, { userId: '222' }, { userId: '333' }] },
          ]),
      });

      await controller.syncReviewers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ team1: [], team2: [] }));
    });

    it('splits reviewers A-M to team1 and N-Z to team2', async () => {
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSQUsers),
      });
      mockTeam.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ members: [] }]),
      });
      mockUserProfile.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfiles),
      });
      mockPRGradingConfig.findOneAndUpdate.mockResolvedValue({});

      await controller.syncReviewers(req, res);

      const responseArg = res.json.mock.calls[0][0];
      expect(responseArg.team1.map((r) => r.name)).toContain('Alice Anderson');
      expect(responseArg.team1.map((r) => r.name)).toContain('Bob Brown');
      expect(responseArg.team2.map((r) => r.name)).toContain('Peter Parker');
    });

    it('calculates prsNeeded correctly from weeklycommittedHours', async () => {
      const profiles = [
        { _id: '1', firstName: 'A', lastName: 'Alpha', weeklycommittedHours: 12 }, // → 7
        { _id: '2', firstName: 'B', lastName: 'Beta', weeklycommittedHours: 20 }, // → 10
        { _id: '3', firstName: 'C', lastName: 'Ceta', weeklycommittedHours: 30 }, // → 20
        { _id: '4', firstName: 'D', lastName: 'Delta', weeklycommittedHours: 35 }, // → 30
        { _id: '5', firstName: 'E', lastName: 'Eta', weeklycommittedHours: 5 }, // → 0
      ];
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(profiles.map((p) => ({ user_id: p._id }))),
      });
      mockTeam.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ members: [] }]),
      });
      mockUserProfile.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(profiles) });
      mockPRGradingConfig.findOneAndUpdate.mockResolvedValue({});

      await controller.syncReviewers(req, res);

      const { team1 } = res.json.mock.calls[0][0];
      const byName = Object.fromEntries(team1.map((r) => [r.name, r.prsNeeded]));
      expect(byName['A Alpha']).toBe(7);
      expect(byName['B Beta']).toBe(10);
      expect(byName['C Ceta']).toBe(20);
      expect(byName['D Delta']).toBe(30);
      expect(byName['E Eta']).toBe(0);
    });

    it('excludes promoted users from reviewer list', async () => {
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ user_id: '111' }, { user_id: '222' }]),
      });
      // User 111 is promoted
      mockTeam.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ members: [{ userId: '111' }] }]),
      });
      mockUserProfile.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: '222', firstName: 'Bob', lastName: 'Brown', weeklycommittedHours: 20 },
          ]),
      });
      mockPRGradingConfig.findOneAndUpdate.mockResolvedValue({});

      await controller.syncReviewers(req, res);

      const { team1 } = res.json.mock.calls[0][0];
      expect(team1.map((r) => r.name)).not.toContain('Alice Anderson');
      expect(team1.map((r) => r.name)).toContain('Bob Brown');
    });

    it('upserts Team 1 and Team 2 configs', async () => {
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSQUsers),
      });
      mockTeam.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ members: [] }]),
      });
      mockUserProfile.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfiles),
      });
      mockPRGradingConfig.findOneAndUpdate.mockResolvedValue({});

      await controller.syncReviewers(req, res);

      expect(mockPRGradingConfig.findOneAndUpdate).toHaveBeenCalledTimes(2);
      const [call1, call2] = mockPRGradingConfig.findOneAndUpdate.mock.calls;
      expect(call1[0]).toEqual({ teamName: 'Team 1' });
      expect(call2[0]).toEqual({ teamName: 'Team 2' });
    });

    it('returns 500 on database error', async () => {
      mockHgnFormResponse.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await controller.syncReviewers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to sync reviewers' }),
      );
    });
  });
});
