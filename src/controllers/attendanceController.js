const mongoose = require('mongoose');
const AttendanceLog = require('../models/attendanceLog');
const Event = require('../models/event');
const UserProfile = require('../models/userProfile');

const { AttendanceStatuses } = AttendanceLog;

const attendanceController = () => {
  const sanitizeObjectId = (value) => {
    if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
      return null;
    }

    return new mongoose.Types.ObjectId(value);
  };

  const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

  const sanitizeStatus = (value) => {
    if (typeof value !== 'string') return null;
    return AttendanceStatuses.find((status) => status === value) || null;
  };
  const validateStatus = (status) => sanitizeStatus(status) !== null;
  const buildParticipantQuery = ({ participantId, participantExternalId }) => {
    const clauses = [];

    const safeParticipantId = sanitizeObjectId(participantId);
    const safeExternalId = sanitizeString(participantExternalId);

    if (safeParticipantId) {
      clauses.push({ participantId: safeParticipantId });
    }

    if (safeExternalId) {
      clauses.push({ participantExternalId: safeExternalId });
    }

    return clauses.length ? { $or: clauses } : {};
  };

  const ensureEventExists = async (eventId) => {
    const safeEventId = sanitizeObjectId(eventId);
    if (!safeEventId) return null;

    return Event.findById(safeEventId);
  };
  const findDuplicateAttendance = async ({ eventId, participantId, participantExternalId }) => {
    const participantQuery = buildParticipantQuery({
      participantId,
      participantExternalId,
    });

    return AttendanceLog.findOne({
      eventId,
      ...participantQuery,
    });
  };
  const participantExists = async (participantId) => {
    if (!participantId) return true;

    const profile = await UserProfile.findById(participantId);
    return Boolean(profile);
  };
  const validateAttendancePayload = ({
    eventId,
    participantId,
    participantExternalId,
    participantName,
    status,
  }) => {
    if (!eventId) {
      return { status: 400, error: 'eventId is required' };
    }

    if (!sanitizeString(participantName)) {
      return { status: 400, error: 'participantName is required' };
    }

    if (!sanitizeObjectId(participantId) && !sanitizeString(participantExternalId)) {
      return {
        status: 400,
        error: 'participantId or participantExternalId must be provided',
      };
    }

    if (!sanitizeStatus(status)) {
      return {
        status: 400,
        error: `status must be one of: ${AttendanceStatuses.join(', ')}`,
      };
    }

    return null;
  };
  const createAttendanceLog = async (req, res) => {
    try {
      const {
        eventId,
        participantId,
        participantExternalId,
        participantName,
        participantEmail,
        status = 'pending',
        checkInTime,
        notes,
      } = req.body;

      const safeEventId = sanitizeObjectId(eventId);
      const safeParticipantId = participantId ? sanitizeObjectId(participantId) : null;
      const safeExternalId = sanitizeString(participantExternalId);
      const safeParticipantName = sanitizeString(participantName);
      const safeParticipantEmail = sanitizeString(participantEmail);
      const safeStatus = sanitizeStatus(status);

      const validationError = validateAttendancePayload({
        eventId,
        participantId,
        participantExternalId,
        participantName,
        status,
      });

      if (validationError) {
        return res.status(validationError.status).json({
          error: validationError.error,
        });
      }

      if (!safeEventId) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const event = await Event.findById(safeEventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const hasParticipant = await participantExists(safeParticipantId);

      if (!hasParticipant) {
        return res.status(404).json({ error: 'Participant profile not found' });
      }

      const duplicate = await findDuplicateAttendance({
        eventId: safeEventId,
        participantId,
        participantExternalId,
      });

      if (duplicate) {
        return res.status(409).json({
          error: 'Attendance record already exists for this participant and event',
        });
      }

      const payload = {
        eventId: safeEventId,
        participantId: safeParticipantId || undefined,
        participantExternalId: safeExternalId || undefined,
        participantName: safeParticipantName,
        participantEmail: safeParticipantEmail || undefined,
        status: safeStatus,
        notes,
      };

      if (safeStatus === 'checked_in') {
        payload.checkInTime = checkInTime ? new Date(checkInTime) : new Date();
      } else if (checkInTime) {
        payload.checkInTime = new Date(checkInTime);
      }

      const record = await AttendanceLog.create(payload);

      return res.status(201).json(record);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Duplicate attendance record detected' });
      }

      return res.status(500).json({ error: error.message });
    }
  };

  const getAttendanceByEvent = async (req, res) => {
    try {
      const safeEventId = sanitizeObjectId(req.params.eventId);
      const requestedStatus = req.query.status;

      if (!safeEventId) {
        return res.status(400).json({ error: 'Invalid eventId' });
      }

      const query = {
        eventId: safeEventId,
      };

      if (requestedStatus) {
        const safeStatus = sanitizeStatus(requestedStatus);

        if (!safeStatus) {
          return res
            .status(400)
            .json({ error: `status must be one of: ${AttendanceStatuses.join(', ')}` });
        }

        query.status = safeStatus;
      }

      const records = await AttendanceLog.find(query)
        .populate('participantId', 'firstName lastName email profilePic')
        .sort({ createdAt: -1 });

      return res.status(200).json(records);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const updateAttendanceLog = async (req, res) => {
    try {
      const { attendanceId } = req.params;
      const { status, checkInTime, notes } = req.body;

      const record = await AttendanceLog.findById(attendanceId);
      if (!record) {
        return res.status(404).json({ error: 'Attendance record not found' });
      }

      if (status) {
        if (!validateStatus(status)) {
          return res
            .status(400)
            .json({ error: `status must be one of: ${AttendanceStatuses.join(', ')}` });
        }
        record.status = status;
        if (status === 'checked_in') {
          record.checkInTime = checkInTime ? new Date(checkInTime) : new Date();
        } else {
          record.checkInTime = null;
        }
      } else if (checkInTime) {
        record.checkInTime = new Date(checkInTime);
      }

      if (typeof notes === 'string') {
        record.notes = notes;
      }

      await record.save();
      return res.status(200).json(record);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const deleteAttendanceLog = async (req, res) => {
    try {
      const { attendanceId } = req.params;
      const record = await AttendanceLog.findById(attendanceId);
      if (!record) {
        return res.status(404).json({ error: 'Attendance record not found' });
      }
      await AttendanceLog.deleteOne({ _id: attendanceId });
      return res.status(200).json({ message: 'Attendance record deleted' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getAttendanceSummary = async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ error: 'Invalid eventId' });
      }

      const totalRegistrations = Number(req.query.registrations) || null;
      const logs = await AttendanceLog.find({ eventId });
      const totals = {
        checkedIn: logs.filter((log) => log.status === 'checked_in').length,
        pending: logs.filter((log) => log.status === 'pending').length,
        noShow: logs.filter((log) => log.status === 'no_show').length,
        cancelled: logs.filter((log) => log.status === 'cancelled').length,
        logged: logs.length,
      };
      const denominator = totalRegistrations || logs.length || 1;
      const summary = {
        totals,
        attendanceRate: Math.round((totals.checkedIn / denominator) * 100),
        noShowRate: Math.round((totals.noShow / denominator) * 100),
        pendingRate: Math.round((totals.pending / denominator) * 100),
        denominator,
      };
      return res.status(200).json(summary);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const seedAttendanceForEvent = async (req, res) => {
    try {
      const { eventId } = req.params;
      const { attendees = [] } = req.body;

      const event = await ensureEventExists(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const defaults = [
        {
          participantExternalId: 'SAMP-001',
          participantName: 'Sample Attendee 1',
          participantEmail: 'sample1@example.com',
          status: 'checked_in',
        },
        {
          participantExternalId: 'SAMP-002',
          participantName: 'Sample Attendee 2',
          participantEmail: 'sample2@example.com',
          status: 'no_show',
        },
        {
          participantExternalId: 'SAMP-003',
          participantName: 'Sample Attendee 3',
          participantEmail: 'sample3@example.com',
          status: 'pending',
        },
      ];

      const seedSource = attendees.length ? attendees : defaults;

      const payloads = seedSource.map((attendee, index) => {
        const entryStatus =
          attendee.status && validateStatus(attendee.status) ? attendee.status : 'pending';
        let checkInTimeValue;
        if (entryStatus === 'checked_in') {
          checkInTimeValue = attendee.checkInTime ? new Date(attendee.checkInTime) : new Date();
        } else {
          checkInTimeValue = undefined;
        }

        return {
          eventId,
          participantExternalId:
            attendee.participantExternalId || `SEED-${index + 1}-${Date.now().toString(16)}`,
          participantName: attendee.participantName || `Seeded Participant ${index + 1}`,
          participantEmail: attendee.participantEmail,
          status: entryStatus,
          checkInTime: checkInTimeValue,
        };
      });

      const created = await AttendanceLog.insertMany(payloads, { ordered: false });
      return res.status(201).json(created);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Seed would create duplicate attendance records' });
      }
      return res.status(500).json({ error: error.message });
    }
  };

  const getMockAttendanceForEvent = (req, res) => {
    const sampleEventId = req.params.eventId;
    const now = new Date();
    const eventStartTime = new Date(now);
    eventStartTime.setHours(9, 0, 0, 0); // 9:00 AM

    return res.status(200).json([
      {
        attendanceCode: 'MOCK-001',
        eventId: sampleEventId,
        participantName: 'Jiaqi Li',
        participantExternalId: 'MOCK-ATT-1',
        participantEmail: 'jiaqi@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() - 4 * 60000).toISOString(), // 4 min before
      },
      {
        attendanceCode: 'MOCK-002',
        eventId: sampleEventId,
        participantName: 'Alex Rivera',
        participantExternalId: 'MOCK-ATT-2',
        participantEmail: 'alex.r@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() + 2 * 60000).toISOString(), // 2 min after
      },
      {
        attendanceCode: 'MOCK-003',
        eventId: sampleEventId,
        participantName: 'Taylor Brooks',
        participantExternalId: 'MOCK-ATT-3',
        participantEmail: 'taylorb@example.com',
        status: 'no_show',
        checkInTime: null,
      },
      {
        attendanceCode: 'MOCK-004',
        eventId: sampleEventId,
        participantName: 'Jordan Kim',
        participantExternalId: 'MOCK-ATT-4',
        participantEmail: 'kim.j@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() + 10 * 60000).toISOString(), // 10 min after
      },
      {
        attendanceCode: 'MOCK-005',
        eventId: sampleEventId,
        participantName: 'Sam Patel',
        participantExternalId: 'MOCK-ATT-5',
        participantEmail: 'sam.p@example.com',
        status: 'pending',
        checkInTime: null,
      },
      {
        attendanceCode: 'MOCK-006',
        eventId: sampleEventId,
        participantName: 'Reyna Mehta',
        participantExternalId: 'MOCK-ATT-6',
        participantEmail: 'reyna@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() + 14 * 60000).toISOString(), // 14 min after
      },
      {
        attendanceCode: 'MOCK-007',
        eventId: sampleEventId,
        participantName: 'Liam Cruz',
        participantExternalId: 'MOCK-ATT-7',
        participantEmail: 'liam@example.com',
        status: 'no_show',
        checkInTime: null,
      },
      {
        attendanceCode: 'MOCK-008',
        eventId: sampleEventId,
        participantName: 'Maya Chen',
        participantExternalId: 'MOCK-ATT-8',
        participantEmail: 'maya@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() + 5 * 60000).toISOString(), // 5 min after
      },
      {
        attendanceCode: 'MOCK-009',
        eventId: sampleEventId,
        participantName: 'David Park',
        participantExternalId: 'MOCK-ATT-9',
        participantEmail: 'david@example.com',
        status: 'pending',
        checkInTime: null,
      },
      {
        attendanceCode: 'MOCK-010',
        eventId: sampleEventId,
        participantName: 'Sarah Johnson',
        participantExternalId: 'MOCK-ATT-10',
        participantEmail: 'sarah@example.com',
        status: 'checked_in',
        checkInTime: new Date(eventStartTime.getTime() - 2 * 60000).toISOString(), // 2 min before
      },
    ]);
  };

  return {
    createAttendanceLog,
    getAttendanceByEvent,
    updateAttendanceLog,
    deleteAttendanceLog,
    getAttendanceSummary,
    seedAttendanceForEvent,
    getMockAttendanceForEvent,
  };
};

module.exports = attendanceController;
