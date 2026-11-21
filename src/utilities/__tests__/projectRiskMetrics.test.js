// v1.0.0
const { calculateRiskMetrics } = require('../projectRiskMetrics');
const Profile = require('../../models/bmdashboard/projectRiskProfile');

const now = new Date('2026-10-31T00:00:00Z');
const base = {
  startDate: new Date('2026-07-03'),
  endDate: new Date('2026-10-11'),
  initialCostEstimate: 100,
  currentCostIncurred: 110,
  status: 'active',
};

test('active duration is not capped at end date', () => {
  expect(calculateRiskMetrics(base, now)).toEqual({
    predictedCostOverrun: 10,
    predictedTimeDelay: 120,
  });
});
test('completed duration and final cost stay fixed after completion', () => {
  const profile = {
    ...base,
    status: 'completed',
    completedAt: new Date('2026-10-01'),
    actualTimeElapsed: 999,
  };
  expect(calculateRiskMetrics(profile, now)).toEqual({
    predictedCostOverrun: 10,
    predictedTimeDelay: 90,
  });
  expect(calculateRiskMetrics(profile, new Date('2027-10-31'))).toEqual(
    calculateRiskMetrics(profile, now),
  );
});
test('legacy past-end profiles without actual duration stay unknown', () => {
  expect(calculateRiskMetrics({ ...base, status: undefined }, now)).toEqual({
    predictedCostOverrun: null,
    predictedTimeDelay: null,
  });
});
test('explicit zero duration and missing cost are not replaced with invented values', () => {
  expect(calculateRiskMetrics({ ...base, actualTimeElapsed: 0 }, now)).toEqual({
    predictedCostOverrun: null,
    predictedTimeDelay: 0,
  });
  expect(
    calculateRiskMetrics({ ...base, currentCostIncurred: undefined }, now).predictedCostOverrun,
  ).toBeNull();
});
test('under-budget half-time spending produces the correct forecast', () => {
  expect(
    calculateRiskMetrics({ ...base, actualTimeElapsed: 50, currentCostIncurred: 40 }, now)
      .predictedCostOverrun,
  ).toBe(-20);
});
test('invalid schedules cannot produce a delay', () => {
  expect(
    calculateRiskMetrics({ ...base, endDate: base.startDate }, now).predictedTimeDelay,
  ).toBeNull();
});
test('completed profiles require a valid completion date and nonnegative amounts', async () => {
  const p = new Profile({
    ...base,
    projectId: 'abcdefabcdefabcdefabcdef',
    status: 'completed',
    currentCostIncurred: -1,
  });
  await expect(p.validate()).rejects.toThrow(/currentCostIncurred|completedAt/);
});
