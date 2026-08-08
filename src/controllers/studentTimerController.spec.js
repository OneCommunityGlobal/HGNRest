jest.mock('../services/studentTimerService', () => ({
  start: jest.fn().mockResolvedValue({ status: 'running' }),
  pause: jest.fn().mockResolvedValue({ status: 'paused' }),
  resume: jest.fn().mockResolvedValue({ status: 'running' }),
  stop: jest.fn().mockResolvedValue({ status: 'stopped' }),
  reset: jest.fn().mockResolvedValue({ status: 'idle' }),
  status: jest.fn().mockResolvedValue({ status: 'idle' }),
  history: jest.fn().mockResolvedValue({ page: 1, limit: 20, total: 0, items: [] }),
  adjustDuration: jest.fn().mockResolvedValue({ status: 'running' }),
}));

const timerSvc = require('../services/studentTimerService');
const controller = require('./studentTimerController');

const realUserId = '65cf6c3706d8ac105827bb2e';
const spoofedUserId = '65cf6c3706d8ac105827bb99';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const authedReq = (extra = {}) => ({
  body: { requestor: { requestorId: realUserId, role: 'Student' }, ...(extra.body || {}) },
  query: extra.query,
  ...(extra.rest || {}),
});

describe('studentTimerController authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores a spoofed x-user-id header and uses the verified JWT identity on start', async () => {
    const req = {
      headers: { 'x-user-id': spoofedUserId },
      body: {
        requestor: { requestorId: realUserId, role: 'Student' },
        hours: 0,
        minutes: 30,
        taskId: 'some-task-id',
      },
    };

    await controller.start(req, mockRes());

    expect(timerSvc.start).toHaveBeenCalledWith(expect.objectContaining({ userId: realUserId }));
    expect(timerSvc.start).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: spoofedUserId }),
    );
  });

  it('ignores a spoofed x-user-id header on stop', async () => {
    const req = {
      headers: { 'x-user-id': spoofedUserId },
      body: { requestor: { requestorId: realUserId, role: 'Student' } },
    };

    await controller.stop(req, mockRes());

    expect(timerSvc.stop).toHaveBeenCalledWith({ userId: realUserId });
  });

  it('ignores a spoofed x-user-id header on reset', async () => {
    const req = {
      headers: { 'x-user-id': spoofedUserId },
      body: { requestor: { requestorId: realUserId, role: 'Student' } },
    };

    await controller.reset(req, mockRes());

    expect(timerSvc.reset).toHaveBeenCalledWith({ userId: realUserId });
  });

  it('passes undefined userId to the service (which rejects it) when there is no verified requestor', async () => {
    const req = { headers: { 'x-user-id': spoofedUserId }, body: {} };

    await controller.start(req, mockRes());

    expect(timerSvc.start).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it('derives no identity at all when the request has no body (unauthenticated call)', async () => {
    const res = mockRes();

    await controller.status({}, res);

    expect(timerSvc.status).toHaveBeenCalledWith({ userId: undefined });
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { status: 'idle' } });
  });
});

describe('studentTimerController success envelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['pause', 'pause', { status: 'paused' }],
    ['resume', 'resume', { status: 'running' }],
    ['stop', 'stop', { status: 'stopped' }],
    ['status', 'status', { status: 'idle' }],
    ['reset', 'reset', { status: 'idle' }],
  ])('%s forwards only the verified userId and wraps the result', async (handler, svcFn, data) => {
    const res = mockRes();

    await controller[handler](authedReq(), res);

    expect(timerSvc[svcFn]).toHaveBeenCalledWith({ userId: realUserId });
    expect(res.json).toHaveBeenCalledWith({ ok: true, data });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('start forwards the duration, task and note from the body', async () => {
    const res = mockRes();
    const req = authedReq({
      body: { hours: 1, minutes: 15, taskId: '65cf6c3706d8ac105827bb2f', note: 'algebra' },
    });

    await controller.start(req, res);

    expect(timerSvc.start).toHaveBeenCalledWith({
      userId: realUserId,
      hours: 1,
      minutes: 15,
      taskId: '65cf6c3706d8ac105827bb2f',
      note: 'algebra',
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { status: 'running' } });
  });

  it('start tolerates a missing body and lets the service reject the empty input', async () => {
    const res = mockRes();

    await controller.start({}, res);

    expect(timerSvc.start).toHaveBeenCalledWith({
      userId: undefined,
      hours: undefined,
      minutes: undefined,
      taskId: undefined,
      note: undefined,
    });
  });

  it('history applies page/limit defaults when the query omits them', async () => {
    const res = mockRes();

    await controller.history(authedReq({ query: {} }), res);

    expect(timerSvc.history).toHaveBeenCalledWith({ userId: realUserId, page: 1, limit: 20 });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: { page: 1, limit: 20, total: 0, items: [] },
    });
  });

  it('history forwards an explicit page and limit', async () => {
    const res = mockRes();

    await controller.history(authedReq({ query: { page: '3', limit: '5' } }), res);

    expect(timerSvc.history).toHaveBeenCalledWith({ userId: realUserId, page: '3', limit: '5' });
  });

  it('adjust forwards deltaMinutes', async () => {
    const res = mockRes();

    await controller.adjust(authedReq({ body: { deltaMinutes: -10 } }), res);

    expect(timerSvc.adjustDuration).toHaveBeenCalledWith({
      userId: realUserId,
      deltaMinutes: -10,
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { status: 'running' } });
  });

  it('adjust tolerates a missing body', async () => {
    const res = mockRes();

    await controller.adjust({}, res);

    expect(timerSvc.adjustDuration).toHaveBeenCalledWith({
      userId: undefined,
      deltaMinutes: undefined,
    });
  });
});

describe('studentTimerController error envelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a service error status onto the HTTP response', async () => {
    const res = mockRes();
    timerSvc.pause.mockRejectedValueOnce(
      Object.assign(new Error('Timer is not running'), { status: 409 }),
    );

    await controller.pause(authedReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: 'Timer is not running',
      data: null,
    });
  });

  it('defaults to 500 for an error that carries no status (unexpected failure)', async () => {
    const res = mockRes();
    timerSvc.stop.mockRejectedValueOnce(new Error('connection lost'));

    await controller.stop(authedReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'connection lost', data: null });
  });

  it('passes an error payload through as the response data', async () => {
    const res = mockRes();
    timerSvc.start.mockRejectedValueOnce(
      Object.assign(new Error('Timer already running'), {
        status: 409,
        payload: { status: 'running' },
      }),
    );

    await controller.start(authedReq({ body: { hours: 0, minutes: 5 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: 'Timer already running',
      data: { status: 'running' },
    });
  });

  it.each([
    ['start', 'start'],
    ['pause', 'pause'],
    ['resume', 'resume'],
    ['stop', 'stop'],
    ['status', 'status'],
    ['reset', 'reset'],
    ['adjust', 'adjustDuration'],
  ])('%s reports a service rejection instead of throwing', async (handler, svcFn) => {
    const res = mockRes();
    timerSvc[svcFn].mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 400 }));

    await expect(controller[handler](authedReq(), res)).resolves.not.toThrow();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'nope', data: null });
  });

  it('history reports a service rejection instead of throwing', async () => {
    const res = mockRes();
    timerSvc.history.mockRejectedValueOnce(Object.assign(new Error('bad page'), { status: 400 }));

    await controller.history(authedReq({ query: {} }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'bad page', data: null });
  });

  it('history fails closed with a 500 when the request has no query object', async () => {
    const res = mockRes();

    await controller.history(authedReq(), res);

    expect(timerSvc.history).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, data: null }));
  });
});
