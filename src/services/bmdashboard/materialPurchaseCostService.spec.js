jest.mock('../../models/bmdashboard/buildingMaterial', () => ({ aggregate: jest.fn() }));

const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const { getMaterialPurchaseCostByProject } = require('./materialPurchaseCostService');

const PROJECT_A = '507f1f77bcf86cd799439011';
const PROJECT_B = '507f1f77bcf86cd799439012';

// The $match stage the service sends to MongoDB
const getMatchStage = () => {
  const pipeline = BuildingMaterial.aggregate.mock.calls[0][0];
  return pipeline.find((stage) => stage.$match).$match;
};

describe('materialPurchaseCostService.getMaterialPurchaseCostByProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BuildingMaterial.aggregate.mockResolvedValue([]);
  });

  it('only counts approved purchases when no filters are given', async () => {
    await getMaterialPurchaseCostByProject();

    expect(getMatchStage()).toEqual({ 'purchaseRecord.status': 'Approved' });
  });

  it('filters by the given projects', async () => {
    await getMaterialPurchaseCostByProject({ projectIds: [PROJECT_A, PROJECT_B] });

    const match = getMatchStage();
    expect(match.project.$in.map((id) => id.toString())).toEqual([PROJECT_A, PROJECT_B]);
  });

  it('ignores an empty project list', async () => {
    await getMaterialPurchaseCostByProject({ projectIds: [] });

    expect(getMatchStage().project).toBeUndefined();
  });

  it('filters purchases by start and end date', async () => {
    await getMaterialPurchaseCostByProject({ startDate: '2026-01-01', endDate: '2026-06-30' });

    expect(getMatchStage()['purchaseRecord.date']).toEqual({
      $gte: new Date('2026-01-01'),
      $lte: new Date('2026-06-30'),
    });
  });

  it('supports only a start date or only an end date', async () => {
    await getMaterialPurchaseCostByProject({ startDate: '2026-01-01' });
    expect(getMatchStage()['purchaseRecord.date']).toEqual({ $gte: new Date('2026-01-01') });

    jest.clearAllMocks();
    BuildingMaterial.aggregate.mockResolvedValue([]);
    await getMaterialPurchaseCostByProject({ endDate: '2026-06-30' });
    expect(getMatchStage()['purchaseRecord.date']).toEqual({ $lte: new Date('2026-06-30') });
  });

  it("uses the purchase's unit price, falling back to the material type's price", async () => {
    await getMaterialPurchaseCostByProject();

    const pipeline = BuildingMaterial.aggregate.mock.calls[0][0];
    const lookup = pipeline.find((stage) => stage.$lookup).$lookup;
    expect(lookup).toMatchObject({ from: 'buildingInventoryTypes', localField: 'itemType' });
    const price = pipeline.find((stage) => stage.$addFields).$addFields.effectiveUnitPrice;
    expect(price.$cond[1]).toBe('$purchaseRecord.unitPrice');
  });

  it('returns the cost per project from the aggregation', async () => {
    const rows = [{ project: PROJECT_A, totalCost: 100 }];
    BuildingMaterial.aggregate.mockResolvedValue(rows);

    await expect(getMaterialPurchaseCostByProject()).resolves.toEqual(rows);
  });
});
