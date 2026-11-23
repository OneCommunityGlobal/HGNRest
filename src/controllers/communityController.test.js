jest.mock('../models/hgnFormResponse');
jest.mock('../helpers/weeklySummaryStatusHelper', () => ({
  getWeeklySummaryStatusMap: jest.fn(),
}));

const FormResponse = require('../models/hgnFormResponse');
const { getWeeklySummaryStatusMap } = require('../helpers/weeklySummaryStatusHelper');
const communityMemberController = require('./communityController');

describe('communityController', () => {
  const mockResponses = (responses) =>
    FormResponse.find.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(responses),
    });

  beforeEach(() => {
    jest.clearAllMocks();
    getWeeklySummaryStatusMap.mockResolvedValue(null);
  });

  it('preserves the response _id and exposes userId from user_id', async () => {
    FormResponse.find.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([
        {
          _id: 'response-1',
          user_id: 'profile-1',
          userInfo: { name: 'John', email: 'john@example.com', slack: 'john' },
          general: { location: 'Remote' },
          frontend: { React: '8' },
          backend: { MongoDB: '7' },
        },
      ]),
    });

    const req = { query: {} };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await communityMemberController().getCommunityMembers(req, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        _id: 'response-1',
        userId: 'profile-1',
        name: 'John',
        email: 'john@example.com',
        slack: 'john',
        team: 'Remote',
      }),
    ]);
  });

  describe('weeklySummaryStatus', () => {
    const responses = [
      { _id: 'r1', user_id: 'u1', userInfo: { name: 'A' } },
      { _id: 'r2', user_id: 'u2', userInfo: { name: 'B' } },
      { _id: 'r3', userInfo: { name: 'No profile' } },
    ];
    const res = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });

    it('adds each member their own status when the requestor may see it', async () => {
      mockResponses(responses);
      getWeeklySummaryStatusMap.mockResolvedValue({ u1: 'completed', u2: 'incomplete' });
      const req = { query: {}, body: { requestor: { requestorId: 'admin' } } };
      const response = res();

      await communityMemberController().getCommunityMembers(req, response);

      expect(getWeeklySummaryStatusMap).toHaveBeenCalledWith({ requestorId: 'admin' }, [
        'u1',
        'u2',
        undefined,
      ]);
      const statuses = response.json.mock.calls[0][0].map((m) => m.weeklySummaryStatus);
      expect(statuses).toEqual(['completed', 'incomplete', null]);
    });

    it('omits the field when the requestor may not see summary status', async () => {
      mockResponses(responses);
      const response = res();

      await communityMemberController().getCommunityMembers({ query: {}, body: {} }, response);

      response.json.mock.calls[0][0].forEach((m) => {
        expect(m).not.toHaveProperty('weeklySummaryStatus');
      });
    });

    it('still returns members (without status) when the status lookup fails', async () => {
      mockResponses(responses);
      getWeeklySummaryStatusMap.mockRejectedValue(new Error('db down'));
      const response = res();

      await communityMemberController().getCommunityMembers({ query: {}, body: {} }, response);

      expect(response.status).not.toHaveBeenCalled();
      expect(response.json.mock.calls[0][0]).toHaveLength(3);
      response.json.mock.calls[0][0].forEach((m) => {
        expect(m).not.toHaveProperty('weeklySummaryStatus');
      });
    });
  });
});
