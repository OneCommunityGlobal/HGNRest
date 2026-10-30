const jwt = require('jsonwebtoken');
const moment = require('moment');
const mongoose = require('mongoose');
const config = require('../../config');
const LBUser = require('../../models/lbdashboard/LBuser');
const { validateInput } = require('../../controllers/lbdashboard/lbdashboardController');
const lbUserManagementController = require('../../controllers/lbUserManagementController');
const { requireLBAdmin } = require('../../middleware/lbdashboard/requireLBAdmin');

jest.mock('../../models/lbdashboard/LBuser');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('validateInput', () => {
  it('should return errors for invalid fields', () => {
    const result = validateInput({
      firstName: '',
      lastName: '1',
      email: 'abc@',
      phone: 'abc123',
      password: '123',
    });

    expect(result.firstName).toMatch(/at least 2 letters/);
    expect(result.lastName).toMatch(/at least 2 letters/);
    expect(result.email).toMatch(/Invalid email/);
    expect(result.phone).toMatch(/7-15 digits/);
    expect(result.password).toMatch(/Password must be at least 8 characters/);
  });

  it('should return empty object for valid data', () => {
    const result = validateInput({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '+12345678901',
      password: 'Pass1234!',
    });

    expect(result).toEqual({});
  });
});

describe('requireLBAdmin middleware', () => {
  it('returns 401 when Authorization header and session are missing', () => {
    const req = { header: () => undefined, headers: {} };
    const res = makeRes();
    const next = jest.fn();

    requireLBAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', () => {
    const req = { header: () => 'Bearer invalid-token' };
    const res = makeRes();
    const next = jest.fn();

    requireLBAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user is not an Admin', () => {
    const token = jwt.sign(
      {
        userid: '507f1f77bcf86cd799439011',
        role: 'Volunteer',
        expiryTimestamp: moment().add(1, 'hour').toISOString(),
      },
      config.JWT_SECRET,
    );
    const req = { header: () => `Bearer ${token}` };
    const res = makeRes();
    const next = jest.fn();

    requireLBAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user has Administrator or Admin role', () => {
    const token = jwt.sign(
      {
        userid: '507f1f77bcf86cd799439011',
        role: 'Administrator',
        expiryTimestamp: moment().add(1, 'hour').toISOString(),
      },
      config.JWT_SECRET,
    );
    const req = { header: () => `Bearer ${token}` };
    const res = makeRes();
    const next = jest.fn();

    requireLBAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('Administrator');
  });
});

describe('lbUserManagementController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LBUser.find = jest.fn();
    LBUser.countDocuments = jest.fn();
    LBUser.findById = jest.fn();
    LBUser.findOne = jest.fn();
    LBUser.findByIdAndUpdate = jest.fn();
    LBUser.findByIdAndDelete = jest.fn();
  });

  describe('listUsers (GET /lbdashboard/admin/users)', () => {
    it('lists users with default pagination, sorted by createdAt desc, and excludes sensitive fields', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: '507f1f77bcf86cd799439011',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            phone: '+1234567890',
            passwordHash: 'secret-hash-should-not-leak',
            resetToken: 'secret-token',
            createdAt: '2026-10-30T00:00:00.000Z',
            updatedAt: '2026-10-30T00:00:00.000Z',
          },
        ]),
      };
      LBUser.find.mockReturnValue(mockChain);
      LBUser.countDocuments.mockResolvedValue(1);

      const req = { query: {} };
      const res = makeRes();

      await lbUserManagementController.listUsers(req, res);

      expect(LBUser.find).toHaveBeenCalledWith({});
      expect(mockChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockChain.skip).toHaveBeenCalledWith(0);
      expect(mockChain.limit).toHaveBeenCalledWith(20);
      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(payload.users).toHaveLength(1);
      expect(payload.users[0]).toEqual({
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        phone: '+1234567890',
        createdAt: '2026-10-30T00:00:00.000Z',
        updatedAt: '2026-10-30T00:00:00.000Z',
      });
      expect(payload.users[0].passwordHash).toBeUndefined();
      expect(payload.users[0].resetToken).toBeUndefined();
    });

    it('applies case-insensitive regex search across firstName, lastName, and email', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      LBUser.find.mockReturnValue(mockChain);
      LBUser.countDocuments.mockResolvedValue(0);

      const req = { query: { page: '2', limit: '5', search: 'alice' } };
      const res = makeRes();

      await lbUserManagementController.listUsers(req, res);

      const expectedPattern = { $regex: 'alice', $options: 'i' };
      expect(LBUser.find).toHaveBeenCalledWith({
        $or: [
          { firstName: expectedPattern },
          { lastName: expectedPattern },
          { email: expectedPattern },
        ],
      });
      expect(mockChain.skip).toHaveBeenCalledWith(5);
      expect(mockChain.limit).toHaveBeenCalledWith(5);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getUserById, updateUser, deleteUser', () => {
    const validId = new mongoose.Types.ObjectId().toString();

    it('gets a single user by id excluding sensitive fields', async () => {
      LBUser.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: validId,
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          phone: '1234567890',
          passwordHash: 'hidden',
          createdAt: '2026-10-30T00:00:00.000Z',
          updatedAt: '2026-10-30T00:00:00.000Z',
        }),
      });

      const req = { params: { id: validId } };
      const res = makeRes();

      await lbUserManagementController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].user.passwordHash).toBeUndefined();
      expect(res.json.mock.calls[0][0].user.email).toBe('bob@example.com');
    });

    it('updates a user by id', async () => {
      LBUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      LBUser.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: validId,
          firstName: 'Bobby',
          lastName: 'Jones',
          email: 'bobby@example.com',
          phone: '1234567890',
          createdAt: '2026-10-30T00:00:00.000Z',
          updatedAt: '2026-10-30T01:00:00.000Z',
        }),
      });

      const req = {
        params: { id: validId },
        body: { firstName: 'Bobby', email: 'bobby@example.com' },
      };
      const res = makeRes();

      await lbUserManagementController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].user.firstName).toBe('Bobby');
    });

    it('deletes a user by id', async () => {
      LBUser.findByIdAndDelete.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: validId }),
      });

      const req = { params: { id: validId } };
      const res = makeRes();

      await lbUserManagementController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deleted',
        userId: validId,
      });
    });
  });
});
