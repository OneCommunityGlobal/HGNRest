jest.mock('../../models/lbdashboard/listings', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/lbdashboard/villages', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/lbdashboard/bidoverview/Notification', () => ({
  create: jest.fn(),
}));

const mockBidSave = jest.fn();
const mockBidSort = jest.fn();
const mockBidFindOne = jest.fn(() => ({ sort: mockBidSort }));

jest.mock('../../models/lbdashboard/bidoverview/Bid', () => {
  const FakeBid = jest.fn().mockImplementation(function bid(data) {
    Object.assign(this, data);
    this.save = mockBidSave;
  });
  FakeBid.findOne = (...args) => mockBidFindOne(...args);
  return FakeBid;
});

const Listing = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');
const Notification = require('../../models/lbdashboard/bidoverview/Notification');
const { getBidOverview, placeBid } = require('./bidOverviewController');

const VALID_LISTING_ID = '507f1f77bcf86cd799439011';
const VALID_USER_ID = '507f1f77bcf86cd799439012';
const OTHER_USER_ID = '507f1f77bcf86cd799439013';

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('bidOverviewController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBidSort.mockReset();
    res = createMockRes();
  });

  describe('getBidOverview', () => {
    it('returns 400 when the listing id is not a valid ObjectId', async () => {
      const req = { params: { id: 'not-an-object-id' } };

      await getBidOverview(req, res);

      expect(Listing.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid listing id' });
    });

    it('returns 404 when the listing cannot be found', async () => {
      Listing.findById.mockResolvedValue(null);
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(Listing.findById).toHaveBeenCalledWith(VALID_LISTING_ID);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing not found' });
    });

    it('returns listing details with empty village amenities when the listing has no village', async () => {
      const listing = {
        _id: VALID_LISTING_ID,
        title: 'Cabin',
        description: 'A cozy cabin',
        images: ['img.png'],
        amenities: ['wifi'],
        village: null,
        availableFrom: '2026-01-01',
        availableTo: '2026-02-01',
        price: 100,
      };
      Listing.findById.mockResolvedValue(listing);
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(Village.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        listingDetail: {
          id: listing._id,
          title: listing.title,
          description: listing.description,
          images: listing.images,
          unitAmenities: listing.amenities,
          villageAmenities: [],
          availableFrom: listing.availableFrom,
          availableTo: listing.availableTo,
          bidAmount: listing.price,
        },
      });
    });

    it('defaults bidAmount to 0 when the listing has no price', async () => {
      const listing = {
        _id: VALID_LISTING_ID,
        title: 'Cabin',
        village: null,
        price: undefined,
      };
      Listing.findById.mockResolvedValue(listing);
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingDetail: expect.objectContaining({ bidAmount: 0 }),
        }),
      );
    });

    it('includes village amenities when the village has an amenities array', async () => {
      const listing = {
        _id: VALID_LISTING_ID,
        title: 'Cabin',
        village: 'Willow Village',
        price: 50,
      };
      Listing.findById.mockResolvedValue(listing);
      Village.findOne.mockResolvedValue({ name: 'Willow Village', amenities: ['pool', 'gym'] });
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(Village.findOne).toHaveBeenCalledWith({ name: 'Willow Village' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingDetail: expect.objectContaining({ villageAmenities: ['pool', 'gym'] }),
        }),
      );
    });

    it('falls back to empty village amenities when the village is not found', async () => {
      const listing = {
        _id: VALID_LISTING_ID,
        title: 'Cabin',
        village: 'Unknown Village',
        price: 50,
      };
      Listing.findById.mockResolvedValue(listing);
      Village.findOne.mockResolvedValue(null);
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingDetail: expect.objectContaining({ villageAmenities: [] }),
        }),
      );
    });

    it('returns 500 when an unexpected error is thrown', async () => {
      Listing.findById.mockRejectedValue(new Error('DB down'));
      const req = { params: { id: VALID_LISTING_ID } };

      await getBidOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB down' });
    });
  });

  describe('placeBid', () => {
    const buildReq = (overrides = {}) => ({
      body: {
        user_id: VALID_USER_ID,
        property_id: VALID_LISTING_ID,
        bid_amount: 150,
        start_date: '2026-01-01',
        end_date: '2026-02-01',
        ...overrides,
      },
    });

    it('returns 400 when the user id or property id is invalid', async () => {
      const req = buildReq({ user_id: 'bad-id' });

      await placeBid(req, res);

      expect(Listing.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid user or property id' });
    });

    it('returns 404 when the property does not exist', async () => {
      Listing.findById.mockResolvedValue(null);
      const req = buildReq();

      await placeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Property not found' });
    });

    it('returns 400 when the bid is not higher than the listing price', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 200 });
      const req = buildReq({ bid_amount: 100 });

      await placeBid(req, res);

      expect(mockBidSave).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Your bid must be higher than the listed price (200).',
      });
    });

    it('places a bid and notifies the bidder when there is no existing highest bid', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 100 });
      mockBidSort.mockResolvedValue(null);
      mockBidSave.mockResolvedValue(true);
      Notification.create.mockResolvedValue({ message: 'notified' });
      const req = buildReq({ bid_amount: 150 });

      await placeBid(req, res);

      expect(mockBidFindOne).toHaveBeenCalledWith({ property_id: VALID_LISTING_ID });
      expect(mockBidSave).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Bid placed successfully',
          notifications: expect.arrayContaining([{ message: 'notified' }]),
        }),
      );
    });

    it('only sends the bid-placed notification when the bid is not the new highest', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 100 });
      mockBidSort.mockResolvedValue({ bid_amount: 500, user_id: OTHER_USER_ID });
      mockBidSave.mockResolvedValue(true);
      Notification.create.mockResolvedValue({ message: 'notified' });
      const req = buildReq({ bid_amount: 150 });

      await placeBid(req, res);

      expect(Notification.create).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('notifies the previous highest bidder when they are outbid by a different user', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 100 });
      mockBidSort.mockResolvedValue({ bid_amount: 120, user_id: OTHER_USER_ID });
      mockBidSave.mockResolvedValue(true);
      Notification.create.mockResolvedValue({ message: 'notified' });
      const req = buildReq({ bid_amount: 150 });

      await placeBid(req, res);

      expect(Notification.create).toHaveBeenCalledTimes(3);
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: OTHER_USER_ID,
          message: expect.stringContaining('outbid'),
        }),
      );
    });

    it('does not send an outbid notification when the same user already held the highest bid', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 100 });
      mockBidSort.mockResolvedValue({ bid_amount: 120, user_id: VALID_USER_ID });
      mockBidSave.mockResolvedValue(true);
      Notification.create.mockResolvedValue({ message: 'notified' });
      const req = buildReq({ bid_amount: 150 });

      await placeBid(req, res);

      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('returns 500 when saving the bid fails', async () => {
      Listing.findById.mockResolvedValue({ title: 'Cabin', price: 100 });
      mockBidSort.mockResolvedValue(null);
      mockBidSave.mockRejectedValue(new Error('save failed'));
      const req = buildReq({ bid_amount: 150 });

      await placeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'save failed' });
    });
  });
});
