jest.mock('../../models/lbdashboard/users', () => ({
  findOne: jest.fn(),
}));

const Users = require('../../models/lbdashboard/users');
const bidNotificationsController = require('./bidNotificationsController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeBidNotificationsCtor = (saveMock) => {
  function FakeBidNotifications(data) {
    Object.assign(this, data);
  }
  FakeBidNotifications.prototype.save = saveMock;
  return FakeBidNotifications;
};

describe('bidNotificationsController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
  });

  describe('postBidNotifications', () => {
    it('creates a bid notification when the user exists', async () => {
      const saved = { _id: 'notif1', message: 'hello' };
      const saveMock = jest.fn().mockResolvedValue(saved);
      const BidNotifications = makeBidNotificationsCtor(saveMock);
      const controller = bidNotificationsController(BidNotifications);

      Users.findOne.mockResolvedValue({ _id: 'user1', email: 'a@b.com' });

      const req = {
        body: { email: 'a@b.com', message: 'hello', isDelivered: false },
      };

      await controller.postBidNotifications(req, res);

      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: saved });
    });

    it('rejects when the user does not exist', async () => {
      const saveMock = jest.fn();
      const BidNotifications = makeBidNotificationsCtor(saveMock);
      const controller = bidNotificationsController(BidNotifications);

      Users.findOne.mockResolvedValue(null);

      const req = { body: { email: 'missing@b.com', message: 'hello' } };

      await controller.postBidNotifications(req, res);

      expect(saveMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid email' });
    });
  });
});
