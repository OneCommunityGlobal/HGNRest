jest.mock('../../../utilities/AzureBlobImages', () => ({
  uploadFileToAzureBlobStorage: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));

const bmEquipmentController = require('../bmEquipmentController');
const { uploadFileToAzureBlobStorage } = require('../../../utilities/AzureBlobImages');
const { logException } = require('../../../startup/logger');

describe('bmEquipmentController', () => {
  let mockBuildingEquipment;
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock BuildingEquipment model
    mockBuildingEquipment = {
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    // Initialize controller with mock model
    controller = bmEquipmentController(mockBuildingEquipment);

    // Mock request and response objects
    mockReq = {
      params: {},
      body: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  function setupFindByIdAndUpdate(resolvedValue) {
    const mockPopulate = jest.fn().mockResolvedValue(resolvedValue);
    mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({ populate: mockPopulate });
    return mockPopulate;
  }

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

    it('should create new equipment purchase record when equipment does not exist', async () => {
      mockReq.body = purchaseData;
      mockBuildingEquipment.findOne.mockResolvedValue(null);
      mockBuildingEquipment.create.mockResolvedValue({});

      await controller.bmPurchaseEquipments(mockReq, mockRes);

      expect(mockBuildingEquipment.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should push to existing purchase record when equipment already exists', async () => {
      const existingDoc = { _id: '507f1f77bcf86cd799439011' };
      mockReq.body = purchaseData;
      mockBuildingEquipment.findOne.mockResolvedValue(existingDoc);
      mockBuildingEquipment.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await controller.bmPurchaseEquipments(mockReq, mockRes);

      expect(mockBuildingEquipment.findOneAndUpdate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateEquipmentById', () => {
    const validEquipmentId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
      mockReq.params.equipmentId = validEquipmentId;
      mockReq.body = { condition: 'Good' };
    });

    it('should return 400 for invalid equipmentId', async () => {
      mockReq.params.equipmentId = 'not-valid';

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Invalid equipment ID.' });
    });

    it('should return 400 for invalid projectId', async () => {
      mockReq.body = { projectId: 'bad-id', condition: 'Good' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Invalid project ID.' });
    });

    it('should return 400 for invalid enum value', async () => {
      mockReq.body = { condition: 'Destroyed' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid condition') }),
      );
    });

    it('should return 400 when no valid fields are provided', async () => {
      mockReq.body = {};

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'No valid fields provided to update.' });
    });

    it('should update equipment and return 200 on success', async () => {
      const mockEquipment = { _id: validEquipmentId, condition: 'Good' };
      mockBuildingEquipment.updateOne = jest.fn().mockResolvedValue({});
      mockBuildingEquipment.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockEquipment),
      });

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockBuildingEquipment.updateOne).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockEquipment);
    });

    it('should return 404 when equipment is not found after update', async () => {
      mockBuildingEquipment.updateOne = jest.fn().mockResolvedValue({});
      mockBuildingEquipment.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Equipment not found.' });
    });

    it('should return 500 on unexpected error', async () => {
      mockBuildingEquipment.updateOne = jest.fn().mockRejectedValue(new Error('DB error'));

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateLogRecords', () => {
    const validEquipmentId = '507f1f77bcf86cd799439011';
    const validLogEntry = { createdBy: '507f1f77bcf86cd799439012', type: 'checkout' };

    beforeEach(() => {
      mockReq.query = {};
      mockReq.body = [{ equipmentId: validEquipmentId, logEntry: validLogEntry }];
    });

    it('should return 400 when body is not an array', async () => {
      mockReq.body = {};

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Request body must be a non-empty array.',
      });
    });

    it('should return 400 when body is an empty array', async () => {
      mockReq.body = [];

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid equipmentId in an item', async () => {
      mockReq.body = [{ equipmentId: 'bad-id', logEntry: validLogEntry }];

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Invalid or missing equipmentId.' });
    });

    it('should return 400 when logEntry is missing createdBy', async () => {
      mockReq.body = [{ equipmentId: validEquipmentId, logEntry: { type: 'checkout' } }];

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when logEntry is missing type', async () => {
      mockReq.body = [{ equipmentId: validEquipmentId, logEntry: { createdBy: 'someone' } }];

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should update log records and return 200 on success', async () => {
      const equipmentList = [{ _id: validEquipmentId }];
      mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockBuildingEquipment.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(equipmentList),
      });

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockBuildingEquipment.findByIdAndUpdate).toHaveBeenCalledWith(
        validEquipmentId,
        { $push: { logRecord: expect.any(Object) } },
        { new: false },
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(equipmentList);
    });

    it('should filter equipment by projectId when query param is provided', async () => {
      mockReq.query = { project: '507f1f77bcf86cd799439099' };
      mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockBuildingEquipment.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockBuildingEquipment.find).toHaveBeenCalledWith({
        project: '507f1f77bcf86cd799439099',
      });
    });

    it('should return 500 and call logException on DB error', async () => {
      mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await controller.updateLogRecords(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logException).toHaveBeenCalled();
    });
  });

  describe('updateEquipmentStatus', () => {
    const validEquipmentId = '507f1f77bcf86cd799439011';
    const validCreatedBy = '507f1f77bcf86cd799439012';
    const mockUpdatedEquipment = {
      _id: validEquipmentId,
      condition: 'Good',
      updateRecord: [{ condition: 'Good' }],
    };
    const baseBody = {
      condition: 'Good',
      createdBy: validCreatedBy,
      lastUsedBy: 'John',
      lastUsedFor: 'Digging',
      replacementRequired: 'No',
      description: 'Test description',
      notes: 'Test notes',
    };

    beforeEach(() => {
      mockReq.params.equipmentId = validEquipmentId;
      mockReq.body = { ...baseBody };
      delete mockReq.file;
      // Satisfy the Azure env guard so image-upload tests reach the mock
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;test';
      process.env.AZURE_STORAGE_CONTAINER_NAME = 'test-container';
    });

    afterEach(() => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AZURE_STORAGE_CONTAINER_NAME;
    });

    it('should update equipment status without image and return 200', async () => {
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockBuildingEquipment.findByIdAndUpdate).toHaveBeenCalledWith(
        validEquipmentId,
        { $push: { updateRecord: expect.objectContaining({ condition: 'Good' }) } },
        { new: true },
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockUpdatedEquipment);
    });

    it('should not include $set in DB update when no image is provided', async () => {
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      const [[, dbUpdateArg]] = mockBuildingEquipment.findByIdAndUpdate.mock.calls;
      expect(dbUpdateArg).not.toHaveProperty('$set');
    });

    it('should upload image, add imageUrl to updateRecord, and $set root imageUrl', async () => {
      const imageUrl = 'https://mystorage.blob.core.windows.net/container/equipment/img.png';
      uploadFileToAzureBlobStorage.mockResolvedValue(imageUrl);
      mockReq.file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        originalname: 'photo.png',
      };
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(uploadFileToAzureBlobStorage).toHaveBeenCalledWith(
        mockReq.file,
        expect.stringMatching(new RegExp(`^equipment/${validEquipmentId}/status/`)),
      );
      const [[, dbUpdateArg]] = mockBuildingEquipment.findByIdAndUpdate.mock.calls;
      expect(dbUpdateArg.$push.updateRecord).toHaveProperty('imageUrl', imageUrl);
      expect(dbUpdateArg.$set).toEqual({ imageUrl });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should accept image/jpeg MIME type', async () => {
      const imageUrl = 'https://mystorage.blob.core.windows.net/container/equipment/img.jpeg';
      uploadFileToAzureBlobStorage.mockResolvedValue(imageUrl);
      mockReq.file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      };
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(uploadFileToAzureBlobStorage).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should use safe blob name when originalname contains special characters', async () => {
      const imageUrl = 'https://mystorage.blob.core.windows.net/container/img.png';
      uploadFileToAzureBlobStorage.mockResolvedValue(imageUrl);
      mockReq.file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        originalname: 'my photo (1).png',
      };
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      const [[, blobName]] = uploadFileToAzureBlobStorage.mock.calls;
      expect(blobName).toMatch(/[^<>:"/\\|?*]+/);
      expect(blobName).not.toContain(' ');
      expect(blobName).toMatch(/\.png$/);
    });

    it('should fallback to "image" safeName when originalname is falsy', async () => {
      const imageUrl = 'https://mystorage.blob.core.windows.net/container/img.png';
      uploadFileToAzureBlobStorage.mockResolvedValue(imageUrl);
      mockReq.file = { buffer: Buffer.from('img'), mimetype: 'image/png', originalname: '' };
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      const [[, blobName]] = uploadFileToAzureBlobStorage.mock.calls;
      expect(blobName).toMatch(/image\.png$/);
    });

    it('should return 400 when condition is missing', async () => {
      mockReq.body = { ...baseBody, condition: undefined };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Condition and createdBy are required fields.',
      });
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 400 when createdBy is missing', async () => {
      mockReq.body = { ...baseBody, createdBy: undefined };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Condition and createdBy are required fields.',
      });
    });

    it('should return 400 and call logException when createdBy is not a valid ObjectId', async () => {
      mockReq.body = { ...baseBody, createdBy: 'not-a-valid-id' };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid user ID format. Please log in again.' }),
      );
      expect(logException).toHaveBeenCalled();
    });

    it('should return 400 when image has an unsupported MIME type', async () => {
      mockReq.file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/gif',
        originalname: 'anim.gif',
      };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Invalid image. Use PNG, JPG, or JPEG under 5MB.',
      });
      expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 503 when Azure env vars are not configured', async () => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AZURE_STORAGE_CONTAINER_NAME;
      mockReq.file = { buffer: Buffer.from('img'), mimetype: 'image/png', originalname: 'img.png' };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Image storage is not configured on this server.',
      });
      expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 and not update DB when Azure upload fails', async () => {
      uploadFileToAzureBlobStorage.mockRejectedValue(new Error('Azure connection error'));
      mockReq.file = { buffer: Buffer.from('img'), mimetype: 'image/png', originalname: 'img.png' };

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Image selected but not saved.' });
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(logException).toHaveBeenCalled();
    });

    it('should return 404 when equipment is not found in DB', async () => {
      setupFindByIdAndUpdate(null);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Equipment not found.' });
    });

    it('should return 500 and call logException on unexpected DB error', async () => {
      mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Image selected but not saved.' });
      expect(logException).toHaveBeenCalledWith(expect.any(Error), 'updateEquipmentStatus');
    });

    it('should populate itemType, project, and updateRecord.createdBy in the response', async () => {
      const mockPopulate = setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockPopulate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: 'itemType' }),
          expect.objectContaining({ path: 'project' }),
          expect.objectContaining({ path: 'updateRecord.createdBy' }),
        ]),
      );
    });
  });
});
