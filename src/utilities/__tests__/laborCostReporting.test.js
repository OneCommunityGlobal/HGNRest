const { getLaborCostDetails } = require('../laborCostDetails');

describe('read-only paid labor reporting', () => {
  it('does not invent hours or pay rates from cost-only records', () => {
    expect(getLaborCostDetails({ cost: 100 })).toEqual({
      hoursWorked: null,
      hourlyRate: null,
      hoursSource: null,
      rateSource: null,
    });
  });
  it('calculates a missing rate or hours only from existing recorded values', () => {
    expect(getLaborCostDetails({ cost: 100, hoursWorked: 4 })).toMatchObject({
      hoursWorked: 4,
      hourlyRate: 25,
      rateSource: 'calculated',
    });
    expect(getLaborCostDetails({ cost: 100, hourlyRate: 20 })).toMatchObject({
      hoursWorked: 5,
      hourlyRate: 20,
      hoursSource: 'calculated',
    });
  });
  it('preserves the input record', () => {
    const record = Object.freeze({ cost: 100, hoursWorked: 4 });
    getLaborCostDetails(record);
    expect(record).toEqual({ cost: 100, hoursWorked: 4 });
  });
  it('does not report inconsistent data as a valid rate', () => {
    expect(getLaborCostDetails({ cost: 100, hoursWorked: 0 })).toMatchObject({
      hoursWorked: null,
      hourlyRate: null,
    });
    expect(getLaborCostDetails({ cost: 100, hoursWorked: 4, hourlyRate: 10 })).toMatchObject({
      hoursWorked: null,
      hourlyRate: null,
    });
  });
});
