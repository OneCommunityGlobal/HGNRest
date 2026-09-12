const express = require('express');

jest.mock('../controllers/rescheduleEventContoller', () => ({
  rescheduleNotify: jest.fn(),
  getReschedulePoll: jest.fn(),
  submitRescheduleVote: jest.fn(),
}));

const activityRouter = require('./activityRouter');

describe('activityRouter', () => {
  it('registers the reschedule routes for activities', () => {
    const layerPaths = activityRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(layerPaths).toEqual(
      expect.arrayContaining([
        { path: '/:activityId/reschedule/notify', methods: ['post'] },
        { path: '/:activityId/reschedule/poll', methods: ['get'] },
        { path: '/:activityId/reschedule/vote', methods: ['post'] },
      ]),
    );
  });

  it('returns a router instance', () => {
    expect(activityRouter).toBeDefined();
    expect(typeof activityRouter).toBe('function');
    expect(activityRouter.stack).toBeDefined();
  });
});
