const mongoose = require('mongoose');

jest.mock('../../models/attendanceLog', () => ({
  AttendanceStatuses: ['pending', 'checked_in', 'no_show', 'cancelled'],
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  deleteOne: jest.fn(),
  insertMany: jest.fn(),
}));

jest.mock('../../models/event', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/userProfile', () => ({
  findById: jest.fn(),
}));

const AttendanceLog = require('../../models/attendanceLog');
const Event = require('../../models/event');
const UserProfile = require('../../models/userProfile');
const attendanceController = require('../attendanceController');

describe('attendanceController', () => {
  const validEventId = '507f1f77bcf86cd799439011';
  const validParticipantId = '507f1f77bcf86cd799439012';
  const validAttendanceId = '507f1f77bcf86cd799439013';

  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = attendanceController();

    req = {
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('createAttendanceLog', () => {
    it('returns 400 when eventId is missing', async () => {
      req.body = {
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'eventId is required',
      });
    });

    it('returns 400 when participantName is missing', async () => {
      req.body = {
        eventId: validEventId,
        participantExternalId: 'EXT-1',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'participantName is required',
      });
    });

    it('returns 400 when no participant identifier is provided', async () => {
      req.body = {
        eventId: validEventId,
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'participantId or participantExternalId must be provided',
      });
    });

    it('returns 400 for invalid status', async () => {
      req.body = {
        eventId: validEventId,
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
        status: 'invalid_status',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('status must be one of'),
        }),
      );
    });

    it('returns 404 for invalid event id', async () => {
      req.body = {
        eventId: 'invalid-id',
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Event not found',
      });
    });

    it('returns 404 when event does not exist', async () => {
      Event.findById.mockResolvedValue(null);

      req.body = {
        eventId: validEventId,
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(Event.findById).toHaveBeenCalledWith(expect.any(mongoose.Types.ObjectId));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Event not found',
      });
    });

    it('returns 404 when participant profile does not exist', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });
      UserProfile.findById.mockResolvedValue(null);

      req.body = {
        eventId: validEventId,
        participantId: validParticipantId,
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(UserProfile.findById).toHaveBeenCalledWith(expect.any(mongoose.Types.ObjectId));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Participant profile not found',
      });
    });

    it('returns 409 when duplicate attendance exists', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });
      UserProfile.findById.mockResolvedValue({ _id: validParticipantId });
      AttendanceLog.findOne.mockResolvedValue({ _id: validAttendanceId });

      req.body = {
        eventId: validEventId,
        participantId: validParticipantId,
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(AttendanceLog.findOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Attendance record already exists for this participant and event',
      });
    });

    it('creates checked-in attendance with check-in time', async () => {
      const createdRecord = {
        _id: validAttendanceId,
        status: 'checked_in',
      };

      Event.findById.mockResolvedValue({ _id: validEventId });
      UserProfile.findById.mockResolvedValue({ _id: validParticipantId });
      AttendanceLog.findOne.mockResolvedValue(null);
      AttendanceLog.create.mockResolvedValue(createdRecord);

      req.body = {
        eventId: validEventId,
        participantId: validParticipantId,
        participantName: ' Test User ',
        participantEmail: ' test@example.com ',
        status: 'checked_in',
      };

      await controller.createAttendanceLog(req, res);

      expect(AttendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participantName: 'Test User',
          participantEmail: 'test@example.com',
          status: 'checked_in',
          checkInTime: expect.any(Date),
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdRecord);
    });

    it('creates attendance with an external participant id', async () => {
      const createdRecord = {
        _id: validAttendanceId,
        status: 'pending',
      };

      Event.findById.mockResolvedValue({ _id: validEventId });
      AttendanceLog.findOne.mockResolvedValue(null);
      AttendanceLog.create.mockResolvedValue(createdRecord);

      req.body = {
        eventId: validEventId,
        participantExternalId: ' EXT-123 ',
        participantName: 'External User',
        status: 'pending',
      };

      await controller.createAttendanceLog(req, res);

      expect(UserProfile.findById).not.toHaveBeenCalled();

      expect(AttendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participantExternalId: 'EXT-123',
          participantName: 'External User',
          status: 'pending',
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 409 for database duplicate-key error', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });
      AttendanceLog.findOne.mockResolvedValue(null);
      AttendanceLog.create.mockRejectedValue({ code: 11000 });

      req.body = {
        eventId: validEventId,
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Duplicate attendance record detected',
      });
    });

    it('returns 500 when creation fails', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });
      AttendanceLog.findOne.mockRejectedValue(new Error('Database error'));

      req.body = {
        eventId: validEventId,
        participantExternalId: 'EXT-1',
        participantName: 'Test User',
      };

      await controller.createAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error',
      });
    });
  });

  describe('getAttendanceByEvent', () => {
    it('returns 400 for invalid event id', async () => {
      req.params.eventId = 'invalid-id';

      await controller.getAttendanceByEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid eventId',
      });
    });

    it('returns 400 for invalid status filter', async () => {
      req.params.eventId = validEventId;
      req.query.status = 'invalid';

      await controller.getAttendanceByEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns attendance records for an event', async () => {
      const records = [{ status: 'pending' }, { status: 'checked_in' }];

      const sort = jest.fn().mockResolvedValue(records);
      const populate = jest.fn().mockReturnValue({ sort });

      AttendanceLog.find.mockReturnValue({ populate });

      req.params.eventId = validEventId;

      await controller.getAttendanceByEvent(req, res);

      expect(AttendanceLog.find).toHaveBeenCalledWith({
        eventId: expect.any(mongoose.Types.ObjectId),
      });
      expect(populate).toHaveBeenCalled();
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(records);
    });

    it('filters attendance records by valid status', async () => {
      const records = [{ status: 'cancelled' }];

      const sort = jest.fn().mockResolvedValue(records);
      const populate = jest.fn().mockReturnValue({ sort });

      AttendanceLog.find.mockReturnValue({ populate });

      req.params.eventId = validEventId;
      req.query.status = 'cancelled';

      await controller.getAttendanceByEvent(req, res);

      expect(AttendanceLog.find).toHaveBeenCalledWith({
        eventId: expect.any(mongoose.Types.ObjectId),
        status: 'cancelled',
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 when lookup fails', async () => {
      AttendanceLog.find.mockImplementation(() => {
        throw new Error('Lookup failed');
      });

      req.params.eventId = validEventId;

      await controller.getAttendanceByEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Lookup failed',
      });
    });
  });

  describe('updateAttendanceLog', () => {
    it('returns 404 when attendance record does not exist', async () => {
      AttendanceLog.findById.mockResolvedValue(null);

      req.params.attendanceId = validAttendanceId;
      req.body = { status: 'no_show' };

      await controller.updateAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 for invalid status', async () => {
      AttendanceLog.findById.mockResolvedValue({
        save: jest.fn(),
      });

      req.params.attendanceId = validAttendanceId;
      req.body = { status: 'invalid_status' };

      await controller.updateAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sets check-in time when status changes to checked_in', async () => {
      const record = {
        status: 'pending',
        checkInTime: null,
        save: jest.fn().mockResolvedValue(),
      };

      AttendanceLog.findById.mockResolvedValue(record);

      req.params.attendanceId = validAttendanceId;
      req.body = { status: 'checked_in' };

      await controller.updateAttendanceLog(req, res);

      expect(record.status).toBe('checked_in');
      expect(record.checkInTime).toBeInstanceOf(Date);
      expect(record.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it.each(['pending', 'no_show', 'cancelled'])(
      'clears check-in time when status changes to %s',
      async (status) => {
        const record = {
          status: 'checked_in',
          checkInTime: new Date(),
          save: jest.fn().mockResolvedValue(),
        };

        AttendanceLog.findById.mockResolvedValue(record);

        req.params.attendanceId = validAttendanceId;
        req.body = { status };

        await controller.updateAttendanceLog(req, res);

        expect(record.status).toBe(status);
        expect(record.checkInTime).toBeNull();
        expect(record.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      },
    );

    it('updates only the check-in time when status is not provided', async () => {
      const record = {
        checkInTime: null,
        save: jest.fn().mockResolvedValue(),
      };

      AttendanceLog.findById.mockResolvedValue(record);

      req.params.attendanceId = validAttendanceId;
      req.body = {
        checkInTime: '2026-10-27T12:00:00.000Z',
      };

      await controller.updateAttendanceLog(req, res);

      expect(record.checkInTime).toBeInstanceOf(Date);
      expect(record.save).toHaveBeenCalled();
    });

    it('updates notes when provided', async () => {
      const record = {
        notes: '',
        save: jest.fn().mockResolvedValue(),
      };

      AttendanceLog.findById.mockResolvedValue(record);

      req.params.attendanceId = validAttendanceId;
      req.body = {
        notes: 'Updated note',
      };

      await controller.updateAttendanceLog(req, res);

      expect(record.notes).toBe('Updated note');
      expect(record.save).toHaveBeenCalled();
    });

    it('returns 500 when update fails', async () => {
      AttendanceLog.findById.mockRejectedValue(new Error('Update failed'));

      req.params.attendanceId = validAttendanceId;

      await controller.updateAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Update failed',
      });
    });
  });

  describe('deleteAttendanceLog', () => {
    it('returns 404 when record does not exist', async () => {
      AttendanceLog.findById.mockResolvedValue(null);

      req.params.attendanceId = validAttendanceId;

      await controller.deleteAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('deletes an attendance record successfully', async () => {
      AttendanceLog.findById.mockResolvedValue({
        _id: validAttendanceId,
      });

      AttendanceLog.deleteOne.mockResolvedValue({ deletedCount: 1 });

      req.params.attendanceId = validAttendanceId;

      await controller.deleteAttendanceLog(req, res);

      expect(AttendanceLog.deleteOne).toHaveBeenCalledWith({
        _id: validAttendanceId,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Attendance record deleted',
      });
    });

    it('returns 500 when deletion fails', async () => {
      AttendanceLog.findById.mockRejectedValue(new Error('Delete failed'));

      req.params.attendanceId = validAttendanceId;

      await controller.deleteAttendanceLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAttendanceSummary', () => {
    it('returns 400 for invalid event id', async () => {
      req.params.eventId = 'invalid';

      await controller.getAttendanceSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('calculates attendance summary', async () => {
      AttendanceLog.find.mockResolvedValue([
        { status: 'checked_in' },
        { status: 'checked_in' },
        { status: 'pending' },
        { status: 'no_show' },
        { status: 'cancelled' },
      ]);

      req.params.eventId = validEventId;
      req.query.registrations = '10';

      await controller.getAttendanceSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        totals: {
          checkedIn: 2,
          pending: 1,
          noShow: 1,
          cancelled: 1,
          logged: 5,
        },
        attendanceRate: 20,
        noShowRate: 10,
        pendingRate: 10,
        denominator: 10,
      });
    });

    it('uses log count as denominator when registrations are missing', async () => {
      AttendanceLog.find.mockResolvedValue([{ status: 'checked_in' }, { status: 'no_show' }]);

      req.params.eventId = validEventId;

      await controller.getAttendanceSummary(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          denominator: 2,
          attendanceRate: 50,
          noShowRate: 50,
        }),
      );
    });

    it('returns 500 when summary lookup fails', async () => {
      AttendanceLog.find.mockRejectedValue(new Error('Summary failed'));

      req.params.eventId = validEventId;

      await controller.getAttendanceSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('seedAttendanceForEvent', () => {
    it('returns 404 when event does not exist', async () => {
      Event.findById.mockResolvedValue(null);

      req.params.eventId = validEventId;

      await controller.seedAttendanceForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('creates default attendance records', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });

      AttendanceLog.insertMany.mockResolvedValue([
        { status: 'checked_in' },
        { status: 'no_show' },
        { status: 'pending' },
      ]);

      req.params.eventId = validEventId;
      req.body = {};

      await controller.seedAttendanceForEvent(req, res);

      expect(AttendanceLog.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'checked_in',
          }),
          expect.objectContaining({
            status: 'no_show',
          }),
          expect.objectContaining({
            status: 'pending',
          }),
        ]),
        { ordered: false },
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('uses pending when seeded status is invalid', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });

      AttendanceLog.insertMany.mockResolvedValue([]);

      req.params.eventId = validEventId;
      req.body = {
        attendees: [
          {
            participantExternalId: 'EXT-1',
            participantName: 'Test User',
            status: 'invalid',
          },
        ],
      };

      await controller.seedAttendanceForEvent(req, res);

      expect(AttendanceLog.insertMany).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            status: 'pending',
          }),
        ],
        { ordered: false },
      );
    });

    it('returns 409 for duplicate seed records', async () => {
      Event.findById.mockResolvedValue({ _id: validEventId });

      AttendanceLog.insertMany.mockRejectedValue({
        code: 11000,
      });

      req.params.eventId = validEventId;
      req.body = {};

      await controller.seedAttendanceForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('returns 500 when seeding fails', async () => {
      Event.findById.mockRejectedValue(new Error('Seed failed'));

      req.params.eventId = validEventId;

      await controller.seedAttendanceForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMockAttendanceForEvent', () => {
    it('returns mock attendance records', () => {
      req.params.eventId = validEventId;

      controller.getMockAttendanceForEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const records = res.json.mock.calls[0][0];

      expect(records).toHaveLength(10);
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'checked_in',
          }),
          expect.objectContaining({
            status: 'no_show',
          }),
          expect.objectContaining({
            status: 'pending',
          }),
        ]),
      );
    });
  });
});
