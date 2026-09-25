jest.mock('../utilities/jwtVerificationLogic');

const jwtVerificationLogic = require('../utilities/jwtVerificationLogic');
const authenticateHelpRequest = require('./authenticateHelpRequest');

const makeReqResNext = (authHeader) => {
  const req = { header: jest.fn().mockReturnValue(authHeader) };
  const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
};

describe('authenticateHelpRequest middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('populates req.user from the verified JWT payload and calls next()', () => {
    jwtVerificationLogic.mockReturnValue({
      userid: 'authenticatedUser1',
      role: 'Volunteer',
      permissions: { frontPermissions: [] },
    });
    const { req, res, next } = makeReqResNext('Bearer valid.token');

    authenticateHelpRequest(req, res, next);

    expect(req.user).toEqual({
      requestorId: 'authenticatedUser1',
      role: 'Volunteer',
      permissions: { frontPermissions: [] },
    });
    expect(next).toHaveBeenCalled();
  });

  it('rejects a missing/invalid token without calling next()', () => {
    jwtVerificationLogic.mockImplementation((authHeader, res) => {
      res.status(401).json({ error: 'Invalid token' });
      res.headersSent = true;
      return undefined;
    });
    const { req, res, next } = makeReqResNext(undefined);

    authenticateHelpRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
