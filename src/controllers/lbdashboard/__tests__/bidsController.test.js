jest.mock('../../../models/lbdashboard/users', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../models/lbdashboard/listings', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../models/lbdashboard/bidDeadline', () => ({}));

jest.mock('../../../sockets/BiddingService/connServer', () => ({
  getIO: jest.fn(() => null),
}));

jest.mock('../bidDeadlinesController', () => {
  const addBidToHistory = jest.fn();

  return jest.fn(() => ({
    addBidToHistory,
  }));
});

jest.mock('../paymentsController', () => () => ({
  postPayments: jest.fn(),
  postPaymentsWithoutCard: jest.fn(),
  postPaymentUpdateOrderWithoutCard: jest.fn(),
  postPaymentAuthorizationsWithoutCard: jest.fn(),
  postPaymentCheckoutNowWithoutCard: jest.fn(),
  postPaymentStatusWithoutCard: jest.fn(),
}));

const Users = require('../../../models/lbdashboard/users');
const Listings = require('../../../models/lbdashboard/listings');
const { addBidToHistory } = require('../bidDeadlinesController')();
const bidsController = require('../bidsController');

describe('bidsController - postBids', () => {
  let controller;
  let req;
  let res;
  let Bids;

  beforeEach(() => {
    jest.clearAllMocks();

    Bids = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({
        _id: 'bid123',
        ...data,
      }),
    }));

    controller = bidsController(Bids);

    req = {
      body: {
        listingId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        termsAgreed: true,
        startDate: '12/01/2026',
        endDate: '12/05/2026',
        biddingHistory: { bidPrice: 100 },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    Users.findOne.mockResolvedValue({ _id: 'user123' });
    Listings.findOne.mockResolvedValue({ _id: req.body.listingId });
    addBidToHistory.mockResolvedValue({ status: 200 });
  });

  it('returns HTTP 200 when a bid is successfully saved', async () => {
    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('returns HTTP 400 when the email is invalid', async () => {
    Users.findOne.mockResolvedValue(null);

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid email',
    });

    expect(Bids).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when the listing ID is invalid', async () => {
    Listings.findOne.mockResolvedValue(null);

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid listingId',
    });

    expect(Bids).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when the bid price is zero', async () => {
    req.body.biddingHistory.bidPrice = 0;

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Bid price should be greater than 0',
    });

    expect(Bids).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when terms are not agreed', async () => {
    req.body.termsAgreed = false;

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'termsAgreed cannot be empty',
    });

    expect(Bids).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when the start date is invalid', async () => {
    req.body.startDate = 'invalid-date';

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid startDate',
    });

    expect(Bids).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 when the end date is invalid', async () => {
    req.body.endDate = 'invalid-date';

    await controller.postBids(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid endDate',
    });

    expect(Bids).not.toHaveBeenCalled();
  });
});
