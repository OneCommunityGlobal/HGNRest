const mongoose = require('mongoose');

// Mocks must be registered before/with requirements
jest.mock('../../models/activityLog', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  schema: {
    path: jest.fn(),
  },
}));

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
}));

jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
}));

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const activityLogController = require('../activityLogController');
const ActivityLog = require('../../models/activityLog');
const usersProfiles = require('../../models/userProfile');
const logger = require('../../startup/logger');
const { hasPermission } = require('../../utilities/permissions');

describe('activityLogController', () => {
  let controller;
  let req;
  let res;

  const validObjectId = new mongoose.Types.ObjectId().toString();
  const validUserObjectId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    controller = activityLogController();

    ActivityLog.schema.path.mockImplementation((path) => {
      if (path === 'action_type') {
        return { enumValues: ['LOGIN', 'LOGOUT', 'SUBMIT_TASK', 'ATTENDANCE'] };
      }
      if (path === 'assisted_users') {
        return {
          schema: {
            path: jest.fn().mockReturnValue({
              enumValues: ['1-on-1', 'group', 'technical_support'],
            }),
          },
        };
      }
      return {};
    });

    req = {
      body: {
        requestor: {
          requestorId: validObjectId,
          role: 'Student',
        },
      },
      query: {},
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('fetchStudentDailyLog', () => {
    it('should return 400 if requestor studentId is missing or invalid', async () => {
      req.body.requestor.requestorId = 'invalid-id';

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid studentId format' });
    });

    it('should return 400 if requested studentId in query has an invalid format', async () => {
      req.query.studentId = 'invalid-query-id';

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid studentId format' });
    });

    it("should return 403 if requested studentId does not match requestor's studentId", async () => {
      const otherStudentId = new mongoose.Types.ObjectId().toString();
      req.query.studentId = otherStudentId;

      await controller.fetchStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden: Cannot access another student's log",
      });
    });

    it('should return 200 and formatted logs for a valid request', async () => {
      const mockLog = {
        _id: 'log123',
        action_type: 'LOGIN',
        metadata: { browser: 'Chrome' },
        created_at: new Date(),
        actor_id: validObjectId,
        is_assisted: false,
      };

      ActivityLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([mockLog]),
      });

      await controller.fetchStudentDailyLog(req, res);

      expect(res.json).toHaveBeenCalledWith([
        {
          log_id: 'log123',
          action_type: 'LOGIN',
          metadata: { browser: 'Chrome' },
          created_at: mockLog.created_at,
          actor_id: validObjectId,
          is_assisted: false,
        },
      ]);
    });

    it('should handle exceptions and return 500', async () => {
      ActivityLog.find.mockImplementation(() => {
        throw new Error('Database Failure');
      });

      await controller.fetchStudentDailyLog(req, res);

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred' });
    });
  });

  describe('fetchStudentDailyLogsByStaff', () => {
    it('should return 400 if studentId param is missing', async () => {
      req.params.studentId = '';

      await controller.fetchStudentDailyLogsByStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing studentId' });
    });

    it('should return 400 if studentId param is invalid', async () => {
      req.params.studentId = 'bad-id';

      await controller.fetchStudentDailyLogsByStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid studentId format' });
    });

    it('should return 403 if staff member lacks readActivityLogs permission', async () => {
      req.params.studentId = validObjectId;
      hasPermission.mockResolvedValue(false);

      await controller.fetchStudentDailyLogsByStaff(req, res);

      expect(hasPermission).toHaveBeenCalledWith(req.body.requestor, 'readActivityLogs');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You are not authorized to view student logs',
      });
    });

    it('should return 200 and logs when permission is granted', async () => {
      req.params.studentId = validObjectId;
      hasPermission.mockResolvedValue(true);

      const mockLog = {
        _id: 'log456',
        action_type: 'SUBMIT_TASK',
        metadata: {},
        created_at: new Date(),
        actor_id: validObjectId,
        is_assisted: true,
        assisted_users: [
          {
            user_id: validUserObjectId,
            name: 'Jane Doe',
            assisted_at: new Date(),
            assistance_type: '1-on-1',
          },
        ],
      };

      ActivityLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([mockLog]),
      });

      await controller.fetchStudentDailyLogsByStaff(req, res);

      expect(res.json).toHaveBeenCalledWith([
        {
          log_id: 'log456',
          action_type: 'SUBMIT_TASK',
          metadata: {},
          created_at: mockLog.created_at,
          actor_id: validObjectId,
          is_assisted: true,
          assisted_users: [
            {
              user_id: validUserObjectId,
              name: 'Jane Doe',
              assisted_at: mockLog.assisted_users[0].assisted_at,
              assistance_type: '1-on-1',
            },
          ],
        },
      ]);
    });
  });

  describe('createStudentDailyLog', () => {
    it('should return 400 if actionType or entityId are missing', async () => {
      req.body = { requestor: { requestorId: validObjectId } };

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'actionType and entityId are required' });
    });

    it('should return 400 if actionType is invalid', async () => {
      req.body.actionType = 'INVALID_ACTION';
      req.body.entityId = 'entity123';

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid actionType. Must be one of: LOGIN, LOGOUT, SUBMIT_TASK, ATTENDANCE',
      });
    });

    it('should return 403 if non-staff user attempts to set isAssisted to true', async () => {
      req.body.actionType = 'LOGIN';
      req.body.entityId = 'entity123';
      req.body.isAssisted = true;
      hasPermission.mockResolvedValue(false);

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only educators or administrators can set the assisted flag',
      });
    });

    it('should return 400 if isAssisted is true but assistedUsers is empty', async () => {
      req.body.actionType = 'LOGIN';
      req.body.entityId = 'entity123';
      req.body.isAssisted = true;
      req.body.assistedUsers = [];
      hasPermission.mockResolvedValue(true);

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('should return 400 when an invalid userId is passed in assistedUsers', async () => {
      req.body.actionType = 'LOGIN';
      req.body.entityId = 'entity123';
      req.body.isAssisted = true;
      req.body.assistedUsers = [{ userId: 'invalid-user-id', assistanceType: '1-on-1' }];
      hasPermission.mockResolvedValue(true);

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'One or more provided userIds are invalid' });
    });

    it('should return 400 when an invalid assistanceType is provided', async () => {
      req.body.actionType = 'LOGIN';
      req.body.entityId = 'entity123';
      req.body.isAssisted = true;
      req.body.assistedUsers = [{ userId: validUserObjectId, assistanceType: 'INVALID_TYPE' }];
      hasPermission.mockResolvedValue(true);

      usersProfiles.find.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue([{ _id: validUserObjectId, firstName: 'John', lastName: 'Doe' }]),
      });

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: `Invalid assistanceType for user ${validUserObjectId}: INVALID_TYPE`,
      });
    });

    it('should successfully create an unassisted activity log', async () => {
      req.body.actionType = 'LOGIN';
      req.body.entityId = 'entity123';

      const mockCreatedLog = {
        _id: 'newLog123',
        action_type: 'LOGIN',
        metadata: {},
        created_at: new Date(),
        actor_id: validObjectId,
        is_assisted: false,
      };

      ActivityLog.create.mockResolvedValue(mockCreatedLog);

      await controller.createStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Activity log created successfully',
        log: expect.objectContaining({ log_id: 'newLog123', is_assisted: false }),
      });
    });
  });

  describe('updateStudentDailyLog', () => {
    it('should return 400 if logId param is missing or invalid', async () => {
      req.params.logId = 'invalid-log-id';

      await controller.updateStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing logId' });
    });

    it('should return 403 if user lacks updateActivityLogs permission', async () => {
      req.params.logId = validObjectId;
      hasPermission.mockResolvedValue(false);

      await controller.updateStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only educators or administrators can update the assisted flag',
      });
    });

    it('should return 404 if the log is not found in database', async () => {
      req.params.logId = validObjectId;
      hasPermission.mockResolvedValue(true);
      ActivityLog.findById.mockResolvedValue(null);

      await controller.updateStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Activity log not found' });
    });

    it('should return 400 if isAssisted is true but assistedUsers is omitted', async () => {
      req.params.logId = validObjectId;
      req.body.isAssisted = true;
      hasPermission.mockResolvedValue(true);

      const mockLog = { _id: validObjectId, save: jest.fn() };
      ActivityLog.findById.mockResolvedValue(mockLog);

      await controller.updateStudentDailyLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('should successfully update the activity log', async () => {
      req.params.logId = validObjectId;
      req.body.isAssisted = true;
      req.body.assistedUsers = [{ userId: validUserObjectId, assistanceType: '1-on-1' }];

      hasPermission.mockResolvedValue(true);

      const mockLog = {
        _id: validObjectId,
        action_type: 'ATTENDANCE',
        metadata: {},
        created_at: new Date(),
        actor_id: validObjectId,
        is_assisted: false,
        assisted_users: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ActivityLog.findById.mockResolvedValue(mockLog);
      usersProfiles.find.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue([{ _id: validUserObjectId, firstName: 'Alex', lastName: 'Smith' }]),
      });

      await controller.updateStudentDailyLog(req, res);

      expect(mockLog.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Activity log updated successfully',
        log: expect.objectContaining({
          log_id: validObjectId,
          is_assisted: true,
        }),
      });
    });
  });
});
