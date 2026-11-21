const listingsController = require('../listingsController');

const makeQueryChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(result);
  return chain;
};

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('listingsController getListings', () => {
  let ListingHome;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    ListingHome = {
      countDocuments: jest.fn(),
      find: jest.fn(),
    };
    controller = listingsController(ListingHome);
  });

  it('reads pagination from req.query, not req.headers', async () => {
    const chain = makeQueryChain([]);
    ListingHome.find.mockReturnValue(chain);
    ListingHome.countDocuments.mockResolvedValue(10);

    const req = {
      query: { page: '2', size: '5' },
      headers: { page: '99', size: '99' },
    };

    await controller.getListings(req, mockRes());

    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('reads the village and date-range filters from req.query', async () => {
    const chain = makeQueryChain([]);
    ListingHome.find.mockReturnValue(chain);
    ListingHome.countDocuments.mockResolvedValue(0);

    const req = {
      query: {
        village: 'village1',
        availableFrom: '2026-01-01',
        availableTo: '2026-02-01',
      },
      headers: {},
    };

    await controller.getListings(req, mockRes());

    expect(ListingHome.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        village: 'village1',
        $and: expect.any(Array),
      }),
    );
  });

  it('defaults to page 1 / size 10 when no query params are given', async () => {
    const chain = makeQueryChain([]);
    ListingHome.find.mockReturnValue(chain);
    ListingHome.countDocuments.mockResolvedValue(0);

    await controller.getListings({ query: {}, headers: {} }, mockRes());

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});
