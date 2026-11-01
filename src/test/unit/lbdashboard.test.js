const jwt = require('jsonwebtoken');
const moment = require('moment');
const mongoose = require('mongoose');
const config = require('../../config');
const LBUser = require('../../models/lbdashboard/LBuser');
const { validateInput } = require('../../controllers/lbdashboard/lbdashboardController');
const lbUserManagementController = require('../../controllers/lbUserManagementController');
const { requireLBAdmin } = require('../../middleware/lbdashboard/requireLBAdmin');
const lbUserManagementRouter = require('../../routes/lbUserManagementRouter');
const lbdashboardRoutes = require('../../routes/lbdashboard/lbdashboardRoutes');
const registerMiddleware = require('../../startup/middleware');

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

describe('routers', () => {
  it('exports configured lbUserManagementRouter and lbdashboardRoutes', () => {
    expect(typeof lbUserManagementRouter).toBe('function');
    const routerInstance = lbdashboardRoutes();
    expect(typeof routerInstance).toBe('function');
  });

  it('allows public register and delegates admin routes in startup/middleware', () => {
    const mockApp = { use: jest.fn(), all: jest.fn(), post: jest.fn() };
    registerMiddleware(mockApp);
    const allHandler = mockApp.all.mock.calls[0][1];

    [
      {
        originalUrl: '/api/lbdashboard/register',
        path: '/api/lbdashboard/register',
        method: 'POST',
      },
      { originalUrl: '/lbdashboard/register', path: '/lbdashboard/register', method: 'POST' },
      {
        originalUrl: '/api/lbdashboard/admin/users',
        path: '/api/lbdashboard/admin/users',
        method: 'GET',
      },
      { originalUrl: '/lbdashboard/admin/users', path: '/lbdashboard/admin/users', method: 'GET' },
    ].forEach((req) => {
      const next = jest.fn();
      allHandler(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    const getRegisterReq = {
      originalUrl: '/lbdashboard/register',
      path: '/lbdashboard/register',
      method: 'GET',
      header: () => undefined,
    };
    const res401 = makeRes();
    Object.defineProperty(res401, 'headersSent', { get: () => true });
    const nextNotCalled = jest.fn();
    allHandler(getRegisterReq, res401, nextNotCalled);
    expect(nextNotCalled).not.toHaveBeenCalled();
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

  it('returns 401 when Authorization header is whitespace, non-string, or empty Bearer', () => {
    ['   ', 12345, 'Bearer   '].forEach((val) => {
      const req = { headers: { authorization: val } };
      const res = makeRes();
      const next = jest.fn();
      requireLBAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  it('returns 401 when token is invalid, missing userId/role, or expired', () => {
    const badPayloads = [
      { userid: '123' },
      { role: 'Administrator' },
      {
        userId: '123',
        role: 'Administrator',
        expiryTimestamp: moment().subtract(1, 'hour').toISOString(),
      },
      {
        id: '123',
        role: 'Administrator',
        expiryTimestamp: 'not-a-valid-date',
      },
    ];

    const invalidReq = { header: () => 'Bearer invalid-token' };
    const invalidRes = makeRes();
    requireLBAdmin(invalidReq, invalidRes, jest.fn());
    expect(invalidRes.status).toHaveBeenCalledWith(401);

    badPayloads.forEach((payload) => {
      const token = jwt.sign(payload, config.JWT_SECRET);
      const req = { header: () => token };
      const res = makeRes();
      requireLBAdmin(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(401);
    });
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

  it('calls next() when user has Administrator role via token or req.user or req.session.user', () => {
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

    const reqWithUser = { headers: {}, user: { isAdmin: true } };
    const next2 = jest.fn();
    requireLBAdmin(reqWithUser, makeRes(), next2);
    expect(next2).toHaveBeenCalled();

    const reqWithSession = { headers: {}, session: { user: { role: 'Admin' } } };
    const next3 = jest.fn();
    requireLBAdmin(reqWithSession, makeRes(), next3);
    expect(next3).toHaveBeenCalled();

    const tokenNoExpiry = jwt.sign({ userid: '123', role: 'Admin' }, config.JWT_SECRET);
    const next4 = jest.fn();
    requireLBAdmin({ header: () => tokenNoExpiry }, makeRes(), next4);
    expect(next4).toHaveBeenCalled();
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

      const req = {};
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

    it('returns 400 for invalid page/limit and 500 on database error', async () => {
      const res1 = makeRes();
      await lbUserManagementController.listUsers({ query: { page: '0' } }, res1);
      expect(res1.status).toHaveBeenCalledWith(400);

      const res2 = makeRes();
      await lbUserManagementController.listUsers({ query: { limit: 'abc' } }, res2);
      expect(res2.status).toHaveBeenCalledWith(400);

      LBUser.find.mockImplementation(() => {
        throw new Error('DB fail');
      });
      const res3 = makeRes();
      await lbUserManagementController.listUsers({ query: {} }, res3);
      expect(res3.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUserById, updateUser, deleteUser', () => {
    const validId = new mongoose.Types.ObjectId().toString();

    it('gets a single user by id and handles 400, 404, 500', async () => {
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

      const res = makeRes();
      await lbUserManagementController.getUserById({ params: { id: validId } }, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].user.passwordHash).toBeUndefined();

      const res400 = makeRes();
      await lbUserManagementController.getUserById({ params: { id: 'bad-id' } }, res400);
      expect(res400.status).toHaveBeenCalledWith(400);

      const res400TwelveChar = makeRes();
      await lbUserManagementController.getUserById(
        { params: { id: '123456789012' } },
        res400TwelveChar,
      );
      expect(res400TwelveChar.status).toHaveBeenCalledWith(400);

      const res400Undefined = makeRes();
      await lbUserManagementController.getUserById({ params: {} }, res400Undefined);
      expect(res400Undefined.status).toHaveBeenCalledWith(400);

      LBUser.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      const res404 = makeRes();
      await lbUserManagementController.getUserById({ params: { id: validId } }, res404);
      expect(res404.status).toHaveBeenCalledWith(404);

      LBUser.findById.mockImplementation(() => {
        throw new Error('DB fail');
      });
      const res500 = makeRes();
      await lbUserManagementController.getUserById({ params: { id: validId } }, res500);
      expect(res500.status).toHaveBeenCalledWith(500);
    });

    it('updates a user by id and handles validation, duplicate email, 404, 500', async () => {
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

      const res = makeRes();
      await lbUserManagementController.updateUser(
        {
          params: { id: validId },
          body: { firstName: 'Bobby', email: 'bobby@example.com', password: 'Password1!' },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].user.firstName).toBe('Bobby');

      const resInvalidId = makeRes();
      await lbUserManagementController.updateUser({ params: { id: 'bad' } }, resInvalidId);
      expect(resInvalidId.status).toHaveBeenCalledWith(400);

      const resEmpty = makeRes();
      await lbUserManagementController.updateUser({ params: { id: validId } }, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      const resInvalidField = makeRes();
      await lbUserManagementController.updateUser(
        { params: { id: validId }, body: { firstName: 'A' } },
        resInvalidField,
      );
      expect(resInvalidField.status).toHaveBeenCalledWith(400);

      LBUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'other' }),
      });
      const resDup = makeRes();
      await lbUserManagementController.updateUser(
        { params: { id: validId }, body: { email: 'taken@example.com' } },
        resDup,
      );
      expect(resDup.status).toHaveBeenCalledWith(409);

      LBUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      LBUser.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      const res404 = makeRes();
      await lbUserManagementController.updateUser(
        { params: { id: validId }, body: { firstName: 'Bobby' } },
        res404,
      );
      expect(res404.status).toHaveBeenCalledWith(404);

      LBUser.findByIdAndUpdate.mockImplementation(() => {
        const err = new Error('dup');
        err.code = 11000;
        throw err;
      });
      const resDupKey = makeRes();
      await lbUserManagementController.updateUser(
        { params: { id: validId }, body: { firstName: 'Bobby' } },
        resDupKey,
      );
      expect(resDupKey.status).toHaveBeenCalledWith(409);

      LBUser.findByIdAndUpdate.mockImplementation(() => {
        throw new Error('DB fail');
      });
      const res500 = makeRes();
      await lbUserManagementController.updateUser(
        { params: { id: validId }, body: { firstName: 'Bobby' } },
        res500,
      );
      expect(res500.status).toHaveBeenCalledWith(500);
    });

    it('deletes a user by id and handles 400, 404, 500', async () => {
      LBUser.findByIdAndDelete.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: validId }),
      });

      const res = makeRes();
      await lbUserManagementController.deleteUser({ params: { id: validId } }, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deleted',
        userId: validId,
      });

      const res400 = makeRes();
      await lbUserManagementController.deleteUser({ params: { id: 'bad' } }, res400);
      expect(res400.status).toHaveBeenCalledWith(400);

      LBUser.findByIdAndDelete.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const res404 = makeRes();
      await lbUserManagementController.deleteUser({ params: { id: validId } }, res404);
      expect(res404.status).toHaveBeenCalledWith(404);

      LBUser.findByIdAndDelete.mockImplementation(() => {
        throw new Error('DB fail');
      });
      const res500 = makeRes();
      await lbUserManagementController.deleteUser({ params: { id: validId } }, res500);
      expect(res500.status).toHaveBeenCalledWith(500);
    });
  });
});
