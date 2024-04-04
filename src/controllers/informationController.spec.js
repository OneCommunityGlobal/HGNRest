// const informationController = require('./informationController');
// const {
//     mockReq,
//     mockRes,
//     mongoHelper: {dbConnect, dbDisconnect },
// } = require('../test');
// const Information = require('../models/information');

// jest.mock('../utilities/nodeCache');

// const cache = require('../utilities/nodeCache');

// jest.mock('node-fetch');

// const fetch = require('node-fetch');

// const makeSut = () => {
//     const { getInformations } = informationController(Information);
  
//     return {
//         getInformations,
//     };
// };

// const assertResMock = (statusCode, message, response) => {
//     expect(mockRes.status).toHaveBeenCalledWith(statusCode);
//     expect(mockRes.send).toHaveBeenCalledWith(message);
//     expect(response).toBeUndefined();
// };

// const makeMockGetCache = (value) => {
//     const getCacheObject = {
//       getCache: () => {},
//     };

//     const mockGetCache = jest.spyOn(getCacheObject, 'getCache').mockImplementation(() => value);

//     cache.mockImplementation(() => getCacheObject);
  
//     return mockGetCache;
// };
  
//   const makeMockSortAndFind = (value = null) => {
//     const databaseUsers = value;
  
//     const sortObject = {
//       sort: () => {},
//     };
  
//     const mockSort = jest
//       .spyOn(sortObject, 'sort')
//       .mockImplementationOnce(() => Promise.resolve(databaseUsers));
  
//     const findSpy = jest.spyOn(Information, 'find').mockReturnValueOnce(sortObject);
  
//     return {
//       databaseUsers,
//       mockSort,
//       findSpy,
//     };
// };
// describe('informationController module', () => {
//     beforeAll(async () => {
//       await dbConnect();
//     });

//     beforeEach(() => {
//       jest.clearAllMocks();
//     });

//     afterAll(async () => {
//       await dbDisconnect();
//     });

  
//     describe('getInformations function', () => {    
//         test("Ensure getInformations returns 404 if the informations key doesn't exist in NodeCache", async () => {
//           cache.getCache.mockReturnValue(undefined); // Simulate cache miss

//           // Information.find.mockImplementation(() => {
//           //   throw new Error('Database error'); // Simulate database query failure
//           // });
//           // const mockGetCache = makeMockGetCache('');
    
//           const { getInformations } = makeSut();

//           // const { findSpy, mockSort } = makeMockSortAndFind();
    
//           // const response = await getInformations(mockReq, mockRes);
    
//           // expect(findSpy).toHaveBeenCalledWith(
//           //   {},
//           //   'infoName infoContent visibility',
//           // );
    
//           // expect(mockSort).toHaveBeenCalledWith({
//           //   lastName: 1,
//           // });
    
//           // expect(mockGetCache).toHaveBeenCalledWith('informations');
//           // assertResMock(404, { error: 'Database error' }, response);
//         });
    
//         // test('Ensure getInformations returns 404 if any error occurs while getting informations', async () => {
//         //   const errMsg = 'getCache failed';
    
//         //   cache.mockImplementationOnce(() => ({
//         //     getCache: jest.fn(() => {
//         //       throw new Error(errMsg);
//         //     }),
//         //   }));
    
//         //   const { getInformations } = makeSut();
    
//         //   const { findSpy, mockSort } = makeMockSortAndFind();
    
//         //   const response = await getInformations(mockReq, mockRes);
    
//         //   expect(findSpy).toHaveBeenCalledWith(
//         //     {},
//         //     'infoName infoContent visibility',
//         //   );
    
//         //   expect(mockSort).toHaveBeenCalledWith({
//         //     lastName: 1,
//         //   });
    
//         //   assertResMock(404, new Error(errMsg), response);
//         // });
    
//         // test('Ensure getInformations returns 200 if the informations key exists in NodeCache', async () => {
//         //   const data = '[{"infoName": "roleInfo"}]';
    
//         //   const mockGetCache = makeMockGetCache(data);
    
//         //   const { getInformations } = makeSut();
    
//         //   const { findSpy, mockSort } = makeMockSortAndFind();
    
//         //   const response = await getInformations(mockReq, mockRes);
      
//         //   expect(findSpy).toHaveBeenCalledWith(
//         //     {},
//         //     'infoName infoContent visibility',
//         //   );
    
//         //   expect(mockSort).toHaveBeenCalledWith({
//         //     lastName: 1,
//         //   });
    
//         //   expect(mockGetCache).toHaveBeenCalledWith('informations');
    
//         //   assertResMock(200, JSON.parse(data), response);
//         // });
    
//         // test('Ensure getInformations returns 200 if there are information in the database', async () => {
//         //   const setCacheObject = {
//         //     setCache: () => {},
//         //   };
    
//         //   const mockSetCache = jest
//         //     .spyOn(setCacheObject, 'setCache')
//         //     .mockImplementation(() => undefined);
    
//         //   cache.mockImplementation(() => setCacheObject);
    
//         //   const { getInformations } = makeSut();

    
//         //   const databaseInfos = [
//         //     {
//         //       infoName: 'testInfo',
//         //       infoContent: 'Unspecified',
//         //       visibility: '0'
//         //     },
//         //   ];
    
//         //   const { findSpy, mockSort } = makeMockSortAndFind(databaseInfos);
    
//         //   const response = await getInformations(mockReq, mockRes);
      
//         //   expect(findSpy).toHaveBeenCalledWith(
//         //     {},
//         //     'infoName infoContent visibility',
//         //   );
    
//         //   expect(mockSort).toHaveBeenCalledWith({
//         //     lastName: 1,
//         //   });
    
//         //   expect(mockSetCache).toHaveBeenCalledWith('informations', JSON.stringify(databaseInfos));
    
//         //   assertResMock(200, databaseInfos, response);
//         // });
//       });

// }); 
  
// Assume jest.setup.js is configured for global mocks if needed
import Information, { find } from '../models/information'; // Adjust path as necessary
import { getCache as _getCache, setCache as _setCache } from '../utilities/nodeCache'; // Adjust path as necessary
import informationController from './informationController'; // Adjust path as necessary

jest.mock('../utilities/nodeCache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}));
jest.mock('../models/information');

describe('informationController', () => {
  const mockReq = {};
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInformations function', () => {
    test('returns cached informations if available', async () => {
      const cachedData = [{ infoName: 'Cached Data' }];
      _getCache.mockReturnValue(cachedData);

      const { getInformations } = informationController(Information);
      await getInformations(mockReq, mockRes);

      expect(_getCache).toHaveBeenCalledWith('informations');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(cachedData);
      expect(find).not.toHaveBeenCalled();
    });

    test('queries database and caches result if cache is empty', async () => {
      _getCache.mockReturnValue(null);
      const dbData = [{ infoName: 'DB Data' }];
      find.mockResolvedValue(dbData);

      const { getInformations } = informationController(Information);
      await getInformations(mockReq, mockRes);

      expect(_getCache).toHaveBeenCalledWith('informations');
      expect(find).toHaveBeenCalled();
      expect(_setCache).toHaveBeenCalledWith('informations', dbData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(dbData);
    });

    test('returns 404 if database query fails', async () => {
      _getCache.mockReturnValue(null);
      find.mockRejectedValue(new Error('Database error'));

      const { getInformations } = informationController(Information);
      await getInformations(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalled(); // You might want to check the error structure
    });
  });
});
