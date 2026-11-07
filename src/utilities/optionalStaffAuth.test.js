jest.mock('./jwtVerificationLogic', () => jest.fn());

const jwtVerificationLogic = require('./jwtVerificationLogic');
const { isAuthenticatedRequest } = require('./optionalStaffAuth');

const requestWithHeader = (value) => ({ header: jest.fn().mockReturnValue(value) });

describe('isAuthenticatedRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the request is missing', () => {
    expect(isAuthenticatedRequest(undefined)).toBe(false);
    expect(jwtVerificationLogic).not.toHaveBeenCalled();
  });

  it('returns false when the request has no header function', () => {
    expect(isAuthenticatedRequest({})).toBe(false);
    expect(jwtVerificationLogic).not.toHaveBeenCalled();
  });

  it('returns false when there is no Authorization header', () => {
    const req = requestWithHeader(undefined);

    expect(isAuthenticatedRequest(req)).toBe(false);
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(jwtVerificationLogic).not.toHaveBeenCalled();
  });

  it('returns true for a valid payload with a user id and role', () => {
    jwtVerificationLogic.mockReturnValue({ userid: 'u1', role: 'Administrator' });

    expect(isAuthenticatedRequest(requestWithHeader('Bearer good'))).toBe(true);
    expect(jwtVerificationLogic).toHaveBeenCalledWith('Bearer good', expect.any(Object));
  });

  it('returns false when the verifier answers through the response sink', () => {
    jwtVerificationLogic.mockImplementation((header, sink) => sink.status(401).json({}));

    expect(isAuthenticatedRequest(requestWithHeader('Bearer bad'))).toBe(false);
  });

  it('never sends a response, whatever method the verifier calls on the sink', () => {
    jwtVerificationLogic.mockImplementation((header, sink) => {
      sink.status(401).json({ error: 'x' });
      sink.send('x');
      return sink;
    });

    expect(isAuthenticatedRequest(requestWithHeader('Bearer bad'))).toBe(false);
  });

  it('returns false when the payload has no user id or no role', () => {
    jwtVerificationLogic.mockReturnValueOnce({ role: 'Administrator' });
    expect(isAuthenticatedRequest(requestWithHeader('Bearer a'))).toBe(false);

    jwtVerificationLogic.mockReturnValueOnce({ userid: 'u1' });
    expect(isAuthenticatedRequest(requestWithHeader('Bearer b'))).toBe(false);
  });

  it('returns false when verification throws', () => {
    jwtVerificationLogic.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(isAuthenticatedRequest(requestWithHeader('Bearer c'))).toBe(false);
  });
});
