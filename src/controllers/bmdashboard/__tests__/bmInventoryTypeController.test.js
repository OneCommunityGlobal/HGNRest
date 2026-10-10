const controllerFactory = require('../bmInventoryTypeController');

const ID = '507f1f77bcf86cd799439011';
const ID2 = '507f191e810c19729de860ea';
const unsupported =
  'Unsupported inventory type. Expected one of: materials, consumables, tools, reusables, equipments.';

const model = () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
  exec: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  insertMany: jest.fn(),
  populate: jest.fn(),
  sort: jest.fn(),
  lean: jest.fn(),
});
const response = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});
const query = (value, fail = false) => ({
  exec: fail ? jest.fn().mockRejectedValue(value) : jest.fn().mockResolvedValue(value),
});
const tick = () =>
  new Promise((resolve) => {
    process.nextTick(() => resolve());
  });

describe('bmInventoryTypeController', () => {
  let c;
  let req;
  let res;
  let InvType;
  let MatType;
  let ConsType;
  let ReusType;
  let ToolType;
  let EquipType;
  let history;
  let InvUnit;

  beforeEach(() => {
    InvType = model();
    MatType = model();
    ConsType = model();
    ReusType = model();
    ToolType = model();
    EquipType = model();
    history = model();
    InvUnit = model();
    c = controllerFactory(
      InvType,
      MatType,
      ConsType,
      ReusType,
      ToolType,
      EquipType,
      history,
      InvUnit,
    );
    req = { body: {}, params: {} };
    res = response();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ['fetchMaterialTypes', () => MatType],
    ['fetchConsumableTypes', () => ConsType],
    ['fetchReusableTypes', () => ReusType],
    ['fetchEquipmentTypes', () => EquipType],
  ])('%s', (name, getModel) => {
    it('returns records', async () => {
      const m = getModel();
      const rows = [{ _id: ID }];
      m.find.mockReturnValue(query(rows));
      await c[name](req, res);
      expect(m.find).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(rows);
    });
    it('returns query errors', async () => {
      const m = getModel();
      const e = Error('query');
      m.find.mockReturnValue(query(e, true));
      await c[name](req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(e);
    });
  });

  it('fetchToolTypes populates and returns tools', async () => {
    const rows = [{ name: 'Hammer' }];
    const q = { populate: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(rows) };
    ToolType.find.mockReturnValue(q);
    await c.fetchToolTypes(req, res);
    await tick();
    expect(q.populate).toHaveBeenCalledWith([
      expect.objectContaining({ path: 'available' }),
      expect.objectContaining({ path: 'using' }),
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(rows);
  });
  it('fetchToolTypes handles async and sync errors', async () => {
    const e = Error('tool');
    const q = { populate: jest.fn().mockReturnThis(), exec: jest.fn().mockRejectedValue(e) };
    ToolType.find.mockReturnValue(q);
    await c.fetchToolTypes(req, res);
    await tick();
    expect(res.status).toHaveBeenCalledWith(500);
    res = response();
    ToolType.find.mockImplementation(() => {
      throw e;
    });
    await c.fetchToolTypes(req, res);
    expect(res.json).toHaveBeenCalledWith(e);
  });
  it('fetchInvUnits returns units', async () => {
    const rows = [{ unit: 'kg' }];
    InvUnit.find.mockResolvedValue(rows);
    await c.fetchInvUnits(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(rows);
  });
  it('fetchInvUnits handles errors', async () => {
    const e = Error('units');
    InvUnit.find.mockRejectedValue(e);
    await c.fetchInvUnits(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(e);
  });

  describe('generic handlers', () => {
    it('deletes successfully, not found, and error', async () => {
      req.params.id = ID;
      InvType.findByIdAndDelete.mockResolvedValue({ _id: ID });
      await c.deleteInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted successfully', id: ID });
      res = response();
      InvType.findByIdAndDelete.mockResolvedValue(null);
      await c.deleteInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      res = response();
      InvType.findByIdAndDelete.mockRejectedValue(Error('delete'));
      await c.deleteInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'delete' });
    });
    it('updates valid fields, rejects empty fields, not found, and errors', async () => {
      req.params.id = ID;
      req.body = { name: ' Steel ', description: ' Structural ' };
      InvType.findByIdAndUpdate.mockResolvedValue({ _id: ID });
      await c.updateInvType(req, res);
      expect(InvType.findByIdAndUpdate).toHaveBeenCalledWith(
        ID,
        { name: 'Steel', description: 'Structural' },
        { new: true, runValidators: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      res = response();
      req.body = { name: 3, description: ' ' };
      await c.updateInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.body = { name: 'Steel' };
      InvType.findByIdAndUpdate.mockResolvedValue(null);
      await c.updateInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      res = response();
      InvType.findByIdAndUpdate.mockRejectedValue(Error('update'));
      await c.updateInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('create handlers', () => {
    it('adds materials including custom units, duplicate, validation and server errors', async () => {
      req.body = {
        name: 'Concrete',
        description: 'Mix',
        unit: 'yd3',
        requestor: { requestorId: ID2 },
      };
      MatType.find.mockResolvedValue([]);
      MatType.create.mockResolvedValue({ _id: ID });
      await c.addMaterialType(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      req.body = { name: 'Lumber', description: 'Wood', customUnit: 'board foot' };
      MatType.find.mockResolvedValue([]);
      MatType.create.mockResolvedValue({ _id: ID });
      InvUnit.create.mockResolvedValue({});
      await c.addMaterialType(req, res);
      await tick();
      expect(InvUnit.create).toHaveBeenCalledWith({ unit: 'board foot', category: 'Material' });
      res = response();
      MatType.find.mockResolvedValue([{ _id: ID }]);
      await c.addMaterialType(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      MatType.find.mockResolvedValue([]);
      MatType.create.mockRejectedValue({ _message: 'validation failed' });
      await c.addMaterialType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      MatType.create.mockRejectedValue(Error('create'));
      await c.addMaterialType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      MatType.find.mockResolvedValue([]);
      MatType.create.mockResolvedValue({ _id: ID });
      InvUnit.create.mockRejectedValue(Error('unit save'));
      await c.addMaterialType(req, res);
      await tick();
      expect(console.error).toHaveBeenCalledWith('Error saving custom unit:', expect.any(Error));
    });
    it('adds consumables through every branch', async () => {
      req.body = {
        name: 'Screws',
        description: 'Deck',
        unit: 'box',
        size: '#8',
        requestor: { requestorId: ID2 },
      };
      ConsType.find.mockResolvedValue([]);
      ConsType.create.mockResolvedValue({ _id: ID });
      await c.addConsumableType(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      res = response();
      ConsType.find.mockResolvedValue([{ _id: ID }]);
      await c.addConsumableType(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      ConsType.find.mockResolvedValue([]);
      ConsType.create.mockRejectedValue({
        _message: 'validation failed',
        errors: { unit: { message: 'required' } },
      });
      await c.addConsumableType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('required');
      res = response();
      ConsType.create.mockRejectedValue(Error('create'));
      await c.addConsumableType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
    it('adds tools through every branch', async () => {
      req.body = { name: 'Drill', description: 'Cordless', requestor: { requestorId: ID2 } };
      ToolType.find.mockResolvedValue([]);
      ToolType.create.mockResolvedValue({ _id: ID });
      await c.addToolType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(201);
      res = response();
      ToolType.find.mockResolvedValue([{ _id: ID }]);
      await c.addToolType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      ToolType.find.mockResolvedValue([]);
      ToolType.create.mockRejectedValue({
        _message: 'validation failed',
        errors: { unit: { message: 'unit' } },
      });
      await c.addToolType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      ToolType.create.mockRejectedValue(Error('create'));
      await c.addToolType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      ToolType.find.mockRejectedValue(Error('lookup'));
      await c.addToolType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      ToolType.find.mockImplementation(() => {
        throw Error('sync');
      });
      await c.addToolType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
    it('adds equipment with valid/default fuel, duplicate, validation, and errors', async () => {
      req.body = {
        name: 'Excavator',
        description: 'Tracked',
        fuel: 'Biodiesel',
        requestor: { requestorId: ID2 },
      };
      EquipType.find.mockResolvedValue([]);
      EquipType.create.mockResolvedValue({});
      await c.addEquipmentType(req, res);
      await tick();
      expect(EquipType.create).toHaveBeenCalledWith(
        expect.objectContaining({ fuelType: 'Biodiesel' }),
      );
      res = response();
      req.body.fuel = 'Electric';
      EquipType.create.mockResolvedValue({});
      await c.addEquipmentType(req, res);
      await tick();
      expect(EquipType.create).toHaveBeenCalledWith(
        expect.objectContaining({ fuelType: 'Diesel' }),
      );
      res = response();
      EquipType.find.mockResolvedValue([{ _id: ID }]);
      await c.addEquipmentType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      EquipType.find.mockResolvedValue([]);
      EquipType.create.mockRejectedValue({ _message: 'validation failed' });
      await c.addEquipmentType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      EquipType.create.mockRejectedValue(Error('create'));
      await c.addEquipmentType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      EquipType.find.mockRejectedValue(Error('lookup'));
      await c.addEquipmentType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      EquipType.find.mockImplementation(() => {
        throw Error('sync');
      });
      await c.addEquipmentType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
    it('adds reusables through every branch', async () => {
      req.body = { name: 'Gloves', description: 'Work', requestor: { requestorId: ID2 } };
      ReusType.find.mockResolvedValue([]);
      ReusType.create.mockResolvedValue({});
      await c.addReusableType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(201);
      res = response();
      ReusType.find.mockResolvedValue([{ _id: ID }]);
      await c.addReusableType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      ReusType.find.mockResolvedValue([]);
      ReusType.create.mockRejectedValue({ _message: 'validation failed' });
      await c.addReusableType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      ReusType.create.mockRejectedValue(Error('create'));
      await c.addReusableType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      ReusType.find.mockRejectedValue(Error('lookup'));
      await c.addReusableType(req, res);
      await tick();
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      ReusType.find.mockImplementation(() => {
        throw Error('sync');
      });
      await c.addReusableType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  it.each([
    ['Materials', () => MatType],
    ['Consumables', () => ConsType],
    ['Reusables', () => ReusType],
    ['Tools', () => ToolType],
    ['Equipments', () => EquipType],
    ['Other', () => InvType],
  ])('fetchInventoryByType selects %s', async (type, getModel) => {
    const m = getModel();
    req.params.type = type;
    const rows = [{ type }];
    m.find.mockReturnValue(query(rows));
    await c.fetchInventoryByType(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(rows);
  });
  it('fetchInventoryByType handles errors', async () => {
    req.params.type = 'Materials';
    const e = Error('inventory');
    MatType.find.mockReturnValue(query(e, true));
    await c.fetchInventoryByType(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('fetchSingleInventoryType handles success, not found and errors', async () => {
    req.params.invtypeId = ID;
    InvType.findById.mockReturnValue(query({ _id: ID }));
    await c.fetchSingleInventoryType(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    res = response();
    InvType.findById.mockReturnValue(query(null));
    await c.fetchSingleInventoryType(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    res = response();
    InvType.findById.mockReturnValue(query(Error('single'), true));
    await c.fetchSingleInventoryType(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe('updateNameAndUnit', () => {
    beforeEach(() => {
      req.params.invtypeId = ID;
      req.body = {
        name: ' Steel ',
        unit: ' kg ',
        type: 'Material',
        requestor: { requestorId: ID2 },
      };
    });
    it('validates id, name and unit', async () => {
      req.params.invtypeId = 'invalid';
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.params.invtypeId = ID;
      req.body.name = undefined;
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.body.name = 'Steel';
      req.body.unit = ' ';
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('handles absent, duplicate, changed, unchanged, and failed updates', async () => {
      MatType.findById.mockResolvedValue(null);
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      res = response();
      MatType.findById.mockResolvedValue({ name: 'Iron', unit: 'lb' });
      MatType.findOne.mockResolvedValue({ _id: ID2 });
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      MatType.findOne.mockResolvedValue(null);
      MatType.findByIdAndUpdate.mockResolvedValue({ _id: ID });
      history.insertMany.mockResolvedValue([]);
      await c.updateNameAndUnit(req, res);
      expect(history.insertMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      res = response();
      MatType.findById.mockResolvedValue({ name: 'Steel', unit: 'kg' });
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(MatType.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      res = response();
      MatType.findById.mockRejectedValue(Error('update'));
      await c.updateNameAndUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      res = response();
      req.body = { name: 'Screws', unit: 'case', type: 'Consumable' };
      ConsType.findById.mockResolvedValue({ name: 'Screws', unit: 'box' });
      ConsType.findOne.mockResolvedValue(null);
      ConsType.findByIdAndUpdate.mockResolvedValue({ _id: ID });
      history.insertMany.mockResolvedValue([]);
      await c.updateNameAndUnit(req, res);
      expect(ConsType.findByIdAndUpdate).toHaveBeenCalled();
      res = response();
      req.body = { name: 'Steel', unit: 'kg', type: 'Tool' };
      InvType.findById.mockResolvedValue({ name: 'Iron', unit: 'kg' });
      InvType.findOne.mockResolvedValue(null);
      InvType.findByIdAndUpdate.mockResolvedValue({ _id: ID });
      await c.updateNameAndUnit(req, res);
      expect(InvType.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('inventory units', () => {
    it.each([undefined, '', 3])('rejects invalid add unit %p', async (unit) => {
      req.body = { unit };
      await c.addInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('adds units and handles duplicate/error', async () => {
      req.body = { unit: 'kg' };
      InvUnit.findOne.mockResolvedValue(null);
      InvUnit.create.mockResolvedValue({});
      InvUnit.find.mockResolvedValue([{ unit: 'kg' }]);
      await c.addInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      res = response();
      InvUnit.findOne.mockResolvedValue({});
      await c.addInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      res = response();
      InvUnit.findOne.mockRejectedValue(Error('unit'));
      await c.addInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
    it.each([undefined, '', 3])('rejects invalid delete unit %p', async (unit) => {
      req.body = { unit };
      await c.deleteInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('deletes units and handles absent/error', async () => {
      req.body = { unit: 'kg' };
      InvUnit.findOne.mockResolvedValue(null);
      await c.deleteInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      InvUnit.findOne.mockResolvedValue({});
      InvUnit.deleteOne.mockResolvedValue({});
      InvUnit.find.mockResolvedValue([]);
      await c.deleteInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      res = response();
      InvUnit.findOne.mockRejectedValue(Error('delete'));
      await c.deleteInvUnit(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateSingleInvType', () => {
    const cases = [
      [
        'materials',
        () => MatType,
        { name: 'Concrete', description: 'Mix', unit: 'yd3' },
        { name: 'Concrete', description: 'Mix', unit: 'yd3' },
        'Material does not exist',
      ],
      [
        'consumables',
        () => ConsType,
        { name: 'Screws', description: 'Deck', unit: 'box' },
        { name: 'Screws', description: 'Deck', unit: 'box' },
        'Consumable does not exist',
      ],
      [
        'equipments',
        () => EquipType,
        { name: 'Excavator', description: 'Tracked', fuel: 'Diesel' },
        { name: 'Excavator', description: 'Tracked', fuelType: 'Diesel' },
        'Equipment does not exist',
      ],
      [
        'reusables',
        () => ReusType,
        { name: 'Gloves', description: 'Work' },
        { name: 'Gloves', description: 'Work' },
        'Reusable does not exist',
      ],
      [
        'tools',
        () => ToolType,
        { name: 'Drill', description: 'Cordless' },
        { name: 'Drill', description: 'Cordless' },
        'Tool does not exist',
      ],
    ];
    it.each(cases)('updates %s', async (type, getModel, body, update) => {
      const m = getModel();
      req.params = { type, invtypeId: ID };
      req.body = body;
      m.findByIdAndUpdate.mockResolvedValue({ _id: ID });
      await c.updateSingleInvType(req, res);
      expect(m.findByIdAndUpdate).toHaveBeenCalledWith(ID, update, {
        new: true,
        runValidators: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it.each(cases)('returns not found for %s', async (type, getModel, body, update, message) => {
      const m = getModel();
      req.params = { type, invtypeId: ID };
      req.body = body;
      m.findByIdAndUpdate.mockResolvedValue(null);
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });
    it('rejects unsupported/invalid ids and missing fields', async () => {
      req.params = { type: '<bad>', invtypeId: ID };
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: unsupported });
      res = response();
      req.params = { type: 'materials', invtypeId: 'bad' };
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.params.invtypeId = ID;
      req.body = {};
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('handles validation and unexpected update errors', async () => {
      req.params = { type: 'equipments', invtypeId: ID };
      req.body = { name: 'E', description: 'D', fuel: 'Electric' };
      const e = Error('fuel');
      e.name = 'ValidationError';
      EquipType.findByIdAndUpdate.mockRejectedValue(e);
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.params.type = 'materials';
      req.body = { name: 'Concrete', description: 'Mix', unit: 'yd3' };
      MatType.findByIdAndUpdate.mockRejectedValue(Error('db'));
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
    it.each([
      ['consumables', { name: 'Screws', description: '', unit: 'box' }],
      ['equipments', { name: 'Excavator', description: 'Tracked', fuel: '' }],
      ['reusables', { name: 'Gloves', description: '' }],
      ['tools', { name: '', description: 'Cordless' }],
    ])('rejects missing fields for %s', async (type, body) => {
      req.params = { type, invtypeId: ID };
      req.body = body;
      await c.updateSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteSingleInvType', () => {
    const cases = [
      ['equipments', () => EquipType, 'Equipment does not exist'],
      ['materials', () => MatType, 'Material does not exist'],
      ['consumables', () => ConsType, 'Consumables does not exist'],
      ['tools', () => ToolType, 'Tool does not exist'],
      ['reusables', () => ReusType, 'Reusable does not exist'],
    ];
    it.each(cases)('deletes %s', async (type, getModel) => {
      const m = getModel();
      req.params = { type, invtypeId: ID };
      m.findByIdAndDelete.mockResolvedValue({ _id: ID });
      m.find.mockResolvedValue([]);
      await c.deleteSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
    it.each(cases)('returns not found for %s', async (type, getModel, message) => {
      const m = getModel();
      req.params = { type, invtypeId: ID };
      m.findByIdAndDelete.mockResolvedValue(null);
      await c.deleteSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });
    it('rejects unsupported/invalid ids and sanitizes failures', async () => {
      req.params = { type: '<bad>', invtypeId: ID };
      await c.deleteSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: unsupported });
      res = response();
      req.params = { type: 'materials', invtypeId: 'bad' };
      await c.deleteSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      res = response();
      req.params.invtypeId = ID;
      MatType.findByIdAndDelete.mockRejectedValue(Error(`bad ${ID}`));
      await c.deleteSingleInvType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unable to delete inventory type' });
    });
  });

  describe('fetchInvTypeHistory', () => {
    it('rejects invalid ids', async () => {
      req.params.invtypeId = 'bad';
      await c.fetchInvTypeHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(history.find).not.toHaveBeenCalled();
    });
    it('returns sorted populated history and handles errors', async () => {
      const q = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ field: 'name' }]),
      };
      req.params.invtypeId = ID;
      history.find.mockReturnValue(q);
      await c.fetchInvTypeHistory(req, res);
      expect(q.populate).toHaveBeenCalledWith('editedBy', '_id firstName lastName email');
      expect(res.status).toHaveBeenCalledWith(200);
      res = response();
      q.lean.mockRejectedValue(Error('history'));
      await c.fetchInvTypeHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
