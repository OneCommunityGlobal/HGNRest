const mongoose = require('mongoose');

jest.mock('../../models/event', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
}));

jest.mock('../../utilities/emailSender', () => jest.fn(() => Promise.resolve('sent')));

jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
}));

const Event = require('../../models/event');
const User = require('../../models/userProfile');
const emailSender = require('../../utilities/emailSender');
const logger = require('../../startup/logger');
const eventController = require('../eventController');

const EVENT_ID = '507f1f77bcf86cd799439011';
const id = () => new mongoose.Types.ObjectId();

const makeUser = (firstName, overrides = {}) => ({
  _id: id(),
  firstName,
  lastName: 'Tester',
  email: `${firstName.toLowerCase()}@example.com`,
  profilePic: `${firstName}.png`,
  ...overrides,
});

const makeEvent = (overrides = {}) => {
  const event = {
    _id: new mongoose.Types.ObjectId(EVENT_ID),
    title: 'Garden <b>Day</b>',
    type: 'Workshop',
    location: 'Virtual',
    date: new Date('2030-01-01T18:00:00Z'),
    startTime: '2030-01-01T10:00:00-08:00',
    endTime: '2030-01-01T11:00:00-08:00',
    maxAttendees: 1,
    currentAttendees: 1,
    attendeesThreshold: 0,
    isActive: true,
    status: 'Full',
    resources: [],
    waitlist: [],
    ...overrides,
  };
  event.set = jest.fn((field, value) => {
    event[field] = field === 'date' ? new Date(value) : value;
  });
  event.save = jest.fn().mockResolvedValue(event);
  event.toObject = jest.fn(() => ({ ...event }));
  return event;
};

const mockUsers = (users) => {
  User.find.mockImplementation(({ _id }) => {
    const wanted = new Set(_id.$in.map((value) => value.toString()));
    return {
      select: jest.fn().mockResolvedValue(users.filter((user) => wanted.has(user._id.toString()))),
    };
  });
};

const emailSubjects = () => emailSender.mock.calls.map((call) => call[1]);
const emailRecipients = () => emailSender.mock.calls.map((call) => call[0]);

