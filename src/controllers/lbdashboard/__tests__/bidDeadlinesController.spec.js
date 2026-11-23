jest.mock('../../../models/lbdashboard/listings', () => ({
  findOne: jest.fn(),
}));

const Listings = require('../../../models/lbdashboard/listings');
const bidsDeadlineController = require('../bidDeadlinesController');

const BidDeadlines = jest.fn().mockImplementation(function BidDeadlinesModel(data) {
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
});

const controller = bidsDeadlineController(BidDeadlines);

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('postBidDeadlines', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a new bid deadline for a valid listing', async () => {
    Listings.findOne.mockResolvedValue({ _id: 'listing1' });
    const res = mockRes();

    await controller.postBidDeadlines(
      {
        body: {
          listingId: 'listing1',
          startDate: '01/01/2026',
          endDate: '02/01/2026',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 500 when the listing does not exist', async () => {
    Listings.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.postBidDeadlines(
      {
        body: {
          listingId: 'missing',
          startDate: '01/01/2026',
          endDate: '02/01/2026',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
