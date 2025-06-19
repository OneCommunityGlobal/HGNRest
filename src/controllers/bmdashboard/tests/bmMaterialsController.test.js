jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => id),
  },
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({}),
  model: jest.fn().mockReturnValue({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  }),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const bmMaterialsController = require('../bmMaterialsController')(
  mongoose.model('BuildingMaterial'),
);

describe('bmMaterialsController', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bmMaterialsList', () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return a list of materials when successful', async () => {
      const mockResults = [{ id: 1, name: 'Material 1' }];
      mongoose.model('BuildingMaterial').find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResults),
      });

      await bmMaterialsController.bmMaterialsList(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').find).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockResults);
    });

    it('should handle errors appropriately', async () => {
      const mockError = new Error('Database error');
      const mockExec = jest.fn().mockRejectedValue(mockError);
      const mockPopulate = jest.fn().mockReturnThis();

      mongoose.model('BuildingMaterial').find.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await bmMaterialsController.bmMaterialsList(mockReq, mockRes);

      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(mockError);
    });
  });
});
