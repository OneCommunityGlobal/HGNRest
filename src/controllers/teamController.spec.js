const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes, assertResMock } = require('../test');
const helper = require('../utilities/permissions');

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

  const sortObject = {
    sort: () => {},
  };

  const error = new Error('any error');

  // TODO: Fix
  // describe('getAllTeams', () => {
  //   test('Returns 404 - an error occurs during team retrieval.', async () => {
  //     const { getAllTeams } = makeSut();
  //
  //     const mockSort = jest.spyOn(sortObject, 'sort').mockRejectedValueOnce(error);
  //     const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);
  //     const response = getAllTeams(mockReq, mockRes);
  //     await flushPromises();
  //
  //     expect(findSpy).toHaveBeenCalledWith({});
  //     expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
  //     assertResMock(404, error, response, mockRes);
  //   });
  //
  //   test('Returns 200 - should return all teams sorted by name.', async () => {
  //     const team1 = { teamName: 'Team A' };
  //     const team2 = { teamName: 'Team B' };
  //     const sortedTeams = [team1, team2];
  //
  //     const mockSortResovledValue = [team1, team2];
  //     const mockSort = jest.spyOn(sortObject, 'sort').mockResolvedValue(mockSortResovledValue);
  //     const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);
  //     const { getAllTeams } = makeSut();
  //     const response = getAllTeams(mockReq, mockRes);
  //     await flushPromises();
  //
  //     expect(findSpy).toHaveBeenCalledWith({});
  //     expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
  //     assertResMock(200, sortedTeams, response, mockRes);
  //   });
  // });

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

    test('Returns 200 - all is successful, return a team by ID.', async () => {
      const { getTeamById } = makeSut();
      const teamId = '5a8e21f00317bc';
      const req = { params: { teamId } };
      const findByIdSpy = jest.spyOn(Team, 'findById').mockResolvedValue({ teamId });
      const response = getTeamById(req, mockRes);
      await flushPromises();

      expect(findByIdSpy).toHaveBeenCalledWith(teamId);
      assertResMock(200, { teamId }, response, mockRes);
    });
  });
});
