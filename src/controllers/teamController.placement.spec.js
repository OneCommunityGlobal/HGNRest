/**
 * Placement fields on the team model (doc item #23).
 *
 * A separate file from teamController.spec.js on purpose. That suite mocks
 * permissions with jest.spyOn, which cannot reach putTeam: putTeam calls the
 * `hasPermission` it destructured at import time, not `helper.hasPermission`,
 * so a spy on the module object never applies. That is also why putTeam has no
 * coverage there. Mocking the whole module here is what makes it testable.
 */

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');
const teamController = require('./teamController');

const TEAM_ID = '637af0c0fb9bbc1e308cfa01';

describe('team placement fields', () => {
  let Team;
  let controller;
  let mockRes;
  let record;

  const flushPromises = () => new Promise(setImmediate);

  const request = (body) => ({
    params: { teamId: TEAM_ID },
    body: { requestor: { requestorId: '665234c757ca141fe891e1ca', role: 'Owner' }, ...body },
  });

  /** putTeam works through a findById callback, so the record is captured. */
  const givenExistingTeam = (existing = {}) => {
    record = { teamCode: '', save: jest.fn().mockResolvedValue(true), ...existing };
    Team.findById = jest.fn((id, cb) => cb(null, record));
    return record;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    Team = {
      exists: jest.fn().mockResolvedValue(false),
      findById: jest.fn(),
    };
    controller = teamController(Team);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('putTeam', () => {
    it('does NOT clear the placement fields when the caller omits them', async () => {
      // The regression this exists to catch. putTeam assigns every field it
      // knows about unconditionally, so reading the new ones the same way
      // would let the existing Teams page wipe a team's standup on every
      // ordinary rename.
      givenExistingTeam({ hoursBand: '20+', standupDay: 'Friday', standupTime: '3PM' });

      await controller.putTeam(request({ teamName: 'Renamed', isActive: true }), mockRes);
      await flushPromises();

      expect(record.teamName).toBe('Renamed');
      expect(record.hoursBand).toBe('20+');
      expect(record.standupDay).toBe('Friday');
      expect(record.standupTime).toBe('3PM');
    });

    it('sets them when they are supplied', async () => {
      givenExistingTeam();

      await controller.putTeam(
        request({
          teamName: 'T',
          isActive: true,
          hoursBand: '10-19.99',
          standupDay: 'Tuesday',
          standupTime: '11AM',
        }),
        mockRes,
      );
      await flushPromises();

      expect(record.hoursBand).toBe('10-19.99');
      expect(record.standupDay).toBe('Tuesday');
      expect(record.standupTime).toBe('11AM');
    });

    it('an explicit null clears one, which takes the team out of placement', async () => {
      givenExistingTeam({ hoursBand: '20+', standupDay: 'Friday' });

      await controller.putTeam(
        request({ teamName: 'T', isActive: true, hoursBand: null }),
        mockRes,
      );
      await flushPromises();

      expect(record.hoursBand).toBeNull();
      expect(record.standupDay).toBe('Friday');
    });

    it('rejects a bad hours band without reading the record', async () => {
      await controller.putTeam(
        request({ teamName: 'T', isActive: true, hoursBand: '30+' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(Team.findById).not.toHaveBeenCalled();
    });

    it('rejects an abbreviated weekday', async () => {
      await controller.putTeam(
        request({ teamName: 'T', isActive: true, standupDay: 'Tues' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(Team.findById).not.toHaveBeenCalled();
    });

    it('rejects an unreadable standup time', async () => {
      await controller.putTeam(
        request({ teamName: 'T', isActive: true, standupTime: 'lunchtime' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(Team.findById).not.toHaveBeenCalled();
    });

    it('accepts the time formats the standup is likely to be entered in', async () => {
      const accepted = ['11AM', '9:30 AM', '3PM', '14:00', '12PM'];

      // eslint-disable-next-line no-restricted-syntax
      for (const standupTime of accepted) {
        jest.clearAllMocks();
        hasPermission.mockResolvedValue(true);
        givenExistingTeam();

        // eslint-disable-next-line no-await-in-loop
        await controller.putTeam(request({ teamName: 'T', isActive: true, standupTime }), mockRes);
        // eslint-disable-next-line no-await-in-loop
        await flushPromises();

        expect(record.standupTime).toBe(standupTime);
        expect(mockRes.status).not.toHaveBeenCalledWith(400);
      }
    });

    it('still refuses a requestor without putTeam permission', async () => {
      hasPermission.mockResolvedValue(false);

      await controller.putTeam(
        request({ teamName: 'T', isActive: true, hoursBand: '20+' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('postTeam', () => {
    it('creates a team carrying the placement fields', async () => {
      const saved = [];
      function FakeTeam() {
        this.save = jest.fn().mockImplementation(() => {
          saved.push(this);
          return Promise.resolve(this);
        });
      }
      FakeTeam.exists = jest.fn().mockResolvedValue(false);
      controller = teamController(FakeTeam);

      await controller.postTeam(
        request({
          teamName: 'New',
          isActive: true,
          hoursBand: '20+',
          standupDay: 'Friday',
          standupTime: '3PM',
        }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(saved[0]).toMatchObject({
        teamName: 'New',
        hoursBand: '20+',
        standupDay: 'Friday',
        standupTime: '3PM',
      });
    });

    it('rejects a bad placement field on create before checking for a duplicate name', async () => {
      await controller.postTeam(request({ teamName: 'New', hoursBand: 'nonsense' }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(Team.exists).not.toHaveBeenCalled();
    });

    it('creates a team with no placement fields, exactly as before', async () => {
      const saved = [];
      function FakeTeam() {
        this.save = jest.fn().mockImplementation(() => {
          saved.push(this);
          return Promise.resolve(this);
        });
      }
      FakeTeam.exists = jest.fn().mockResolvedValue(false);
      controller = teamController(FakeTeam);

      await controller.postTeam(request({ teamName: 'Plain', isActive: true }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(saved[0].teamName).toBe('Plain');
      expect(saved[0].hoursBand).toBeUndefined();
      expect(saved[0].standupDay).toBeUndefined();
    });
  });
});
