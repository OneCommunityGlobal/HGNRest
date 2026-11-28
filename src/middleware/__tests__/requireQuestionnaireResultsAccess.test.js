const FormResponse = require('../../models/hgnFormResponse');
const requireQuestionnaireResultsAccess = require('../requireQuestionnaireResultsAccess');

describe('requireQuestionnaireResultsAccess', () => {
  let req;
  let res;
  let next;
  let findOneSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    findOneSpy = jest.spyOn(FormResponse, 'findOne');

    req = {
      user: {
        requestorId: 'user123',
        role: 'Volunteer',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 401 when requestorId is missing', async () => {
    req.user = { role: 'Volunteer' };

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not authenticated',
    });
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when user is missing', async () => {
    req.user = undefined;

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not authenticated',
    });
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow Administrator without checking questionnaire completion', async () => {
    req.user.role = 'Administrator';

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it('should allow Owner without checking questionnaire completion', async () => {
    req.user.role = 'Owner';

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it('should allow users who completed the questionnaire', async () => {
    findOneSpy.mockResolvedValue({ user_id: 'user123' });

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(findOneSpy).toHaveBeenCalledWith({
      user_id: 'user123',
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user has not completed the questionnaire', async () => {
    findOneSpy.mockResolvedValue(null);

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Complete the HGN Skills Questionnaire to access results.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 when questionnaire lookup fails', async () => {
    const error = new Error('Database connection failed');

    findOneSpy.mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await requireQuestionnaireResultsAccess(req, res, next);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Questionnaire results authorization error:',
      error,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to verify questionnaire access.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
