jest.mock('../../models/lbdashboard/wishlists');
jest.mock('../../models/lbdashboard/listings');
jest.mock('../../models/lbdashboard/villages');

const mongoose = require('mongoose');
const Wishlist = require('../../models/lbdashboard/wishlists');
const Listing = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');
const wishlistController = require('./wishlistsController');

const validUserId = new mongoose.Types.ObjectId().toString();
const validListingId = new mongoose.Types.ObjectId().toString();
const invalidId = 'not-an-objectid';

describe('wishlistController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = { query: {}, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── getWishlist ───────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('returns 400 when userId is missing', async () => {
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'userId is required' });
    });

    it('returns 400 when userId is invalid ObjectId', async () => {
      req.query.userId = invalidId;
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userId' });
    });

    it('returns 200 with empty listingId when no wishlist found', async () => {
      req.query.userId = validUserId;
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ listingId: [] });
    });

    it('returns 200 with wishlist data including villageAmenities', async () => {
      req.query.userId = validUserId;
      const mockListing = {
        village: 'Cob Village',
        toObject: () => ({ title: 'Test', village: 'Cob Village' }),
      };
      const mockWishlist = {
        listingId: [mockListing],
        toObject: () => ({ userId: validUserId, listingId: [] }),
      };
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockWishlist) });
      Village.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ amenities: ['Solar', 'Water'] }),
      });

      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: expect.arrayContaining([
            expect.objectContaining({ villageAmenities: ['Solar', 'Water'] }),
          ]),
        }),
      );
    });

    it('returns 200 with empty villageAmenities when listing has no village', async () => {
      req.query.userId = validUserId;
      const mockListing = {
        village: null,
        toObject: () => ({ title: 'Test', village: null }),
      };
      const mockWishlist = {
        listingId: [mockListing],
        toObject: () => ({ userId: validUserId }),
      };
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockWishlist) });

      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: [expect.objectContaining({ villageAmenities: [] })],
        }),
      );
    });

    it('returns 200 with empty villageAmenities when village not found in DB', async () => {
      req.query.userId = validUserId;
      const mockListing = {
        village: 'Ghost Village',
        toObject: () => ({ title: 'Test', village: 'Ghost Village' }),
      };
      const mockWishlist = {
        listingId: [mockListing],
        toObject: () => ({ userId: validUserId }),
      };
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockWishlist) });
      Village.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await wishlistController.getWishlist(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: [expect.objectContaining({ villageAmenities: [] })],
        }),
      );
    });

    it('returns 500 on unexpected error', async () => {
      req.query.userId = validUserId;
      Wishlist.findOne.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching wishlist' });
    });
  });

  // ─── addToWishlist ─────────────────────────────────────────────────────────

  describe('addToWishlist', () => {
    it('returns 400 when userId or listingId is missing', async () => {
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'userId and listingId required' });
    });

    it('returns 400 when userId is invalid ObjectId', async () => {
      req.body = { userId: invalidId, listingId: validListingId };
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userId or listingId' });
    });

    it('returns 400 when listingId is invalid ObjectId', async () => {
      req.body = { userId: validUserId, listingId: invalidId };
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userId or listingId' });
    });

    it('returns 404 when listing does not exist', async () => {
      req.body = { userId: validUserId, listingId: validListingId };
      Listing.findById.mockResolvedValue(null);
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing not found' });
    });

    it('creates new wishlist when user has none', async () => {
      req.body = { userId: validUserId, listingId: validListingId };
      Listing.findById.mockResolvedValue({ _id: validListingId });
      Wishlist.findOne.mockResolvedValue(null);
      const mockSave = jest.fn().mockResolvedValue();
      Wishlist.mockImplementation(() => ({ save: mockSave, listingId: [validListingId] }));

      await wishlistController.addToWishlist(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 409 when listing already in wishlist', async () => {
      req.body = { userId: validUserId, listingId: validListingId };
      Listing.findById.mockResolvedValue({ _id: validListingId });
      Wishlist.findOne.mockResolvedValue({
        listingId: { some: () => true },
      });

      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing already in wishlist' });
    });

    it('pushes listingId and saves when wishlist exists without the listing', async () => {
      req.body = { userId: validUserId, listingId: validListingId };
      Listing.findById.mockResolvedValue({ _id: validListingId });
      const mockPush = jest.fn();
      const mockSave = jest.fn().mockResolvedValue();
      const mockWishlist = {
        listingId: { some: () => false, push: mockPush },
        save: mockSave,
      };
      Wishlist.findOne.mockResolvedValue(mockWishlist);

      await wishlistController.addToWishlist(req, res);
      expect(mockPush).toHaveBeenCalledWith(validListingId);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 on unexpected error', async () => {
      req.body = { userId: validUserId, listingId: validListingId };
      Listing.findById.mockRejectedValue(new Error('DB error'));
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error adding to wishlist' });
    });
  });

  // ─── removeFromWishlist ────────────────────────────────────────────────────

  describe('removeFromWishlist', () => {
    it('returns 400 when userId or listingId is missing', async () => {
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'userId and listingId required' });
    });

    it('returns 400 when userId is invalid ObjectId', async () => {
      req.body = { userId: invalidId };
      req.params = { listingId: validListingId };
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userId or listingId' });
    });

    it('returns 400 when listingId is invalid ObjectId', async () => {
      req.body = { userId: validUserId };
      req.params = { listingId: invalidId };
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userId or listingId' });
    });

    it('returns 404 when wishlist not found', async () => {
      req.body = { userId: validUserId };
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockResolvedValue(null);
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Wishlist not found' });
    });

    it('returns 404 when listing not in wishlist', async () => {
      req.body = { userId: validUserId };
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockResolvedValue({
        listingId: { some: () => false },
      });
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing not in wishlist' });
    });

    it('removes listing and returns 200', async () => {
      req.body = { userId: validUserId };
      req.params = { listingId: validListingId };
      const mockSave = jest.fn().mockResolvedValue();
      const mockWishlist = {
        listingId: {
          some: () => true,
          filter: jest.fn().mockReturnValue([]),
        },
        save: mockSave,
      };
      Wishlist.findOne.mockResolvedValue(mockWishlist);

      await wishlistController.removeFromWishlist(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing removed from wishlist' });
    });

    it('returns 500 on unexpected error', async () => {
      req.body = { userId: validUserId };
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockRejectedValue(new Error('DB error'));
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error removing from wishlist' });
    });
  });
});
