const mockEstimatedDocumentCount = jest.fn();
const mockDistinct = jest.fn();
const mockLean = jest.fn();
const mockSelect = jest.fn(() => ({ lean: mockLean }));
const mockFind = jest.fn(() => ({ distinct: mockDistinct, select: mockSelect }));

const Educator = {
  estimatedDocumentCount: mockEstimatedDocumentCount,
  find: mockFind,
};
jest.mock('../../models/pmEducators', () => Educator);

const mockCreate = jest.fn();
const PMNotification = {
  create: mockCreate,
};
jest.mock('../../models/pmNotification', () => PMNotification);

const { previewNotification, sendNotification } = require('../pmnotificationsController');

const EDUCATOR_ID_1 = '507f1f77bcf86cd799439011';
const EDUCATOR_ID_2 = '507f1f77bcf86cd799439012';

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('pmnotificationsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('previewNotification', () => {
    it('returns 400 when message is missing', async () => {
      const req = { body: { educatorIds: [EDUCATOR_ID_1], message: '   ' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'message is required' });
    });

    it('returns 400 when message exceeds 1000 characters', async () => {
      const req = { body: { educatorIds: [EDUCATOR_ID_1], message: 'a'.repeat(1001) } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'message must be ≤ 1000 characters' });
    });

    it('returns 400 when no educatorIds are provided and all is not set', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(0);
      const req = { body: { educatorIds: [], message: 'hello' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Provide at least one educatorId or set all=true',
      });
    });

    it('resolves mock mode when a non-ObjectId educatorId is provided', async () => {
      const req = { body: { educatorIds: ['t-001'], message: 'hello there' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(mockEstimatedDocumentCount).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        mode: 'mock',
        summary: { attempted: 1, willSendTo: 1, unknownIds: [], all: false },
        message: 'hello there',
      });
    });

    it('resolves real mode with all=true and no educators in the system', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(0);
      const req = { body: { all: true, message: 'hello' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        mode: 'real',
        summary: { attempted: 0, willSendTo: 0, unknownIds: [], all: true },
        message: 'hello',
      });
    });

    it('resolves real mode with all=true and existing educators', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(2);
      mockDistinct.mockResolvedValue([EDUCATOR_ID_1, EDUCATOR_ID_2]);
      const req = { body: { all: true, message: 'hello' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(mockFind).toHaveBeenCalled();
      expect(mockDistinct).toHaveBeenCalledWith('_id');
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        mode: 'real',
        summary: {
          attempted: 2,
          willSendTo: 2,
          unknownIds: [],
          all: true,
        },
        message: 'hello',
      });
    });

    it('resolves real mode with specific educatorIds, splitting valid and unknown ids', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(5);
      mockLean.mockResolvedValue([{ _id: EDUCATOR_ID_1 }]);
      const req = {
        body: { educatorIds: [EDUCATOR_ID_1, EDUCATOR_ID_2], message: 'hi team' },
      };
      const res = mockRes();

      await previewNotification(req, res);

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.objectContaining({ $in: expect.any(Array) }) }),
      );
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        mode: 'real',
        summary: {
          attempted: 2,
          willSendTo: 1,
          unknownIds: [EDUCATOR_ID_2],
          all: false,
        },
        message: 'hi team',
      });
    });

    it('returns 500 when resolving recipients throws', async () => {
      mockEstimatedDocumentCount.mockRejectedValue(new Error('db down'));
      const req = { body: { all: true, message: 'hello' } };
      const res = mockRes();

      await previewNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to preview notification' });
    });
  });

  describe('sendNotification', () => {
    it('returns 400 when message is missing', async () => {
      const req = { body: { educatorIds: [EDUCATOR_ID_1] } };
      const res = mockRes();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'message is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('creates a mock notification when educatorIds are not real ObjectIds', async () => {
      const req = { body: { educatorIds: ['t-001'], message: 'hello' } };
      const res = mockRes();

      await sendNotification(req, res);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          mode: 'mock',
          notification: expect.objectContaining({
            id: null,
            message: 'hello',
            educatorIds: ['t-001'],
          }),
          summary: { attempted: 1, sentTo: 1, unknownIds: [], all: false },
        }),
      );
    });

    it('returns 400 when none of the provided educatorIds match a real educator', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(5);
      mockLean.mockResolvedValue([]);
      const req = { body: { educatorIds: [EDUCATOR_ID_1], message: 'hello' } };
      const res = mockRes();

      await sendNotification(req, res);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No valid educatorIds provided',
        unknownIds: [EDUCATOR_ID_1],
      });
    });

    it('creates a real notification and returns 201 on success', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(5);
      mockLean.mockResolvedValue([{ _id: EDUCATOR_ID_1 }]);
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      mockCreate.mockResolvedValue({
        _id: 'notif1',
        message: 'hello team',
        educatorIds: [EDUCATOR_ID_1],
        createdAt,
      });

      const req = {
        body: { educatorIds: [EDUCATOR_ID_1], message: 'hello team' },
        user: { _id: 'user1' },
      };
      const res = mockRes();

      await sendNotification(req, res);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'hello team',
          createdBy: 'user1',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        mode: 'real',
        notification: {
          id: 'notif1',
          message: 'hello team',
          educatorIds: [EDUCATOR_ID_1],
          createdAt: createdAt.toISOString(),
        },
        summary: { attempted: 1, sentTo: 1, unknownIds: [], all: false },
      });
    });

    it('returns 500 when PMNotification.create throws', async () => {
      mockEstimatedDocumentCount.mockResolvedValue(5);
      mockLean.mockResolvedValue([{ _id: EDUCATOR_ID_1 }]);
      mockCreate.mockRejectedValue(new Error('write failed'));

      const req = { body: { educatorIds: [EDUCATOR_ID_1], message: 'hello' } };
      const res = mockRes();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to send notification' });
    });
  });
});
