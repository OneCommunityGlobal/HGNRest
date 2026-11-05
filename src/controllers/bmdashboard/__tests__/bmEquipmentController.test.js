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

  describe('fetchSingleEquipment', () => {
    it('should fetch a single equipment by ID successfully', async () => {
      const mockEquipment = { _id: '123', name: 'Test Equipment' };
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockEquipment);

      mockBuildingEquipment.findById.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      mockReq.params.equipmentId = '507f1f77bcf86cd799439011';
      await controller.fetchSingleEquipment(mockReq, mockRes);

      expect(mockBuildingEquipment.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
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

      mockReq.params.equipmentId = '507f1f77bcf86cd799439011';
      await controller.fetchSingleEquipment(mockReq, mockRes);
      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Failed to fetch equipment.' });
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
  });
  describe('status contract', () => {
    const equipmentId = '507f1f77bcf86cd799439011';
    const authorId = '507f1f77bcf86cd799439012';
    let populate;

    beforeEach(() => {
      mockReq.params.equipmentId = equipmentId;
      mockReq.user = { requestorId: authorId };
      mockReq.body = { condition: 'Good' };
      populate = jest.fn().mockResolvedValue({ _id: equipmentId, condition: 'Like New' });
      mockBuildingEquipment.findByIdAndUpdate.mockReturnValue({ populate });
    });

    test.each(['Good', 'Needs Repair', 'Out of Order'])(
      'accepts %s without changing root condition',
      async (condition) => {
        const before = Date.now();
        mockReq.body = {
          condition,
          createdBy: equipmentId,
          date: '2000-01-01',
          lastUsedBy: 'Volunteer',
          lastUsedFor: 'Tiling',
          replacementRequired: 'yes',
          description: '',
          notes: 'Inspection note',
        };
        await controller.updateEquipmentStatus(mockReq, mockRes);
        const [, update, options] = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0];
        expect(Object.keys(update)).toEqual(['$push']);
        expect(update.$push.updateRecord).toMatchObject({
          condition,
          lastUsedBy: 'Volunteer',
          lastUsedFor: 'Tiling',
          replacementRequired: 'yes',
          description: '',
          notes: 'Inspection note',
        });
        expect(update.$push.updateRecord.createdBy.toString()).toBe(authorId);
        expect(update.$push.updateRecord.date.getTime()).toBeGreaterThanOrEqual(before);
        expect(update.$push.updateRecord.date.getTime()).toBeLessThanOrEqual(Date.now());
        expect(options).toEqual({ new: true, runValidators: true });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith({ _id: equipmentId, condition: 'Like New' });
      },
    );

    test.each([false, true, 'yes', 'no', ''])(
      'preserves replacement selection %p',
      async (value) => {
        mockReq.body.replacementRequired = value;
        await controller.updateEquipmentStatus(mockReq, mockRes);
        expect(
          mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1].$push.updateRecord
            .replacementRequired,
        ).toBe(value);
      },
    );

    test('allows omitted optional fields and explicit null text', async () => {
      mockReq.body.notes = null;
      await controller.updateEquipmentStatus(mockReq, mockRes);
      const entry = mockBuildingEquipment.findByIdAndUpdate.mock.calls[0][1].$push.updateRecord;
      expect(entry.notes).toBeNull();
      expect(entry).not.toHaveProperty('replacementRequired');
      expect(entry).not.toHaveProperty('lastUsedBy');
    });

    test.each([
      {},
      { condition: null },
      { condition: '' },
      { condition: ' ' },
      { condition: 'Working well' },
      { condition: 1 },
      { condition: ['Good'] },
      { condition: { value: 'Good' } },
      { condition: 'Good', replacementRequired: 'maybe' },
      { condition: 'Good', replacementRequired: null },
      { condition: 'Good', replacementRequired: {} },
      { condition: 'Good', notes: false },
      { condition: 'Good', notes: 'x'.repeat(2001) },
      { condition: 'Good', description: [] },
      { condition: 'Good', lastUsedBy: 123 },
      { condition: 'Good', lastUsedFor: 'x'.repeat(501) },
      { condition: 'Good', sendNote: 'yes', notes: ' ' },
      { condition: 'Good', sendNote: true },
      { condition: 'Good', sendNote: 'invalid' },
      null,
      [],
    ])('rejects malformed payload %p', async (body) => {
      mockReq.body = body;
      await controller.updateEquipmentStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('accepts a requested nonblank note', async () => {
      Object.assign(mockReq.body, { sendNote: 'yes', notes: 'Useful note' });
      await controller.updateEquipmentStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('does not use body identity when authentication is missing', async () => {
      delete mockReq.user;
      mockReq.body.createdBy = authorId;
      mockReq.body.requestor = { requestorId: authorId };
      await controller.updateEquipmentStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test.each(['fetchSingleEquipment', 'updateEquipmentStatus'])(
      '%s rejects malformed IDs',
      async (method) => {
        mockReq.params.equipmentId = 'bad-id';
        await controller[method](mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockBuildingEquipment.findById).not.toHaveBeenCalled();
        expect(mockBuildingEquipment.findByIdAndUpdate).not.toHaveBeenCalled();
      },
    );

    test.each(['fetchSingleEquipment', 'updateEquipmentStatus'])(
      '%s returns 404 for missing equipment',
      async (method) => {
        populate.mockResolvedValue(null);
        mockBuildingEquipment.findById.mockReturnValue({
          populate: () => ({ exec: async () => null }),
        });
        await controller[method](mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith({ error: 'Equipment not found.' });
      },
    );

    test.each([
      ['ValidationError', 400],
      ['CastError', 400],
      ['Error', 500],
    ])('handles %s without leaking internals', async (name, status) => {
      const error = new Error('secret database details');
      error.name = name;
      populate.mockRejectedValue(error);
      await controller.updateEquipmentStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(status);
      expect(JSON.stringify(mockRes.send.mock.calls)).not.toContain('secret');
    });
  });
});
