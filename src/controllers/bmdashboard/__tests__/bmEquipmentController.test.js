const bmEquipmentController = require('../bmEquipmentController');

describe('bmEquipmentController', () => {
  let mockBuildingEquipment;
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Mock BuildingEquipment model
    mockBuildingEquipment = {
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };

    // Initialize controller with mock model
    controller = bmEquipmentController(mockBuildingEquipment);

    // Mock request and response objects
    mockReq = {
      params: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe('fetchSingleEquipment', () => {
    it('should fetch a single equipment by ID successfully', async () => {
      const mockEquipment = { _id: '123', name: 'Test Equipment' };
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockEquipment);
      
      mockBuildingEquipment.findById.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      mockReq.params.equipmentId = '123';
      await controller.fetchSingleEquipment(mockReq, mockRes);

      expect(mockBuildingEquipment.findById).toHaveBeenCalledWith('123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockEquipment);
    });

    it('should handle errors when fetching single equipment', async () => {
      const error = new Error('Database error');
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockRejectedValue(error);
      
      mockBuildingEquipment.findById.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      mockReq.params.equipmentId = '123';
      await controller.fetchSingleEquipment(mockReq, mockRes);
      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('fetchBMEquipments', () => {
    it('should fetch all building equipments successfully', async () => {
      const mockEquipments = [{ _id: '1' }, { _id: '2' }];
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockEquipments);
      
      mockBuildingEquipment.find.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await controller.fetchBMEquipments(mockReq, mockRes);

      expect(mockBuildingEquipment.find).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockEquipments);
    });

    it('should handle errors when fetching all equipments', async () => {
      const error = new Error('Database error');
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockRejectedValue(error);
      
      mockBuildingEquipment.find.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await controller.fetchBMEquipments(mockReq, mockRes);
      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('bmPurchaseEquipments', () => {
    it('should create new equipment purchase record when equipment does not exist', async () => {
      const purchaseData = {
        projectId: '123',
        equipmentId: '456',
        quantity: 2,
        priority: 'high',
        estTime: '2 weeks',
        desc: 'Test description',
        makeModel: 'Test Model',
        requestor: { requestorId: '789' },
      };

      mockReq.body = purchaseData;
      mockBuildingEquipment.findOne.mockResolvedValue(null);
      mockBuildingEquipment.create.mockResolvedValue({});

      await controller.bmPurchaseEquipments(mockReq, mockRes);

      expect(mockBuildingEquipment.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });
});
