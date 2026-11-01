jest.mock('../../models/userProfile', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/timeentry', () => ({}));
jest.mock('../../models/team', () => ({}));
jest.mock('../../models/helpRequest', () => ({
  updateMany: jest.fn(),
  exists: jest.fn(),
}));
jest.mock('../../utilities/permissions', () => ({ hasPermission: jest.fn() }));

const userProfile = require('../../models/userProfile');
const HelpRequest = require('../../models/helpRequest');
const dashboardhelperFactory = require('../dashboardhelper');

const { requestFeedback, checkQuestionaireModal } = dashboardhelperFactory();

const USER_ID = '5baac381e16814009017678c';
const OTHER_ID = '5baac381e16814009017678d';

const buildFeedbackReq = (overrides = {}) => ({
  user: { requestorId: USER_ID },
  body: {
    userId: USER_ID,
    haveYouRecievedHelpLastWeek: 'Yes',
    peopleYouContacted: [],
    additionalComments: '',
    foundHelpSomeWhereClosePermanently: false,
    requestor: { requestorId: USER_ID },
    ...overrides,
  },
});

const buildCheckReq = (userId = USER_ID, requestorId = USER_ID) => ({
  user: { requestorId },
  params: { userId },
  body: {},
});

describe('dashboardhelper.requestFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('returns 400 when userId is missing', async () => {
    const result = await requestFeedback(buildFeedbackReq({ userId: undefined }));

    expect(result.status).toBe(400);
    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed userId', async () => {
    const result = await requestFeedback(buildFeedbackReq({ userId: 'not-an-id' }));

    expect(result.status).toBe(400);
    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
    expect(HelpRequest.updateMany).not.toHaveBeenCalled();
  });

  it('returns 403 and writes nothing when the body userId is not the requestor', async () => {
    const result = await requestFeedback(buildFeedbackReq({ userId: OTHER_ID }));

    expect(result.status).toBe(403);
    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
    expect(HelpRequest.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    userProfile.findOneAndUpdate.mockResolvedValue(null);

    const result = await requestFeedback(buildFeedbackReq());

    expect(result.status).toBe(404);
    expect(HelpRequest.updateMany).not.toHaveBeenCalled();
  });

  it('saves feedback and marks only the requestor old help requests as answered', async () => {
    const updatedUser = { _id: USER_ID };
    userProfile.findOneAndUpdate.mockResolvedValue(updatedUser);
    HelpRequest.updateMany.mockResolvedValue({ nModified: 1 });

    const result = await requestFeedback(buildFeedbackReq());

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      message: 'Feedback submitted successfully',
      data: updatedUser,
    });
    const [filter, update] = HelpRequest.updateMany.mock.calls[0];
    expect(String(filter.userId)).toBe(USER_ID);
    expect(filter.feedbackSubmitted).toBe(false);
    expect(filter.requestedAt.$lte).toBeInstanceOf(Date);
    expect(update).toEqual({ feedbackSubmitted: true });
  });

  it('returns 500 when the help request update fails so the client can retry', async () => {
    userProfile.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });
    HelpRequest.updateMany.mockRejectedValue(new Error('write failed'));

    const result = await requestFeedback(buildFeedbackReq());

    expect(result.status).toBe(500);
  });
});

describe('dashboardhelper.checkQuestionaireModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('returns 400 for a malformed userId', async () => {
    const result = await checkQuestionaireModal(buildCheckReq('not-an-id'));

    expect(result.status).toBe(400);
    expect(userProfile.findOne).not.toHaveBeenCalled();
  });

  it('returns 403 when asking about another user', async () => {
    const result = await checkQuestionaireModal(buildCheckReq(OTHER_ID, USER_ID));

    expect(result.status).toBe(403);
    expect(userProfile.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    userProfile.findOne.mockResolvedValue(null);

    const result = await checkQuestionaireModal(buildCheckReq());

    expect(result.status).toBe(404);
  });

  it('hides the modal after it was closed permanently', async () => {
    userProfile.findOne.mockResolvedValue({
      questionaireFeedback: { foundHelpSomeWhereClosePermanently: true },
    });

    const result = await checkQuestionaireModal(buildCheckReq());

    expect(result).toEqual({ status: 200, body: { showModal: false } });
    expect(HelpRequest.exists).not.toHaveBeenCalled();
  });

  it('shows the modal when an unanswered help request is at least seven days old', async () => {
    userProfile.findOne.mockResolvedValue({
      questionaireFeedback: { foundHelpSomeWhereClosePermanently: false },
    });
    HelpRequest.exists.mockResolvedValue({ _id: 'hr1' });

    const result = await checkQuestionaireModal(buildCheckReq());

    expect(result).toEqual({ status: 200, body: { showModal: true } });
  });

  it('hides the modal when there is no pending help request', async () => {
    userProfile.findOne.mockResolvedValue({});
    HelpRequest.exists.mockResolvedValue(null);

    const result = await checkQuestionaireModal(buildCheckReq());

    expect(result).toEqual({ status: 200, body: { showModal: false } });
  });

  it('returns 500 when the help request lookup fails', async () => {
    userProfile.findOne.mockResolvedValue({});
    HelpRequest.exists.mockRejectedValue(new Error('db down'));

    const result = await checkQuestionaireModal(buildCheckReq());

    expect(result.status).toBe(500);
  });
});
