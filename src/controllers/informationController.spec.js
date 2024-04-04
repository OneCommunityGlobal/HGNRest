const informationController = require('./informationController');
const {
    mockReq,
    mockRes,
    mongoHelper: {dbConnect, dbDisconnect },
} = require('../test');
const Information = require('../models/information');

jest.mock('../utilities/nodeCache');

// jest.mock('node-fetch');

// jest.mock('../utilities/nodeCache', () => ({
//   hasCache: jest.fn(),
//   getCache: jest.fn(),
//   setCache: jest.fn(),
// }));
const cache = require('../utilities/nodeCache');

// eslint-disable-next-line import/no-extraneous-dependencies, import/order
// const fetch = require('node-fetch');
// const { error } = require('console');

const makeSut = () => {
    const { getInformations } = informationController(Information);
  
    return {
        getInformations,
    };
};

const assertResMock = (statusCode, message, response) => {
    expect(mockRes.status).toHaveBeenCalledWith(statusCode);
    expect(mockRes.send).toHaveBeenCalledWith(message);
    expect(response).toBeUndefined();
};

const makeMockGetCache = (value) => {
    const getCacheObject = {
      getCache: () => {},
    };

    const mockGetCache = jest.spyOn(getCacheObject, 'getCache').mockImplementation(() => value);

    cache.mockImplementation(() => getCacheObject);
  
    return mockGetCache;
};
  
  const makeMockSortAndFind = (value = null) => {
    const databaseUsers = value;
  
    const sortObject = {
      sort: () => {},
    };
  
    const mockSort = jest
      .spyOn(sortObject, 'sort')
      .mockImplementationOnce(() => Promise.resolve(databaseUsers));
  
    const findSpy = jest.spyOn(Information, 'find').mockReturnValueOnce(sortObject);
  
    return {
      databaseUsers,
      mockSort,
      findSpy,
    };
};
describe('informationController module', () => {
    beforeAll(async () => {
      await dbConnect();
    });
  
    beforeEach(() => {
      mockReq.body.role = 'any_role';
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    afterAll(async () => {
      await dbDisconnect();
    });
    describe('getInformations function', () => {    
        test("Ensure getInformations returns 404 if the informations key doesn't exist in NodeCache", async () => {

          const mockGetCache = makeMockGetCache('');
    
          const { getInformations } = makeSut();

          const { findSpy, mockSort } = makeMockSortAndFind();
    
          const response = await getInformations(mockReq, mockRes);
    
          expect(findSpy).toHaveBeenCalledWith(
            {},
            'infoName infoContent visibility',
          );
    
          expect(mockSort).toHaveBeenCalledWith({
            lastName: 1,
          });
    
          expect(mockGetCache).toHaveBeenCalledWith('informations');
          assertResMock(404, { error: 'Database error' }, response);
        });
    
        // test('Ensure getInformations returns 404 if any error occurs while getting informations', async () => {
        //   const errMsg = 'getCache failed';
    
        //   cache.mockImplementationOnce(() => ({
        //     getCache: jest.fn(() => {
        //       throw new Error(errMsg);
        //     }),
        //   }));
    
        //   const { getInformations } = makeSut();
    
        //   const { findSpy, mockSort } = makeMockSortAndFind();
    
        //   const response = await getInformations(mockReq, mockRes);
    
        //   expect(findSpy).toHaveBeenCalledWith(
        //     {},
        //     'infoName infoContent visibility',
        //   );
    
        //   expect(mockSort).toHaveBeenCalledWith({
        //     lastName: 1,
        //   });
    
        //   assertResMock(404, new Error(errMsg), response);
        // });
    
        // test('Ensure getInformations returns 200 if the informations key exists in NodeCache', async () => {
        //   const data = '[{"infoName": "roleInfo"}]';
    
        //   const mockGetCache = makeMockGetCache(data);
    
        //   const { getInformations } = makeSut();
    
        //   const { findSpy, mockSort } = makeMockSortAndFind();
    
        //   const response = await getInformations(mockReq, mockRes);
      
        //   expect(findSpy).toHaveBeenCalledWith(
        //     {},
        //     'infoName infoContent visibility',
        //   );
    
        //   expect(mockSort).toHaveBeenCalledWith({
        //     lastName: 1,
        //   });
    
        //   expect(mockGetCache).toHaveBeenCalledWith('informations');
    
        //   assertResMock(200, JSON.parse(data), response);
        // });
    
        // test('Ensure getInformations returns 200 if there are information in the database', async () => {
        //   const setCacheObject = {
        //     setCache: () => {},
        //   };
    
        //   const mockSetCache = jest
        //     .spyOn(setCacheObject, 'setCache')
        //     .mockImplementation(() => undefined);
    
        //   cache.mockImplementation(() => setCacheObject);
    
        //   const { getInformations } = makeSut();

    
        //   const databaseInfos = [
        //     {
        //       infoName: 'testInfo',
        //       infoContent: 'Unspecified',
        //       visibility: '0'
        //     },
        //   ];
    
        //   const { findSpy, mockSort } = makeMockSortAndFind(databaseInfos);
    
        //   const response = await getInformations(mockReq, mockRes);
      
        //   expect(findSpy).toHaveBeenCalledWith(
        //     {},
        //     'infoName infoContent visibility',
        //   );
    
        //   expect(mockSort).toHaveBeenCalledWith({
        //     lastName: 1,
        //   });
    
        //   expect(mockSetCache).toHaveBeenCalledWith('informations', JSON.stringify(databaseInfos));
    
        //   assertResMock(200, databaseInfos, response);
        // });
      });

}); 
  