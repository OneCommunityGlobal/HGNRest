const { getPrsNeeded, resolvePrsNeeded } = require('./promotionEligibilityHelper');

describe('getPrsNeeded', () => {
  test('returns 7 across the 10 to 14.99 band', () => {
    expect(getPrsNeeded(10)).toBe(7);
    expect(getPrsNeeded(12.5)).toBe(7);
    expect(getPrsNeeded(14.99)).toBe(7);
  });

  test('returns 10 across the 15 to 25.99 band', () => {
    expect(getPrsNeeded(15)).toBe(10);
    expect(getPrsNeeded(25.99)).toBe(10);
  });

  test('returns 20 across the 26 to 35.99 band', () => {
    expect(getPrsNeeded(26)).toBe(20);
    expect(getPrsNeeded(35.99)).toBe(20);
  });

  test('returns 30 across the 36 to 40 band', () => {
    expect(getPrsNeeded(36)).toBe(30);
    expect(getPrsNeeded(40)).toBe(30);
  });

  test('band boundaries do not overlap or leave gaps at the integer edges', () => {
    expect(getPrsNeeded(14.99)).toBe(7);
    expect(getPrsNeeded(15)).toBe(10);
    expect(getPrsNeeded(25.99)).toBe(10);
    expect(getPrsNeeded(26)).toBe(20);
    expect(getPrsNeeded(35.99)).toBe(20);
    expect(getPrsNeeded(36)).toBe(30);
  });

  test('clamps below the lowest band to 7 and above the highest to 30', () => {
    expect(getPrsNeeded(9.99)).toBe(7);
    expect(getPrsNeeded(0.5)).toBe(7);
    expect(getPrsNeeded(60)).toBe(30);
  });

  test('requires nothing of a reviewer committed to no hours', () => {
    expect(getPrsNeeded(0)).toBe(0);
    expect(getPrsNeeded(-5)).toBe(0);
  });

  test('treats missing or non-numeric committed hours as no requirement', () => {
    expect(getPrsNeeded(undefined)).toBe(0);
    expect(getPrsNeeded(null)).toBe(0);
    expect(getPrsNeeded('not a number')).toBe(0);
    expect(getPrsNeeded(NaN)).toBe(0);
  });

  test('accepts a numeric string, since committed hours reach us from user input', () => {
    expect(getPrsNeeded('20')).toBe(10);
  });
});

describe('resolvePrsNeeded', () => {
  test('derives the figure from committed hours when no record exists yet', () => {
    expect(resolvePrsNeeded({ committedHours: 20, existingRecord: null })).toEqual({
      prsNeeded: 10,
      prsNeededSource: 'auto',
      committedHoursChanged: false,
    });
  });

  test('reports no change when committed hours match the stored value', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result.committedHoursChanged).toBe(false);
    expect(result.prsNeeded).toBe(10);
  });

  test('flags a change and recalculates when committed hours have moved', () => {
    const result = resolvePrsNeeded({
      committedHours: 30,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result).toEqual({
      prsNeeded: 20,
      prsNeededSource: 'auto',
      committedHoursChanged: true,
    });
  });

  test('an Owner override wins and stops the committed hours check', () => {
    const result = resolvePrsNeeded({
      committedHours: 40,
      existingRecord: { pledgedHours: 10, prsNeededOverride: 5 },
    });
    expect(result).toEqual({
      prsNeeded: 5,
      prsNeededSource: 'ownerOverride',
      committedHoursChanged: false,
    });
  });

  test('an override of 0 is honoured rather than treated as absent', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: 0 },
    });
    expect(result.prsNeeded).toBe(0);
    expect(result.prsNeededSource).toBe('ownerOverride');
  });

  test('clearing an override returns the reviewer to the committed hours bands', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result.prsNeededSource).toBe('auto');
    expect(result.prsNeeded).toBe(10);
  });
});
