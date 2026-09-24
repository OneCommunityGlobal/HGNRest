const webhookTest = jest.fn();

jest.mock('../controllers/lbdashboard/webhookController', () => jest.fn(() => ({ webhookTest })));
jest.mock('../models/lbdashboard/bids', () => ({ Bids: {} }));

const middlewareInitializer = require('./middleware');

const makeApp = () => ({
  use: jest.fn(),
  all: jest.fn(),
  post: jest.fn(),
});

const getPaypalAuthMiddleware = () => {
  const app = makeApp();
  middlewareInitializer(app);
  return app.post.mock.calls[0][1];
};

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('paypalAuthMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 501 when the PayPal auth algorithm header is missing', () => {
    const paypalAuthMiddleware = getPaypalAuthMiddleware();
    const req = { header: jest.fn(() => undefined) };
    const res = makeResponse();
    const next = jest.fn();

    paypalAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing PayPal-Auth-Algo header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when the PayPal auth algorithm header is present', () => {
    const paypalAuthMiddleware = getPaypalAuthMiddleware();
    const req = { header: jest.fn(() => 'SHA256withRSA') };
    const res = makeResponse();
    const next = jest.fn();

    paypalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
