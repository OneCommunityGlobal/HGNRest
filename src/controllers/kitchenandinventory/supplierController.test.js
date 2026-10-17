jest.mock('../../models/kitchenandinventory/supplier', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

const Supplier = require('../../models/kitchenandinventory/supplier');
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('./supplierController');

describe('Supplier Controller', () => {
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
      json: jest.fn(),
    };
  });

  describe('getSuppliers', () => {
    it('should return all suppliers', async () => {
      const suppliers = [
        {
          name: 'ABC Supplies',
          email: 'abc@example.com',
          phone: '1234567890',
        },
        {
          name: 'XYZ Supplies',
          email: 'xyz@example.com',
          phone: '9876543210',
        },
      ];

      const lean = jest.fn().mockResolvedValue(suppliers);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      expect(Supplier.find).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({ name: 1 });
      expect(lean).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(suppliers);
    });

    it('should filter only active suppliers when activeOnly is true', async () => {
      req.query = {
        activeOnly: 'true',
      };

      const suppliers = [
        {
          name: 'Active Supplier',
          isActive: true,
        },
      ];

      const lean = jest.fn().mockResolvedValue(suppliers);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      expect(Supplier.find).toHaveBeenCalledWith({
        isActive: true,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(suppliers);
    });

    it('should search suppliers by name, email, phone, or contact', async () => {
      req.query = {
        search: 'ABC',
      };

      const suppliers = [
        {
          name: 'ABC Supplies',
        },
      ];

      const lean = jest.fn().mockResolvedValue(suppliers);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      expect(Supplier.find).toHaveBeenCalled();

      const query = Supplier.find.mock.calls[0][0];

      expect(query.$or).toHaveLength(4);

      expect(query.$or[0].name).toEqual(/ABC/i);
      expect(query.$or[1].email).toEqual(/ABC/i);
      expect(query.$or[2].phone).toEqual(/ABC/i);
      expect(query.$or[3].contact).toEqual(/ABC/i);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(suppliers);
    });

    it('should trim the search string before searching', async () => {
      req.query = {
        search: '  ABC  ',
      };

      const lean = jest.fn().mockResolvedValue([]);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      const query = Supplier.find.mock.calls[0][0];

      expect(query.$or[0].name).toEqual(/ABC/i);
    });

    it('should combine activeOnly and search filters', async () => {
      req.query = {
        activeOnly: 'true',
        search: 'ABC',
      };

      const lean = jest.fn().mockResolvedValue([]);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      const query = Supplier.find.mock.calls[0][0];

      expect(query.isActive).toBe(true);
      expect(query.$or).toHaveLength(4);
    });

    it('should handle an empty search string', async () => {
      req.query = {
        search: '   ',
      };

      const lean = jest.fn().mockResolvedValue([]);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      expect(Supplier.find).toHaveBeenCalledWith({});

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should escape special regex characters in the search string', async () => {
      req.query = {
        search: 'ABC.*+?',
      };

      const lean = jest.fn().mockResolvedValue([]);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      await getSuppliers(req, res);

      const query = Supplier.find.mock.calls[0][0];

      expect(query.$or[0].name.source).toBe('ABC\\.\\*\\+\\?');
      expect(query.$or[0].name.flags).toContain('i');
    });

    it('should return 500 when Supplier.find fails', async () => {
      const error = new Error('Database error');

      const lean = jest.fn().mockRejectedValue(error);
      const sort = jest.fn().mockReturnValue({ lean });

      Supplier.find.mockReturnValue({ sort });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getSuppliers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch suppliers',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getSupplierById', () => {
    it('should return a supplier by ID', async () => {
      const supplier = {
        _id: 'supplier123',
        name: 'ABC Supplies',
        email: 'abc@example.com',
      };

      Supplier.findById.mockResolvedValue(supplier);

      req.params.id = 'supplier123';

      await getSupplierById(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('supplier123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(supplier);
    });

    it('should return 404 when supplier is not found', async () => {
      Supplier.findById.mockResolvedValue(null);

      req.params.id = 'missing123';

      await getSupplierById(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('missing123');

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should return 500 when finding supplier fails', async () => {
      Supplier.findById.mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getSupplierById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch supplier',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('createSupplier', () => {
    it('should create a supplier successfully', async () => {
      req.body = {
        name: 'ABC Supplies',
        contact: 'John Doe',
        email: 'ABC@Example.com',
        phone: '1234567890',
        specialities: ['Food', 'Equipment'],
        website: 'https://example.com',
      };

      const supplier = {
        _id: 'supplier123',
        name: 'ABC Supplies',
        contact: 'John Doe',
        email: 'abc@example.com',
        phone: '1234567890',
        specialities: ['Food', 'Equipment'],
        website: 'https://example.com',
      };

      Supplier.findOne.mockResolvedValue(null);
      Supplier.create.mockResolvedValue(supplier);

      await createSupplier(req, res);

      expect(Supplier.findOne).toHaveBeenCalledWith({
        email: 'abc@example.com',
      });

      expect(Supplier.create).toHaveBeenCalledWith({
        name: 'ABC Supplies',
        contact: 'John Doe',
        email: 'abc@example.com',
        phone: '1234567890',
        specialities: ['Food', 'Equipment'],
        website: 'https://example.com',
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(supplier);
    });

    it('should return 400 when name is missing', async () => {
      req.body = {
        email: 'test@example.com',
        phone: '1234567890',
      };

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Name, email, and phone are required',
      });

      expect(Supplier.findOne).not.toHaveBeenCalled();
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      req.body = {
        name: 'ABC Supplies',
        phone: '1234567890',
      };

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Name, email, and phone are required',
      });

      expect(Supplier.findOne).not.toHaveBeenCalled();
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it('should return 400 when phone is missing', async () => {
      req.body = {
        name: 'ABC Supplies',
        email: 'test@example.com',
      };

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Name, email, and phone are required',
      });

      expect(Supplier.findOne).not.toHaveBeenCalled();
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it('should return 409 when supplier email already exists', async () => {
      req.body = {
        name: 'ABC Supplies',
        email: 'ABC@Example.com',
        phone: '1234567890',
      };

      Supplier.findOne.mockResolvedValue({
        _id: 'existing123',
        email: 'abc@example.com',
      });

      await createSupplier(req, res);

      expect(Supplier.findOne).toHaveBeenCalledWith({
        email: 'abc@example.com',
      });

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'A supplier with this email already exists',
      });

      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it('should return 500 when creating supplier fails', async () => {
      req.body = {
        name: 'ABC Supplies',
        email: 'abc@example.com',
        phone: '1234567890',
      };

      Supplier.findOne.mockResolvedValue(null);
      Supplier.create.mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to create supplier',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateSupplier', () => {
    it('should update a supplier successfully', async () => {
      const supplier = {
        _id: 'supplier123',
        name: 'Old Supplier',
        contact: 'Old Contact',
        email: 'old@example.com',
        phone: '1111111111',
        specialities: ['Old'],
        website: 'https://old.com',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Supplier.findById.mockResolvedValue(supplier);

      req.params.id = 'supplier123';

      req.body = {
        name: 'Updated Supplier',
        contact: 'John Doe',
        email: 'UPDATED@EXAMPLE.COM',
        phone: '2222222222',
        specialities: ['Food', 'Equipment'],
        website: 'https://updated.com',
        isActive: false,
      };

      await updateSupplier(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('supplier123');

      expect(supplier.name).toBe('Updated Supplier');
      expect(supplier.contact).toBe('John Doe');
      expect(supplier.email).toBe('updated@example.com');
      expect(supplier.phone).toBe('2222222222');
      expect(supplier.specialities).toEqual(['Food', 'Equipment']);
      expect(supplier.website).toBe('https://updated.com');
      expect(supplier.isActive).toBe(false);

      expect(supplier.updated).toBeInstanceOf(Date);
      expect(supplier.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(supplier);
    });

    it('should update only provided fields', async () => {
      const supplier = {
        _id: 'supplier123',
        name: 'Original Supplier',
        contact: 'Original Contact',
        email: 'original@example.com',
        phone: '1234567890',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Supplier.findById.mockResolvedValue(supplier);

      req.params.id = 'supplier123';

      req.body = {
        name: 'Updated Supplier',
      };

      await updateSupplier(req, res);

      expect(supplier.name).toBe('Updated Supplier');
      expect(supplier.contact).toBe('Original Contact');
      expect(supplier.email).toBe('original@example.com');
      expect(supplier.phone).toBe('1234567890');
      expect(supplier.isActive).toBe(true);

      expect(supplier.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should lowercase email when updating it', async () => {
      const supplier = {
        _id: 'supplier123',
        email: 'old@example.com',
        save: jest.fn().mockResolvedValue(true),
      };

      Supplier.findById.mockResolvedValue(supplier);

      req.params.id = 'supplier123';

      req.body = {
        email: 'NEW@EXAMPLE.COM',
      };

      await updateSupplier(req, res);

      expect(supplier.email).toBe('new@example.com');
      expect(supplier.save).toHaveBeenCalled();
    });

    it('should return 404 when supplier does not exist', async () => {
      Supplier.findById.mockResolvedValue(null);

      req.params.id = 'missing123';

      await updateSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should return 500 when updating supplier fails', async () => {
      Supplier.findById.mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await updateSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update supplier',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should return 500 when save fails', async () => {
      const supplier = {
        _id: 'supplier123',
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      Supplier.findById.mockResolvedValue(supplier);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await updateSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update supplier',
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteSupplier', () => {
    it('should deactivate a supplier successfully', async () => {
      const supplier = {
        _id: 'supplier123',
        name: 'ABC Supplies',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Supplier.findById.mockResolvedValue(supplier);

      req.params.id = 'supplier123';

      await deleteSupplier(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('supplier123');

      expect(supplier.isActive).toBe(false);
      expect(supplier.updated).toBeInstanceOf(Date);
      expect(supplier.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier deactivated successfully',
        supplier,
      });
    });

    it('should return 404 when supplier does not exist', async () => {
      Supplier.findById.mockResolvedValue(null);

      req.params.id = 'missing123';

      await deleteSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should return 500 when finding supplier fails', async () => {
      Supplier.findById.mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await deleteSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to deactivate supplier',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should return 500 when save fails', async () => {
      const supplier = {
        _id: 'supplier123',
        name: 'ABC Supplies',
        isActive: true,
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      Supplier.findById.mockResolvedValue(supplier);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await deleteSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to deactivate supplier',
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
