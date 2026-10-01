jest.mock('../controllers/githubAnalyticsController', () => ({
  getGitHubReviews: jest.fn((req, res) => res.status(200).json([{ ok: true }])),
}));

const express = require('express');
const request = require('supertest');
const { getGitHubReviews } = require('../controllers/githubAnalyticsController');
const githubAnalyticsRouter = require('./githubAnalyticsRouter');

describe('githubAnalyticsRouter', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use('/api/analytics', githubAnalyticsRouter);
  });

  test('GET /api/analytics/review-summary is registered', async () => {
    const response = await request(app).get('/api/analytics/review-summary');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ ok: true }]);
    expect(getGitHubReviews).toHaveBeenCalledTimes(1);
  });

  test('GET /api/analytics/github-reviews alias is registered', async () => {
    const response = await request(app).get('/api/analytics/github-reviews?duration=lastWeek');

    expect(response.status).toBe(200);
    expect(getGitHubReviews).toHaveBeenCalledTimes(1);
  });

  test('unknown analytics route returns 404', async () => {
    const response = await request(app).get('/api/analytics/not-a-real-route');
    expect(response.status).toBe(404);
  });
});
