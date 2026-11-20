jest.mock('../../../models/bmdashboard/buildingSupplier', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));

const BuildingSupplier = require('../../../models/bmdashboard/buildingSupplier');
const logger = require('../../../startup/logger');
const { getSuppliers, createSupplier } = require('../bmSupplierController');

describe('bmSupplierController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getSuppliers', () => {
    it('returns suppliers sorted by name', async () => {
      const suppliers = [{ name: 'ABC Supplies' }, { name: 'XYZ Supplies' }];

      BuildingSupplier.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(suppliers),
      });

      await getSuppliers(req, res);

      expect(BuildingSupplier.find).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(suppliers);
    });

    it('returns 500 when fetching suppliers fails', async () => {
      const error = new Error('Database error');

      BuildingSupplier.find.mockImplementation(() => {
        throw error;
      });

      await getSuppliers(req, res);

      expect(logger.logException).toHaveBeenCalledWith(error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch suppliers',
      });
    });
  });

  describe('createSupplier', () => {
    it('creates a supplier successfully', async () => {
      req.body.name = 'ABC Supplies';

      const supplier = {
        _id: 'supplier123',
        name: 'ABC Supplies',
      };

      BuildingSupplier.findOne.mockResolvedValue(null);
      BuildingSupplier.create.mockResolvedValue(supplier);

      await createSupplier(req, res);

      expect(BuildingSupplier.create).toHaveBeenCalledWith({
        name: 'ABC Supplies',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(supplier);
    });

    it('trims whitespace from supplier names', async () => {
      req.body.name = '  ABC Supplies  ';

      BuildingSupplier.findOne.mockResolvedValue(null);
      BuildingSupplier.create.mockResolvedValue({
        name: 'ABC Supplies',
      });

      await createSupplier(req, res);

      expect(BuildingSupplier.create).toHaveBeenCalledWith({
        name: 'ABC Supplies',
      });
    });

    it('rejects an empty supplier name', async () => {
      req.body.name = '';

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier name is required',
      });
      expect(BuildingSupplier.create).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only supplier name', async () => {
      req.body.name = '   ';

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(BuildingSupplier.create).not.toHaveBeenCalled();
    });

    it('rejects a non-string supplier name', async () => {
      req.body.name = 123;

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(BuildingSupplier.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate supplier names', async () => {
      req.body.name = 'ABC Supplies';

      BuildingSupplier.findOne.mockResolvedValue({
        name: 'ABC Supplies',
      });

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier already exists',
      });
      expect(BuildingSupplier.create).not.toHaveBeenCalled();
    });

    it('checks duplicates case-insensitively', async () => {
      req.body.name = 'abc supplies';

      BuildingSupplier.findOne.mockResolvedValue(null);
      BuildingSupplier.create.mockResolvedValue({
        name: 'abc supplies',
      });

      await createSupplier(req, res);

      const query = BuildingSupplier.findOne.mock.calls[0][0];

      expect(query.name).toBeInstanceOf(RegExp);
      expect(query.name.test('ABC SUPPLIES')).toBe(true);
    });

    it('escapes special regex characters in supplier names', async () => {
      req.body.name = 'ABC (Supplies)';

      BuildingSupplier.findOne.mockResolvedValue(null);
      BuildingSupplier.create.mockResolvedValue({
        name: 'ABC (Supplies)',
      });

      await createSupplier(req, res);

      const query = BuildingSupplier.findOne.mock.calls[0][0];

      expect(query.name.test('ABC (Supplies)')).toBe(true);
      expect(query.name.test('ABC Supplies')).toBe(false);
    });

    it('returns 500 when creating a supplier fails', async () => {
      req.body.name = 'ABC Supplies';

      const error = new Error('Database error');

      BuildingSupplier.findOne.mockResolvedValue(null);
      BuildingSupplier.create.mockRejectedValue(error);

      await createSupplier(req, res);

      expect(logger.logException).toHaveBeenCalledWith(error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to create supplier',
      });
    });
  });
});
