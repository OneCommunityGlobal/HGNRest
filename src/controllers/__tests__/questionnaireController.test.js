const FormResponse = require('../../models/hgnFormResponse');
const questionnaireController = require('../questionnaireController');

describe('questionnaireController', () => {
  let req;
  let res;
  let controller;
  let findOneSpy;

  beforeEach(() => {
    jest.restoreAllMocks();

    req = {
      user: {
        requestorId: 'test-user-id',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    findOneSpy = jest.spyOn(FormResponse, 'findOne');
    controller = questionnaireController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getQuestionnaireStatus', () => {
    it('should return 401 when user is missing', async () => {
      req.user = undefined;

      await controller.getQuestionnaireStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not authenticated',
      });
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('should return 401 when user ID is missing', async () => {
      req.user = {};

      await controller.getQuestionnaireStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not authenticated',
      });
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('should return completed true when a response exists', async () => {
      findOneSpy.mockResolvedValue({ _id: 'response-id' });

      await controller.getQuestionnaireStatus(req, res);

      expect(findOneSpy).toHaveBeenCalledWith({
        user_id: 'test-user-id',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        completed: true,
      });
    });

    it('should return completed false when no response exists', async () => {
      findOneSpy.mockResolvedValue(null);

      await controller.getQuestionnaireStatus(req, res);

      expect(findOneSpy).toHaveBeenCalledWith({
        user_id: 'test-user-id',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        completed: false,
      });
    });

    it('should return 500 when database query fails', async () => {
      findOneSpy.mockRejectedValue(new Error('Database error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.getQuestionnaireStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unable to check questionnaire status',
      });
    });
  });
});
