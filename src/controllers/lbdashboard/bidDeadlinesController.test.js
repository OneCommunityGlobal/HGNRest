jest.mock('../../models/lbdashboard/listings', () => ({
  findOne: jest.fn(),
}));

const Listings = require('../../models/lbdashboard/listings');
const bidsDeadlineController = require('./bidDeadlinesController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeBidDeadlinesCtor = (saveMock) => {
  function FakeBidDeadlines(data) {
    Object.assign(this, data);
  }
  FakeBidDeadlines.prototype.save = saveMock;
  return FakeBidDeadlines;
};

describe('bidDeadlinesController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
  });

  describe('postBidDeadlines', () => {
    it('creates a bid deadline when the listing and dates are valid', async () => {
      const saved = { _id: 'bd1', listingId: 'listing1' };
      const saveMock = jest.fn().mockResolvedValue(saved);
      const BidDeadlines = makeBidDeadlinesCtor(saveMock);
      const controller = bidsDeadlineController(BidDeadlines);

      Listings.findOne.mockResolvedValue({ _id: 'listing1' });

      const req = {
        body: {
          listingId: 'listing1',
          startDate: '01/01/2026',
          endDate: '02/01/2026',
          isActive: true,
          isClosed: false,
        },
      };

      await controller.postBidDeadlines(req, res);

      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: saved });
    });

    it('rejects when the listing does not exist', async () => {
      const saveMock = jest.fn();
      const BidDeadlines = makeBidDeadlinesCtor(saveMock);
      const controller = bidsDeadlineController(BidDeadlines);

      Listings.findOne.mockResolvedValue(null);

      const req = {
        body: {
          listingId: 'missingListing',
          startDate: '01/01/2026',
          endDate: '02/01/2026',
        },
      };

      await controller.postBidDeadlines(req, res);

      expect(saveMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid listingId' });
    });
  });
});
