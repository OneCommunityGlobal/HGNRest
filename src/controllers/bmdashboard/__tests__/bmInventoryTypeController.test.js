const bmInventoryTypeController = require('../bmInventoryTypeController');
const mongoose = require('mongoose');

const mockMatType = {
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  exec: jest.fn(),
};

const mockConsType = {
  find: jest.fn(),
  create: jest.fn(),
  exec: jest.fn(),
};

const mockReusType = {
  find: jest.fn(),
  exec: jest.fn(),
};

const mockToolType = {
  find: jest.fn(),
  create: jest.fn(),
  populate: jest.fn(),
  exec: jest.fn(),
};

const mockEquipType = {
  find: jest.fn(),
  create: jest.fn(),
  exec: jest.fn(),
};

const mockInvType = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  exec: jest.fn(),
};

jest.mock('fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn(),
  dirname: jest.fn(),
  join: jest.fn(),
}));

describe('Building Materials Inventory Controller', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    controller = bmInventoryTypeController(
      mockInvType,
      mockMatType,
      mockConsType,
      mockReusType,
      mockToolType,
      mockEquipType
    );

    req = {
      body: {},
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('fetchMaterialTypes', () => {
    it('should fetch all material types successfully', async () => {
      const mockMaterials = [{ name: 'Steel' }, { name: 'Concrete' }];
      mockMatType.find.mockReturnThis();
      mockMatType.exec.mockResolvedValue(mockMaterials);

      await controller.fetchMaterialTypes(req, res);

      expect(mockMatType.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockMaterials);
    });
  });

  describe('addMaterialType', () => {
    beforeEach(() => {
      req.body = {
        name: 'New Material',
        description: 'Test description',
        unit: 'kg',
        requestor: { requestorId: 'user123' },
      };
    });

    it('should add a new material type successfully', async () => {
      const mockNewMaterial = { ...req.body, _id: 'mat123' };
      mockMatType.find.mockReturnValue({
        then: jest.fn().mockImplementation(cb => {
          cb([]);
          return {
            catch: jest.fn()
          };
        })
      });

      mockMatType.create.mockReturnValue({
        then: jest.fn().mockImplementation(cb => {
          cb(mockNewMaterial);
          return {
            catch: jest.fn()
          };
        })
      });

      await controller.addMaterialType(req, res);

      expect(mockMatType.find).toHaveBeenCalledWith({ name: 'New Material' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith(mockNewMaterial);
    });

    it('should handle duplicate material names', async () => {
      mockMatType.find.mockReturnValue({
        then: jest.fn().mockImplementation(cb => {
          cb([{ name: 'New Material' }]);
          return {
            catch: jest.fn()
          };
        })
      });

      await controller.addMaterialType(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith('Oops!! Material already exists!');
    });
  });

  describe('fetchToolTypes', () => {
    it('should fetch all tool types with populated fields', async () => {
      const mockTools = [
        {
          name: 'Hammer',
          available: [{ _id: 'tool1', code: 'T1', project: { _id: 'proj1', name: 'Project 1' } }],
        },
      ];

      mockToolType.find.mockReturnThis();
      mockToolType.populate.mockReturnThis();
      mockToolType.exec.mockResolvedValue(mockTools);

      await controller.fetchToolTypes(req, res);

      expect(mockToolType.find).toHaveBeenCalled();
      expect(mockToolType.populate).toHaveBeenCalledWith([
        expect.objectContaining({ path: 'available' }),
        expect.objectContaining({ path: 'using' }),
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockTools);
    });
  });

  describe('updateNameAndUnit', () => {
    it('should update name and unit successfully', async () => {
      req.params = { invtypeId: 'inv123' };
      req.body = { name: 'Updated Name', unit: 'Updated Unit' };
      
      const updatedDoc = { ...req.body, _id: 'inv123' };
      mockInvType.findByIdAndUpdate.mockResolvedValue(updatedDoc);

      await controller.updateNameAndUnit(req, res);

      expect(mockInvType.findByIdAndUpdate).toHaveBeenCalledWith(
        'inv123',
        { name: 'Updated Name', unit: 'Updated Unit' },
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedDoc);
    });

    it('should handle non-existent inventory type', async () => {
      req.params = { invtypeId: 'nonexistent' };
      req.body = { name: 'Updated Name' };

      mockInvType.findByIdAndUpdate.mockResolvedValue(null);

      await controller.updateNameAndUnit(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'invType Material not found check Id' });
    });
  });
});
