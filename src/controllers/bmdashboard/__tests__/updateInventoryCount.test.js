const updateCount = require('../updateInventoryCount');

const id = '6652347c57ca141fe891e1ca';
const projectId = '6652347c57ca141fe891e1cb';
const body = () => ({
  count: 0,
  expectedCount: null,
  date: '2026-01-01',
  condition: 'Good',
  projectId,
  requestor: { requestorId: id },
});
const response = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('inventory count update', () => {
  let Model;
  beforeEach(() => {
    Model = {
      findById: jest.fn().mockResolvedValue({ _id: id, project: projectId }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ count: 0 }),
    };
  });
  it('saves zero and appends authenticated audit data atomically', async () => {
    const res = response();
    await updateCount(Model, 'toolId')({ params: { toolId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, count: null },
      expect.objectContaining({
        $set: { count: 0 },
        $push: {
          countHistory: expect.objectContaining({
            createdBy: id,
            previousCount: null,
            count: 0,
            condition: 'Good',
          }),
        },
      }),
      { new: true, runValidators: true },
    );
  });
  it.each([-1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid count %s',
    async (count) => {
      const res = response();
      await updateCount(Model, 'toolId')(
        { params: { toolId: id }, body: { ...body(), count } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(Model.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );
  it.each([
    { date: '' },
    { date: '2026-02-30' },
    { date: '2999-01-01' },
    { condition: '' },
    { condition: 'Broken' },
    { projectId: 'invalid' },
  ])('rejects invalid update metadata %j', async (fields) => {
    const res = response();
    await updateCount(Model, 'toolId')(
      { params: { toolId: id }, body: { ...body(), ...fields } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('supports equipment IDs through the same validated endpoint', async () => {
    const res = response();
    await updateCount(Model, 'equipmentId')({ params: { equipmentId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('rejects missing authenticated user', async () => {
    const res = response();
    await updateCount(Model, 'toolId')(
      { params: { toolId: id }, body: { ...body(), requestor: null } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
  it('rejects an item from another project', async () => {
    Model.findById.mockResolvedValue({ _id: id, project: id });
    const res = response();
    await updateCount(Model, 'toolId')({ params: { toolId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('rejects a stale count', async () => {
    Model.findById.mockResolvedValue({ _id: id, project: projectId, count: 3 });
    const res = response();
    await updateCount(Model, 'toolId')({ params: { toolId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects a concurrent write', async () => {
    Model.findOneAndUpdate.mockResolvedValue(null);
    const res = response();
    await updateCount(Model, 'toolId')({ params: { toolId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('reports storage failures', async () => {
    Model.findById.mockRejectedValue(new Error('offline'));
    const res = response();
    await updateCount(Model, 'toolId')({ params: { toolId: id }, body: body() }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// Verify the models actually mounted by startup/routes.js retain these fields.
describe('mounted inventory schemas', () => {
  const {
    buildingTool,
    buildingEquipment,
  } = require('../../../models/bmdashboard/buildingInventoryItem');
  it.each([buildingTool, buildingEquipment])('retains count and audit metadata', (Model) => {
    const item = new Model({
      count: 3,
      countHistory: [
        { date: new Date(), createdBy: id, condition: 'Good', previousCount: 1, count: 3 },
      ],
    });
    expect(item.count).toBe(3);
    expect(item.countHistory[0].count).toBe(3);
    expect(String(item.countHistory[0].createdBy)).toBe(id);
    expect(item.validateSync()).toBeUndefined();
  });
});
