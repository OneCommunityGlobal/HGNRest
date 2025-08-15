jest.mock('../models/pullRequest');
jest.mock('../models/pullRequestReview');
jest.mock('../helpers/analyticsPopularPRsControllerHelper');

const { parseDurationValue } = require('../helpers/analyticsPopularPRsControllerHelper');
const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');
const analyticsPopularPRsController = require('./analyticsPopularPRsController');

describe('Test analyticsPopularPRsController functions', () => {
  let res;
  let req;
  let controller;
  beforeEach(() => {
    controller = analyticsPopularPRsController();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    req = {
      query: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Return 400 when an invalid parameter is passed', async () => {
    req = { query: { duration: 'invalid' } };
    await controller.getPopularPRs(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Invalid duration'),
      }),
    );
  });

  test('Handle when parseDurationValue throw an error', async () => {
    parseDurationValue.mockImplementation(() => {
      throw new Error();
    });
    await controller.getPopularPRs(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('Return the result directly when >= 20PRs', async () => {
    parseDurationValue.mockReturnValue([new Date(), new Date()]);
    const result = [];
    for (let i = 0; i < 20; i += 1) {
      result.push({
        prNumber: `FE- ${i}`,
        prTitle: `PR FE-${i}`,
        reviewCount: 20 - i,
        createdAt: new Date(),
      });
    }
    PullRequestReview.aggregate.mockResolvedValue(result);
    await controller.getPopularPRs(req, res);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(PullRequest.find).not.toHaveBeenCalled();
  });

  test('Call PullRequest.find when the aggregate result < 20PRs', async () => {
    parseDurationValue.mockReturnValue([new Date(), new Date()]);
    PullRequestReview.aggregate.mockResolvedValue([
      {
        prNumber: 'FE- 1890',
        prTitle: 'PR FE-1890',
        reviewCount: 6,
        createdAt: new Date(),
      },
    ]);
    PullRequest.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          prNumber: 'BE- 1234',
          prTitle: 'PR BE-1234',
          reviewCount: 0,
          createdAt: new Date(),
        },
      ]),
    });
    await controller.getPopularPRs(req, res);
    console.log(res.json.mock.calls);
    expect(res.json.mock.calls[0][0]).toHaveLength(2);
  });

  test('Should return 500 if DB through an error', async () => {
    parseDurationValue.mockReturnValue([new Date(), new Date()]);
    PullRequestReview.aggregate.mockRejectedValue(new Error('DB error'));
    await controller.getPopularPRs(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Internal server error'),
      }),
    );
  });
});
