const UserProfile = require('../models/userProfile');
const reporthelper = require('./reporthelper');

describe('reporthelper weeklySummaries badge filtering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('filters badges by individual earnedDate values instead of comparing the earnedDate array directly', async () => {
    jest.spyOn(UserProfile, 'aggregate').mockResolvedValue([]);

    const { weeklySummaries } = reporthelper();

    await weeklySummaries(1, 1);

    expect(UserProfile.aggregate).toHaveBeenCalledTimes(1);

    const pipeline = UserProfile.aggregate.mock.calls[0][0];
    const projectStage = pipeline.find((stage) => stage.$project);
    const badgeFilterCondition = projectStage.$project.badgeCollection.$filter.cond;

    expect(badgeFilterCondition).toEqual(
      expect.objectContaining({
        $or: expect.any(Array),
      }),
    );

    const serializedCondition = JSON.stringify(badgeFilterCondition);

    // Regression guard:
    // earnedDate is an array, so the aggregation should inspect its elements
    // rather than compare the whole array directly to week boundaries.
    expect(serializedCondition).toContain('$map');
    expect(serializedCondition).toContain('$anyElementTrue');
  });
});
