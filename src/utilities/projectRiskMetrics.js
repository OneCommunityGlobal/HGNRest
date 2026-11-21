// v1.0.0
const DAY = 86400000;
const validNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function calculateRiskMetrics(profile, now = new Date()) {
  const start = new Date(profile.startDate).getTime();
  const end = new Date(profile.endDate).getTime();
  const completed = profile.status === 'completed';
  const finish = profile.completedAt ? new Date(profile.completedAt).getTime() : NaN;
  const planned = profile.plannedTime ?? (end - start) / DAY;
  const knownDuration = validNumber(profile.actualTimeElapsed);
  let elapsed = null;
  if (completed) {
    if (Number.isFinite(finish)) elapsed = Math.max(0, (finish - start) / DAY);
  } else if (knownDuration) elapsed = profile.actualTimeElapsed;
  else if (profile.status === 'active' || now.getTime() <= end) {
    elapsed = Math.max(0, (now.getTime() - start) / DAY);
  }
  const validSchedule =
    Number.isFinite(start) && end > start && Number.isFinite(planned) && planned > 0;
  const ratio = validSchedule && elapsed !== null ? elapsed / planned : null;
  const spend = profile.currentCostIncurred;
  const budget = profile.initialCostEstimate;
  let cost = null;
  if (validNumber(spend) && validNumber(budget) && budget > 0) {
    if (completed && Number.isFinite(finish)) cost = (spend / budget - 1) * 100;
    else if (ratio > 0) cost = (spend / Math.min(ratio, 1) / budget - 1) * 100;
  }
  return {
    predictedCostOverrun: Number.isFinite(cost) ? Number(cost.toFixed(2)) : null,
    // Preserve the API's duration ratio: 100 is on time, 120 means 20% late.
    predictedTimeDelay: ratio === null ? null : Number((ratio * 100).toFixed(2)),
  };
}

module.exports = { calculateRiskMetrics };
