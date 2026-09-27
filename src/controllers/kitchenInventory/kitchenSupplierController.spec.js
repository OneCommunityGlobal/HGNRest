jest.mock('../../models/kitchenInventory/supplier', () => {
  const mock = jest.fn();
  mock.findOne = jest.fn();
  mock.find = jest.fn();
  mock.findById = jest.fn();
  mock.findByIdAndUpdate = jest.fn();
  mock.findByIdAndDelete = jest.fn();
  return mock;
});
jest.mock('../../models/kitchenInventory/order', () => ({
  aggregate: jest.fn(),
}));

const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');
const kitchenSupplierController = require('./kitchenSupplierController');

const VALID_OID = '507f1f77bcf86cd799439011';
const OTHER_OID = '507f1f77bcf86cd799439012';
const INVALID_OID = 'not-a-valid-id';

function makeReq(overrides = {}) {
  return {
    body: {
      requestor: { role: 'Administrator', requestorId: VALID_OID },
      ...overrides.body,
    },
    query: overrides.query || {},
    params: overrides.params || {},
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

function leanResult(value) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

describe('kitchenSupplierController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = kitchenSupplierController();
  });

  describe('createSupplier', () => {
    test('returns 400 when name is missing', async () => {
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: {} }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid supplier name' });
      expect(Supplier.findOne).not.toHaveBeenCalled();
    });

    test('returns 400 when name is only whitespace', async () => {
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: '   ' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid supplier name' });
    });

    test('returns 400 when name is not a string', async () => {
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: 123 } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid supplier name' });
    });

    test('returns 400 when isActive is not a boolean', async () => {
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: 'Acme', isActive: 'yes' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid isActive value' });
    });

    test('returns 400 when a supplier with the same name already exists', async () => {
      Supplier.findOne.mockResolvedValue({ _id: OTHER_OID, name: 'Acme' });
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: 'acme' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier already exists' });
    });

    test('checks duplicates case-insensitively with regex characters escaped', async () => {
      Supplier.findOne.mockResolvedValue(null);
      Supplier.mockImplementation((data) => ({ save: jest.fn().mockResolvedValue(data) }));
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: '  A+B (Foods)  ' } }), res);

      expect(Supplier.findOne).toHaveBeenCalledWith({
        name: { $regex: '^A\\+B \\(Foods\\)$', $options: 'i' },
      });
    });

    test('creates the supplier with a trimmed name and returns 201', async () => {
      Supplier.findOne.mockResolvedValue(null);
      const save = jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Acme' });
      Supplier.mockImplementation(() => ({ save }));
      const res = makeRes();

      await controller.createSupplier(
        makeReq({
          body: {
            name: '  Acme  ',
            email: 'a@acme.com',
            phone: '123',
            specialities: ['Organic'],
            isActive: true,
          },
        }),
        res,
      );

      expect(Supplier).toHaveBeenCalledWith({
        name: 'Acme',
        email: 'a@acme.com',
        phone: '123',
        specialities: ['Organic'],
        isActive: true,
      });
      expect(save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ _id: VALID_OID, name: 'Acme' });
    });

    test('does not include fields that were not sent', async () => {
      Supplier.findOne.mockResolvedValue(null);
      Supplier.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));
      await controller.createSupplier(makeReq({ body: { name: 'Acme' } }), makeRes());

      expect(Supplier).toHaveBeenCalledWith({ name: 'Acme' });
    });

    test('returns 400 when save fails', async () => {
      Supplier.findOne.mockResolvedValue(null);
      Supplier.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('validation failed')),
      }));
      const res = makeRes();
      await controller.createSupplier(makeReq({ body: { name: 'Acme' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ err: 'Unable to create supplier' });
    });
  });

  describe('getSuppliers', () => {
    test('returns 200 with all suppliers', async () => {
      const suppliers = [{ name: 'Acme' }, { name: 'Best Produce' }];
      Supplier.find.mockReturnValue(leanResult(suppliers));
      const res = makeRes();

      await controller.getSuppliers(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(suppliers);
    });

    test('returns 500 when the query fails', async () => {
      Supplier.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('db down')) });
      const res = makeRes();

      await controller.getSuppliers(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });

  describe('getSupplierById', () => {
    test('returns 400 for an invalid id', async () => {
      const res = makeRes();
      await controller.getSupplierById(makeReq({ params: { supplierId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Supplier' });
      expect(Supplier.findById).not.toHaveBeenCalled();
    });

    test('returns 404 when the supplier does not exist', async () => {
      Supplier.findById.mockReturnValue(leanResult(null));
      const res = makeRes();

      await controller.getSupplierById(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier Not found' });
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    test('returns the supplier with order stats', async () => {
      Supplier.findById.mockReturnValue(
        leanResult({ _id: VALID_OID, name: 'Acme', specialities: ['Organic'] }),
      );
      Order.aggregate.mockResolvedValue([{ totalOrders: 3, avgDeliveryDays: 2.3456 }]);
      const res = makeRes();

      await controller.getSupplierById(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        _id: VALID_OID,
        name: 'Acme',
        specialities: ['Organic'],
        attributes: ['Organic'],
        totalOrders: 3,
        avgDeliveryDays: 2.35,
      });
    });

    test('returns zero stats and empty attributes when there are no delivered orders', async () => {
      Supplier.findById.mockReturnValue(leanResult({ _id: VALID_OID, name: 'Acme' }));
      Order.aggregate.mockResolvedValue([]);
      const res = makeRes();

      await controller.getSupplierById(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ attributes: [], totalOrders: 0, avgDeliveryDays: 0 }),
      );
    });

    test('returns 500 when the query fails', async () => {
      Supplier.findById.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('boom')) });
      const res = makeRes();

      await controller.getSupplierById(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });

  describe('updateSupplier', () => {
    test('returns 400 for an invalid id', async () => {
      const res = makeRes();
      await controller.updateSupplier(makeReq({ params: { supplierId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Supplier Id' });
    });

    test('returns 400 when name is empty', async () => {
      const res = makeRes();
      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { name: '  ' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid supplier name' });
      expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('returns 400 when the new name belongs to another supplier', async () => {
      Supplier.findOne.mockResolvedValue({ _id: OTHER_OID, name: 'Best Produce Inc' });
      const res = makeRes();

      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { name: 'best produce inc' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier already exists' });
      expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('excludes the supplier being updated from the duplicate check', async () => {
      Supplier.findOne.mockResolvedValue(null);
      Supplier.findByIdAndUpdate.mockResolvedValue({ _id: VALID_OID, name: 'Acme' });

      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { name: 'Acme' } }),
        makeRes(),
      );

      const filter = Supplier.findOne.mock.calls[0][0];
      expect(String(filter._id.$ne)).toBe(VALID_OID);
      expect(filter.name).toEqual({ $regex: '^Acme$', $options: 'i' });
    });

    test('skips the duplicate check when name is not sent', async () => {
      Supplier.findByIdAndUpdate.mockResolvedValue({ _id: VALID_OID });

      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { phone: '999' } }),
        makeRes(),
      );

      expect(Supplier.findOne).not.toHaveBeenCalled();
    });

    test('returns 400 when isActive is not a boolean', async () => {
      const res = makeRes();
      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { isActive: 'false' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid isActive value' });
    });

    test('updates the supplier and returns 200', async () => {
      Supplier.findOne.mockResolvedValue(null);
      const updated = { _id: VALID_OID, name: 'Acme', phone: '999', isActive: false };
      Supplier.findByIdAndUpdate.mockResolvedValue(updated);
      const res = makeRes();

      await controller.updateSupplier(
        makeReq({
          params: { supplierId: VALID_OID },
          body: { name: '  Acme ', phone: '999', specialities: ['Local'], isActive: false },
        }),
        res,
      );

      const [id, update, options] = Supplier.findByIdAndUpdate.mock.calls[0];
      expect(String(id)).toBe(VALID_OID);
      expect(update).toEqual(
        expect.objectContaining({
          name: 'Acme',
          phone: '999',
          specialities: ['Local'],
          isActive: false,
          updated: expect.any(Number),
        }),
      );
      expect(options).toEqual({ new: true, runValidators: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test('returns 404 when the supplier does not exist', async () => {
      Supplier.findByIdAndUpdate.mockResolvedValue(null);
      const res = makeRes();

      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { phone: '999' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier Not Found' });
    });

    test('returns 400 when the update fails', async () => {
      Supplier.findByIdAndUpdate.mockRejectedValue(new Error('validation failed'));
      const res = makeRes();

      await controller.updateSupplier(
        makeReq({ params: { supplierId: VALID_OID }, body: { email: 'bad' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ err: 'Unable to update supplier' });
    });
  });

  describe('deleteSupplier', () => {
    test('returns 400 for an invalid id', async () => {
      const res = makeRes();
      await controller.deleteSupplier(makeReq({ params: { supplierId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Supplier Id' });
      expect(Supplier.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test('returns 404 when the supplier does not exist', async () => {
      Supplier.findByIdAndDelete.mockResolvedValue(null);
      const res = makeRes();

      await controller.deleteSupplier(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier Not Found' });
    });

    test('deletes the supplier and returns 200', async () => {
      Supplier.findByIdAndDelete.mockResolvedValue({ _id: VALID_OID });
      const res = makeRes();

      await controller.deleteSupplier(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(String(Supplier.findByIdAndDelete.mock.calls[0][0])).toBe(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
    });

    test('returns 500 when the delete fails', async () => {
      Supplier.findByIdAndDelete.mockRejectedValue(new Error('boom'));
      const res = makeRes();

      await controller.deleteSupplier(makeReq({ params: { supplierId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });
});
