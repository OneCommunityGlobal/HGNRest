const mockRequestFeedback = jest.fn();
const mockCheckQuestionaireModal = jest.fn();

jest.mock('../../helpers/dashboardhelper', () =>
  jest.fn(() => ({
    requestFeedback: mockRequestFeedback,
    checkQuestionaireModal: mockCheckQuestionaireModal,
  })),
);
jest.mock('../../utilities/emailSender', () => jest.fn());

const dashboardControllerFactory = require('../dashBoardController');

const controller = dashboardControllerFactory();

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('dashBoardController feedback endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps a successful feedback save in savingRequestFeedbackData with HTTP 200', async () => {
    const body = { message: 'Feedback submitted successfully', data: {} };
    mockRequestFeedback.mockResolvedValue({ status: 200, body });
    const res = buildRes();

    await controller.requestFeedbackModal({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ savingRequestFeedbackData: body });
  });

  it.each([400, 403, 404, 500])(
    'passes through HTTP %i from a failed feedback save',
    async (status) => {
      mockRequestFeedback.mockResolvedValue({ status, body: { message: 'failed' } });
      const res = buildRes();

      await controller.requestFeedbackModal({}, res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ message: 'failed' });
    },
  );

  it('returns 500 when the feedback helper throws', async () => {
    mockRequestFeedback.mockRejectedValue(new Error('boom'));
    const res = buildRes();

    await controller.requestFeedbackModal({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns the check modal status and body from the helper', async () => {
    mockCheckQuestionaireModal.mockResolvedValue({ status: 200, body: { showModal: true } });
    const res = buildRes();

    await controller.checkQuestionaireModal({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ showModal: true });
  });
});
