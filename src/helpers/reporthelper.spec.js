const moment = require('moment-timezone');
const { MongoClient } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');
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

describe('weeklySummaries badge filter in MongoDB', () => {
  let mongoServer;
  let client;
  let collection;

  beforeAll(async () => {
    // Always use an isolated test server, never the application database.
    mongoServer = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongoServer.getUri(), { useUnifiedTopology: true });
    collection = client.db('weekly_badge_regression').collection('profiles');
  });

  beforeEach(() => {
    jest.spyOn(moment, 'now').mockReturnValue(new Date('2026-09-19T12:00:00-07:00').getTime());
    jest.spyOn(UserProfile, 'aggregate').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (client) await client.close();
    if (mongoServer) await mongoServer.stop();
  });

  const filterBadges = async (badge, weekIndex) => {
    await reporthelper().weeklySummaries(weekIndex, weekIndex);
    const pipeline = UserProfile.aggregate.mock.calls[0][0];
    const { badgeCollection } = pipeline.find((stage) => stage.$project).$project;
    const { insertedId } = await collection.insertOne({ badgeCollection: [badge] });
    // Execute the real badge projection, without unrelated report stages such as $dateDiff.
    const [result] = await collection
      .aggregate([{ $match: { _id: insertedId } }, { $project: { badgeCollection } }])
      .toArray();
    return result.badgeCollection;
  };

  test.each([
    ['earlier entry in a multi-week history', ['Sep-12-26', 'Sep-19-26'], 1, true],
    ['unpadded writer output', ['Sep-6-26', 'Sep-19-26'], 1, true],
    ['padded single-digit day', ['Sep-06-26'], 1, true],
    ['ISO calendar date', ['2026-09-06'], 1, true],
    ['stored ISO timestamp', ['2026-09-05T20:49:24.113Z'], 2, true],
    ['stored timestamp outside the selected week', ['2026-09-05T20:49:24.113Z'], 1, false],
    ['inclusive week start', ['2026-09-06T07:00:00.000Z'], 1, true],
    ['just before week start', ['2026-09-06T06:59:59.999Z'], 1, false],
    ['inclusive week end', ['2026-09-13T06:59:59.999Z'], 1, true],
    ['just after week end', ['2026-09-13T07:00:00.000Z'], 1, false],
    ['timestamp with an explicit offset', ['2026-09-12T23:30:00-07:00'], 1, true],
    ['next-week calendar date', ['2026-09-13'], 1, false],
    ['previous-week calendar date', ['Sep-5-26'], 1, false],
    ['invalid dates', ['garbage', 'Sep-31-26', '2026-09-10Tgarbage'], 1, false],
    ['invalid entry types', [null, 0, {}, []], 1, false],
    ['multiple matching entries include the badge once', ['Sep-6-26', 'Sep-12-26'], 1, true],
    ['empty history outside the fallback week', [], 1, false],
    ['missing history outside the fallback week', undefined, 1, false],
    ['non-array history outside the fallback week', 'Sep-6-26', 1, false],
  ])('%s', async (_label, earnedDate, weekIndex, included) => {
    const badges = await filterBadges(
      { badge: 'historical-badge', earnedDate, lastModified: new Date('2026-09-19T12:00:00Z') },
      weekIndex,
    );
    expect(badges).toHaveLength(included ? 1 : 0);
  });

  test.each([[[]], [undefined]])(
    'preserves lastModified fallback for history %p',
    async (earnedDate) => {
      const badges = await filterBadges(
        { badge: 'legacy-badge', earnedDate, lastModified: new Date('2026-09-10T12:00:00Z') },
        1,
      );
      expect(badges).toHaveLength(1);
    },
  );
});
