jest.mock('../services/studentTimerService', () => ({
  start: jest.fn().mockResolvedValue({ status: 'running' }),
  pause: jest.fn().mockResolvedValue({ status: 'paused' }),
  resume: jest.fn().mockResolvedValue({ status: 'running' }),
  stop: jest.fn().mockResolvedValue({ status: 'stopped' }),
  reset: jest.fn().mockResolvedValue({ status: 'idle' }),
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
});
