// File version: 1.0.0
const bmMaterialsController = require('./bmMaterialsController');

const projectIds = [
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013',
];
const material = {
  project: { _id: projectIds[0], name: 'Building A' },
  itemType: { _id: '507f1f77bcf86cd799439014', name: 'Cement', unit: 'kg' },
  stockAvailable: 30,
  stockUsed: 30,
  updateRecord: [],
};

describe('material stock-out data readiness', () => {
  let model;
  let res;
  let controller;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00Z'));
    model = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([material]),
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    controller = bmMaterialsController(model);
  });

  afterEach(() => jest.useRealTimers());

  it('returns per-project readiness, including projects with no materials', async () => {
    model.exec.mockResolvedValue([
      material,
      { ...material, project: { _id: projectIds[1] }, stockAvailable: 0, stockUsed: 0 },
    ]);
    await controller.bmGetMaterialStockOutRisk(
      {
        query: { projectIds: projectIds.join(','), includeReadiness: 'true' },
      },
      res,
    );

    const { chartData, readiness } = res.json.mock.calls[0][0];
    expect(chartData).toHaveLength(1);
    expect(readiness.map((p) => p.status)).toEqual(['Ready', 'Partial', 'Not Configured']);
    expect(readiness[0]).toMatchObject({
      materialCount: 1,
      readyMaterialCount: 1,
      missingInputs: [],
    });
    expect(readiness[1].missingInputs).toEqual([
      'Positive available stock is missing.',
      'Usage data is missing: record consumption within the last 30 days or total stock used.',
    ]);
    expect(readiness[2]).toMatchObject({ materialCount: 0, readyMaterialCount: 0 });
    expect(readiness[2].missingInputs).toEqual(['No materials are mapped to this project.']);
    expect(model.find.mock.calls[0][0].project.$in.map(String)).toEqual(projectIds);
  });

  it.each([
    [{ itemType: null }, 'Material type mapping is missing.'],
    [{ stockAvailable: -1 }, 'Positive available stock is missing.'],
    [
      {
        stockUsed: 0,
        updateRecord: [
          { date: '2026-09-23', quantityUsed: 60 },
          { date: '2026-10-25', quantityUsed: 60 },
        ],
      },
      'Usage data is missing: record consumption within the last 30 days or total stock used.',
    ],
    [{ stockAvailable: 999 }, 'An estimate is outside the chart range of 0–998 days.'],
  ])(
    'keeps usable materials visible while explaining missing inputs: %j',
    async (overrides, message) => {
      model.exec.mockResolvedValue([material, { ...material, ...overrides }]);
      await controller.bmGetMaterialStockOutRisk(
        {
          query: { projectIds: projectIds[0], includeReadiness: 'true' },
        },
        res,
      );

      const { chartData, readiness } = res.json.mock.calls[0][0];
      expect(chartData).toHaveLength(1);
      expect(readiness[0]).toMatchObject({
        status: 'Partial',
        materialCount: 2,
        readyMaterialCount: 1,
      });
      expect(readiness[0].missingInputs).toContain(message);
    },
  );

  it('preserves the legacy array and existing recent-usage calculation', async () => {
    model.exec.mockResolvedValue([
      { ...material, updateRecord: [{ date: '2026-10-23', quantityUsed: 60 }] },
    ]);
    await controller.bmGetMaterialStockOutRisk({ query: { projectIds: projectIds[0] } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: projectIds[0],
        stockAvailable: 30,
        averageDailyUsage: 2,
        daysUntilStockOut: 15,
      }),
    ]);
  });

  it('rejects invalid project IDs without querying materials', async () => {
    await controller.bmGetMaterialStockOutRisk(
      {
        query: { projectIds: 'invalid', includeReadiness: 'true' },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('reports database failures as errors rather than Not Configured', async () => {
    model.exec.mockRejectedValue(new Error('Database unavailable'));
    await controller.bmGetMaterialStockOutRisk(
      {
        query: { projectIds: projectIds[0], includeReadiness: 'true' },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
