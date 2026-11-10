jest.mock('../models/hgnFormResponse');

const FormResponse = require('../models/hgnFormResponse');
const communityMemberController = require('./communityController');

describe('communityController', () => {
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
});
