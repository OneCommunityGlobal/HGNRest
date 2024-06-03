/* eslint-disable no-unused-vars */
// const mongoose = require('mongoose');
const informationController = require('./informationController');
const {
  mockReq,
  mockRes,
  assertResMock,
  mongoHelper: { dbConnect, dbDisconnect },
} = require('../test');
const Information = require('../models/information');
const escapeRegex = require('../utilities/escapeRegex');

/* eslint-disable no-unused-vars */
/* eslint-disable prefer-promise-reject-errors */

const cache = require('../utilities/nodeCache');

jest.mock('../utilities/nodeCache');

const makeSut = () => {
  const { addInformation, getInformations, updateInformation, deleteInformation } =
    informationController(Information);

  return {
    addInformation,
    getInformations,
    updateInformation,
    deleteInformation,
  };
};
// Define flushPromises function));
const flushPromises = () => new Promise(setImmediate);

// const makeMockGetCache = (value) => {
//   const getCacheObject = {
//     getCache: () => {},
//   };

//   const mockGetCache = jest.spyOn(getCacheObject, 'getCache').mockImplementation(() => value);

//   cache.mockImplementation(() => getCacheObject);

//   return mockGetCache;
// };
// const makeMockHasCache = (value) => {
//   const cacheObject = {
//     hasCache: () => {},
//   };

//   const mockHasCache = jest.spyOn(cacheObject, 'hasCache').mockImplementation(() => value);

//   cache.mockImplementation(() => cacheObject);

//   return mockHasCache;
// };

