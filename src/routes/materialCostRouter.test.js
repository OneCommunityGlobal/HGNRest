jest.mock('../utilities/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../app');
const createUser = require('../test/db/createUser');
const jwtPayload = require('../test/auth/jwt');
const BuildingMaterial = require('../models/bmdashboard/buildingMaterial');
const cache = require('../utilities/cache');

describe('GET /material-costs (integration)', () => {
  let mongoServer;
  let requestorUser;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    console.log(uri);
    await mongoose.connect(uri);
    requestorUser = await createUser(); // requestor user
    token = jwtPayload(requestorUser);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await BuildingMaterial.deleteMany({});
  });
  it('should compute total material cost per project', async () => {
    const project1 = new mongoose.Types.ObjectId();
    const project2 = new mongoose.Types.ObjectId();

    await BuildingMaterial.insertMany([
      {
        project: project1,
        purchaseRecord: [
          { quantity: 5, unitPrice: 200, status: 'Approved', priority: 'Medium' }, // 1000
          { quantity: 5, unitPrice: 100, status: 'Pending', priority: 'Medium' }, // ignored
        ],
      },
      {
        project: project1,
        purchaseRecord: [
          { quantity: 5, unitPrice: 200, status: 'Approved', priority: 'Medium' }, // 1000
          { quantity: 5, unitPrice: 100, status: 'Pending', priority: 'Medium' }, // ignored
        ],
      },
      {
        project: project2,
        purchaseRecord: [
          { quantity: 4, unitPrice: 300, status: 'Approved', priority: 'Medium' }, // 1200
          { quantity: 1, unitPrice: 100, status: 'Rejected', priority: 'Medium' }, // ignored
        ],
      },
    ]);

    cache.get.mockReturnValue(null); // ensure DB path, not cache

    const res = await request.agent(app).get('/api/material-costs').set('Authorization', token);

    // expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project: project1.toString(),
          totalCostK: 2.0, // 2000 / 1000
        }),
        expect.objectContaining({
          project: project2.toString(),
          totalCostK: 1.2, // 1200 / 1000
        }),
      ]),
    );

    // ensure cache is set with results
    expect(cache.set).toHaveBeenCalledWith('materialCostall', expect.any(Array));
  });
  it('should return cached data if available', async () => {
    const cached = [{ project: 'cachedProj', totalCostK: 7.5 }];
    cache.get.mockReturnValue(cached);

    const res = await request.agent(app).get('/api/material-costs').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cached);

    // no aggregation should have run
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('should filter by projectId list', async () => {
    const projectA = new mongoose.Types.ObjectId();
    const projectB = new mongoose.Types.ObjectId();

    await BuildingMaterial.insertMany([
      {
        project: projectA,
        purchaseRecord: [{ quantity: 10, unitPrice: 50, status: 'Approved', priority: 'Medium' }], // 500
      },
      {
        project: projectB,
        purchaseRecord: [{ quantity: 5, unitPrice: 100, status: 'Approved', priority: 'Medium' }], // 500
      },
    ]);

    cache.get.mockReturnValue(null);

    const res = await request
      .agent(app)
      .get(`/api/material-costs?projectId=${projectA.toString()}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].project).toBe(projectA.toString());
  });

  it('should handle DB errors gracefully', async () => {
    jest.spyOn(BuildingMaterial, 'aggregate').mockRejectedValueOnce(new Error('DB fail'));
    cache.get.mockReturnValue(null);

    const res = await request.agent(app).get('/api/material-costs').set('Authorization', token);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.details).toBe('DB fail');
  });
});
