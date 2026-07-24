jest.mock('axios');
jest.mock('../../models/hgnFormResponse');
jest.mock('../../models/userProfile');

process.env.GITHUB_TOKEN = 'test-token';

const axios = require('axios');
const dayjs = require('dayjs');
const HgnFormResponses = require('../../models/hgnFormResponse');
const UserProfile = require('../../models/userProfile');
const fetchGitHubReviewsFactory = require('./fetchGithubReviews');

describe('fetchGithubReviews service', () => {
  const fetchGitHubReviews = fetchGitHubReviewsFactory(HgnFormResponses, UserProfile);

  const mockLeanFind = (data) => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(data),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchGitHubReviewsFactory.clearCache();

    HgnFormResponses.find.mockReturnValue(mockLeanFind([]));
    UserProfile.find.mockReturnValue(mockLeanFind([]));
  });

  test('aggregates review states into required count categories', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ number: 1 }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            user: { login: 'alice' },
            state: 'APPROVED',
            submitted_at: dayjs().toISOString(),
          },
          {
            user: { login: 'alice' },
            state: 'CHANGES_REQUESTED',
            submitted_at: dayjs().toISOString(),
          },
          {
            user: { login: 'alice' },
            state: 'COMMENTED',
            submitted_at: dayjs().toISOString(),
          },
          {
            user: { login: 'alice' },
            state: 'DISMISSED',
            submitted_at: dayjs().toISOString(),
          },
        ],
      });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');

    expect(result).toEqual([
      {
        reviewer: 'alice',
        isMentor: false,
        team: null,
        counts: {
          Exceptional: 1,
          Sufficient: 1,
          'Needs Changes': 1,
          'Did Not Review': 1,
        },
      },
    ]);
  });

  test('filters reviews outside the selected duration', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ number: 10 }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            user: { login: 'alice' },
            state: 'APPROVED',
            submitted_at: dayjs().subtract(2, 'day').toISOString(),
          },
          {
            user: { login: 'bob' },
            state: 'APPROVED',
            submitted_at: dayjs().subtract(20, 'day').toISOString(),
          },
        ],
      });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'lastWeek');

    expect(result).toHaveLength(1);
    expect(result[0].reviewer).toBe('alice');
  });

  test('always sets isMentor to false and resolves team from linked profile', async () => {
    const userId = '507f1f77bcf86cd799439011';

    HgnFormResponses.find.mockReturnValue(
      mockLeanFind([
        {
          userInfo: { github: 'https://github.com/AliceDev' },
          user_id: userId,
        },
      ]),
    );
    UserProfile.find.mockReturnValue(
      mockLeanFind([
        {
          _id: userId,
          teamCode: 'TeamA',
        },
      ]),
    );

    axios.get
      .mockResolvedValueOnce({
        data: [{ number: 2 }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            user: { login: 'AliceDev' },
            state: 'APPROVED',
            submitted_at: dayjs().toISOString(),
          },
        ],
      });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');

    expect(result[0].isMentor).toBe(false);
    expect(result[0].team).toBe('TeamA');
  });

  test('normalizes github URL and @handle when matching reviewers', async () => {
    const userId = '507f1f77bcf86cd799439012';

    HgnFormResponses.find.mockReturnValue(
      mockLeanFind([
        {
          userInfo: { github: '@bob-user' },
          user_id: userId,
        },
      ]),
    );
    UserProfile.find.mockReturnValue(
      mockLeanFind([
        {
          _id: userId,
          teamCode: 'Rando',
        },
      ]),
    );

    axios.get.mockResolvedValueOnce({ data: [{ number: 3 }] }).mockResolvedValueOnce({
      data: [
        {
          user: { login: 'bob-user' },
          state: 'COMMENTED',
          submitted_at: dayjs().toISOString(),
        },
      ],
    });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');
    expect(result[0].team).toBe('Rando');
  });

  test('returns empty array and does not throw when GitHub credentials fail', async () => {
    axios.get.mockRejectedValue({
      response: { data: { message: 'Bad credentials', status: '401' } },
      message: 'Request failed with status code 401',
    });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');
    expect(result).toEqual([]);
  });

  test('continues when a single PR review fetch fails', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ number: 1 }, { number: 2 }],
      })
      .mockRejectedValueOnce(new Error('reviews failed'))
      .mockResolvedValueOnce({
        data: [
          {
            user: { login: 'carol' },
            state: 'APPROVED',
            submitted_at: dayjs().toISOString(),
          },
        ],
      });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');
    expect(result).toEqual([
      expect.objectContaining({
        reviewer: 'carol',
        counts: expect.objectContaining({ Sufficient: 1 }),
      }),
    ]);
  });

  test('skips incomplete review payloads', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ number: 7 }] }).mockResolvedValueOnce({
      data: [
        { user: null, state: 'APPROVED', submitted_at: dayjs().toISOString() },
        { user: { login: 'dave' }, state: null, submitted_at: dayjs().toISOString() },
        { user: { login: 'dave' }, state: 'APPROVED', submitted_at: null },
        {
          user: { login: 'dave' },
          state: 'APPROVED',
          submitted_at: dayjs().toISOString(),
        },
      ],
    });

    const result = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');
    expect(result).toHaveLength(1);
    expect(result[0].counts.Sufficient).toBe(1);
  });

  test('returns cached result on subsequent calls with same key', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ number: 9 }] }).mockResolvedValueOnce({
      data: [
        {
          user: { login: 'erin' },
          state: 'APPROVED',
          submitted_at: dayjs().toISOString(),
        },
      ],
    });

    const first = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'lastMonth');
    const second = await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'lastMonth');

    expect(first).toEqual(second);
    // 1 PR list + 1 reviews call only for the first invocation
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('sends Authorization header with GITHUB_TOKEN', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    await fetchGitHubReviews('OneCommunityGlobal', 'HGNRest', 'allTime');

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/repos/OneCommunityGlobal/HGNRest/pulls'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token test-token',
          Accept: 'application/vnd.github+json',
        }),
      }),
    );
  });
});
