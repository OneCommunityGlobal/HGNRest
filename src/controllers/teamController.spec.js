const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes } = require('../test');
const helper = require('../utilities/permissions');

const makeSut = () => {
  const { getAllTeams, getTeamById, postTeam } = teamController(Team);
  return {
    getAllTeams,
    getTeamById,
    postTeam,
  };
};

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const flushPromises = () => new Promise(setImmediate);

describe('teamController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const sortObject = {
    sort: () => {},
  };

  const error = new Error('any error');

  describe('getAllTeams', () => {
    test('should return all teams sorted by name', async () => {
      const team1 = {
        teamName: 'Team A',
      };
      const team2 = {
        teamName: 'Team B',
      };

      const mockSortResovledValue = [team1, team2];
      const mockSort = jest.spyOn(sortObject, 'sort').mockResolvedValue(mockSortResovledValue);
      const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);
      const { getAllTeams } = makeSut();
      getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockSortResovledValue);
    });

    test('should return 404 if an error occurs', async () => {
      const { getAllTeams } = makeSut();

      const mockSort = jest.spyOn(sortObject, 'sort').mockRejectedValueOnce(error);
      const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);
      getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('getTeamById', () => {
    test('should return a team by ID', async () => {
      const { getTeamById } = makeSut();
      const teamId = '5a8e21f00317bc';
      const findByIdSpy = jest.spyOn(Team, 'findById').mockResolvedValue({ teamId });
      getTeamById(mockReq, mockRes);
      await flushPromises();

      expect(findByIdSpy).toHaveBeenCalledWith(teamId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({ teamId });
    });

    test('should return 404 if the team is not found', async () => {
      const { getTeamById } = makeSut();
      const req = { params: { teamId: 'nonExistentTeamId' } };
      const findByIdSpy = jest.spyOn(Team, 'findById').mockRejectedValue(error);
      getTeamById(req, mockRes);
      await flushPromises();

      expect(findByIdSpy).toHaveBeenCalledWith(req.params.teamId);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('postTeam', () => {
    test('should reject unauthorized request', async () => {
      const { postTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'You are not authorized to create teams.',
      });
      expect(response).toBeUndefined();
    });

    test('should reject request if team name already exists', async () => {
      const { postTeam } = makeSut();
      jest.spyOn(Team, 'exists').mockResolvedValue(true);
      const hasPermissionSpy = mockHasPermission(true);
      const response = await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: `Team Name "${mockReq.body.teamName}" already exists`,
      });
      expect(response).toBeUndefined();
    });

    test('should successfully create a team', async () => {
      const { postTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const mockSaveResolvedValue = { teamName: 'Unique Team', isActive: true };
      jest.spyOn(Team, 'exists').mockResolvedValue(false);
      const mockSave = jest.spyOn(Team.prototype, 'save').mockResolvedValue(mockSaveResolvedValue);

      await postTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
      expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
      expect(mockSave).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith(mockSaveResolvedValue);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
