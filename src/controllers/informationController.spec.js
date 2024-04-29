/* eslint-disable no-unused-vars */
// const mongoose = require('mongoose');
const informationController = require('./informationController');
const { mockReq, mockRes, assertResMock } = require('../test');
const Information = require('../models/information');
const escapeRegex = require('../utilities/escapeRegex');
// const fetch = require('node-fetch');
jest.mock('../utilities/nodeCache');
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-promise-reject-errors */

const cache = require('../utilities/nodeCache');

// jest.mock('node-fetch');

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
// Define flushPromises function
// const flushPromises = () => new Promise(resolve => setImmediate(resolve));
const flushPromises = () => new Promise(setImmediate);

// const makeMockSortAndFind = (value = null) => {
//   const sortObject = {
//     sort: () => {},
//   };

//   const mockSort = jest
//     .spyOn(sortObject, 'sort')
//     .mockImplementationOnce(() => Promise.reject(value));

//   const findSpy = jest.spyOn(Information, 'find').mockReturnValueOnce(sortObject);

//   return {
//     mockSort,
//     findSpy,
//   };
// };

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
  describe('addInformation function', () => {
    test('Ensure addInformation returns 500 if any error when adding any information', async () => {
      const { addInformation } = makeSut();
      jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.reject({ error: 'Error when finding infoName' }));
      const response = addInformation(mockReq, mockRes);
      await flushPromises();
      assertResMock(500, { error: 'Error when finding infoName' }, response, mockRes);
    });
    // test('Ensure addInformation returns 400 if duplicate info Name', async () => {
    //   // const sortObject = { sort: () => { } };
    //   const { addInformation } = makeSut();
    //   const data = [{infoName: 'testInfo'}];
    //   const findSpy = jest.spyOn(Information, 'find').mockImplementationOnce(() => Promise.resolve({ error: 'Error when finding infoName' }));
    //   // const sortSpy = jest
    //   //           .spyOn(sortObject, 'sort')
    //   //           .mockImplementationOnce(() => Promise.resolve(data));
    //   const newMockReq = {
    //     body: {
    //         ...mockReq.body,
    //         infoName: "testInfo",
    //     },
    // };
    //   const response = addInformation(newMockReq, mockRes);
    //   await flushPromises();
    //   // expect(findSpy).toHaveBeenCalledWith({
    //   //   infoName: { $regex: escapeRegex(newMockReq.body.infoName), $options: 'i' },
    //   // });
    //   // expect(sortSpy).toHaveBeenCalledWith({
    //   //   visibility: 1,
    //   // });
    //   expect(mockRes.status).toHaveBeenCalledWith(500);

    //   // assertResMock(400, { error: `Info Name must be unique. Another infoName with name ${newMockReq.body.infoName} already exists. Please note that info names are case insensitive`}, response, mockRes);
    //   });
  });
  describe('getInformations function', () => {
    test('Ensure getInformations returns 500 if any error when no informations key and catching the any information', async () => {
      const data = '';
      const getCacheObject = {
        getCache: () => {},
      };
      jest.spyOn(getCacheObject, 'getCache').mockImplementationOnce(() => data);
      cache.mockReturnValueOnce(() => getCacheObject);

      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error()));

      const { getInformations } = makeSut();

      const response = getInformations(mockReq, mockRes);
      await flushPromises();
      expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
      assertResMock(
        500,
        { error: 'Error when finding informations and any information' },
        response,
        mockRes,
      );
    });
    // test('Ensure getInformations returns 200 when no informations key and has any information', async () => {
    //   const data = [{infoName: "testInfo", infoContent: "some", visibility: "0"}];
    //   const getCacheObject = {
    //     getCache: () => {},
    //   };
    //   const findObject = {
    //     find: () => {},
    //   }
    //   jest.spyOn(getCacheObject, 'getCache').mockImplementationOnce(() => '[]');
    //   cache.mockReturnValueOnce(() => getCacheObject);

    //   const findSpy = jest
    //     .spyOn(Information , 'find')
    //     .mockImplementationOnce(() => Promise.resolve(...data));

    //   const { getInformations } = makeSut();
    //   const newMockReq = {
    //         body: {
    //             ...mockReq.body,
    //             ...data,
    //         }
    //       }
    //   const response = getInformations(newMockReq, mockRes);
    //   await flushPromises();
    //   // expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
    //   expect(mockRes.status).toHaveBeenCalledWith(200);
    //   // assertResMock(
    //   //   500,
    //   //   { error: 'Error when finding informations and any information' },
    //   //   response,
    //   //   mockRes,
    //   // );
    // });

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
  });
  describe('deleteInformation function', () => {
    test('Ensure deleteInformation returns 400 if any error when finding and delete information', async () => {
      const errorMsg = 'Error when finding and deleting information by Id';
      const { deleteInformation } = makeSut();
      jest
        .spyOn(Information, 'findOneAndDelete')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));
      const response = deleteInformation(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });
  });
  describe('updateInformation function', () => {
    test('Ensure updateInformation returns 400 if any error when finding and update information', async () => {
      const errorMsg = 'Error when finding and updating information by Id';
      const { updateInformation } = makeSut();
      jest
        .spyOn(Information, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));
      const response = updateInformation(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });
  });
});
