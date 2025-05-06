const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getAllTeams, getTeamById } = teamController(Team);
  return {
    getAllTeams,
    getTeamById,
  };
};

const flushPromises = () => new Promise(setImmediate);

describe('teamController', () => {
  afterEach(() => {
    jest.clearAllMocks();
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
