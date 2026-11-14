const createController = require('../bmMaterialsController');

const id = '507f1f77bcf86cd799439011';
const secondId = '507f1f77bcf86cd799439012';
const purchaseId = '507f1f77bcf86cd799439013';
const saved = { _id: id, stockBought: 100, stockUsed: 20, stockWasted: 10, stockAvailable: 70 };
const payload = (overrides = {}) => ({
  material: { _id: id, stockBought: 9999, stockAvailable: 9999, stockUsed: 0, stockWasted: 0 },
  quantityUsed: 10,
  quantityWasted: 5,
  QtyUsedLogUnit: 'unit',
  QtyWastedLogUnit: 'unit',
  date: '2026-11-13',
  requestor: { requestorId: id },
  ...overrides,
});
const response = () => ({ status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() });

describe('Material stock integrity', () => {
  let model;
  let controller;
  beforeEach(() => {
    model = {
      findOne: jest.fn().mockResolvedValue({ ...saved }),
      updateOne: jest.fn().mockResolvedValue({ n: 1, nModified: 1 }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    controller = createController(model);
  });

  it('ignores forged browser totals and guards every saved stock field', async () => {
    const res = response();
    await controller.bmPostMaterialUpdateRecord({ body: payload() }, res);
    expect(model.updateOne).toHaveBeenCalledWith(saved, {
      $set: { stockUsed: 30, stockWasted: 15, stockAvailable: 55 },
      $push: {
        updateRecord: { date: '2026-11-13', createdBy: id, quantityUsed: 10, quantityWasted: 5 },
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([-1, Infinity, NaN, 'abc', '', null, true, {}, []])(
    'rejects invalid Used %p without a write',
    async (quantityUsed) => {
      const res = response();
      await controller.bmPostMaterialUpdateRecord({ body: payload({ quantityUsed }) }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(model.updateOne).not.toHaveBeenCalled();
    },
  );

  it.each(['unit', 'percent'])('rejects excessive combined usage in %s', async (unit) => {
    const res = response();
    await controller.bmPostMaterialUpdateRecord(
      {
        body: payload({
          quantityUsed: 60,
          quantityWasted: 50,
          QtyUsedLogUnit: unit,
          QtyWastedLogUnit: unit,
        }),
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('allows exact exhaustion using percentages of saved Available', async () => {
    const res = response();
    await controller.bmPostMaterialUpdateRecord(
      {
        body: payload({
          quantityUsed: 80,
          quantityWasted: 20,
          QtyUsedLogUnit: 'percent',
          QtyWastedLogUnit: 'percent',
        }),
      },
      res,
    );
    expect(model.updateOne.mock.calls[0][1].$set).toEqual({
      stockUsed: 76,
      stockWasted: 24,
      stockAvailable: 0,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    { stockUsed: 110, stockAvailable: -20 },
    { stockAvailable: 90 },
    { stockBought: undefined },
  ])('blocks inconsistent legacy stock %p without correcting it', async (overrides) => {
    model.findOne.mockResolvedValue({ ...saved, ...overrides });
    const res = response();
    await controller.bmPostMaterialUpdateRecord({ body: payload() }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('returns 404 when the saved material no longer exists', async () => {
    model.findOne.mockResolvedValue(null);
    const res = response();
    await controller.bmPostMaterialUpdateRecord({ body: payload() }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it.each([-1, Infinity, 'invalid'])(
    'rejects invalid Wasted %p in bulk before any writes',
    async (quantityWasted) => {
      const res = response();
      await controller.bmPostMaterialUpdateBulk(
        { body: { upadateMaterials: [payload({ quantityWasted })] } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(model.updateOne).not.toHaveBeenCalled();
    },
  );

  it.each([{ n: 0 }, { matchedCount: 0 }])(
    'reports a concurrent change with result %p',
    async (result) => {
      model.updateOne.mockResolvedValue(result);
      const res = response();
      await controller.bmPostMaterialUpdateRecord({ body: payload() }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Refresh'));
    },
  );

  it('prevalidates all bulk rows before writing any of them', async () => {
    const res = response();
    await controller.bmPostMaterialUpdateBulk(
      {
        body: {
          upadateMaterials: [
            payload(),
            payload({ material: { _id: secondId }, quantityUsed: 100 }),
          ],
        },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('rejects duplicate material IDs in one bulk request', async () => {
    const res = response();
    await controller.bmPostMaterialUpdateBulk(
      { body: { upadateMaterials: [payload(), payload()] } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('reports saved rows if a later bulk row encounters a conflict', async () => {
    model.findOne.mockImplementation(({ _id }) => Promise.resolve({ ...saved, _id }));
    model.updateOne.mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 0 });
    const res = response();
    await controller.bmPostMaterialUpdateBulk(
      { body: { upadateMaterials: [payload(), payload({ material: { _id: secondId } })] } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('1 material updates were saved'));
  });

  it('approves stored purchase quantity once and increments Bought and Available together', async () => {
    model.findOne.mockResolvedValue({
      purchaseRecord: [{ _id: purchaseId, status: 'Pending', quantity: 25 }],
    });
    const res = response();
    await controller.bmupdatePurchaseStatus(
      { body: { purchaseId, status: 'Approved', quantity: 9999 } },
      res,
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        purchaseRecord: { $elemMatch: { _id: expect.anything(), status: 'Pending', quantity: 25 } },
      },
      {
        $set: { 'purchaseRecord.$.status': 'Approved' },
        $inc: { stockBought: 25, stockAvailable: 25 },
      },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns conflict when another request already approved the purchase', async () => {
    model.findOne.mockResolvedValue({
      purchaseRecord: [{ _id: purchaseId, status: 'Pending', quantity: 25 }],
    });
    model.findOneAndUpdate.mockResolvedValue(null);
    const res = response();
    await controller.bmupdatePurchaseStatus({ body: { purchaseId, status: 'Approved' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
