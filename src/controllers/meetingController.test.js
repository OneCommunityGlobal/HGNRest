jest.mock('../models/userProfile', () => ({
  exists: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
}));

const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const logger = require('../startup/logger');
const meetingControllerFactory = require('./meetingController');

const VALID_ORGANIZER_ID = '507f1f77bcf86cd799439011';
const VALID_PARTICIPANT_ID = '507f1f77bcf86cd799439012';
const VALID_MEETING_ID = '507f1f77bcf86cd799439013';
const INVALID_ID = 'not-a-valid-id';

const buildValidMeetingBody = (overrides = {}) => ({
  dateOfMeeting: '2026-08-01',
  startHour: 10,
  startMinute: 30,
  startTimePeriod: 'AM',
  duration: 60,
  organizer: VALID_ORGANIZER_ID,
  participantList: [VALID_PARTICIPANT_ID],
  location: 'Zoom',
  locationDetails: 'https://zoom.us/j/123',
  notes: 'Weekly sync',
  ...overrides,
});

describe('meetingController', () => {
  let Meeting;
  let controller;
  let mockRes;
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn(),
    };

    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

    Meeting = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
    Meeting.aggregate = jest.fn();
    Meeting.updateOne = jest.fn();
    Meeting.findById = jest.fn();
    Meeting.find = jest.fn();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    controller = meetingControllerFactory(Meeting);
    UserProfile.exists.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('postMeeting', () => {
    it('returns 400 when required fields are missing', async () => {
      await controller.postMeeting({ body: {} }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Invalid form values',
      });
    });

    it('returns 400 when startTimePeriod is invalid', async () => {
      await controller.postMeeting(
        { body: buildValidMeetingBody({ startTimePeriod: 'XX' }) },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Invalid form values',
      });
    });

    it('returns 400 when location is invalid', async () => {
      await controller.postMeeting({ body: buildValidMeetingBody({ location: 'Teams' }) }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Invalid form values',
      });
    });

    it('returns 400 when participant ID is invalid', async () => {
      await controller.postMeeting(
        { body: buildValidMeetingBody({ participantList: [INVALID_ID] }) },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Invalid participant ID',
      });
    });

    it('returns 400 when participant does not exist', async () => {
      UserProfile.exists.mockResolvedValueOnce(false);

      await controller.postMeeting({ body: buildValidMeetingBody() }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Participant ID does not exist',
      });
    });

    it('returns 400 when organizer ID is invalid', async () => {
      await controller.postMeeting(
        { body: buildValidMeetingBody({ organizer: INVALID_ID }) },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Invalid organizer ID',
      });
    });

    it('returns 400 when organizer does not exist', async () => {
      UserProfile.exists
        .mockResolvedValueOnce(true) // participant
        .mockResolvedValueOnce(false); // organizer

      await controller.postMeeting({ body: buildValidMeetingBody() }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Bad request: Organizer ID does not exist',
      });
    });

    it('creates a meeting and returns 201 on success', async () => {
      const meetingInstance = {
        save: jest.fn().mockResolvedValue(undefined),
      };
      Meeting.mockImplementation(() => meetingInstance);

      await controller.postMeeting({ body: buildValidMeetingBody() }, mockRes);

      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(meetingInstance.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Meeting saved successfully' });
    });

    it('aborts transaction and returns 500 when save fails', async () => {
      const saveError = new Error('DB write failed');
      Meeting.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(saveError),
      }));

      await controller.postMeeting({ body: buildValidMeetingBody() }, mockRes);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(logger.logException).toHaveBeenCalledWith(saveError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: saveError.toString() });
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('getMeetings', () => {
    it('returns meetings for a date range', async () => {
      const meetings = [{ _id: VALID_MEETING_ID, isRead: false }];
      Meeting.aggregate.mockResolvedValue(meetings);

      await controller.getMeetings(
        {
          query: {
            startTime: encodeURIComponent('2026-08-01T00:00:00.000Z'),
            endTime: encodeURIComponent('2026-08-31T23:59:59.000Z'),
          },
        },
        mockRes,
      );

      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(meetings);
    });

    it('returns 500 when aggregation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      Meeting.aggregate.mockRejectedValue(new Error('aggregate failed'));

      await controller.getMeetings(
        { query: { startTime: '2026-08-01', endTime: '2026-08-02' } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch meetings' });
      consoleSpy.mockRestore();
    });
  });

  describe('markMeetingAsRead', () => {
    it('returns 400 for invalid IDs', async () => {
      await controller.markMeetingAsRead(
        { params: { meetingId: INVALID_ID, recipient: INVALID_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid meeting or recipient ID',
      });
    });

    it('returns 404 when meeting is not found or already read', async () => {
      Meeting.updateOne.mockResolvedValue({ nModified: 0 });

      await controller.markMeetingAsRead(
        { params: { meetingId: VALID_MEETING_ID, recipient: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Meeting not found or already marked as read',
      });
    });

    it('marks meeting as read successfully', async () => {
      Meeting.updateOne.mockResolvedValue({ nModified: 1 });

      await controller.markMeetingAsRead(
        { params: { meetingId: VALID_MEETING_ID, recipient: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(Meeting.updateOne).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Meeting marked as read successfully',
      });
    });

    it('returns 500 when update fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      Meeting.updateOne.mockRejectedValue(new Error('update failed'));

      await controller.markMeetingAsRead(
        { params: { meetingId: VALID_MEETING_ID, recipient: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to mark meeting as read' });
      consoleSpy.mockRestore();
    });
  });

  describe('getAllMeetingsByOrganizer', () => {
    it('returns 400 for invalid organizer ID', async () => {
      await controller.getAllMeetingsByOrganizer({ params: { organizerId: INVALID_ID } }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid organizer userId' });
    });

    it('returns 500 when organizer does not exist', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      UserProfile.exists.mockResolvedValue(false);

      await controller.getAllMeetingsByOrganizer(
        { params: { organizerId: VALID_ORGANIZER_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch all upcoming meetings',
      });
      consoleSpy.mockRestore();
    });

    it('returns upcoming meetings for organizer', async () => {
      const meetings = [{ _id: VALID_MEETING_ID, duration: 30 }];
      Meeting.aggregate.mockResolvedValue(meetings);

      await controller.getAllMeetingsByOrganizer(
        { params: { organizerId: VALID_ORGANIZER_ID } },
        mockRes,
      );

      expect(Meeting.aggregate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(meetings);
    });

    it('returns 500 when aggregation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      Meeting.aggregate.mockRejectedValue(new Error('aggregate failed'));

      await controller.getAllMeetingsByOrganizer(
        { params: { organizerId: VALID_ORGANIZER_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch all upcoming meetings',
      });
      consoleSpy.mockRestore();
    });
  });

  describe('getCalendarInvite', () => {
    it('returns 400 for invalid meeting ID', async () => {
      await controller.getCalendarInvite({ params: { meetingId: INVALID_ID } }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid meeting ID' });
    });

    it('returns 404 when meeting is not found', async () => {
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await controller.getCalendarInvite({ params: { meetingId: VALID_MEETING_ID } }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Meeting not found' });
    });

    it('returns google calendar link and ics content', async () => {
      const meeting = {
        dateTime: new Date('2026-08-01T17:00:00.000Z'),
        duration: 60,
        notes: 'Planning',
        locationDetails: 'Room 1',
        organizer: { firstName: 'Jane', lastName: 'Doe' },
      };
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(meeting),
      });

      await controller.getCalendarInvite({ params: { meetingId: VALID_MEETING_ID } }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          organizerFullName: 'Jane Doe',
          googleCalendarLink: expect.stringContaining('calendar.google.com'),
          icsContent: expect.stringContaining('BEGIN:VCALENDAR'),
        }),
      );
    });

    it('returns 500 when lookup fails', async () => {
      const error = new Error('find failed');
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      });

      await controller.getCalendarInvite({ params: { meetingId: VALID_MEETING_ID } }, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch calendar invite' });
    });
  });

  describe('getUpcomingMeetingForParticipant', () => {
    it('returns 400 for invalid participant ID', async () => {
      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: INVALID_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid participant ID' });
    });

    it('returns 404 when no unread meetings exist', async () => {
      Meeting.aggregate.mockResolvedValue([]);

      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No upcoming unread meetings found',
      });
    });

    it('returns 404 when unread meetings are outside next 3 days', async () => {
      const farFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      Meeting.aggregate.mockResolvedValue([
        {
          _id: VALID_MEETING_ID,
          dateTime: farFuture,
          isRead: false,
        },
      ]);

      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No upcoming unread meetings within next 3 days',
      });
    });

    it('returns upcoming unread meetings within 3 days', async () => {
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
      Meeting.aggregate.mockResolvedValue([
        {
          _id: VALID_MEETING_ID,
          dateTime: soon,
          isRead: false,
        },
      ]);
      Meeting.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            _id: VALID_MEETING_ID,
            dateTime: soon,
            duration: 45,
            location: 'Zoom',
            locationDetails: 'https://zoom.us/j/1',
            notes: 'Catch up',
            organizer: { firstName: 'Alex', lastName: 'Smith' },
          },
        ]),
      });

      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        upComingMeetings: [
          expect.objectContaining({
            _id: VALID_MEETING_ID,
            organizerName: 'Alex Smith',
            duration: 45,
            location: 'Zoom',
          }),
        ],
      });
    });

    it('uses N/A when organizer is missing', async () => {
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
      Meeting.aggregate.mockResolvedValue([
        {
          _id: VALID_MEETING_ID,
          dateTime: soon,
          isRead: false,
        },
      ]);
      Meeting.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            _id: VALID_MEETING_ID,
            dateTime: soon,
            duration: 30,
            location: 'Phone call',
            locationDetails: '555-0100',
            notes: 'Call',
            organizer: null,
          },
        ]),
      });

      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        upComingMeetings: [expect.objectContaining({ organizerName: 'N/A' })],
      });
    });

    it('returns 500 when query fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      Meeting.aggregate.mockRejectedValue(new Error('query failed'));

      await controller.getUpcomingMeetingForParticipant(
        { params: { participantId: VALID_PARTICIPANT_ID } },
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      consoleSpy.mockRestore();
    });
  });
});
