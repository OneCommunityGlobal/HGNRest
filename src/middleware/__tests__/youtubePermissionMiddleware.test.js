const { requireYoutubePermission } = require('../youtubePermissionMiddleware');
const { hasPermission } = require('../../utilities/permissions');

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

describe('YouTube Permission Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      requestor: null,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Missing Requestor', () => {
    it('should return 401 when no requestor in req.requestor or req.body', async () => {
      await requireYoutubePermission(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required. Please log in to access YouTube features.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract requestor from req.requestor and call next when authorized', async () => {
      const requestor = { requestorId: 'user123', role: 'admin' };
      req.requestor = requestor;
      hasPermission.mockResolvedValueOnce(true);

      await requireYoutubePermission(req, res, next);

      expect(hasPermission).toHaveBeenCalledWith(requestor, 'postYoutubeContent');
      expect(next).toHaveBeenCalled();
    });

    it('should extract requestor from req.body.requestor and call next when authorized', async () => {
      const requestor = { requestorId: 'user456', role: 'user' };
      req.body = { requestor };
      hasPermission.mockResolvedValueOnce(true);

      await requireYoutubePermission(req, res, next);

      expect(hasPermission).toHaveBeenCalledWith(requestor, 'postYoutubeContent');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Permission Check', () => {
    const requestor = { requestorId: 'user123', role: 'admin' };

    it('should call next() when user has postYoutubeContent permission', async () => {
      req.requestor = requestor;
      hasPermission.mockResolvedValueOnce(true);

      await requireYoutubePermission(req, res, next);

      expect(hasPermission).toHaveBeenCalledWith(requestor, 'postYoutubeContent');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks postYoutubeContent permission', async () => {
      req.requestor = requestor;
      hasPermission.mockResolvedValueOnce(false);

      await requireYoutubePermission(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to post content to YouTube. Please contact your administrator.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 and not leak error details on hasPermission failure', async () => {
      req.requestor = { requestorId: 'user123' };
      hasPermission.mockRejectedValueOnce(new Error('Database connection failed'));

      await requireYoutubePermission(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while verifying your permissions. Please try again.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Preference for req.requestor over req.body.requestor', () => {
    it('should prefer req.requestor when both are present', async () => {
      const reqRequestor = { requestorId: 'user123' };
      const bodyRequestor = { requestorId: 'user456' };
      req.requestor = reqRequestor;
      req.body = { requestor: bodyRequestor };
      hasPermission.mockResolvedValueOnce(true);

      await requireYoutubePermission(req, res, next);

      expect(hasPermission).toHaveBeenCalledWith(reqRequestor, 'postYoutubeContent');
      expect(next).toHaveBeenCalled();
    });
  });
});