jest.mock('../models/helpRequest');
jest.mock('../models/helpFeedback');
jest.mock('../helpers/helpRequestEligibility', () => ({
  getHelpRequestEligibility: jest.fn(),
}));

const HelpRequest = require('../models/helpRequest');
const { getHelpRequestEligibility } = require('../helpers/helpRequestEligibility');
const { createHelpRequest, checkHelpRequestEligibility } = require('./helpRequestController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('helpRequestController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createHelpRequest', () => {
    it('creates the help request for an authenticated, eligible caller (201)', async () => {
      getHelpRequestEligibility.mockResolvedValue({ eligible: true, questionnaireCompleted: true });
      const savedRequest = { _id: 'hr1', userId: 'authenticatedUser1', topic: 'HTML Semantics' };
      HelpRequest.mockImplementation(() => ({
        ...savedRequest,
        save: jest.fn().mockResolvedValue(savedRequest),
      }));

      const req = {
        user: { requestorId: 'authenticatedUser1' },
        body: { topic: 'HTML Semantics', description: 'desc' },
      };
      const res = makeRes();

      await createHelpRequest(req, res);

      expect(getHelpRequestEligibility).toHaveBeenCalledWith('authenticatedUser1');
      expect(HelpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'authenticatedUser1' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects an authenticated but ineligible caller with 403 and does not create a request', async () => {
      getHelpRequestEligibility.mockResolvedValue({
        eligible: false,
        questionnaireCompleted: false,
      });

      const req = {
        user: { requestorId: 'ineligibleCallerId' },
        body: { topic: 'HTML Semantics', description: 'desc' },
      };
      const res = makeRes();

      await createHelpRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
      expect(HelpRequest).not.toHaveBeenCalled();
    });

    it('ignores a spoofed body.userId: eligibility is checked only for the authenticated caller', async () => {
      getHelpRequestEligibility.mockResolvedValue({ eligible: true, questionnaireCompleted: true });
      HelpRequest.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));

      const req = {
        user: { requestorId: 'ineligibleCallerId' },
        body: { userId: 'eligibleVictimId', topic: 'HTML Semantics', description: 'desc' },
      };
      const res = makeRes();

      await createHelpRequest(req, res);

      expect(getHelpRequestEligibility).toHaveBeenCalledWith('ineligibleCallerId');
      expect(getHelpRequestEligibility).not.toHaveBeenCalledWith('eligibleVictimId');
    });

    it('ignores a spoofed body.userId when saving: HelpRequest.userId is the authenticated caller', async () => {
      getHelpRequestEligibility.mockResolvedValue({ eligible: true, questionnaireCompleted: true });
      HelpRequest.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));

      const req = {
        user: { requestorId: 'authenticatedUser1' },
        body: { userId: 'eligibleVictimId', topic: 'HTML Semantics', description: 'desc' },
      };
      const res = makeRes();

      await createHelpRequest(req, res);

      expect(HelpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'authenticatedUser1' }),
      );
      expect(HelpRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'eligibleVictimId' }),
      );
    });

    it('treats a missing authenticated identity as ineligible rather than trusting the request body', async () => {
      getHelpRequestEligibility.mockResolvedValue({
        eligible: false,
        questionnaireCompleted: false,
      });

      const req = {
        user: undefined,
        body: { userId: 'eligibleVictimId', topic: 'HTML Semantics' },
      };
      const res = makeRes();

      await createHelpRequest(req, res);

      expect(getHelpRequestEligibility).toHaveBeenCalledWith(undefined);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(HelpRequest).not.toHaveBeenCalled();
    });
  });

  describe('checkHelpRequestEligibility', () => {
    it('returns the eligibility result for the authenticated caller', async () => {
      getHelpRequestEligibility.mockResolvedValue({ eligible: true, questionnaireCompleted: true });

      const req = { user: { requestorId: 'authenticatedUser1' } };
      const res = makeRes();

      await checkHelpRequestEligibility(req, res);

      expect(getHelpRequestEligibility).toHaveBeenCalledWith('authenticatedUser1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ eligible: true, questionnaireCompleted: true });
    });

    it("cannot be used to query another user's eligibility via the request", async () => {
      getHelpRequestEligibility.mockResolvedValue({
        eligible: false,
        questionnaireCompleted: false,
      });

      // No :userId param exists on this route anymore; only req.user is consulted.
      const req = {
        user: { requestorId: 'authenticatedUser1' },
        params: { userId: 'otherUserId' },
      };
      const res = makeRes();

      await checkHelpRequestEligibility(req, res);

      expect(getHelpRequestEligibility).toHaveBeenCalledWith('authenticatedUser1');
      expect(getHelpRequestEligibility).not.toHaveBeenCalledWith('otherUserId');
    });
  });
});
