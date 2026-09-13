/* eslint-disable no-unused-vars */
const Team = require('../models/team');
const { mockReq: baseMockReq, mockRes, assertResMock } = require('../test');
const helper = require('../utilities/permissions');
const teamController = require('./teamController');

const mockReq = {
  ...baseMockReq,
  params: {},
  body: {},
};

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const makeSut = () => {
  const { postTeam, getAllTeams, getTeamById } = teamController(Team);
  return {
    postTeam,
    getAllTeams,
    getTeamById,
  };
};

const flushPromises = () => new Promise(setImmediate);

describe('teamController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postTeam', () => {
    test('Returns 403 - the requestor lacks `postTeam` permission.', async () => {
      const { postTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      assertResMock(403, { error: 'You are not authorized to create teams.' }, response, mockRes);
    });

    test('Returns 403 - a team with the same name already exists.', async () => {
      const { postTeam } = makeSut();
      jest.spyOn(Team, 'exists').mockResolvedValue(true);
      const hasPermissionSpy = mockHasPermission(true);
      const response = await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
      assertResMock(
        403,
        { error: `Team Name "${mockReq.body.teamName}" already exists` },
        response,
        mockRes,
      );
    });

    test('Returns 200 - a new team is successfully created.', async () => {
      const { postTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const mockSaveResolvedValue = { teamName: 'Unique Team', isActive: true };
      jest.spyOn(Team, 'exists').mockResolvedValue(false);

      const mockSave = jest.spyOn(Team.prototype, 'save').mockResolvedValue(mockSaveResolvedValue);
      const response = await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
      expect(mockSave).toHaveBeenCalled();
      assertResMock(200, mockSaveResolvedValue, response, mockRes);
    });

    test('Returns 500 - error occurs during team creation.', async () => {
      const { postTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      jest.spyOn(Team, 'exists').mockResolvedValue(false);
      jest.spyOn(Team.prototype, 'save').mockRejectedValue(new Error('DB error'));
      const response = await postTeam(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
      assertResMock(500, { error: 'Internal server error' }, response, mockRes);
    });
  });

  const error = new Error('any error');

  describe('getAllTeams', () => {
    test('uses the most frequent valid code from active members and preserves all members', async () => {
      const aggregateResults = [
        {
          _id: 'team-id',
          teamName: 'City Center Architecture',
          isActive: true,
          members: [
            { _id: 'active-1', teamCode: ' C-ARCH ', isActive: true },
            { _id: 'active-2', teamCode: 'C-ARCH', isActive: true },
            { _id: 'active-3', teamCode: 'OTHER', isActive: true },
            { _id: 'inactive-1', teamCode: 'OLD-C', isActive: false },
            { _id: 'inactive-2', teamCode: 'OLD-C', isActive: false },
            { _id: 'inactive-3', teamCode: 'OLD-C', isActive: false },
          ],
        },
      ];
      const aggregateSpy = jest.spyOn(Team, 'aggregate').mockResolvedValue(aggregateResults);

      makeSut().getAllTeams(mockReq, mockRes);
      await flushPromises();

      const groupStage = aggregateSpy.mock.calls[0][0].find((stage) => stage.$group);
      expect(groupStage.$group).not.toHaveProperty('teamCode');
      expect(groupStage.$group.members.$push.isActive).toBe('$userProfile.isActive');
      expect(mockRes.send).toHaveBeenCalledWith([
        {
          _id: 'team-id',
          teamName: 'City Center Architecture',
          isActive: true,
          teamCode: 'C-ARCH',
          members: aggregateResults[0].members.map(({ isActive, ...member }) => member),
        },
      ]);
      expect(mockRes.send.mock.calls[0][0][0].members).toHaveLength(6);
    });

    test('ignores active members with missing, non-string, or blank codes', async () => {
      jest.spyOn(Team, 'aggregate').mockResolvedValue([
        {
          _id: 'team-id',
          members: [
            { _id: 'missing', isActive: true },
            { _id: 'null', teamCode: null, isActive: true },
            { _id: 'blank', teamCode: '   ', isActive: true },
            { _id: 'number', teamCode: 12345, isActive: true },
          ],
        },
      ]);

      makeSut().getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.send.mock.calls[0][0][0].teamCode).toBe('');
    });

    test('returns an empty code and preserves teams without a joined user profile', async () => {
      jest
        .spyOn(Team, 'aggregate')
        .mockResolvedValue([{ _id: 'empty-team', teamName: 'Empty Team', members: [{}] }]);

      makeSut().getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.send).toHaveBeenCalledWith([
        { _id: 'empty-team', teamName: 'Empty Team', teamCode: '', members: [{}] },
      ]);
    });

    test('breaks equal-frequency ties by team code in lexical ascending order', async () => {
      jest.spyOn(Team, 'aggregate').mockResolvedValue([
        {
          _id: 'team-id',
          members: [
            { teamCode: 'B-CODE', isActive: true },
            { teamCode: 'A-CODE', isActive: true },
          ],
        },
      ]);

      makeSut().getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.send.mock.calls[0][0][0].teamCode).toBe('A-CODE');
    });

    test('returns 500 when aggregation fails', async () => {
      jest.spyOn(Team, 'aggregate').mockRejectedValue(error);
      jest.spyOn(console, 'error').mockImplementation(() => {});

      makeSut().getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('getTeamById', () => {
    test('Returns 404 - the specified team ID does not exist.', async () => {
      const { getTeamById } = makeSut();
      const req = { params: { teamId: 'nonExistentTeamId' } };
      const findByIdSpy = jest.spyOn(Team, 'findById').mockRejectedValue(error);
      const response = getTeamById(req, mockRes);
      await flushPromises();

      expect(findByIdSpy).toHaveBeenCalledWith(req.params.teamId);
      assertResMock(404, error, response, mockRes);
    });

    test.todo('TODO: Fix returns 200 - all is successful, return a team by ID.');

    // test('Returns 200 - all is successful, return a team by ID.', async () => {
    //   const { getTeamById } = makeSut();
    //   const teamId = '5a8e21f00317bc';
    //   mockReq.params.teamId = teamId;
    //   const findByIdSpy = jest.spyOn(Team, 'findById').mockResolvedValue({ teamId });
    //   const response = getTeamById(req, mockRes);
    //   await flushPromises();

    //   expect(findByIdSpy).toHaveBeenCalledWith(teamId);
    //   assertResMock(200, { teamId }, response, mockRes);
    // });
  });
});
