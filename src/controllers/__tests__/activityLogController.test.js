jest.mock('../../models/activityLog', () => {
  const mockActivityLog = jest.fn();
  mockActivityLog.find = jest.fn();
  mockActivityLog.findById = jest.fn();
  mockActivityLog.create = jest.fn();
  mockActivityLog.schema = {
    path: jest.fn((field) => {
      if (field === 'action_type') {
        return {
          enumValues: ['comment', 'note', 'announcement', 'task_upload', 'task_complete'],
        };
      }
      if (field === 'assisted_users') {
        return {
          schema: {
            path: jest.fn(() => ({
              enumValues: ['created', 'edited'],
            })),
          },
        };
      }
      return { enumValues: [] };
    }),
  };
  return mockActivityLog;
});

jest.mock('../../models/userProfile', () => {
  const mockUserProfile = jest.fn();
  mockUserProfile.find = jest.fn();
  return mockUserProfile;
});

jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
}));

const mongoose = require('mongoose');
const ActivityLog = require('../../models/activityLog');
const usersProfiles = require('../../models/userProfile');
const activityLogControllerFactory = require('../activityLogController');

const resolvePromises = () => new Promise(setImmediate);

const buildMockLog = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  action_type: 'comment',
  metadata: { text: 'hello' },
  created_at: new Date('2025-01-01'),
  actor_id: '65cf6c3706d8ac105827bb2e',
  is_assisted: false,
  assisted_users: null,
  ...overrides,
});

const buildAssistedLog = (overrides = {}) =>
  buildMockLog({
    is_assisted: true,
    assisted_users: [
      {
        user_id: '65cf6c3706d8ac105827bb30',
        name: 'Jane Doe',
        assisted_at: new Date('2025-01-01'),
        assistance_type: 'edited',
      },
    ],
    ...overrides,
  });

