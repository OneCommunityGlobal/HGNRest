const mongoose = require('mongoose');
const AttendanceLog = require('../models/attendanceLog');
const Event = require('../models/event');
const UserProfile = require('../models/userProfile');

const { AttendanceStatuses } = AttendanceLog;

const attendanceController = () => {
  const buildParticipantQuery = ({ participantId, participantExternalId }) => {
    const clauses = [];
    if (participantId && mongoose.Types.ObjectId.isValid(participantId)) {
      clauses.push({ participantId });
    }
    if (participantExternalId) {
      clauses.push({ participantExternalId });
    }
    return clauses.length ? { $or: clauses } : {};
  };

  const validateStatus = (status) => AttendanceStatuses.includes(status);

  const ensureEventExists = async (eventId) => {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return Event.findById(eventId);
  };

  const ensureParticipantExists = async (participantId) => {
    if (!participantId || !mongoose.Types.ObjectId.isValid(participantId)) {
      return null;
    }
    return UserProfile.findById(participantId);
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

      if (!eventId) {
        return res.status(400).json({ error: 'eventId is required' });
      }
      if (!participantName) {
        return res.status(400).json({ error: 'participantName is required' });
      }
      if (!participantId && !participantExternalId) {
        return res
          .status(400)
          .json({ error: 'participantId or participantExternalId must be provided' });
      }
      if (!validateStatus(status)) {
        return res
          .status(400)
          .json({ error: `status must be one of: ${AttendanceStatuses.join(', ')}` });
      }

      const event = await ensureEventExists(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (participantId) {
        const profile = await ensureParticipantExists(participantId);
        if (!profile) {
          return res.status(404).json({ error: 'Participant profile not found' });
        }
      }

      const clashQuery = {
        eventId,
        ...buildParticipantQuery({ participantId, participantExternalId }),
      };

      if (clashQuery.$or) {
        const duplicate = await AttendanceLog.findOne(clashQuery);
        if (duplicate) {
          return res.status(409).json({
            error: 'Attendance record already exists for this participant and event',
          });
        }
      }

      const payload = {
        eventId,
        participantId: participantId || undefined,
        participantExternalId,
        participantName,
        participantEmail,
        status,
        notes,
      };

      if (status === 'checked_in') {
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
      const { eventId } = req.params;
      const { status } = req.query;

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ error: 'Invalid eventId' });
      }

      const query = { eventId };
      if (status) {
        if (!validateStatus(status)) {
          return res
            .status(400)
            .json({ error: `status must be one of: ${AttendanceStatuses.join(', ')}` });
        }
        query.status = status;
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
        } else if (checkInTime) {
          record.checkInTime = new Date(checkInTime);
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
