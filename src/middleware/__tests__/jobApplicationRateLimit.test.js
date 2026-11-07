const {
  createRateLimiter,
  createJobApplicationIpLimiter,
  createJobApplicationEmailLimiter,
  IP_LIMIT_MESSAGE,
  EMAIL_LIMIT_MESSAGE,
} = require('../jobApplicationRateLimit');

jest.mock('../../controllers/collaborationController', () => ({
  // Same shape as the real resolveApplicationInput for the two body forms the route accepts.
  resolveApplicationInput: jest.fn((body) => {
    if (body.payload) {
      try {
        const payload = JSON.parse(body.payload);
        return { email: payload.applicantEmail || body.email };
      } catch {
        return { error: 'Invalid application payload.' };
      }
    }
    return { email: body.email };
  }),
}));

const makeRes = () => {
  const res = {};
  res.set = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeClock = (start = 1000000) => {
  const clock = { t: start };
  clock.now = () => clock.t;
  clock.advance = (ms) => {
    clock.t += ms;
  };
  return clock;
};

const run = (limiter, req) => {
  const res = makeRes();
  const next = jest.fn();
  limiter(req, res, next);
  return { res, next };
};

describe('createRateLimiter', () => {
  const WINDOW = 60 * 1000;
  let clock;
  let limiter;

  beforeEach(() => {
    clock = makeClock();
    limiter = createRateLimiter({
      windowMs: WINDOW,
      max: 3,
      keyFn: (req) => req.key,
      message: 'slow down',
      now: clock.now,
    });
  });

  it('lets requests through up to the max and then answers 429 with Retry-After', () => {
    for (let i = 0; i < 3; i += 1) {
      const { next, res } = run(limiter, { key: 'a' });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
    clock.advance(10 * 1000);
    const { res, next } = run(limiter, { key: 'a' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'slow down' });
    expect(res.set).toHaveBeenCalledWith('Retry-After', '50');
  });

  it('allows requests again once the window has passed', () => {
    for (let i = 0; i < 4; i += 1) run(limiter, { key: 'a' });
    clock.advance(WINDOW);
    const { next, res } = run(limiter, { key: 'a' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('counts each key independently', () => {
    for (let i = 0; i < 4; i += 1) run(limiter, { key: 'a' });
    const { next } = run(limiter, { key: 'b' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips requests without a key', () => {
    for (let i = 0; i < 10; i += 1) {
      const { next } = run(limiter, { key: '' });
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('never blocks on its own internal error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = createRateLimiter({
      windowMs: WINDOW,
      max: 1,
      keyFn: () => {
        throw new Error('boom');
      },
      message: 'x',
      now: clock.now,
    });
    const { next, res } = run(broken, {});
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('sweeps expired entries and keeps the map bounded', () => {
    const bounded = createRateLimiter({
      windowMs: WINDOW,
      max: 1,
      keyFn: (req) => req.key,
      message: 'x',
      now: clock.now,
      maxKeys: 3,
    });
    // Fill with live keys beyond the bound: the oldest ('k0') is evicted, so it counts afresh.
    ['k0', 'k1', 'k2', 'k3'].forEach((key) => run(bounded, { key }));
    expect(run(bounded, { key: 'k0' }).next).toHaveBeenCalledTimes(1);
    // k3 is still tracked and over its max of 1 after a second hit.
    expect(run(bounded, { key: 'k3' }).res.status).toHaveBeenCalledWith(429);
    // After the window everything expired and is swept, so all keys start clean.
    clock.advance(WINDOW + 1);
    expect(run(bounded, { key: 'k3' }).next).toHaveBeenCalledTimes(1);
  });
});

describe('job application IP limiter', () => {
  it('allows 10 per 15 minutes per IP, then blocks with the spec message', () => {
    const clock = makeClock();
    const limiter = createJobApplicationIpLimiter({ now: clock.now });
    for (let i = 0; i < 10; i += 1) {
      expect(run(limiter, { ip: '1.1.1.1' }).next).toHaveBeenCalledTimes(1);
    }
    const blocked = run(limiter, { ip: '1.1.1.1' });
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.json).toHaveBeenCalledWith({ error: IP_LIMIT_MESSAGE });
    expect(IP_LIMIT_MESSAGE).toBe(
      'Too many applications from this connection. Please try again later.',
    );
    expect(blocked.res.set).toHaveBeenCalledWith('Retry-After', String(15 * 60));

    expect(run(limiter, { ip: '2.2.2.2' }).next).toHaveBeenCalledTimes(1);

    clock.advance(15 * 60 * 1000);
    expect(run(limiter, { ip: '1.1.1.1' }).next).toHaveBeenCalledTimes(1);
  });
});

describe('job application email limiter', () => {
  it('allows 5 per hour per normalized address, then blocks', () => {
    const clock = makeClock();
    const limiter = createJobApplicationEmailLimiter({ now: clock.now });
    const variants = ['Ada@Example.com', ' ada@example.com ', 'ADA@EXAMPLE.COM'];
    for (let i = 0; i < 5; i += 1) {
      const { next } = run(limiter, { body: { email: variants[i % 3] } });
      expect(next).toHaveBeenCalledTimes(1);
    }
    const blocked = run(limiter, { body: { email: 'ada@example.com' } });
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.json).toHaveBeenCalledWith({ error: EMAIL_LIMIT_MESSAGE });
    expect(blocked.res.set).toHaveBeenCalledWith('Retry-After', String(60 * 60));

    expect(run(limiter, { body: { email: 'bob@example.com' } }).next).toHaveBeenCalledTimes(1);

    clock.advance(60 * 60 * 1000);
    expect(run(limiter, { body: { email: 'ada@example.com' } }).next).toHaveBeenCalledTimes(1);
  });

  it('reads the email from the payload JSON like the controller does', () => {
    const clock = makeClock();
    const limiter = createJobApplicationEmailLimiter({ now: clock.now, max: 1 });
    const body = { payload: JSON.stringify({ applicantEmail: 'Ada@Example.com' }) };
    expect(run(limiter, { body }).next).toHaveBeenCalledTimes(1);
    expect(run(limiter, { body: { email: 'ada@example.com' } }).res.status).toHaveBeenCalledWith(
      429,
    );
  });

  it('skips requests with no email or an unreadable payload', () => {
    const limiter = createJobApplicationEmailLimiter({ max: 1 });
    [{ body: {} }, { body: { payload: '{bad' } }, {}].forEach((req) => {
      for (let i = 0; i < 3; i += 1) expect(run(limiter, req).next).toHaveBeenCalledTimes(1);
    });
  });
});
