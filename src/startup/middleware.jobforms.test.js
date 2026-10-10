jest.mock('../controllers/lbdashboard/webhookController', () =>
  jest.fn(() => ({
    webhookTest: jest.fn(),
  })),
);
jest.mock('../models/lbdashboard/bids', () => ({ Bids: {} }));
jest.mock('../utilities/jwtVerificationLogic', () => jest.fn());

const middlewareFactory = require('./middleware');

describe('middleware public jobforms routes', () => {
  const next = jest.fn();
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    const app = {
      use: jest.fn(),
      all: jest.fn((path, cb) => {
        if (path === '*') handler = cb;
      }),
      post: jest.fn(),
    };
    middlewareFactory(app);
  });

  const run = (originalUrl, method) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    handler({ originalUrl, method, path: originalUrl, header: jest.fn() }, res, next);
    return res;
  };

  it('allows unauthenticated GET /api/jobforms', () => {
    run('/api/jobforms/abc', 'GET');
    expect(next).toHaveBeenCalled();
  });

  it('allows unauthenticated POST /api/jobforms/responses', () => {
    run('/api/jobforms/responses', 'POST');
    expect(next).toHaveBeenCalled();
  });

  it('allows unauthenticated POST /api/jobforms/responses/upload', () => {
    run('/api/jobforms/responses/upload', 'POST');
    expect(next).toHaveBeenCalled();
  });
});