describe('eventController waitlist', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('getEvents', () => {
    const mockFind = (events) => {
      Event.countDocuments.mockResolvedValue(events.length);
      Event.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(events),
            }),
          }),
        }),
      });
    };

    it('returns the requestor waitlist position and count without exposing the waitlist', async () => {
      const requestorId = id();
      const event = makeEvent({
        waitlist: [{ userId: id() }, { userId: requestorId }],
      });
      mockFind([event]);
      req.body.requestor = { requestorId: requestorId.toString() };

      await eventController.getEvents(req, res);

      const [formatted] = res.json.mock.calls[0][0].events;
      expect(formatted.waitlistCount).toBe(2);
      expect(formatted.waitlistEnabled).toBe(true);
      expect(formatted.userWaitlistPosition).toBe(2);
      expect(formatted.isUserRegistered).toBe(false);
      expect(formatted.waitlist).toBeUndefined();
    });

    it('marks a requestor with a populated registration as registered', async () => {
      const requestorId = id();
      const event = makeEvent({ resources: [{ name: 'A', userID: { _id: requestorId } }] });
      mockFind([event]);
      req.user = { requestorId };

      await eventController.getEvents(req, res);

      const [formatted] = res.json.mock.calls[0][0].events;
      expect(formatted.isUserRegistered).toBe(true);
      expect(formatted.userWaitlistPosition).toBeNull();
    });

    it('returns default waitlist fields when there is no requestor', async () => {
      mockFind([makeEvent({ currentAttendees: 0, maxAttendees: 5, waitlist: undefined })]);

      await eventController.getEvents(req, res);

      const [formatted] = res.json.mock.calls[0][0].events;
      expect(formatted.waitlistCount).toBe(0);
      expect(formatted.waitlistEnabled).toBe(false);
      expect(formatted.userWaitlistPosition).toBeNull();
      expect(formatted.isUserRegistered).toBe(false);
    });
  });

  describe('joinWaitlist', () => {
    const userId = id().toString();

    beforeEach(() => {
      req.params.eventId = EVENT_ID;
      req.body.userId = userId;
    });

    it('rejects an invalid eventId', async () => {
      req.params.eventId = 'bad';
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid eventId' });
    });

    it('rejects an invalid userId', async () => {
      req.body.userId = 'bad';
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid userId' });
    });

    it('returns 404 when the event does not exist', async () => {
      Event.findById.mockResolvedValue(null);
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects inactive events', async () => {
      Event.findById.mockResolvedValue(makeEvent({ isActive: false }));
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Event is no longer active' });
    });

    it('rejects events that still have open spots', async () => {
      Event.findById.mockResolvedValue(makeEvent({ maxAttendees: 5 }));
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Event still has open spots' });
    });

    it('rejects users who are already registered', async () => {
      Event.findById.mockResolvedValue(
        makeEvent({ resources: [{ name: 'A', userID: new mongoose.Types.ObjectId(userId) }] }),
      );
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(Event.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects duplicate entries through the atomic update guard', async () => {
      Event.findById.mockResolvedValue(makeEvent());
      Event.findOneAndUpdate.mockResolvedValue(null);

      await eventController.joinWaitlist(req, res);

      const [filter, update] = Event.findOneAndUpdate.mock.calls[0];
      expect(filter['waitlist.userId'].$ne.toString()).toBe(userId);
      expect(update.$push.waitlist.userId.toString()).toBe(userId);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Already in waitlist' });
    });

    it('adds the user and returns their position', async () => {
      Event.findById.mockResolvedValue(makeEvent());
      Event.findOneAndUpdate.mockResolvedValue(
        makeEvent({
          waitlist: [{ userId: id() }, { userId: new mongoose.Types.ObjectId(userId) }],
        }),
      );

      await eventController.joinWaitlist(req, res);

      expect(res.json).toHaveBeenCalledWith({ message: 'Added to waitlist', position: 2 });
    });

    it('returns 500 when the lookup fails', async () => {
      Event.findById.mockRejectedValue(new Error('db down'));
      await eventController.joinWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('leaveWaitlist', () => {
    const userId = id().toString();

    beforeEach(() => {
      req.params.eventId = EVENT_ID;
      req.body.userId = userId;
    });

    it('rejects an invalid eventId', async () => {
      req.params.eventId = 'bad';
      await eventController.leaveWaitlist(req, res);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid eventId' });
    });

    it('rejects an invalid userId', async () => {
      req.body.userId = undefined;
      await eventController.leaveWaitlist(req, res);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid userId' });
    });

    it('removes the user with an atomic pull', async () => {
      Event.findOneAndUpdate.mockResolvedValue(makeEvent());

      await eventController.leaveWaitlist(req, res);

      const [, update] = Event.findOneAndUpdate.mock.calls[0];
      expect(update.$pull.waitlist.userId.toString()).toBe(userId);
      expect(res.json).toHaveBeenCalledWith({ message: 'Removed from waitlist' });
    });

    it('returns 400 when the user is not on the waitlist', async () => {
      Event.findOneAndUpdate.mockResolvedValue(null);
      Event.exists.mockResolvedValue({ _id: EVENT_ID });
      await eventController.leaveWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not in waitlist' });
    });

    it('returns 404 when the event does not exist', async () => {
      Event.findOneAndUpdate.mockResolvedValue(null);
      Event.exists.mockResolvedValue(null);
      await eventController.leaveWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 when the update fails', async () => {
      Event.findOneAndUpdate.mockRejectedValue(new Error('db down'));
      await eventController.leaveWaitlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('registerForEvent', () => {
    it('removes the user from the waitlist when they register directly', async () => {
      const userId = id().toString();
      req.params.id = EVENT_ID;
      req.body = { name: 'Reg User', userId };
      Event.findById.mockResolvedValue(makeEvent({ maxAttendees: 5 }));
      Event.findByIdAndUpdate.mockResolvedValue({});

      await eventController.registerForEvent(req, res);

      const [, update] = Event.findByIdAndUpdate.mock.calls[0];
      expect(update.$pull).toEqual({ waitlist: { userId } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('unregisterFromEvent', () => {
    it('promotes the next waitlisted user in order and emails them', async () => {
      const leaving = id();
      const registered = makeUser('Reg');
      const first = makeUser('First');
      const second = makeUser('Second');
      const event = makeEvent({
        resources: [
          { name: 'Leaving', userID: leaving },
          { name: 'Reg', userID: registered._id },
        ],
        maxAttendees: 2,
        currentAttendees: 2,
        waitlist: [
          { userId: registered._id },
          { userId: id() },
          { userId: first._id },
          { userId: second._id },
        ],
      });
      Event.findById.mockResolvedValue(event);
      mockUsers([registered, first, second]);
      req.params = { id: EVENT_ID, userId: leaving.toString() };

      await eventController.unregisterFromEvent(req, res);

      expect(event.currentAttendees).toBe(2);
      expect(event.resources.map((r) => r.userID)).toEqual([registered._id, first._id]);
      expect(event.resources[1]).toMatchObject({ name: 'First Tester', profilePic: 'First.png' });
      expect(event.waitlist.map((entry) => entry.userId)).toEqual([second._id]);
      expect(event.save).toHaveBeenCalledWith({ validateModifiedOnly: true });
      expect(emailRecipients()).toEqual(['first@example.com']);
      expect(emailSubjects()[0]).toBe('A spot opened up for Garden Day');
      expect(emailSender.mock.calls[0][2]).not.toContain('<b>');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('does not look up users when nobody is waitlisted', async () => {
      const leaving = id();
      const event = makeEvent({ resources: [{ name: 'Leaving', userID: leaving }] });
      Event.findById.mockResolvedValue(event);
      req.params = { id: EVENT_ID, userId: leaving.toString() };

      await eventController.unregisterFromEvent(req, res);

      expect(event.currentAttendees).toBe(0);
      expect(User.find).not.toHaveBeenCalled();
      expect(emailSender).not.toHaveBeenCalled();
    });
  });

  describe('leaveEvent', () => {
    beforeEach(() => {
      req.params.eventId = EVENT_ID;
    });

    it('returns 404 when the event does not exist', async () => {
      Event.findById.mockResolvedValue(null);
      await eventController.leaveEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when there are no attendees', async () => {
      Event.findById.mockResolvedValue(makeEvent({ currentAttendees: 0 }));
      await eventController.leaveEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('promotes from the waitlist and reports the promoted count', async () => {
      const next = makeUser('Next', { email: undefined });
      const event = makeEvent({ waitlist: [{ userId: next._id }], date: null });
      Event.findById.mockResolvedValue(event);
      mockUsers([next]);

      await eventController.leaveEvent(req, res);

      expect(event.currentAttendees).toBe(1);
      expect(event.resources[0].userID).toBe(next._id);
      expect(emailSender).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Left event successfully',
        promotedCount: 1,
      });
    });

    it('returns 500 when saving fails', async () => {
      const event = makeEvent();
      event.save.mockRejectedValue(new Error('db down'));
      Event.findById.mockResolvedValue(event);
      await eventController.leaveEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateEvent', () => {
    beforeEach(() => {
      req.params.id = EVENT_ID;
      req.body.requestor = { role: 'Owner' };
    });

    it('rejects requestors without an editor role', async () => {
      req.body.requestor = { role: 'Volunteer' };
      await eventController.updateEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(Event.findById).not.toHaveBeenCalled();
    });

    it('rejects an invalid event id', async () => {
      req.params.id = 'bad';
      await eventController.updateEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the event does not exist', async () => {
      Event.findById.mockResolvedValue(null);
      await eventController.updateEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a capacity lower than the current attendees', async () => {
      const event = makeEvent({ maxAttendees: 3, currentAttendees: 3 });
      Event.findById.mockResolvedValue(event);
      req.body.maxAttendees = 2;

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(event.save).not.toHaveBeenCalled();
    });

    it('notifies registered and waitlisted users when an event is cancelled', async () => {
      const registered = makeUser('Reg');
      const waiting = makeUser('Wait');
      const event = makeEvent({
        resources: [{ name: 'Reg', userID: registered._id }],
        waitlist: [{ userId: waiting._id }],
        maxAttendees: 1,
      });
      Event.findById.mockResolvedValue(event);
      mockUsers([registered, waiting]);
      req.body.isActive = false;
      req.body.maxAttendees = 5;

      await eventController.updateEvent(req, res);

      expect(event.isActive).toBe(false);
      expect(event.waitlist).toHaveLength(1);
      expect(emailRecipients()).toEqual(['reg@example.com', 'wait@example.com']);
      expect(emailSubjects()).toEqual([
        'Garden Day has been cancelled',
        'Garden Day has been cancelled',
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('notifies users with the new schedule when the date changes', async () => {
      const registered = makeUser('Reg');
      const event = makeEvent({ resources: [{ name: 'Reg', userID: registered._id }] });
      Event.findById.mockResolvedValue(event);
      mockUsers([registered]);
      req.body.date = '2031-02-03T18:00:00Z';
      req.body.ignored = 'not applied';

      await eventController.updateEvent(req, res);

      expect(event.set).toHaveBeenCalledTimes(1);
      expect(event.ignored).toBeUndefined();
      expect(emailSubjects()).toEqual(['Garden Day has been rescheduled']);
      expect(emailSender.mock.calls[0][2]).toContain('Monday, Feb 3, 2031 10:00 AM - 11:00 AM');
    });

    it('promotes waitlisted users when capacity increases without a reschedule email', async () => {
      const waiting = makeUser('Wait');
      const event = makeEvent({ waitlist: [{ userId: waiting._id }], startTime: undefined });
      Event.findById.mockResolvedValue(event);
      mockUsers([waiting]);
      req.body.maxAttendees = 2;

      await eventController.updateEvent(req, res);

      expect(event.currentAttendees).toBe(2);
      expect(event.waitlist).toHaveLength(0);
      expect(emailSubjects()).toEqual(['A spot opened up for Garden Day']);
    });

    it('logs notification failures without failing the update', async () => {
      const event = makeEvent({ resources: [{ name: 'Reg', userID: id() }] });
      Event.findById.mockResolvedValue(event);
      User.find.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('mail db')) });
      req.body.isActive = false;

      await eventController.updateEvent(req, res);

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 on validation errors', async () => {
      const event = makeEvent();
      const validationError = new Error('bad type');
      validationError.name = 'ValidationError';
      event.save.mockRejectedValue(validationError);
      Event.findById.mockResolvedValue(event);
      req.body.type = 'Party';

      await eventController.updateEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 500 on unexpected errors', async () => {
      Event.findById.mockRejectedValue(new Error('db down'));
      await eventController.updateEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
