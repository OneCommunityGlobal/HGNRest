/* eslint-disable no-unused-vars */
// const mongoose = require('mongoose');
const mongoose = require('mongoose');

jest.mock('../utilities/nodeCache');
const cache = require('../utilities/nodeCache');
const Information = require('../models/information');
const escapeRegex = require('../utilities/escapeRegex');
const informationController = require('./informationController');
const { mockReq, mockRes, assertResMock } = require('../test');

/* eslint-disable no-unused-vars */
/* eslint-disable prefer-promise-reject-errors */

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

const makeMockCache = (method, value) => {
  const cacheObject = {
    getCache: jest.fn(),
    removeCache: jest.fn(),
    hasCache: jest.fn(),
    setCache: jest.fn(),
  };

  const mockCache = jest.spyOn(cacheObject, method).mockImplementationOnce(() => value);

  cache.mockImplementationOnce(() => cacheObject);

  return { mockCache, cacheObject };
};

describe('informationController module', () => {
  beforeEach(() => {});
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('addInformation function', () => {
    test('Ensure addInformation returns 500 if any error when finding any information', async () => {
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
    test('Ensure addInformation returns 400 if duplicate info Name', async () => {
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

    test('Ensure addInformation returns 201 if creating information successfully when no cache', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', '');
      const { addInformation } = makeSut();
      const data = {
        infoName: 'mockAdd',
        infoContent: 'mockContent',
        visibility: '1',
      };

      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve([]));
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
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      assertResMock(201, data, response, mockRes);
    });
    test('Ensure addInformation returns 201 if creating information successfully', async () => {
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', '[{_id: 1}]');
      const removeCacheMock = jest
        .spyOn(cacheObject, 'removeCache')
        .mockImplementationOnce(() => null);
      const { addInformation } = makeSut();
      const data = [
        {
          infoName: 'mockAdd',
          infoContent: 'mockContent',
          visibility: '1',
        },
      ];

      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve([]));
      jest.spyOn(Information.prototype, 'save').mockImplementationOnce(() => Promise.resolve(data));
      const newMockReq = {
        body: {
          ...mockReq.body,
          infoName: 'some addInfo',
          infoContent: '1',
          visibility: '1',
        },
      };
      addInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findSpy).toHaveBeenCalledWith({
        infoName: { $regex: escapeRegex(newMockReq.body.infoName), $options: 'i' },
      });
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(removeCacheMock).toHaveBeenCalledWith('informations');
    });
  });
  describe('getInformations function', () => {
    test('Ensure getInformations returns 200 if when informations key in cache', async () => {
      const data = [
        {
          _id: 1,
          infoName: 'infoName',
          infoContent: 'infoContent',
          visibility: '1',
        },
      ];
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', data);
      const getCacheMock = jest.spyOn(cacheObject, 'getCache').mockImplementationOnce(() => data);
      const { getInformations } = makeSut();

      const response = getInformations(mockReq, mockRes);
      await flushPromises();
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(getCacheMock).toHaveBeenCalledWith('informations');
      assertResMock(200, data, response, mockRes);
    });
    test('Ensure getInformations returns 404 if any error when no informations key and catch error in finding', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', '');
      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding information')));
      const { getInformations } = makeSut();

      const response = getInformations(mockReq, mockRes);
      await flushPromises();
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
      assertResMock(404, new Error('Error when finding information'), response, mockRes);
    });

    test('Ensure getInformations returns 200 when no informations key and no duplicated information', async () => {
      const data = [
        {
          infoName: 'mockAdd',
          infoContent: 'mockContent',
          visibility: '1',
        },
      ];
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', '');
      const findSpy = jest
        .spyOn(Information, 'find')
        .mockImplementationOnce(() => Promise.resolve(data));
      const setCacheMock = jest.spyOn(cacheObject, 'setCache').mockImplementationOnce(() => data);

      const { getInformations } = makeSut();
      const newMockReq = {
        body: {
          ...mockReq.body,
          infoName: 'some getInfo',
          infoContent: '1',
          visibility: '1',
        },
      };
      const response = getInformations(newMockReq, mockRes);
      await flushPromises();
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(findSpy).toHaveBeenCalledWith({}, 'infoName infoContent visibility');
      expect(setCacheMock).toHaveBeenCalledWith('informations', data);
      assertResMock(200, data, response, mockRes);
    });
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
    test('Ensure deleteInformation returns 200 if delete information successfully no cache', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', '');
      const deletedData = {
        id: '601acda376045c7879d13a77',
        infoName: 'deletedInfo',
        infoContent: 'deleted',
        visibility: '1',
      };
      const { deleteInformation } = makeSut();
      const newMockReq = {
        ...mockReq.body,
        params: {
          ...mockReq.params,
          id: '601acda376045c7879d13a77',
        },
      };
      const findOneDeleteSpy = jest
        .spyOn(Information, 'findOneAndDelete')
        .mockImplementationOnce(() => Promise.resolve(deletedData));
      const response = deleteInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findOneDeleteSpy).toHaveBeenCalledWith({ _id: deletedData.id });
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      assertResMock(200, deletedData, response, mockRes);
    });
    test('Ensure deleteInformation returns if delete information successfully and has cache', async () => {
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', '[{_id:123}]');
      const removeCacheMock = jest
        .spyOn(cacheObject, 'removeCache')
        .mockImplementationOnce(() => null);
      const deletedData = {
        id: '601acda376045c7879d13a77',
        infoName: 'deletedInfo',
        infoContent: 'deleted',
        visibility: '1',
      };
      const { deleteInformation } = makeSut();
      const newMockReq = {
        ...mockReq.body,
        params: {
          ...mockReq.params,
          id: '601acda376045c7879d13a77',
          infoName: 'deletedInfo',
          infoContent: 'deleted',
          visibility: '1',
        },
      };
      const findOneDeleteSpy = jest
        .spyOn(Information, 'findOneAndDelete')
        .mockImplementationOnce(() => Promise.resolve(deletedData));
      deleteInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findOneDeleteSpy).toHaveBeenCalledWith({ _id: deletedData.id });
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(removeCacheMock).toHaveBeenCalledWith('informations');
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
    test('Ensure updateInformation returns 200 if finding and update information successfuly when nocache', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', '');
      const data = {
        id: '601acda376045c7879d13a77',
        infoName: 'updatedInfo',
        infoContent: 'updated',
        visibility: '1',
      };
      const newMockReq = {
        body: {
          id: '601acda376045c7879d13a77',
          infoName: 'oldInfo',
          infoContent: 'old',
          visibility: '0',
        },
        params: {
          ...mockReq.params,
          id: '601acda376045c7879d13a77',
        },
      };
      const findOneUpdateSpy = jest
        .spyOn(Information, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(data));
      const { updateInformation } = makeSut();
      const response = updateInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findOneUpdateSpy).toHaveBeenCalledWith({ _id: data.id }, newMockReq.body, {
        new: true,
      });
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      assertResMock(200, data, response, mockRes);
    });
    test('Ensure updateInformation returns if finding and update information successfuly when hascache', async () => {
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', '[{_id:123}]');
      const removeCacheMock = jest
        .spyOn(cacheObject, 'removeCache')
        .mockImplementationOnce(() => null);
      const data = {
        id: '601acda376045c7879d13a77',
        infoName: 'updatedInfo',
        infoContent: 'updated',
        visibility: '1',
      };
      const newMockReq = {
        body: {
          id: '601acda376045c7879d13a77',
          infoName: 'oldInfo',
          infoContent: 'old',
          visibility: '0',
        },
        params: {
          ...mockReq.params,
          id: '601acda376045c7879d13a77',
        },
      };
      const findOneUpdateSpy = jest
        .spyOn(Information, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(data));
      const { updateInformation } = makeSut();
      updateInformation(newMockReq, mockRes);
      await flushPromises();
      expect(findOneUpdateSpy).toHaveBeenCalledWith({ _id: data.id }, newMockReq.body, {
        new: true,
      });
      expect(hasCacheMock).toHaveBeenCalledWith('informations');
      expect(removeCacheMock).toHaveBeenCalledWith('informations');
    });
  });
});