describe('informationController module', () => {
  beforeAll(async () => {
    await dbConnect();
  });
  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbDisconnect();
  });
  describe('addInformation function', () => {
    test('Ensure addInformation returns 500 if any error when adding any information', async () => {
      const { addInformation } = makeSut();
      const newMockReq = {
        ...mockReq.body,
        body: {
          infoName: 'some infoName',
        },
      };
      jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding')));
      const response = addInformation(newMockReq, mockRes);
      await flushPromises();
      assertResMock(500, { error: new Error('Error when finding') }, response, mockRes);
    });
    test('Ensure addInformation returns 403 if duplicate info Name', async () => {
      const { addInformation } = makeSut();
      const data = [{ infoName: 'test Info' }];
      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve(data));
      const newMockReq = {
        body: {
          ...mockReq.body,
          infoName: 'test Info',
        },
      };
      const response = addInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findSpy).toHaveBeenCalledWith({
        infoName: { $regex: escapeRegex(newMockReq.body.infoName), $options: 'i' },
      });
      assertResMock(
        400,
        {
          error: `Info Name must be unique. Another infoName with name ${newMockReq.body.infoName} already exists. Please note that info names are case insensitive`,
        },
        response,
        mockRes,
      );
    });
    test('Ensure addInformations returns 400 if any error when saving new Information', async () => {
      const { addInformation } = makeSut();
      const newMockReq = {
        body: {
          ...mockReq.body,
          infoName: 'some Info',
        },
      };
      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve(true));
      jest
        .spyOn(Information.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when saving')));
      const response = addInformation(newMockReq, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({
        infoName: { $regex: escapeRegex(newMockReq.body.infoName), $options: 'i' },
      });
      assertResMock(400, new Error('Error when saving'), response, mockRes);
    });
    test('Ensure addInformation returns 201 if creating information successfully', async () => {
      const { addInformation } = makeSut();
      const data = [
        {
          infoName: 'mockAdd',
          infoContent: 'mockContent',
          visibility: '1',
        },
      ];
      // const mockHasCache = makeMockGetCache(["info"]);

      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve(true));
      jest.spyOn(Information.prototype, 'save').mockImplementationOnce(() => Promise.resolve(data));
      const newMockReq = {
        body: {
          ...mockReq.body,
          infoName: 'some addInfo',
          infoContent: '1',
          visibility: '1',
        },
      };
      const response = addInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findSpy).toHaveBeenCalledWith({
        infoName: { $regex: escapeRegex(newMockReq.body.infoName), $options: 'i' },
      });
      // expect(mockHasCache).toHaveBeenCalledWith('informations');
      assertResMock(201, data, response, mockRes);
    });
  });
  // describe('getInformations function', () => {
  //   test('Ensure getInformations returns 500 if any error when no informations key and catching the any information', async () => {
  //     const data = '';
  //     const getCacheObject = {
  //       getCache: () => {},
  //     };
  //     jest.spyOn(getCacheObject, 'getCache').mockImplementationOnce(() => data);
  //     cache.mockReturnValueOnce(() => getCacheObject);

  //     const findSpy = jest
  //       .spyOn(Information, 'find')
  //       .mockImplementationOnce(() => Promise.reject(new Error('Error when finding infoName')));

  //     const { getInformations } = makeSut();

  //     const response = getInformations(mockReq, mockRes);
  //     await flushPromises();
  //     expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
  //     assertResMock(500, new Error('Error when finding infoName'), response, mockRes);
  //   });

  //   test('Ensure getInformations returns 200 when no informations key and has any information', async () => {
  //     const data = [{ infoName: 'testInfo', infoContent: 'some', visibility: '0' }];
  //     const setCacheObject = {
  //       setCache: () => {},
  //     };
  //     jest.spyOn(setCacheObject, 'setCache').mockImplementationOnce(() => undefined);
  //     cache.mockReturnValueOnce(() => setCacheObject);

  //     const findSpy = jest.spyOn(Information, 'find').mockResolvedValue(data);

  //     const { getInformations } = makeSut();
  //     const newMockReq = {
  //       body: {
  //         ...mockReq.body,
  //         ...data,
  //       },
  //     };
  //     const response = getInformations(newMockReq, mockRes);
  //     await flushPromises();
  //     // jest.spyOn.mockResolvedValue
  //     expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
  //     // expect(mockSetCache).toHaveBeenCalledWith('informations', data);
  //     assertResMock(200, data, response, mockRes);
  //   });

  //   //   const mockGetCache = makeMockGetCache();

  //   //   const { getInformations } = makeSut();

  //   //   const { findSpy, mockSort } = makeMockSortAndFind();

  //   //   getInformations(mockReq, mockRes);

  //   //   await flushPromises();

  //   //   expect(mockGetCache).toHaveBeenCalledWith('informations');

  //   //   expect(findSpy).toHaveBeenCalledWith(
  //   //     {},
  //   //     'infoName infoContent visibility'
  //   //   );

  //   //   expect(mockSort).toHaveBeenCalledWith({
  //   //     visibility: 1,
  //   //   });
  //   //   expect(mockRes.status).toHaveBeenCalledWith(404);
  //   // });
  // });
  // describe('deleteInformation function', () => {
  //   test('Ensure deleteInformation returns 400 if any error when finding and delete information', async () => {
  //     const errorMsg = 'Error when finding and deleting information by Id';
  //     const { deleteInformation } = makeSut();
  //     jest
  //       .spyOn(Information, 'findOneAndDelete')
  //       .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));
  //     const response = deleteInformation(mockReq, mockRes);
  //     await flushPromises();

  //     assertResMock(400, new Error(errorMsg), response, mockRes);
  //   });
  // });
  // describe('updateInformation function', () => {
  //   test('Ensure updateInformation returns 400 if any error when finding and update information', async () => {
  //     const errorMsg = 'Error when finding and updating information by Id';
  //     const { updateInformation } = makeSut();
  //     jest
  //       .spyOn(Information, 'findOneAndUpdate')
  //       .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));
  //     const response = updateInformation(mockReq, mockRes);
  //     await flushPromises();

  //     assertResMock(400, new Error(errorMsg), response, mockRes);
  //   });
  // });
});
