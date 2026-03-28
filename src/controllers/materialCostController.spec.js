jest.mock('../models/bmdashboard/buildingMaterial');
jest.mock('../utilities/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));
const BuildingMaterial = require('../models/bmdashboard/buildingMaterial');
const cache = require('../utilities/cache');
const materialCostController = require('./materialCostController');

describe('materialCostController', () => {
  const { getMaterialCosts } = materialCostController();
  let req;
  let res;
  let mockData;
  beforeEach(() => {
    req = { query: {} };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockData = [
      {
        project: '12345',
        totalCostK: 1000,
      },
    ];
    jest.clearAllMocks();
  });

  it('should aggregate if there is no cache', async () => {
    cache.get = jest.fn().mockReturnValue(null);

    BuildingMaterial.aggregate = jest.fn().mockResolvedValue(mockData);
    await getMaterialCosts(req, res);
    expect(cache.get).toHaveBeenCalledWith('materialCostall');
    expect(BuildingMaterial.aggregate).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith('materialCostall', mockData);
    expect(res.json).toHaveBeenCalledWith(mockData);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should not aggregate if there is a cache', async () => {
    cache.get = jest.fn().mockReturnValue(mockData);
    await getMaterialCosts(req, res);
    expect(cache.get).toHaveBeenCalledWith('materialCostall');
    expect(BuildingMaterial.aggregate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(mockData);
  });

  it('should call cache value with normalized parameters when parameters are passed', async () => {
    cache.get = jest.fn().mockReturnValue(mockData);
    req = {
      query: {
        projectId: '123,   456 ,  789',
      },
    };
    await getMaterialCosts(req, res);
    expect(cache.get).toHaveBeenCalledWith('materialCost123,456,789');
    expect(BuildingMaterial.aggregate).not.toHaveBeenCalled();
  });

  it('should return 500 if an error occured', async () => {
    cache.get = jest.fn().mockReturnValue(null);
    const error = new Error('Aggregation failed');
    BuildingMaterial.aggregate.mockRejectedValue(error);

    await getMaterialCosts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
        details: 'Aggregation failed',
      }),
    );
  });
});
