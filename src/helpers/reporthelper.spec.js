const userProfile = require('../models/userProfile');
const reporthelper = require('./reporthelper');

describe('reporthelper weekly summaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('falls back to createdDate for legacy profiles without a startDate', async () => {
    jest.spyOn(userProfile, 'aggregate').mockImplementation(async (pipeline) => {
      expect(pipeline[3].$project.startDate).toEqual({
        $ifNull: ['$startDate', '$createdDate'],
      });
      return [];
    });

    const { weeklySummaries } = reporthelper();
    await weeklySummaries(0, 0);

    expect(userProfile.aggregate).toHaveBeenCalledTimes(1);
  });
});
