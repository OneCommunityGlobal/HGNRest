jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
const Performance = require('../../../models/summaryDashboard/supplierPerformance');
const RootCause = require('../../../models/summaryDashboard/supplierRootCause');
const controller = require('../supplierPerformance')();

const response = () => ({ status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() });
afterEach(() => jest.restoreAllMocks());
test('rejects forged body roles and non-admin users', async () => {
  const res = response();
  await controller.updateRootCauses(
    { user: { role: 'Volunteer' }, body: { requestor: { role: 'Administrator' } } },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(403);
});
test('admin can persist, replace and clear tags', async () => {
  jest.spyOn(Performance, 'exists').mockResolvedValue(true);
  const update = jest.spyOn(RootCause, 'findOneAndUpdate').mockResolvedValue({ tags: [] });
  for (const tags of [['Delayed Shipments'], ['Quality Rejections'], []]) {
    await controller.updateRootCauses(
      { user: { role: 'Administrator' }, body: { supplierKey: 'name:A', tags } },
      response(),
    );
    expect(update).toHaveBeenLastCalledWith(
      { supplierKey: 'name:A' },
      { $set: { tags } },
      { upsert: true, new: true, runValidators: true },
    );
  }
});
test('rejects invalid tags', async () => {
  const res = response();
  await controller.updateRootCauses(
    { user: { role: 'Owner' }, body: { supplierKey: 'name:A', tags: [''] } },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(400);
});
test('history includes the full final day and filters by observation end date', async () => {
  const find = jest
    .spyOn(Performance, 'find')
    .mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  jest.spyOn(RootCause, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  const res = response();
  await controller.getAnalytics({ query: { startDate: '2026-01-01', endDate: '2026-01-31' } }, res);
  expect(find.mock.calls[0][0].endDate.$lte.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  expect(res.status).toHaveBeenCalledWith(200);
});
test('rejects inverted date ranges', async () => {
  const res = response();
  await controller.getAnalytics({ query: { startDate: '2026-02-01', endDate: '2026-01-01' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('rejects nonexistent calendar dates', async () => {
  const res = response();
  await controller.getAnalytics({ query: { startDate: '2026-02-30', endDate: '2026-04-01' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});
test('accepts zero percent and optional SLA and supplier identity', async () => {
  const save = jest.spyOn(Performance.prototype, 'save').mockResolvedValue({});
  const res = response();
  await controller.postSupplierPerformance(
    {
      body: {
        supplierName: 'A',
        supplierId: 'vendor-1',
        slaTarget: 95,
        onTimeDeliveryPercentage: 0,
        projectId: '507f1f77bcf86cd799439011',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(save.mock.instances[0].slaTarget).toBe(95);
  expect(save.mock.instances[0].supplierId).toBe('vendor-1');
});
