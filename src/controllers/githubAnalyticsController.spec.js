jest.mock('../models/hgnFormResponse');
jest.mock('../models/userProfile');

const mockFetchGitHubReviews = jest.fn();

jest.mock('../services/analytics/fetchGithubReviews', () => jest.fn(() => mockFetchGitHubReviews));

const {
  getGitHubReviews,
  mergeReviewerResults,
  getTotalReviews,
} = require('./githubAnalyticsController');

const makeCounts = (overrides = {}) => ({
  Exceptional: 0,
  Sufficient: 0,
  'Needs Changes': 0,
  'Did Not Review': 0,
  ...overrides,
});

const makeReviewer = (reviewer, overrides = {}) => ({
  reviewer,
  isMentor: false,
  team: null,
  counts: makeCounts(),
  ...overrides,
});

describe('githubAnalyticsController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getTotalReviews', () => {
    test('sums all count categories', () => {
      expect(
        getTotalReviews({
          Exceptional: 1,
          Sufficient: 2,
          'Needs Changes': 3,
          'Did Not Review': 4,
        }),
      ).toBe(10);
    });

    test('returns 0 for empty counts', () => {
      expect(getTotalReviews()).toBe(0);
    });
  });

  describe('mergeReviewerResults', () => {
    test('merges the same reviewer across repos and sums counts', () => {
      const merged = mergeReviewerResults([
        [makeReviewer('alice', { counts: makeCounts({ Sufficient: 2 }), team: 'TeamA' })],
        [makeReviewer('alice', { counts: makeCounts({ 'Needs Changes': 3 }), team: null })],
      ]);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual({
        reviewer: 'alice',
        isMentor: false,
        team: 'TeamA',
        counts: makeCounts({ Sufficient: 2, 'Needs Changes': 3 }),
      });
    });

    test('keeps distinct reviewers', () => {
      const merged = mergeReviewerResults([
        [makeReviewer('alice'), makeReviewer('bob')],
        [makeReviewer('carol')],
      ]);

      expect(merged.map((r) => r.reviewer).sort()).toEqual(['alice', 'bob', 'carol']);
    });

    test('defaults isMentor to false and prefers first available team', () => {
      const merged = mergeReviewerResults([
        [makeReviewer('alice', { isMentor: null, team: null })],
        [makeReviewer('alice', { isMentor: true, team: 'Alpha' })],
      ]);

      expect(merged[0].isMentor).toBe(true);
      expect(merged[0].team).toBe('Alpha');
    });

    test('ignores invalid entries', () => {
      const merged = mergeReviewerResults([[null, {}, makeReviewer('alice')]]);
      expect(merged).toHaveLength(1);
      expect(merged[0].reviewer).toBe('alice');
    });
  });

  describe('getGitHubReviews', () => {
    test('returns 400 for invalid duration', async () => {
      req.query = { duration: 'yesterday' };
      await getGitHubReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid duration') }),
      );
      expect(mockFetchGitHubReviews).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid sort', async () => {
      req.query = { sort: 'dsc' };
      await getGitHubReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid sort') }),
      );
      expect(mockFetchGitHubReviews).not.toHaveBeenCalled();
    });

    test('accepts all valid duration values', async () => {
      mockFetchGitHubReviews.mockResolvedValue([]);

      const durations = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
      // eslint-disable-next-line no-restricted-syntax
      for (const duration of durations) {
        jest.clearAllMocks();
        mockFetchGitHubReviews.mockResolvedValue([]);
        req.query = { duration };
        // eslint-disable-next-line no-await-in-loop
        await getGitHubReviews(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    test('fetches both repos and returns merged response shape', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('alice', {
            team: 'TeamA',
            counts: makeCounts({ Sufficient: 2, Exceptional: 1 }),
          }),
        ])
        .mockResolvedValueOnce([
          makeReviewer('alice', {
            counts: makeCounts({ 'Needs Changes': 1 }),
          }),
          makeReviewer('bob', {
            counts: makeCounts({ Sufficient: 5 }),
          }),
        ]);

      await getGitHubReviews(req, res);

      expect(mockFetchGitHubReviews).toHaveBeenCalledTimes(2);
      expect(mockFetchGitHubReviews).toHaveBeenCalledWith(
        'OneCommunityGlobal',
        'HighestGoodNetworkApp',
        'allTime',
      );
      expect(mockFetchGitHubReviews).toHaveBeenCalledWith(
        'OneCommunityGlobal',
        'HGNRest',
        'allTime',
      );

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload).toHaveLength(2);

      payload.forEach((entry) => {
        expect(entry).toEqual(
          expect.objectContaining({
            reviewer: expect.any(String),
            isMentor: expect.any(Boolean),
            counts: expect.objectContaining({
              Exceptional: expect.any(Number),
              Sufficient: expect.any(Number),
              'Needs Changes': expect.any(Number),
              'Did Not Review': expect.any(Number),
            }),
          }),
        );
        expect(Object.prototype.hasOwnProperty.call(entry, 'team')).toBe(true);
      });

      const alice = payload.find((r) => r.reviewer === 'alice');
      expect(alice.counts).toEqual(
        makeCounts({ Exceptional: 1, Sufficient: 2, 'Needs Changes': 1 }),
      );
      expect(alice.team).toBe('TeamA');
      expect(alice.isMentor).toBe(false);
    });

    test('sorts by total review count descending by default', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('low', { counts: makeCounts({ Sufficient: 1 }) }),
          makeReviewer('high', { counts: makeCounts({ Sufficient: 10 }) }),
        ])
        .mockResolvedValueOnce([]);

      await getGitHubReviews(req, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.map((r) => r.reviewer)).toEqual(['high', 'low']);
    });

    test('sorts by total review count ascending when sort=asc', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('low', { counts: makeCounts({ Sufficient: 1 }) }),
          makeReviewer('high', { counts: makeCounts({ Sufficient: 10 }) }),
        ])
        .mockResolvedValueOnce([]);

      req.query = { sort: 'asc' };
      await getGitHubReviews(req, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.map((r) => r.reviewer)).toEqual(['low', 'high']);
    });

    test('filters by team case-insensitively and excludes null teams', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('alice', { team: 'TeamA', counts: makeCounts({ Sufficient: 2 }) }),
          makeReviewer('bob', { team: null, counts: makeCounts({ Sufficient: 9 }) }),
          makeReviewer('carol', { team: 'teama', counts: makeCounts({ Sufficient: 1 }) }),
          makeReviewer('dave', { team: 'Other', counts: makeCounts({ Sufficient: 4 }) }),
        ])
        .mockResolvedValueOnce([]);

      req.query = { team: 'TeamA' };
      await getGitHubReviews(req, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.map((r) => r.reviewer).sort()).toEqual(['alice', 'carol']);
      expect(payload.every((r) => r.team.toLowerCase() === 'teama')).toBe(true);
    });

    test('returns empty array when team filter matches nobody', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('alice', { team: null, counts: makeCounts({ Sufficient: 2 }) }),
        ])
        .mockResolvedValueOnce([]);

      req.query = { team: 'randomTeam' };
      await getGitHubReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('ignores blank team query and returns all reviewers', async () => {
      mockFetchGitHubReviews
        .mockResolvedValueOnce([
          makeReviewer('alice', { team: null, counts: makeCounts({ Sufficient: 1 }) }),
          makeReviewer('bob', { team: 'X', counts: makeCounts({ Sufficient: 2 }) }),
        ])
        .mockResolvedValueOnce([]);

      req.query = { team: '   ' };
      await getGitHubReviews(req, res);

      expect(res.json.mock.calls[0][0]).toHaveLength(2);
    });

    test('passes duration through to the service', async () => {
      mockFetchGitHubReviews.mockResolvedValue([]);
      req.query = { duration: 'lastWeek', sort: 'desc' };

      await getGitHubReviews(req, res);

      expect(mockFetchGitHubReviews).toHaveBeenCalledWith(
        'OneCommunityGlobal',
        'HighestGoodNetworkApp',
        'lastWeek',
      );
      expect(mockFetchGitHubReviews).toHaveBeenCalledWith(
        'OneCommunityGlobal',
        'HGNRest',
        'lastWeek',
      );
    });

    test('returns 500 when fetch fails unexpectedly', async () => {
      mockFetchGitHubReviews.mockRejectedValue(new Error('boom'));

      await getGitHubReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch GitHub review data',
      });
    });

    test('returns empty array when both repos return no data', async () => {
      mockFetchGitHubReviews.mockResolvedValue([]);

      await getGitHubReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});
