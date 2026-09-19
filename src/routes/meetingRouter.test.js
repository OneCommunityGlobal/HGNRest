jest.mock('../controllers/meetingController', () =>
  jest.fn(() => ({
    postMeeting: jest.fn(),
    getMeetings: jest.fn(),
    markMeetingAsRead: jest.fn(),
    getAllMeetingsByOrganizer: jest.fn(),
    getCalendarInvite: jest.fn(),
    getUpcomingMeetingForParticipant: jest.fn(),
  })),
);

const meetingController = require('../controllers/meetingController');
const meetingRouterFactory = require('./meetingRouter');

describe('meetingRouter', () => {
  it('registers meeting routes and wires controller handlers', () => {
    const Meeting = {};
    const router = meetingRouterFactory(Meeting);

    expect(meetingController).toHaveBeenCalledWith(Meeting);
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');

    const layerPaths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(layerPaths).toEqual(
      expect.arrayContaining([
        { path: '/meetings/new', methods: ['post'] },
        { path: '/meetings', methods: ['get'] },
        { path: '/meetings/markRead/:meetingId/:recipient', methods: ['post'] },
        { path: '/meetings/upcoming/:organizerId', methods: ['get'] },
        { path: '/meeting/:meetingId/calendar', methods: ['get'] },
        { path: '/meetings/participant/:participantId', methods: ['get'] },
      ]),
    );
  });
});
