const userBidNotificationController = require('./userBidNotificationController');

const VALID_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f191e810c19729de860ea';

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Fake models: only the methods placeBid actually calls
const makeModels = ({ listing = { currentPrice: 40 } } = {}) => {
  const select = jest.fn().mockResolvedValue(listing);
  return {
    Bid: { create: jest.fn().mockImplementation(async (data) => ({ _id: 'bid1', ...data })) },
    List: {
      findById: jest.fn().mockReturnValue({ select }),
      updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
    },
    User: {},
    Notification: { create: jest.fn().mockResolvedValue({}) },
  };
};

const makeReq = (overrides = {}) => ({
  params: { id: VALID_ID },
  body: {
    name: 'Test User',
    startDate: '2026-12-10',
    endDate: '2026-12-15',
    bidAmount: 50,
    requestor: { requestorId: USER_ID },
    ...overrides,
  },
});

describe('userBidNotificationController.placeBid', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
  });

  const run = async (models, req) => {
    const { Bid, List, User, Notification } = models;
    const controller = userBidNotificationController(Bid, List, User, Notification);
    await controller.placeBid(req, res);
  };

  it('places a bid and raises currentPrice when bid is higher', async () => {
    const models = makeModels();
    await run(models, makeReq());

    expect(models.Bid.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, property_id: VALID_ID, bid_amount: 50 }),
    );
    expect(models.List.updateOne).toHaveBeenCalledWith(
      { _id: VALID_ID, currentPrice: { $lt: 50 } },
      { $set: { currentPrice: 50 } },
    );
    expect(models.Notification.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 401 when there is no logged-in requestor', async () => {
    const models = makeModels();
    await run(models, makeReq({ requestor: undefined }));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(models.Bid.create).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-ObjectId property id like "403"', async () => {
    const models = makeModels();
    const req = makeReq();
    req.params.id = '403';
    await run(models, req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(models.List.findById).not.toHaveBeenCalled();
  });

  it('returns 400 when endDate is not after startDate', async () => {
    const models = makeModels();
    await run(models, makeReq({ startDate: '2026-12-15', endDate: '2026-12-10' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(models.Bid.create).not.toHaveBeenCalled();
  });

  it('returns 400 when bidAmount is missing or not positive', async () => {
    const models = makeModels();
    await run(models, makeReq({ bidAmount: 0 }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(models.Bid.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the property does not exist', async () => {
    const models = makeModels({ listing: null });
    await run(models, makeReq());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(models.Bid.create).not.toHaveBeenCalled();
  });

  it('returns 400 when bid is not higher than currentPrice', async () => {
    const models = makeModels({ listing: { currentPrice: 60 } });
    await run(models, makeReq({ bidAmount: 50 }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(models.Bid.create).not.toHaveBeenCalled();
  });

  it('returns 500 when the database throws', async () => {
    const models = makeModels();
    models.List.findById.mockImplementation(() => {
      throw new Error('db down');
    });
    await run(models, makeReq());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
