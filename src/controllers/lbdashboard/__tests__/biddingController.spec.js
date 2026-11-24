const mongoose = require('mongoose');
const biddingController = require('../biddingController');

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

describe('biddingController getBidListings', () => {
  let Bidding;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    Bidding = {
      countDocuments: jest.fn(),
      find: jest.fn(),
    };
    controller = biddingController(Bidding);
  });

  it('reads pagination from req.query, not req.headers', async () => {
    const chain = makeQueryChain([{ _id: 'bid1', title: 'Test Listing' }]);
    Bidding.find.mockReturnValue(chain);
    Bidding.countDocuments.mockResolvedValue(10);

    const req = {
      query: { page: '2', size: '5' },
      headers: { page: '99', size: '99' },
    };

    await controller.getBidListings(req, mockRes());

    // skip = (page - 1) * size = (2 - 1) * 5 = 5
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('defaults to page 1 / size 10 when no query params are given', async () => {
    const chain = makeQueryChain([]);
    Bidding.find.mockReturnValue(chain);
    Bidding.countDocuments.mockResolvedValue(0);

    await controller.getBidListings({ query: {}, headers: {} }, mockRes());

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('populates the village field (not the non-existent "villages" path) with its name', async () => {
    const chain = makeQueryChain([]);
    Bidding.find.mockReturnValue(chain);
    Bidding.countDocuments.mockResolvedValue(0);

    await controller.getBidListings({ query: {}, headers: {} }, mockRes());

    expect(chain.populate).toHaveBeenCalledWith(
      expect.arrayContaining([{ path: 'village', select: '_id name' }]),
    );
  });

  it('filters by village from req.query.village', async () => {
    const chain = makeQueryChain([]);
    Bidding.find.mockReturnValue(chain);
    Bidding.countDocuments.mockResolvedValue(0);
    const villageId = new mongoose.Types.ObjectId().toString();

    await controller.getBidListings({ query: { village: villageId }, headers: {} }, mockRes());

    expect(Bidding.find).toHaveBeenCalledWith(
      expect.objectContaining({ village: expect.anything() }),
    );
  });

  it('rejects an invalid village id from req.query', async () => {
    const res = mockRes();

    await controller.getBidListings({ query: { village: 'not-an-object-id' }, headers: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid village id' });
  });
});
