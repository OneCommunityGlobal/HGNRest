const mongoose = require('mongoose');
const SeedInventory = require('../../../models/gardenManagement/seedInventory');
const {
  getSeedInventory,
  getSeedInventoryById,
  createSeedInventory,
  updateSeedInventory,
  deleteSeedInventory,
  updateSeedQuantity,
} = require('../seedInventoryController');

describe('Seed Inventory Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSeedInventory', () => {
    const mockFind = (seeds) => {
      jest.spyOn(SeedInventory, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(seeds),
        }),
      });
    };

    it('should return all seed inventory', async () => {
      const seeds = [
        {
          _id: '1',
          name: 'Tomato',
          quantity: 10,
          viable: 90,
        },
      ];

      mockFind(seeds);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(seeds);
    });

    it('should search seeds by name', async () => {
      const seeds = [
        {
          name: 'Tomato',
          quantity: 10,
          viable: 90,
        },
      ];

      req.query.search = 'Tomato';

      mockFind(seeds);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        name: {
          $regex: 'Tomato',
          $options: 'i',
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(seeds);
    });

    it('should escape regex characters in search', async () => {
      req.query.search = 'Tomato.*';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        name: {
          $regex: 'Tomato\\.\\*',
          $options: 'i',
        },
      });
    });

    it('should ignore empty search values', async () => {
      req.query.search = '   ';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({});
    });

    it('should apply minimum quantity filter', async () => {
      req.query.minQuantity = '10';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        quantity: {
          $gte: 10,
        },
      });
    });

    it('should apply maximum quantity filter', async () => {
      req.query.maxQuantity = '50';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        quantity: {
          $lte: 50,
        },
      });
    });

    it('should apply minimum and maximum quantity filters', async () => {
      req.query.minQuantity = '10';
      req.query.maxQuantity = '50';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        quantity: {
          $gte: 10,
          $lte: 50,
        },
      });
    });

    it.each([
      ['invalid minimum quantity', { minQuantity: '-1' }, 'Invalid minimum quantity'],
      ['non-numeric minimum quantity', { minQuantity: 'abc' }, 'Invalid minimum quantity'],
      ['invalid maximum quantity', { maxQuantity: '-1' }, 'Invalid maximum quantity'],
      ['non-numeric maximum quantity', { maxQuantity: 'abc' }, 'Invalid maximum quantity'],
    ])('should reject %s', async (_description, query, message) => {
      req.query = query;

      const findSpy = jest.spyOn(SeedInventory, 'find');

      await getSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    it('should reject when minimum quantity exceeds maximum quantity', async () => {
      req.query.minQuantity = '100';
      req.query.maxQuantity = '50';

      const findSpy = jest.spyOn(SeedInventory, 'find');

      await getSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Minimum quantity cannot be greater than maximum quantity',
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    it('should apply minimum viability filter', async () => {
      req.query.minViable = '25';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        viable: {
          $gte: 25,
        },
      });
    });

    it('should apply maximum viability filter', async () => {
      req.query.maxViable = '90';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        viable: {
          $lte: 90,
        },
      });
    });

    it('should apply minimum and maximum viability filters', async () => {
      req.query.minViable = '25';
      req.query.maxViable = '90';

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        viable: {
          $gte: 25,
          $lte: 90,
        },
      });
    });

    it.each([
      ['invalid minimum viability', { minViable: '-1' }, 'Invalid minimum viability'],
      ['minimum viability above 100', { minViable: '101' }, 'Invalid minimum viability'],
      ['non-numeric minimum viability', { minViable: 'abc' }, 'Invalid minimum viability'],
      ['invalid maximum viability', { maxViable: '-1' }, 'Invalid maximum viability'],
      ['maximum viability above 100', { maxViable: '101' }, 'Invalid maximum viability'],
      ['non-numeric maximum viability', { maxViable: 'abc' }, 'Invalid maximum viability'],
    ])('should reject %s', async (_description, query, message) => {
      req.query = query;

      const findSpy = jest.spyOn(SeedInventory, 'find');

      await getSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    it('should reject when minimum viability exceeds maximum viability', async () => {
      req.query.minViable = '90';
      req.query.maxViable = '50';

      const findSpy = jest.spyOn(SeedInventory, 'find');

      await getSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Minimum viability cannot be greater than maximum viability',
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    it('should combine all filters', async () => {
      req.query = {
        search: 'Tomato',
        minQuantity: '10',
        maxQuantity: '50',
        minViable: '60',
        maxViable: '100',
      };

      mockFind([]);

      await getSeedInventory(req, res);

      expect(SeedInventory.find).toHaveBeenCalledWith({
        name: {
          $regex: 'Tomato',
          $options: 'i',
        },
        quantity: {
          $gte: 10,
          $lte: 50,
        },
        viable: {
          $gte: 60,
          $lte: 100,
        },
      });
    });

    it('should return 500 when database query fails', async () => {
      jest.spyOn(SeedInventory, 'find').mockImplementation(() => {
        throw new Error('Database error');
      });

      await getSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('getSeedInventoryById', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('should return seed by ID', async () => {
      const seed = {
        _id: validId,
        name: 'Tomato',
        quantity: 20,
        viable: 90,
      };

      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(seed),
      });

      await getSeedInventoryById(req, res);

      expect(SeedInventory.findById).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(seed);
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid-id';

      const findByIdSpy = jest.spyOn(SeedInventory, 'findById');

      await getSeedInventoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid seed inventory ID',
      });

      expect(findByIdSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when seed does not exist', async () => {
      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await getSeedInventoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed inventory item not found',
      });
    });

    it('should return 500 when database query fails', async () => {
      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findById').mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await getSeedInventoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('createSeedInventory', () => {
    it('should create seed successfully', async () => {
      req.body = {
        name: 'Tomato',
        collectedDate: '2026-08-15',
        quantity: 25,
        viable: 90,
      };

      const createdSeed = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Tomato',
        collectedDate: new Date('2026-08-15'),
        quantity: 25,
        viable: 90,
      };

      jest.spyOn(SeedInventory, 'create').mockResolvedValue(createdSeed);

      await createSeedInventory(req, res);

      expect(SeedInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tomato',
          quantity: 25,
          viable: 90,
          collectedDate: expect.any(Date),
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdSeed);
    });

    it('should trim seed name', async () => {
      req.body = {
        name: '  Tomato  ',
        collectedDate: '2026-08-15',
        quantity: '10',
        viable: '80',
      };

      jest.spyOn(SeedInventory, 'create').mockResolvedValue({
        name: 'Tomato',
      });

      await createSeedInventory(req, res);

      expect(SeedInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tomato',
          quantity: 10,
          viable: 80,
        }),
      );
    });

    it.each([
      [
        'missing name',
        {
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: 90,
        },
        'Seed name is required',
      ],
      [
        'non-string name',
        {
          name: 123,
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: 90,
        },
        'Seed name is required',
      ],
      [
        'whitespace name',
        {
          name: '   ',
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: 90,
        },
        'Seed name is required',
      ],
    ])('should reject %s', async (_description, body, message) => {
      req.body = body;

      const createSpy = jest.spyOn(SeedInventory, 'create');

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should reject missing date', async () => {
      req.body = {
        name: 'Tomato',
        quantity: 10,
        viable: 90,
      };

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'collected date is required',
      });
    });

    it('should reject invalid date', async () => {
      req.body = {
        name: 'Tomato',
        collectedDate: 'invalid-date',
        quantity: 10,
        viable: 90,
      };

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid collected date',
      });
    });

    it.each([
      [
        'negative quantity',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          quantity: -1,
          viable: 90,
        },
      ],
      [
        'invalid quantity',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          quantity: 'abc',
          viable: 90,
        },
      ],
      [
        'missing quantity',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          viable: 90,
        },
      ],
    ])('should reject %s', async (_description, body) => {
      req.body = body;

      const createSpy = jest.spyOn(SeedInventory, 'create');

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quantity must be a non-negative number',
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it.each([
      [
        'viability below zero',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: -1,
        },
      ],
      [
        'viability above 100',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: 101,
        },
      ],
      [
        'invalid viability',
        {
          name: 'Tomato',
          collectedDate: '2026-08-15',
          quantity: 10,
          viable: 'abc',
        },
      ],
    ])('should reject %s', async (_description, body) => {
      req.body = body;

      const createSpy = jest.spyOn(SeedInventory, 'create');

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Viability must be a number between 0 and 100',
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should return 500 when create fails', async () => {
      req.body = {
        name: 'Tomato',
        collectedDate: '2026-08-15',
        quantity: 10,
        viable: 90,
      };

      jest.spyOn(SeedInventory, 'create').mockRejectedValue(new Error('Database error'));

      await createSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('updateSeedInventory', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('should update seed successfully', async () => {
      req.params.id = validId;
      req.body = {
        name: 'Updated Tomato',
        quantity: 30,
        viable: 95,
      };

      const updatedSeed = {
        _id: validId,
        name: 'Updated Tomato',
        quantity: 30,
        viable: 95,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue(updatedSeed);

      await updateSeedInventory(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          name: 'Updated Tomato',
          quantity: 30,
          viable: 95,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedSeed);
    });

    it('should trim updated name', async () => {
      req.params.id = validId;
      req.body = {
        name: '  Updated Tomato  ',
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue({
        name: 'Updated Tomato',
      });

      await updateSeedInventory(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          name: 'Updated Tomato',
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should update collected date', async () => {
      req.params.id = validId;
      req.body = {
        collectedDate: '2026-08-15',
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue({});

      await updateSeedInventory(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          collectedDate: expect.any(Date),
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should convert quantity to number', async () => {
      req.params.id = validId;
      req.body = {
        quantity: '25',
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue({});

      await updateSeedInventory(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          quantity: 25,
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should convert viability to number', async () => {
      req.params.id = validId;
      req.body = {
        viable: '85',
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue({});

      await updateSeedInventory(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          viable: 85,
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid';

      const updateSpy = jest.spyOn(SeedInventory, 'findByIdAndUpdate');

      await updateSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['empty update', {}, 'No valid fields provided for update'],
      ['unsupported field', { unsupportedField: 'value' }, 'No valid fields provided for update'],
      ['empty name', { name: '   ' }, 'Seed name cannot be empty'],
      ['non-string name', { name: 123 }, 'Seed name cannot be empty'],
      ['invalid date', { collectedDate: 'invalid-date' }, 'Invalid collected date'],
      ['invalid quantity', { quantity: -5 }, 'Quantity must be a non-negative number'],
      ['invalid viability', { viable: 101 }, 'Viability must be a number between 0 and 100'],
    ])('should reject %s', async (_description, body, message) => {
      req.params.id = validId;
      req.body = body;

      const updateSpy = jest.spyOn(SeedInventory, 'findByIdAndUpdate');

      await updateSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when seed is not found', async () => {
      req.params.id = validId;
      req.body = {
        quantity: 20,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue(null);

      await updateSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed inventory item not found',
      });
    });

    it('should return 500 when update fails', async () => {
      req.params.id = validId;
      req.body = {
        quantity: 20,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockRejectedValue(new Error('Database error'));

      await updateSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('deleteSeedInventory', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('should delete seed successfully', async () => {
      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findByIdAndDelete').mockResolvedValue({
        _id: validId,
        name: 'Tomato',
      });

      await deleteSeedInventory(req, res);

      expect(SeedInventory.findByIdAndDelete).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed inventory item deleted successfully',
      });
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid';

      const deleteSpy = jest.spyOn(SeedInventory, 'findByIdAndDelete');

      await deleteSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when seed is not found', async () => {
      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findByIdAndDelete').mockResolvedValue(null);

      await deleteSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed inventory item not found',
      });
    });

    it('should return 500 when delete fails', async () => {
      req.params.id = validId;

      jest.spyOn(SeedInventory, 'findByIdAndDelete').mockRejectedValue(new Error('Database error'));

      await deleteSeedInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('updateSeedQuantity', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('should update quantity successfully', async () => {
      req.params.id = validId;
      req.body = {
        quantity: 50,
      };

      const updatedSeed = {
        _id: validId,
        quantity: 50,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue(updatedSeed);

      await updateSeedQuantity(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          quantity: 50,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedSeed);
    });

    it('should convert quantity to number', async () => {
      req.params.id = validId;
      req.body = {
        quantity: '25',
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue({
        quantity: 25,
      });

      await updateSeedQuantity(req, res);

      expect(SeedInventory.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          quantity: 25,
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid';
      req.body = {
        quantity: 10,
      };

      const updateSpy = jest.spyOn(SeedInventory, 'findByIdAndUpdate');

      await updateSeedQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['negative quantity', -1],
      ['non-numeric quantity', 'abc'],
      ['missing quantity', undefined],
    ])('should reject %s', async (_description, quantity) => {
      req.params.id = validId;

      if (quantity !== undefined) {
        req.body = { quantity };
      }

      const updateSpy = jest.spyOn(SeedInventory, 'findByIdAndUpdate');

      await updateSeedQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quantity must be a non-negative number',
      });

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when seed is not found', async () => {
      req.params.id = validId;
      req.body = {
        quantity: 20,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockResolvedValue(null);

      await updateSeedQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed inventory item not found',
      });
    });

    it('should return 500 when update fails', async () => {
      req.params.id = validId;
      req.body = {
        quantity: 20,
      };

      jest.spyOn(SeedInventory, 'findByIdAndUpdate').mockRejectedValue(new Error('Database error'));

      await updateSeedQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });
});
