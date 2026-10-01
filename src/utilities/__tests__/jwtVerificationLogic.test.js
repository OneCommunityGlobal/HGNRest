const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../../config');
const jwtVerificationLogic = require('../jwtVerificationLogic');

jest.mock('../../config', () => ({
  JWT_SECRET: 'test-secret-key',
}));

describe('jwtVerificationLogic', () => {
  let mockRes;
  let verifySpy;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Spy on jwt.verify method directly
    verifySpy = jest.spyOn(jwt, 'verify');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Header Validation', () => {
    it('should return 401 if authHeader is missing/falsy', () => {
      const result = jwtVerificationLogic(null, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized request: No header',
      });
      expect(result).toEqual(mockRes);
    });
  });

  describe('Token Parsing & JWT Verification', () => {
    it('should handle headers without "Bearer " prefix', () => {
      const rawToken = 'raw.jwt.token';
      const validPayload = {
        userid: 'user123',
        role: 'admin',
        expiryTimestamp: moment().add(1, 'hour').valueOf(),
      };

      verifySpy.mockReturnValue(validPayload);

      const result = jwtVerificationLogic(rawToken, mockRes);

      expect(verifySpy).toHaveBeenCalledWith(rawToken, config.JWT_SECRET);
      expect(result).toEqual(validPayload);
    });

    it('should strip "Bearer " prefix if present', () => {
      const token = 'valid.jwt.token';
      const authHeader = `Bearer ${token}`;
      const validPayload = {
        userid: 'user123',
        role: 'admin',
        expiryTimestamp: moment().add(1, 'hour').valueOf(),
      };

      verifySpy.mockReturnValue(validPayload);

      const result = jwtVerificationLogic(authHeader, mockRes);

      expect(verifySpy).toHaveBeenCalledWith(token, config.JWT_SECRET);
      expect(result).toEqual(validPayload);
    });

    it('should return 401 and generic error message when jwt.verify throws an error', () => {
      const jwtError = new Error('jwt expired');
      verifySpy.mockImplementation(() => {
        throw jwtError;
      });

      const result = jwtVerificationLogic('Bearer invalid.token', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(result).toEqual(mockRes);
    });
  });

  describe('Payload & Expiry Validation', () => {
    it('should return 401 if payload is missing userid', () => {
      const invalidPayload = {
        role: 'admin',
        expiryTimestamp: moment().add(1, 'hour').valueOf(),
      };
      verifySpy.mockReturnValue(invalidPayload);

      const result = jwtVerificationLogic('Bearer token', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        'Unauthorized request: Token expired or invalid payload',
      );
      expect(result).toEqual(mockRes);
    });

    it('should return 401 if payload is missing role', () => {
      const invalidPayload = {
        userid: 'user123',
        expiryTimestamp: moment().add(1, 'hour').valueOf(),
      };
      verifySpy.mockReturnValue(invalidPayload);

      const result = jwtVerificationLogic('Bearer token', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        'Unauthorized request: Token expired or invalid payload',
      );
      expect(result).toEqual(mockRes);
    });

    it('should return 401 if token is expired', () => {
      const expiredPayload = {
        userid: 'user123',
        role: 'admin',
        expiryTimestamp: moment().subtract(1, 'hour').valueOf(),
      };
      verifySpy.mockReturnValue(expiredPayload);

      const result = jwtVerificationLogic('Bearer token', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        'Unauthorized request: Token expired or invalid payload',
      );
      expect(result).toEqual(mockRes);
    });

    it('should return payload if all validations pass', () => {
      const validPayload = {
        userid: 'user123',
        role: 'user',
        expiryTimestamp: moment().add(10, 'minutes').valueOf(),
      };
      verifySpy.mockReturnValue(validPayload);

      const result = jwtVerificationLogic('Bearer valid.token', mockRes);

      expect(result).toEqual(validPayload);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