describe('activityLogController', () => {
  let controller;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    controller = activityLogControllerFactory();
  });

  // ─── fetchStudentDailyLog ───────────────────────────────────────────
  describe('fetchStudentDailyLog', () => {
    it('returns logs for the requesting student', async () => {
      const logs = [buildMockLog()];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        body: { requestor: { requestorId: '65cf6c3706d8ac105827bb2e' } },
        query: {},
      };

      await controller.fetchStudentDailyLog(req, mockRes);

      expect(ActivityLog.find).toHaveBeenCalledWith({
        actor_id: expect.any(mongoose.Types.ObjectId),
      });
      expect(chain.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            log_id: '507f1f77bcf86cd799439011',
            action_type: 'comment',
          }),
        ]),
      );
    });

    it('returns 403 when requesting another student log', async () => {
      const req = {
        body: { requestor: { requestorId: '65cf6c3706d8ac105827bb2e' } },
        query: { studentId: '65cf6c3706d8ac105827bb99' },
      };

      await controller.fetchStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden: Cannot access another student's log",
      });
    });

    it('allows access when requested studentId matches own id', async () => {
      const logs = [buildMockLog()];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        body: { requestor: { requestorId: '65cf6c3706d8ac105827bb2e' } },
        query: { studentId: '65cf6c3706d8ac105827bb2e' },
      };

      await controller.fetchStudentDailyLog(req, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockRejectedValue(new Error('DB fail')),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        body: { requestor: { requestorId: '65cf6c3706d8ac105827bb2e' } },
        query: {},
      };

      await controller.fetchStudentDailyLog(req, mockRes);
      await resolvePromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred' });
    });
  });

  // ─── createStudentDailyLog ──────────────────────────────────────────
  describe('createStudentDailyLog', () => {
    const validRequestor = { requestorId: '65cf6c3706d8ac105827bb2e', role: 'Volunteer' };

    it('creates a log with valid data', async () => {
      const savedLog = buildMockLog();
      ActivityLog.create.mockResolvedValue(savedLog);

      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'comment',
          entityId: 'some-entity-id',
          metadata: { text: 'hi' },
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: '65cf6c3706d8ac105827bb2e',
          action_type: 'comment',
          entity_id: 'some-entity-id',
          metadata: { text: 'hi' },
          is_assisted: false,
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Activity log created successfully' }),
      );
    });

    it('returns 400 when actionType is missing', async () => {
      const req = {
        body: {
          requestor: validRequestor,
          entityId: 'some-entity-id',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'actionType and entityId are required' });
    });

    it('returns 400 when entityId is missing', async () => {
      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'comment',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'actionType and entityId are required' });
    });

    it('returns 400 for invalid actionType', async () => {
      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'invalid_type',
          entityId: 'some-entity-id',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid actionType') }),
      );
    });

    it('returns 403 when non-educator tries to set isAssisted', async () => {
      const req = {
        body: {
          requestor: { ...validRequestor, role: 'Volunteer' },
          actionType: 'comment',
          entityId: 'some-entity-id',
          isAssisted: true,
          assistedUsers: [{ userId: 'user1', assistanceType: 'edited' }],
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Only educators or administrators can set the assisted flag',
      });
    });

    it('returns 400 when isAssisted is true but no assisted users provided', async () => {
      const req = {
        body: {
          requestor: { ...validRequestor, role: 'Educator' },
          actionType: 'comment',
          entityId: 'some-entity-id',
          isAssisted: true,
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('returns 400 when isAssisted is true but assistedUsers is empty array', async () => {
      const req = {
        body: {
          requestor: { ...validRequestor, role: 'Educator' },
          actionType: 'comment',
          entityId: 'some-entity-id',
          isAssisted: true,
          assistedUsers: [],
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('creates a log with assisted users when educator sets isAssisted', async () => {
      const profileUser = {
        _id: '65cf6c3706d8ac105827bb30',
        firstName: 'Jane',
        lastName: 'Doe',
      };
      usersProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([profileUser]),
      });

      const savedLog = buildAssistedLog();
      ActivityLog.create.mockResolvedValue(savedLog);

      const req = {
        body: {
          requestor: { ...validRequestor, role: 'Educator' },
          actionType: 'comment',
          entityId: 'some-entity-id',
          isAssisted: true,
          assistedUsers: [{ userId: '65cf6c3706d8ac105827bb30', assistanceType: 'edited' }],
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(usersProfiles.find).toHaveBeenCalledWith({
        _id: { $in: [expect.any(mongoose.Types.ObjectId)] },
      });
      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_assisted: true,
          assisted_users: expect.arrayContaining([
            expect.objectContaining({
              user_id: '65cf6c3706d8ac105827bb30',
              name: 'Jane Doe',
              assistance_type: 'edited',
            }),
          ]),
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('creates a log with assisted users when administrator sets isAssisted', async () => {
      const profileUser = {
        _id: '65cf6c3706d8ac105827bb30',
        firstName: 'John',
        lastName: 'Smith',
      };
      usersProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([profileUser]),
      });

      ActivityLog.create.mockResolvedValue(buildAssistedLog());

      const req = {
        body: {
          requestor: { ...validRequestor, role: 'Administrator' },
          actionType: 'note',
          entityId: 'entity-2',
          isAssisted: true,
          assistedUsers: [{ userId: '65cf6c3706d8ac105827bb30', assistanceType: 'created' }],
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('defaults metadata to empty object when not provided', async () => {
      ActivityLog.create.mockResolvedValue(buildMockLog());

      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'comment',
          entityId: 'some-entity-id',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      expect(ActivityLog.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });

    it('returns 500 on database error', async () => {
      ActivityLog.create.mockRejectedValue(new Error('DB error'));

      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'comment',
          entityId: 'some-entity-id',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);
      await resolvePromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred' });
    });

    it('returns formatted log in response', async () => {
      const savedLog = buildMockLog({ is_assisted: false });
      ActivityLog.create.mockResolvedValue(savedLog);

      const req = {
        body: {
          requestor: validRequestor,
          actionType: 'comment',
          entityId: 'some-entity-id',
        },
      };

      await controller.createStudentDailyLog(req, mockRes);

      const responseBody = mockRes.json.mock.calls[0][0];
      expect(responseBody.log).toEqual(
        expect.objectContaining({
          log_id: '507f1f77bcf86cd799439011',
          action_type: 'comment',
          is_assisted: false,
        }),
      );
      expect(responseBody.log.assisted_users).toBeUndefined();
    });
  });

  // ─── updateStudentDailyLog ──────────────────────────────────────────
  describe('updateStudentDailyLog', () => {
    it('returns 400 when logId is missing', async () => {
      const req = {
        params: {},
        body: { requestor: { role: 'Educator' } },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or missing logId' });
    });

    it('returns 403 when non-educator tries to update', async () => {
      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: { requestor: { role: 'Volunteer' } },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Only educators or administrators can update the assisted flag',
      });
    });

    it('returns 404 when log is not found', async () => {
      ActivityLog.findById.mockResolvedValue(null);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Activity log not found' });
    });

    it('updates is_assisted to false when isAssisted is not set', async () => {
      const mockLog = {
        _id: '507f1f77bcf86cd799439011',
        is_assisted: true,
        assisted_users: [],
        save: jest.fn().mockResolvedValue(true),
      };
      ActivityLog.findById.mockResolvedValue(mockLog);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockLog.is_assisted).toBe(false);
      expect(mockLog.assisted_users).toEqual([]);
      expect(mockLog.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 when isAssisted is true but assistedUsers is missing', async () => {
      const mockLog = {
        _id: '507f1f77bcf86cd799439011',
        is_assisted: false,
        assisted_users: null,
        save: jest.fn(),
      };
      ActivityLog.findById.mockResolvedValue(mockLog);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: {
          requestor: { role: 'Educator' },
          isAssisted: true,
        },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('returns 400 when isAssisted is true but assistedUsers is empty', async () => {
      const mockLog = {
        _id: '507f1f77bcf86cd799439011',
        is_assisted: false,
        assisted_users: null,
        save: jest.fn(),
      };
      ActivityLog.findById.mockResolvedValue(mockLog);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: {
          requestor: { role: 'Educator' },
          isAssisted: true,
          assistedUsers: [],
        },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'You must provide at least one assisted user if isAssisted is true',
      });
    });

    it('updates log with assisted users', async () => {
      const profileUser = {
        _id: '65cf6c3706d8ac105827bb30',
        firstName: 'Jane',
        lastName: 'Doe',
      };
      usersProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([profileUser]),
      });

      const mockLog = {
        _id: '507f1f77bcf86cd799439011',
        is_assisted: false,
        assisted_users: null,
        save: jest.fn().mockResolvedValue(true),
      };
      ActivityLog.findById.mockResolvedValue(mockLog);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: {
          requestor: { role: 'Educator' },
          isAssisted: true,
          assistedUsers: [{ userId: '65cf6c3706d8ac105827bb30', assistanceType: 'edited' }],
        },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockLog.is_assisted).toBe(true);
      expect(mockLog.assisted_users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: '65cf6c3706d8ac105827bb30',
            name: 'Jane Doe',
            assistance_type: 'edited',
          }),
        ]),
      );
      expect(mockLog.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Activity log updated successfully' }),
      );
    });

    it('allows administrator to update assisted flag', async () => {
      const mockLog = {
        _id: '507f1f77bcf86cd799439011',
        is_assisted: false,
        assisted_users: null,
        save: jest.fn().mockResolvedValue(true),
      };
      ActivityLog.findById.mockResolvedValue(mockLog);

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: {
          requestor: { role: 'Administrator' },
          isAssisted: false,
        },
      };

      await controller.updateStudentDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 on database error', async () => {
      ActivityLog.findById.mockRejectedValue(new Error('DB fail'));

      const req = {
        params: { logId: '507f1f77bcf86cd799439011' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.updateStudentDailyLog(req, mockRes);
      await resolvePromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred' });
    });
  });

  // ─── fetchEducatorDailyLog ──────────────────────────────────────────
  describe('fetchEducatorDailyLog', () => {
    it('returns logs for a student when educator is authorized', async () => {
      const logs = [buildMockLog()];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      expect(ActivityLog.find).toHaveBeenCalledWith({
        actor_id: expect.any(mongoose.Types.ObjectId),
      });
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('returns logs for a student when administrator is authorized', async () => {
      const logs = [buildMockLog()];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Administrator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    it('returns 400 when studentId is missing', async () => {
      const req = {
        params: {},
        body: { requestor: { role: 'Educator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing studentId' });
    });

    it('returns 403 when user is not an educator or administrator', async () => {
      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Volunteer' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Only Educators can view students logs',
      });
    });

    it('returns 500 on database error', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockRejectedValue(new Error('DB fail')),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);
      await resolvePromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred' });
    });

    it('returns formatted logs with correct fields', async () => {
      const logs = [
        buildMockLog({
          action_type: 'note',
          metadata: { key: 'value' },
          is_assisted: false,
        }),
      ];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response[0]).toEqual(
        expect.objectContaining({
          log_id: '507f1f77bcf86cd799439011',
          action_type: 'note',
          metadata: { key: 'value' },
          is_assisted: false,
        }),
      );
      expect(response[0].assisted_users).toBeUndefined();
    });

    it('includes assisted_users in formatted logs when is_assisted is true', async () => {
      const logs = [buildAssistedLog()];
      const chain = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(logs),
      };
      ActivityLog.find.mockReturnValue(chain);

      const req = {
        params: { studentId: '65cf6c3706d8ac105827bb2e' },
        body: { requestor: { role: 'Educator' } },
      };

      await controller.fetchEducatorDailyLog(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response[0].is_assisted).toBe(true);
      expect(response[0].assisted_users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: '65cf6c3706d8ac105827bb30',
            name: 'Jane Doe',
            assistance_type: 'edited',
          }),
        ]),
      );
    });
  });
});
