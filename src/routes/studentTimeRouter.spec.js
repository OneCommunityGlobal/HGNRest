jest.mock('../controllers/studentTimerController', () => {
  const handler = (name) =>
    jest.fn((req, res) => res.json({ handler: name, body: req.body, query: req.query }));

  return {
    start: handler('start'),
    pause: handler('pause'),
    resume: handler('resume'),
    stop: handler('stop'),
    reset: handler('reset'),
    status: handler('status'),
    history: handler('history'),
    adjust: handler('adjust'),
  };
});

const express = require('express');
const request = require('supertest');
const ctrl = require('../controllers/studentTimerController');
const router = require('./studentTimeRouter');

const makeApp = () => {
  const app = express();
  app.use('/api', router);
  return app;
};

describe('studentTimeRouter wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['/api/timer/start', 'start'],
    ['/api/timer/pause', 'pause'],
    ['/api/timer/resume', 'resume'],
    ['/api/timer/stop', 'stop'],
    ['/api/timer/reset', 'reset'],
    ['/api/timer/adjust', 'adjust'],
  ])('POST %s dispatches to the %s handler', async (path, name) => {
    const res = await request(makeApp()).post(path).send({});

    expect(res.status).toBe(200);
    expect(res.body.handler).toBe(name);
    expect(ctrl[name]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/api/timer/status', 'status'],
    ['/api/timer/history', 'history'],
  ])('GET %s dispatches to the %s handler', async (path, name) => {
    const res = await request(makeApp()).get(path);

    expect(res.status).toBe(200);
    expect(res.body.handler).toBe(name);
    expect(ctrl[name]).toHaveBeenCalledTimes(1);
  });

  it('parses a JSON body so the controller sees the verified requestor', async () => {
    const payload = {
      requestor: { requestorId: '65cf6c3706d8ac105827bb2e' },
      hours: 1,
      minutes: 5,
    };

    const res = await request(makeApp()).post('/api/timer/start').send(payload);

    expect(res.body.body).toEqual(payload);
  });

  it('forwards query parameters to the history handler', async () => {
    const res = await request(makeApp()).get('/api/timer/history?page=2&limit=5');

    expect(res.body.query).toEqual({ page: '2', limit: '5' });
  });

  it('does not expose the state-changing routes over GET', async () => {
    const res = await request(makeApp()).get('/api/timer/start');

    expect(res.status).toBe(404);
    expect(ctrl.start).not.toHaveBeenCalled();
  });

  it('does not expose the read-only routes over POST', async () => {
    const res = await request(makeApp()).post('/api/timer/status').send({});

    expect(res.status).toBe(404);
    expect(ctrl.status).not.toHaveBeenCalled();
  });

  it('404s an unknown timer route', async () => {
    const res = await request(makeApp()).post('/api/timer/not-a-route').send({});

    expect(res.status).toBe(404);
  });
});
