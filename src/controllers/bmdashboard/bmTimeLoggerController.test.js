jest.mock('../../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const BuildingProject = require('../../models/bmdashboard/buildingProject');
const bmTimeLoggerController = require('./bmTimeLoggerController');

const PROJECT_ID = '507f1f77bcf86cd799439011';
const MEMBER_A = '507f1f77bcf86cd799439012';
const MEMBER_B = '507f1f77bcf86cd799439013';
const MEMBER_C = '507f1f77bcf86cd799439014';
const OUTSIDER = '507f1f77bcf86cd799439015';

const mockProjectMembers = (memberIds) => {
  BuildingProject.findById.mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve({ members: memberIds.map((user) => ({ user })) }),
    }),
  });
};

describe('bmTimeLoggerController', () => {
  let bmTimeLogMock;
  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    bmTimeLogMock = {
      findOne: jest.fn().mockResolvedValue(null),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn((doc) => Promise.resolve({ _id: 'new-log', ...doc })),
    };
    controller = bmTimeLoggerController(bmTimeLogMock);
    req = { params: { projectId: PROJECT_ID }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockProjectMembers([MEMBER_A, MEMBER_B, MEMBER_C]);
  });

  describe('bulkStartTimeLogs', () => {
    it.each([[undefined], [[]], ['not-an-array']])(
      'returns 400 when memberIds is %j',
      async (memberIds) => {
        req.body = { memberIds };

        await controller.bulkStartTimeLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(bmTimeLogMock.create).not.toHaveBeenCalled();
      },
    );

    it('returns 400 for an invalid project id', async () => {
      req.params.projectId = 'not-an-id';
      req.body = { memberIds: [MEMBER_A] };

      await controller.bulkStartTimeLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(BuildingProject.findById).not.toHaveBeenCalled();
    });

    it('returns 404 when the project does not exist', async () => {
      BuildingProject.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve(null) }),
      });
      req.body = { memberIds: [MEMBER_A] };

      await controller.bulkStartTimeLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('sorts members by outcome', async () => {
      bmTimeLogMock.findOne.mockImplementation(({ member }) => {
        if (String(member) === MEMBER_B) {
          return Promise.resolve({ _id: 'paused-log', status: 'paused', intervals: [] });
        }
        if (String(member) === MEMBER_C) {
          return Promise.resolve({ _id: 'ongoing-log', status: 'ongoing' });
        }
        return Promise.resolve(null);
      });
      bmTimeLogMock.findByIdAndUpdate.mockResolvedValue({ _id: 'paused-log', status: 'ongoing' });
      req.body = { memberIds: [MEMBER_A, MEMBER_B, MEMBER_C] };

      await controller.bulkStartTimeLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const results = res.json.mock.calls[0][0];
      expect(results.started.map((r) => r.memberId)).toEqual([MEMBER_A]);
      expect(results.resumed.map((r) => r.memberId)).toEqual([MEMBER_B]);
      expect(results.alreadyCheckedIn.map((r) => r.memberId)).toEqual([MEMBER_C]);
      expect(results.failed).toEqual([]);
      expect(bmTimeLogMock.create).toHaveBeenCalledTimes(1);
    });

    it('reports non-members as failed without creating a log for them', async () => {
      req.body = { memberIds: [MEMBER_A, OUTSIDER] };

      await controller.bulkStartTimeLogs(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results.started.map((r) => r.memberId)).toEqual([MEMBER_A]);
      expect(results.failed).toEqual([
        { memberId: OUTSIDER, message: 'Not a member of this project' },
      ]);
      expect(bmTimeLogMock.create).toHaveBeenCalledTimes(1);
    });

    it('still checks in the other members when one fails', async () => {
      bmTimeLogMock.create.mockImplementation((doc) =>
        String(doc.member) === MEMBER_A
          ? Promise.reject(new Error('write failed'))
          : Promise.resolve({ _id: 'new-log', ...doc }),
      );
      req.body = { memberIds: [MEMBER_A, MEMBER_B] };

      await controller.bulkStartTimeLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const results = res.json.mock.calls[0][0];
      expect(results.started.map((r) => r.memberId)).toEqual([MEMBER_B]);
      expect(results.failed).toEqual([{ memberId: MEMBER_A, message: 'write failed' }]);
    });

    it('checks in a duplicated member id only once', async () => {
      req.body = { memberIds: [MEMBER_A, MEMBER_A] };

      await controller.bulkStartTimeLogs(req, res);

      expect(bmTimeLogMock.create).toHaveBeenCalledTimes(1);
      expect(res.json.mock.calls[0][0].started).toHaveLength(1);
    });

    it('returns 500 when the project lookup fails', async () => {
      BuildingProject.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.reject(new Error('db down')) }),
      });
      req.body = { memberIds: [MEMBER_A] };

      await controller.bulkStartTimeLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('startTimeLog', () => {
    beforeEach(() => {
      req.params.memberId = MEMBER_A;
    });

    it('creates a new time log when none is active', async () => {
      req.body = { task: 'Framing' };

      await controller.startTimeLog(req, res);

      expect(bmTimeLogMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'Framing', status: 'ongoing' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].message).toBe('Time log started successfully');
    });

    it('resumes a paused time log', async () => {
      bmTimeLogMock.findOne.mockResolvedValue({ _id: 'paused-log', status: 'paused' });
      bmTimeLogMock.findByIdAndUpdate.mockResolvedValue({ _id: 'paused-log', status: 'ongoing' });

      await controller.startTimeLog(req, res);

      expect(bmTimeLogMock.create).not.toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].timeLog.status).toBe('ongoing');
    });

    it('returns an ongoing time log unchanged', async () => {
      const ongoing = { _id: 'ongoing-log', status: 'ongoing' };
      bmTimeLogMock.findOne.mockResolvedValue(ongoing);

      await controller.startTimeLog(req, res);

      expect(bmTimeLogMock.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].timeLog).toBe(ongoing);
    });
  });
});
