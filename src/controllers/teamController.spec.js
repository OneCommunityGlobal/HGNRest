const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes } = require('../test');

const makeSut = () => {
  const { getAllTeams } = teamController(Team);
  return {
    getAllTeams,
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

  describe('getAllTeams', () => {
    test('should return all teams sorted by name', async () => {
      const team1 = {
        teamName: 'Team A',
      };
      const team2 = {
        teamName: 'Team B',
      };

      const mockSort = jest.spyOn(sortObject, 'sort').mockResolvedValue([team1, team2]);
      const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);
      const { getAllTeams } = makeSut();

      getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith([team1, team2]);
    });

    test('should return 404 if an error occurs', async () => {
      const { getAllTeams } = makeSut();

      const mockSort = jest.spyOn(sortObject, 'sort').mockRejectedValueOnce(new Error('any error'));

      const findSpy = jest.spyOn(Team, 'find').mockReturnValue(sortObject);

      getAllTeams(mockReq, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ teamName: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(new Error('any error'));
    });
  });
});
