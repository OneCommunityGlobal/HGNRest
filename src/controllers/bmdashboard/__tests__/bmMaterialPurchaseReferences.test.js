jest.mock('../../../models/bmdashboard/buildingProject', () => ({ findById: jest.fn() }), { virtual: true });
jest.mock('../../../models/bmdashboard/buildingInventoryType', () => ({
  invTypeBase: { findById: jest.fn() },
}), { virtual: true });

const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const { invTypeBase } = require('../../../models/bmdashboard/buildingInventoryType');
const createController = require('../bmMaterialsController');

const query = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});
const project = { name: 'Building 1' };
const material = { name: 'Sand', unit: 'kg', __t: 'material_type' };
const body = {
  primaryId: '507f1f77bcf86cd799439011',
  secondaryId: '507f1f77bcf86cd799439012',
  quantity: 10,
  priority: 'Low',
  requestor: { requestorId: '507f1f77bcf86cd799439013' },
};

describe('material purchase references', () => {
  let model;
  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    BuildingProject.findById.mockReturnValue(query(project));
    invTypeBase.findById.mockReturnValue(query(material));
    model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn(),
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
  });

  it.each([null, { name: '' }, { name: '   ' }])(
    'rejects a missing or unnamed project %p before writing',
    async (value) => {
      BuildingProject.findById.mockReturnValue(query(value));
      await createController(model).bmPurchaseMaterials({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'projectId' }));
      expect(model.findOne).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    { ...material, name: ' ' },
    { ...material, unit: '' },
    { ...material, __t: 'consumable_type' },
  ])('rejects an invalid material reference %p before writing', async (value) => {
    invTypeBase.findById.mockReturnValue(query(value));
    await createController(model).bmPurchaseMaterials({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'matTypeId' }));
    expect(model.findOne).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('allows a named project and material with a unit', async () => {
    await createController(model).bmPurchaseMaterials({ body }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ stockBought: 0 }));
  });
});
