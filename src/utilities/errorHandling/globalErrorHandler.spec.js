jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../startup/logger', () => ({ logException: jest.fn() }));

const { v4: uuidv4 } = require('uuid');
const Logger = require('../../startup/logger');
const { ValidationError, AuthorizationError } = require('./customError');
const globalErrorHandler = require('./globalErrorHandler');

describe('globalErrorHandler', () => {
  const trackingId = 'test-tracking-id';
  let res;
  let next;

  beforeEach(() => {
    uuidv4.mockReturnValue(trackingId);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each([
    [ValidationError, 400],
    [AuthorizationError, 403],
  ])('returns the status and public message for %p', (ErrorType, status) => {
    const err = new ErrorType('Request rejected');

    globalErrorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request rejected',
      errorMessage: expect.stringContaining(trackingId),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a generic 500 with a tracking ID and keeps internal details in the log', () => {
    const err = new Error('Internal diagnostic');
    const req = {
      method: 'POST',
      url: '/example',
      originalUrl: '/api/example',
      body: { count: 2 },
    };

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      errorMessage: expect.stringContaining(trackingId),
    });
    expect(res.json.mock.calls[0][0].errorMessage).not.toContain(err.message);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('POST /api/example'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('{"count":2}'));
    expect(console.error).toHaveBeenCalledWith(err);
    expect(Logger.logException).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['development', 'production'])('uses the exception logger in %s', (environment) => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: environment });
    const err = new Error('Internal diagnostic');
    const req = { method: 'GET', url: '/example', originalUrl: '/api/example' };

    globalErrorHandler(err, req, res, next);

    expect(Logger.logException).toHaveBeenCalledWith(err, 'GET /api/example', null, trackingId);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('logs a diagnostic and returns a tracked 500 when the error is missing', () => {
    globalErrorHandler(undefined, { method: 'GET' }, res, next);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Critical: err parameter is missing'),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      errorMessage: expect.stringContaining(trackingId),
    });
  });
});
