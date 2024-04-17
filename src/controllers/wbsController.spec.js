// const mongoose = require('mongoose');
// const Project = require('../models/project');
// const Task = require('../models/task');
const WBS = require('../models/wbs');
const wbsController = require('./wbsController');
// const helper = require('../utilities/permissions');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getAllWBS } = wbsController(WBS);

  return { getAllWBS };
};

const flushPromises = async () => new Promise(setImmediate);

// const mockHasPermission = (value) =>
// jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

describe('Wbs Controller', () => {
  beforeEach(() => {
    mockReq.params.projectId = '6237f9af9820a0134ca79c5d';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllWBS method', () => {
    test('Returns 404 if an error occurs when querying the database.', async () => {
      const { getAllWBS } = makeSut();

      const errMsg = 'Error when sorting!';
      const findObj = { sort: () => {} };

      const findSpy = jest.spyOn(WBS, 'find').mockReturnValueOnce(findObj);
      const sortSpy = jest.spyOn(findObj, 'sort').mockRejectedValueOnce(new Error(errMsg));

      const response = getAllWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, new Error(errMsg), response, mockRes);
      expect(findSpy).toHaveBeenCalledWith(
        { projectId: { $in: [mockReq.params.projectId] } },
        'wbsName isActive modifiedDatetime',
      );
      expect(sortSpy).toHaveBeenCalledWith({ modifiedDatetime: -1 });
    });

    test('Returns 200 if all is successful', async () => {
      const { getAllWBS } = makeSut();

      const findObj = { sort: () => {} };
      const result = [{ id: 'randomId' }];

      const findSpy = jest.spyOn(WBS, 'find').mockReturnValueOnce(findObj);
      const sortSpy = jest.spyOn(findObj, 'sort').mockResolvedValueOnce(result);

      const response = getAllWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, result, response, mockRes);
      expect(findSpy).toHaveBeenCalledWith(
        { projectId: { $in: [mockReq.params.projectId] } },
        'wbsName isActive modifiedDatetime',
      );
      expect(sortSpy).toHaveBeenCalledWith({ modifiedDatetime: -1 });
    });
  });
});
