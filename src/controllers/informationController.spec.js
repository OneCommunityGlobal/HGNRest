const mongoose = require('mongoose');
const informationController = require('./informationController');
const { mockReq, mockRes, assertResMock } = require('../test');
const Information = require('../models/information');
// const fetch = require('node-fetch');
jest.mock('../utilities/nodeCache');

const cache = require('../utilities/nodeCache');

// jest.mock('node-fetch');

const makeSut = () => {
  const { getInformations } = informationController(Information);

  return {
    getInformations,
  };
};
// Define flushPromises function
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

const makeMockGetCache = (value) => {
  const getCacheObject = {
    getCache: () => {},
  };

  const mockGetCache = jest.spyOn(getCacheObject, 'getCache').mockImplementation(() => value);

  cache.mockImplementation(() => getCacheObject);

  return mockGetCache;
};

const makeMockSortAndFind = (value = null) => {
  const sortObject = {
    sort: () => {},
  };

  const mockSort = jest
    .spyOn(sortObject, 'sort')
    .mockImplementationOnce(() => Promise.reject(value));

  const findSpy = jest.spyOn(Information, 'find').mockReturnValueOnce(sortObject);

  return {
    mockSort,
    findSpy
  };
};

describe('informationController module', () => {
  beforeAll(async () => {
    // await dbConnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // await dbDisconnect();
  });
  describe('getInformations function', () => {
    test('Ensure getInformations returns 200 if the informations key exists in NodeCache', async () => {
      const data = '[{infoName: "someInfo", infoContent: "Content1", visibility: "0"}]';

      const mockGetCache = makeMockGetCache(data);

      const { getInformations } = makeSut();

      const response = getInformations(mockReq, mockRes);

      expect(mockGetCache).toHaveBeenCalledWith('informations');

      assertResMock(200, data, response, mockRes);
    });

    test("Ensure getInformations returns 404 if there are no information in the database and any error occurs when getting the information", async () => {

      const mockGetCache = makeMockGetCache();

      const { getInformations } = makeSut();

      const { findSpy, mockSort } = makeMockSortAndFind();

      getInformations(mockReq, mockRes);

      await flushPromises();

      expect(mockGetCache).toHaveBeenCalledWith('informations');

      expect(findSpy).toHaveBeenCalledWith(
        {},
        'infoName infoContent visibility'
      );

      expect(mockSort).toHaveBeenCalledWith({
        visibility: 1,
      });
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
