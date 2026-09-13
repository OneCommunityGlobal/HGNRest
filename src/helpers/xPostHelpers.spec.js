jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
}));

const Logger = require('../startup/logger');
const globalErrorHandler = require('../utilities/errorHandling/globalErrorHandler');
const {
  asyncRoute,
  validateContent,
  ValidationError,
  NotFoundError,
  X_MAX_CONTENT_LENGTH,
} = require('./xPostHelpers');

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('xPostHelpers validateContent', () => {
  it('exports a 280-character X content limit', () => {
    expect(X_MAX_CONTENT_LENGTH).toBe(280);
  });

  it('accepts content at exactly 280 characters', () => {
    expect(() => validateContent('a'.repeat(280))).not.toThrow();
  });

  it('accepts a normal short string', () => {
    expect(() => validateContent('Hello from the X auto-poster!')).not.toThrow();
  });

  it('rejects content at 281 characters with a 400 ValidationError', () => {
    let thrown;
    try {
      validateContent('a'.repeat(281));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect(thrown.status).toBe(400);
    expect(thrown.message).toBe(`Content exceeds ${X_MAX_CONTENT_LENGTH} characters`);
  });

  it('rejects content well over the limit', () => {
    expect(() => validateContent('a'.repeat(1000))).toThrow(/exceeds/);
  });

  describe('missing or non-string content (current contract)', () => {
    it.each([
      ['empty string', ''],
      ['undefined', undefined],
      ['null', null],
      ['number', 42],
    ])('rejects %s with a 400 "content is required" error', (_label, value) => {
      let thrown;
      try {
        validateContent(value);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect(thrown.status).toBe(400);
      expect(thrown.message).toBe('content is required');
    });
  });

  it('honors custom messages and max length', () => {
    expect(() => validateContent('abcd', 'req', 'too long', 3)).toThrow('too long');
    expect(() => validateContent('', 'req', 'too long', 3)).toThrow('req');
  });
});

describe('xPostHelpers asyncRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['validation', new ValidationError('Invalid X content'), 400],
    ['authentication', Object.assign(new Error('Missing requestor'), { status: 401 }), 401],
    [
      'authorization',
      Object.assign(new Error('You are not authorized to manage X posts.'), { status: 403 }),
      403,
    ],
    ['not found', new NotFoundError('Scheduled post not found'), 404],
  ])('handles an expected %s error locally without calling next', async (_, error, status) => {
    const res = makeResponse();
    const next = jest.fn();
    const handler = asyncRoute(async () => {
      throw error;
    });

    await handler({}, res, next);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: error.message });
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards the exact unexpected error without producing a local response', async () => {
    const error = new Error('Sensitive database failure');
    const res = makeResponse();
    const next = jest.fn();
    const handler = asyncRoute(async () => {
      throw error;
    });

    await handler({}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(next.mock.calls[0][0]).toBe(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('forwards an unexpected status 500 error instead of exposing its message', async () => {
    const error = Object.assign(new Error('Sensitive status 500 failure'), { status: 500 });
    const res = makeResponse();
    const next = jest.fn();
    const handler = asyncRoute(async () => {
      throw error;
    });

    await handler({}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(next.mock.calls[0][0]).toBe(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('uses the global handler to log and sanitize an unexpected error', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const sensitiveMessage = 'Database password is secret-value';
    const error = new Error(sensitiveMessage);
    const req = {
      method: 'GET',
      url: '/x/history',
      originalUrl: '/x/history',
      body: {},
    };
    const res = makeResponse();
    const next = jest.fn((forwardedError) =>
      globalErrorHandler(forwardedError, req, res, jest.fn()),
    );
    const handler = asyncRoute(async () => {
      throw error;
    });

    try {
      await handler(req, res, next);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    expect(next).toHaveBeenCalledWith(error);
    expect(next.mock.calls[0][0]).toBe(error);
    expect(Logger.logException).toHaveBeenCalledWith(
      error,
      'GET /x/history',
      JSON.stringify(req.body),
      expect.any(String),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      errorMessage: expect.stringMatching(/^An internal error has occurred\..*ID: [0-9a-f-]+$/i),
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(sensitiveMessage);
  });
});
