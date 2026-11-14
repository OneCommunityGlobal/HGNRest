const mongoose = require('mongoose');
const { buildProjectKpiSnapshot, AVAILABILITY } = require('./weeklyProjectSummaryKpiService');

const PROJECT_ID = '507f1f77bcf86cd799439011';
const OTHER_PROJECT_ID = '507f1f77bcf86cd799439012';
const METRICS = [
  'hours',
  'materialsCost',
  'equipmentCost',
  'wastePercentage',
  'members',
  'rentals',
  'mostBoughtMaterial',
  'stockHealth',
];
const UNITS = {
  hours: 'hours',
  materialsCost: 'USD',
  equipmentCost: 'USD',
  wastePercentage: '%',
  members: 'members',
  rentals: null,
  mostBoughtMaterial: null,
  stockHealth: null,
};

describe('buildProjectKpiSnapshot', () => {
  test('counts the supplied project member array as a current snapshot', () => {
    const result = buildProjectKpiSnapshot({ _id: PROJECT_ID, members: [{}, {}] });

    expect(result.projectId).toBe(PROJECT_ID);
    expect(result.metrics.members).toEqual({
      value: 2,
      unit: 'members',
      availability: AVAILABILITY.CURRENT_ONLY,
      unavailableReason: null,
      trend: null,
      comparisons: { wow: null, mom: null },
      alerts: null,
    });
  });

  test('matches the frontend array-length definition even for malformed entries', () => {
    const result = buildProjectKpiSnapshot({ _id: PROJECT_ID, members: [null, {}, 'invalid'] });
    expect(result.metrics.members.value).toBe(3);
  });

  test('distinguishes a genuine zero member count from missing data', () => {
    const empty = buildProjectKpiSnapshot({ _id: PROJECT_ID, members: [] });
    const missing = buildProjectKpiSnapshot({ _id: PROJECT_ID });

    expect(empty.metrics.members.value).toBe(0);
    expect(empty.metrics.members.availability).toBe(AVAILABILITY.CURRENT_ONLY);
    expect(missing.metrics.members.value).toBeNull();
    expect(missing.metrics.members.availability).toBe(AVAILABILITY.UNAVAILABLE);
    expect(missing.metrics.members.unavailableReason).toBeTruthy();
  });

  test.each([null, undefined, {}, 'members', 0])(
    'marks a missing or non-array membership value unavailable: %p',
    (members) => {
      const { metrics } = buildProjectKpiSnapshot({ _id: PROJECT_ID, members });
      expect(metrics.members).toEqual({
        value: null,
        unit: 'members',
        availability: AVAILABILITY.UNAVAILABLE,
        unavailableReason: expect.any(String),
        trend: null,
        comparisons: { wow: null, mom: null },
        alerts: null,
      });
    },
  );

  test('uses the same complete contract for all metrics without fabricating data', () => {
    const { metrics } = buildProjectKpiSnapshot({ _id: PROJECT_ID, members: [] });
    expect(Object.keys(metrics)).toEqual(METRICS);

    METRICS.forEach((key) => {
      expect(metrics[key]).toEqual({
        value: key === 'members' ? 0 : null,
        unit: UNITS[key],
        availability: key === 'members' ? AVAILABILITY.CURRENT_ONLY : AVAILABILITY.UNAVAILABLE,
        unavailableReason: key === 'members' ? null : expect.any(String),
        trend: null,
        comparisons: { wow: null, mom: null },
        alerts: null,
      });
    });
  });

  test('ignores legacy costs, purchases and unsupported metric fields', () => {
    const { metrics } = buildProjectKpiSnapshot({
      _id: PROJECT_ID,
      members: [],
      totalMaterialsCost: 1500,
      totalEquipmentCost: 3000,
      hoursWorked: 80,
      materials: [{ purchaseRecord: [{ status: 'Approved', quantity: 5, unitPrice: 20 }] }],
    });
    expect(metrics.materialsCost.value).toBeNull();
    expect(metrics.equipmentCost.value).toBeNull();
    expect(metrics.hours.value).toBeNull();
  });

  test('keeps project snapshots independent and accepts a MongoDB ObjectId', () => {
    const first = buildProjectKpiSnapshot({
      _id: new mongoose.Types.ObjectId(PROJECT_ID),
      members: [{}],
    });
    const second = buildProjectKpiSnapshot({ _id: OTHER_PROJECT_ID, members: [{}, {}] });

    expect(first.projectId).toBe(PROJECT_ID);
    expect(second.projectId).toBe(OTHER_PROJECT_ID);
    expect(first.metrics.members.value).toBe(1);
    expect(second.metrics.members.value).toBe(2);
    first.metrics.hours.comparisons.wow = 10;
    expect(second.metrics.hours.comparisons.wow).toBeNull();
  });

  test.each([
    null,
    undefined,
    [],
    { projectId: PROJECT_ID },
    { _id: 'all' },
    { _id: 'invalid' },
    { _id: { $ne: null } },
    { _id: [PROJECT_ID] },
  ])('rejects invalid project scope rather than accepting a raw query: %p', (project) => {
    expect(() => buildProjectKpiSnapshot(project)).toThrow(TypeError);
  });

  test('preserves a valid string identifier without unintended changes', () => {
    const uppercaseId = PROJECT_ID.toUpperCase();
    expect(buildProjectKpiSnapshot({ _id: uppercaseId }).projectId).toBe(uppercaseId);
  });
});
