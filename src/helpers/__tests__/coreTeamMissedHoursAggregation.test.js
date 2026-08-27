const {
  buildCoreTeamMissedHoursAggregation,
} = require('../coreTeamMissedHoursAggregation');

describe('buildCoreTeamMissedHoursAggregation', () => {
  const startOfLastWeek = '2025-11-02';
  const endOfLastWeek = '2025-11-08';
  const cutOffDate = '2024-11-02';

  it('builds a Core Team missed-hours aggregation pipeline', () => {
    const pipeline = buildCoreTeamMissedHoursAggregation(
      startOfLastWeek,
      endOfLastWeek,
      cutOffDate,
    );

    expect(pipeline).toHaveLength(3);
    expect(pipeline[0].$match).toEqual({ role: 'Core Team', isActive: true });
  });

  it('looks up tangible time entries for last week only', () => {
    const pipeline = buildCoreTeamMissedHoursAggregation(
      startOfLastWeek,
      endOfLastWeek,
      cutOffDate,
    );
    const lookup = pipeline[1].$lookup;

    expect(lookup.from).toBe('timeEntries');
    expect(lookup.let).toEqual({ userId: '$_id' });
    expect(lookup.pipeline[0].$match.$expr.$and).toEqual(
      expect.arrayContaining([
        { $eq: ['$personId', '$$userId'] },
        { $eq: ['$isTangible', true] },
        { $gte: ['$dateOfWork', startOfLastWeek] },
        { $lte: ['$dateOfWork', endOfLastWeek] },
      ]),
    );
  });

  it('uses year-filtered infringement counts for incremental penalty math', () => {
    const pipeline = buildCoreTeamMissedHoursAggregation(
      startOfLastWeek,
      endOfLastWeek,
      cutOffDate,
    );
    const projectStage = pipeline[2].$project.missedHours.$let.vars.infringementsAdjustment;

    expect(projectStage.$max[1].$subtract[0].$max[1].$subtract[1]).toBe(5);
    expect(projectStage.$max[1].$subtract[1].$max[1].$subtract[1]).toBe(6);
    expect(
      projectStage.$max[1].$subtract[0].$max[1].$subtract[0].$size.$filter.cond.$gte[1],
    ).toBe(cutOffDate);
  });

  it('adds penalty hours only when base missed hours are greater than zero', () => {
    const pipeline = buildCoreTeamMissedHoursAggregation(
      startOfLastWeek,
      endOfLastWeek,
      cutOffDate,
    );
    const missedHoursExpr = pipeline[2].$project.missedHours.$let.in;

    expect(missedHoursExpr.$cond[0]).toEqual({ $gt: ['$$baseMissedHours', 0] });
    expect(missedHoursExpr.$cond[1]).toEqual({
      $add: ['$$baseMissedHours', '$$infringementsAdjustment'],
    });
    expect(missedHoursExpr.$cond[2]).toBe('$$baseMissedHours');
  });
});
