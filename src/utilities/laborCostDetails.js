const COST_TOLERANCE = 0.011;

const optionalNumber = value => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const hasConflictingDetails = (cost, hours, rate) => {
  if (cost === null) return false;
  if (cost > 0 && (hours === 0 || rate === 0)) return true;
  if (hours === null || rate === null) return false;
  return Math.abs(hours * rate - cost) > COST_TOLERANCE;
};

const getLaborCostDetails = record => {
  const cost = optionalNumber(record.cost);
  let hoursWorked = optionalNumber(record.hoursWorked);
  let hourlyRate = optionalNumber(record.hourlyRate);
  let hoursSource = hoursWorked === null ? null : 'recorded';
  let rateSource = hourlyRate === null ? null : 'recorded';
  if (hoursWorked === null && hourlyRate > 0 && cost !== null) {
    hoursWorked = cost / hourlyRate;
    hoursSource = 'calculated';
  }
  if (hourlyRate === null && hoursWorked > 0 && cost !== null) {
    hourlyRate = cost / hoursWorked;
    rateSource = 'calculated';
  }
  // Conflicting recorded inputs cannot support trustworthy hourly calculations.
  if (hasConflictingDetails(cost, hoursWorked, hourlyRate)) {
    return { hoursWorked: null, hourlyRate: null, hoursSource: null, rateSource: null };
  }
  return { hoursWorked, hourlyRate, hoursSource, rateSource };
};

module.exports = { getLaborCostDetails };
