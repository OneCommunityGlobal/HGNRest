jest.mock('../../../utilities/AzureBlobImages', () => ({
  uploadFileToAzureBlobStorage: jest.fn(),
  deleteBlobFromAzureBlobStorage: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../../../config');
const middleware = require('../../../startup/middleware');
const equipmentRouter = require('../../../routes/bmdashboard/bmEquipmentRouter');
const {
  uploadFileToAzureBlobStorage,
  deleteBlobFromAzureBlobStorage,
} = require('../../../utilities/AzureBlobImages');
const { logException } = require('../../../startup/logger');
const bmEquipmentController = require('../bmEquipmentController');

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
      updateOne: jest.fn(),
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

  describe('equipment status route authentication', () => {
    const equipmentId = '507f1f77bcf86cd799439011';
    const authenticatedId = '507f1f77bcf86cd799439012';
    const spoofedId = '507f1f77bcf86cd799439013';
    let app;
    let model;

    beforeEach(() => {
      model = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({ _id: equipmentId }),
        }),
      };
      app = express();
      middleware(app);
      app.use('/api/bm', equipmentRouter(model));
    });

    it('uses the verified JWT identity rather than a body-supplied createdBy', async () => {
      const token = jwt.sign(
        {
          userid: authenticatedId,
          role: 'User',
          expiryTimestamp: new Date(Date.now() + 60000).toISOString(),
        },
        jwtConfig.JWT_SECRET,
      );

      const response = await request(app)
        .put(`/api/bm/equipment/${equipmentId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ condition: 'Working well', createdBy: spoofedId });

      expect(response.status).toBe(200);
      const record = model.findByIdAndUpdate.mock.calls[0][1].$push.updateRecord;
      expect(record.createdBy.toString()).toBe(authenticatedId);
      expect(record.condition).toBe('Good');
    });

    it('rejects unauthenticated requests before writing, even with createdBy in the body', async () => {
      const response = await request(app)
        .put(`/api/bm/equipment/${equipmentId}/status`)
        .send({ condition: 'Good', createdBy: spoofedId });

      expect(response.status).toBe(401);
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });
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
      lastUsedBy: 'John',
      lastUsedFor: 'Digging',
      replacementRequired: 'no',
      description: 'Test description',
      notes: 'Test notes',
    };
    let originalConnectionString;
    let originalContainerName;

    beforeEach(() => {
      mockReq.params.equipmentId = validEquipmentId;
      mockReq.body = { ...baseBody };
      mockReq.user = { requestorId: validCreatedBy, role: 'User' };
      delete mockReq.file;
      originalConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      originalContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
      uploadFileToAzureBlobStorage.mockReset();
      deleteBlobFromAzureBlobStorage.mockReset();
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;test';
      process.env.AZURE_STORAGE_CONTAINER_NAME = 'test-container';
    });

    afterEach(() => {
      if (originalConnectionString === undefined)
        delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      else process.env.AZURE_STORAGE_CONNECTION_STRING = originalConnectionString;
      if (originalContainerName === undefined) delete process.env.AZURE_STORAGE_CONTAINER_NAME;
      else process.env.AZURE_STORAGE_CONTAINER_NAME = originalContainerName;
    });

    it('should update equipment status without image and return 200', async () => {
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockBuildingEquipment.findByIdAndUpdate).toHaveBeenCalledWith(
        validEquipmentId,
        {
          $push: {
            updateRecord: expect.objectContaining({
              date: expect.any(Date),
              condition: 'Good',
              lastUsedBy: 'John',
              lastUsedFor: 'Digging',
              replacementRequired: 'no',
              replacementReason: '',
              description: 'Test description',
              notes: 'Test notes',
            }),
          },
        },
        { new: true },
      );
      const record = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1].$push.updateRecord;
      expect(record.createdBy.toString()).toBe(validCreatedBy);
      expect(record).not.toHaveProperty('imageUrl');
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
      expect(blobName).toMatch(
        new RegExp(`^equipment/${validEquipmentId}/status/\\d+_my_photo__1__png\\.png$`),
      );
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
        error: 'Condition is a required field.',
      });
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 401 when the authenticated user is missing', async () => {
      delete mockReq.user;
      mockReq.body.createdBy = validCreatedBy;

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Authentication required.' });
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 400 when the authenticated user ID is not a valid ObjectId', async () => {
      mockReq.user.requestorId = 'not-a-valid-id';

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Invalid user ID format. Please log in again.',
        details: 'Expected a valid MongoDB ObjectId, got: not-a-valid-id',
      });
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
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

    it.each(['database error', 'equipment not found'])(
      'cleans up an uploaded blob when the update fails with %s',
      async (failure) => {
        uploadFileToAzureBlobStorage.mockResolvedValue('https://example.test/equipment.png');
        mockReq.file = {
          buffer: Buffer.from('img'),
          mimetype: 'image/png',
          originalname: 'photo.png',
        };
        const populate =
          failure === 'database error'
            ? jest.fn().mockRejectedValue(new Error('DB error'))
            : jest.fn().mockResolvedValue(null);
        mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({ populate });

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(deleteBlobFromAzureBlobStorage).toHaveBeenCalledWith(
          uploadFileToAzureBlobStorage.mock.calls[0][1],
        );
        expect(mockRes.status).toHaveBeenCalledWith(failure === 'database error' ? 500 : 404);
      },
    );

    it('stores the normalized condition, replacement reason, and image in history', async () => {
      const imageUrl = 'https://example.test/equipment.png';
      uploadFileToAzureBlobStorage.mockResolvedValue(imageUrl);
      mockReq.body = {
        ...baseBody,
        condition: 'Broken/Needs repair',
        replacementRequired: 'yes',
        replacementReason: '  Worn out  ',
        createdBy: '507f1f77bcf86cd799439099',
      };
      mockReq.file = { buffer: Buffer.from('img'), mimetype: 'image/png', originalname: 'img.png' };
      setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      const update = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1];
      expect(update.$push.updateRecord).toEqual(
        expect.objectContaining({
          condition: 'Needs Repair',
          lastUsedBy: 'John',
          lastUsedFor: 'Digging',
          replacementRequired: 'yes',
          replacementReason: 'Worn out',
          description: 'Test description',
          notes: 'Test notes',
          imageUrl,
        }),
      );
      expect(update.$push.updateRecord.createdBy.toString()).toBe(validCreatedBy);
      expect(update.$set).toEqual({ imageUrl });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should populate itemType, project, and updateRecord.createdBy in the response', async () => {
      const mockPopulate = setupFindByIdAndUpdate(mockUpdatedEquipment);

      await controller.updateEquipmentStatus(mockReq, mockRes);

      expect(mockPopulate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: 'itemType' }),
          expect.objectContaining({ path: 'project' }),
          expect.objectContaining({
            path: 'updateRecord',
            populate: expect.objectContaining({ path: 'createdBy' }),
          }),
        ]),
      );
    });
  });

  describe('updateEquipmentById', () => {
    const validObjectId = '507f1f77bcf86cd799439011';

    it('should return 400 for invalid equipment ID', async () => {
      mockReq.params.equipmentId = 'invalid-id';
      mockReq.body = { purchaseStatus: 'Purchased' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Invalid equipment ID.' });
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid project ID when provided', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { projectId: 'not-valid', purchaseStatus: 'Purchased' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Invalid project ID.' });
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid purchaseStatus enum', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { purchaseStatus: 'InvalidStatus' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid purchaseStatus'),
        }),
      );
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid currentUsage enum', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { currentUsage: 'Broken' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid currentUsage'),
        }),
      );
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid condition enum', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { condition: 'Unknown' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid condition'),
        }),
      );
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 400 when no valid fields provided to update', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { unknownField: 'value' };

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'No valid fields provided to update.',
      });
      expect(mockBuildingEquipment.updateOne).not.toHaveBeenCalled();
    });

    it('should return 200 with updated equipment on success', async () => {
      const updatedEquipment = {
        _id: validObjectId,
        purchaseStatus: 'Purchased',
        condition: 'Good',
      };
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { purchaseStatus: 'Purchased', condition: 'Good' };

      mockBuildingEquipment.updateOne.mockResolvedValue({});
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(updatedEquipment);
      mockBuildingEquipment.findById.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockBuildingEquipment.updateOne).toHaveBeenCalledWith(
        { _id: validObjectId },
        { $set: expect.objectContaining({ purchaseStatus: 'Purchased', condition: 'Good' }) },
      );
      expect(mockBuildingEquipment.findById).toHaveBeenCalledWith(validObjectId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(updatedEquipment);
    });

    it('should return 404 when equipment not found after update', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { condition: 'Good' };

      mockBuildingEquipment.updateOne.mockResolvedValue({});
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(null);
      mockBuildingEquipment.findById.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Equipment not found.' });
    });

    it('should return 500 on updateOne error', async () => {
      mockReq.params.equipmentId = validObjectId;
      mockReq.body = { condition: 'Good' };

      mockBuildingEquipment.updateOne.mockRejectedValue(new Error('DB error'));

      await controller.updateEquipmentById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    describe('updateEquipmentStatus', () => {
      const equipmentId = '507f1f77bcf86cd799439011';
      const createdBy = '507f191e810c19729de860ea';
      const updatedEquipment = { _id: equipmentId, updateRecord: [] };

      beforeEach(() => {
        mockReq.user = { requestorId: createdBy, role: 'User' };
      });

      const mockStatusUpdate = () => {
        const mockPopulate = jest.fn().mockResolvedValue(updatedEquipment);
        mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({ populate: mockPopulate });
        return mockPopulate;
      };

      it('persists status history and a required replacement reason', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Working well',
          createdBy,
          lastUsedBy: 'Pat Volunteer',
          lastUsedFor: 'Garden - landscaping',
          replacementRequired: 'yes',
          replacementReason: 'The current tool is damaged.',
        };
        mockStatusUpdate();

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockBuildingEquipment.findByIdAndUpdate).toHaveBeenCalledWith(
          equipmentId,
          {
            $push: {
              updateRecord: expect.objectContaining({
                condition: 'Good',
                lastUsedBy: 'Pat Volunteer',
                lastUsedFor: 'Garden - landscaping',
                replacementRequired: 'yes',
                replacementReason: 'The current tool is damaged.',
              }),
            },
          },
          { new: true },
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith(updatedEquipment);
      });

      it.each([
        ['Good', 'Good'],
        ['Needs Repair', 'Needs Repair'],
        ['Out of Order', 'Out of Order'],
        ['Working well', 'Good'],
        ['Broken/Needs repair', 'Needs Repair'],
        ['Stolen/Lost', 'Out of Order'],
        ['End of life', 'Out of Order'],
        ['Returned', 'Good'],
      ])('stores %s as the canonical value %s', async (sent, stored) => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = { condition: sent, replacementRequired: 'no' };
        mockStatusUpdate();

        await controller.updateEquipmentStatus(mockReq, mockRes);

        const update = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1];
        expect(update.$push.updateRecord.condition).toBe(stored);
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it.each(['Bogus', 'good', '', 42, { $ne: '' }, ['Good']])(
        'rejects unsupported condition %p without writing',
        async (bad) => {
          mockReq.params.equipmentId = equipmentId;
          mockReq.body = { condition: bad, replacementRequired: 'no' };

          await controller.updateEquipmentStatus(mockReq, mockRes);

          expect(mockRes.status).toHaveBeenCalledWith(400);
          expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
        },
      );

      it('clears replacement reason when replacement is not required', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Working well',
          createdBy,
          replacementRequired: 'no',
          replacementReason: 'stale reason',
        };
        mockBuildingEquipment.findByIdAndUpdate.mockImplementation((id, update) => {
          expect(update.$push.updateRecord.replacementReason).toBe('');
          return { populate: jest.fn().mockResolvedValue(updatedEquipment) };
        });

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('uses the authenticated requestor for an authorized status update', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Good',
          createdBy,
          replacementRequired: 'no',
        };
        mockStatusUpdate();

        await controller.updateEquipmentStatus(mockReq, mockRes);

        const update = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1];
        expect(update.$push.updateRecord.createdBy.toString()).toBe(createdBy);
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('ignores a spoofed createdBy and requestor in the request body', async () => {
        const spoofedId = '507f191e810c19729de860eb';
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Good',
          createdBy: spoofedId,
          requestor: { requestorId: spoofedId },
          replacementRequired: 'no',
        };
        mockBuildingEquipment.findByIdAndUpdate.mockImplementation((id, update) => {
          expect(update.$push.updateRecord.createdBy.toString()).toBe(createdBy);
          return { populate: jest.fn().mockResolvedValue(updatedEquipment) };
        });

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('rejects a missing authenticated identity even when the body supplies createdBy', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Good',
          createdBy,
          replacementRequired: 'no',
        };
        delete mockReq.user;

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it('populates usage history so the response can drive the last-user summary', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = { condition: 'Good', createdBy, replacementRequired: 'no' };
        const mockPopulate = mockStatusUpdate();

        await controller.updateEquipmentStatus(mockReq, mockRes);

        const config = mockPopulate.mock.calls[0][0];
        const logRecord = config.find((item) => item.path === 'logRecord');
        expect(logRecord.populate).toEqual(
          expect.arrayContaining([expect.objectContaining({ path: 'responsibleUser' })]),
        );
        expect(config.find((item) => item.path === 'updateRecord').populate.path).toBe('createdBy');
      });

      it('rejects an invalid replacementRequired value', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = { condition: 'Good', createdBy, replacementRequired: 'maybe' };

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it('rejects a whitespace-only replacement reason', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = {
          condition: 'Good',
          createdBy,
          replacementRequired: 'yes',
          replacementReason: '   ',
        };

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it('returns 404 when the equipment does not exist', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = { condition: 'Good', createdBy, replacementRequired: 'no' };
        mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        });

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
      });

      it('rejects a missing replacement reason', async () => {
        mockReq.params.equipmentId = equipmentId;
        mockReq.body = { condition: 'Working well', createdBy, replacementRequired: 'yes' };

        await controller.updateEquipmentStatus(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: 'A replacement reason is required when replacement is requested.',
        });
        expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      });
    });
  });
});
