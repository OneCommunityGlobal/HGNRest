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
const otherUserId = new mongoose.Types.ObjectId().toString();
const invalidId = 'not-an-objectid';

describe('wishlistController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = { query: {}, body: { requestor: { requestorId: validUserId } }, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── getWishlist ───────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('returns 401 when the requestor is missing', async () => {
      req.body = {};
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid requestor' });
    });

    it('ignores a different userId in the query and body', async () => {
      req.query.userId = otherUserId;
      req.body.userId = otherUserId;
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      await wishlistController.getWishlist(req, res);
      expect(Wishlist.findOne).toHaveBeenCalledWith({
        userId: new mongoose.Types.ObjectId(validUserId),
      });
    });

    it('returns 200 with empty listingId when no wishlist found', async () => {
      Wishlist.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      await wishlistController.getWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ listingId: [] });
    });

    it('returns 200 with wishlist data including villageAmenities', async () => {
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
    it('returns 401 when the requestor is missing', async () => {
      req.body = { listingId: validListingId };
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(Wishlist.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns 400 when listingId is missing', async () => {
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'listingId required' });
    });

    it('returns 400 when listingId is invalid ObjectId', async () => {
      req.body.listingId = invalidId;
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid listingId' });
    });

    it('returns 404 when listing does not exist', async () => {
      req.body.listingId = validListingId;
      Listing.findById.mockResolvedValue(null);
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing not found' });
    });

    it('atomically upserts the listing and returns the updated wishlist', async () => {
      const updated = { listingId: [validListingId] };
      req.body.listingId = validListingId;
      Listing.findById.mockResolvedValue({ _id: validListingId });
      Wishlist.findOneAndUpdate.mockResolvedValue(null);
      Wishlist.findOne.mockResolvedValue(updated);

      await wishlistController.addToWishlist(req, res);
      expect(Wishlist.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new mongoose.Types.ObjectId(validUserId) },
        { $addToSet: { listingId: new mongoose.Types.ObjectId(validListingId) } },
        { upsert: true, new: false },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('ignores a different userId in the body and query', async () => {
      req.body.userId = otherUserId;
      req.body.listingId = validListingId;
      req.query.userId = otherUserId;
      Listing.findById.mockResolvedValue({ _id: validListingId });
      Wishlist.findOneAndUpdate.mockResolvedValue(null);

      await wishlistController.addToWishlist(req, res);
      expect(Wishlist.findOneAndUpdate.mock.calls[0][0]).toEqual({
        userId: new mongoose.Types.ObjectId(validUserId),
      });
    });

    it('returns 409 when listing already in wishlist', async () => {
      req.body.listingId = validListingId;
      Listing.findById.mockResolvedValue({ _id: validListingId });
      Wishlist.findOneAndUpdate.mockResolvedValue({
        listingId: [new mongoose.Types.ObjectId(validListingId)],
      });

      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing already in wishlist' });
    });

    it('returns 500 on unexpected error', async () => {
      req.body.listingId = validListingId;
      Listing.findById.mockRejectedValue(new Error('DB error'));
      await wishlistController.addToWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error adding to wishlist' });
    });
  });

  // ─── removeFromWishlist ────────────────────────────────────────────────────

  describe('removeFromWishlist', () => {
    it('returns 401 when the requestor is missing', async () => {
      req.body = {};
      req.params = { listingId: validListingId };
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(Wishlist.findOne).not.toHaveBeenCalled();
    });

    it('returns 400 when listingId is missing', async () => {
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'listingId required' });
    });

    it('returns 400 when listingId is invalid ObjectId', async () => {
      req.params = { listingId: invalidId };
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid listingId' });
    });

    it('ignores a different userId in the body and query', async () => {
      req.body.userId = otherUserId;
      req.query.userId = otherUserId;
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockResolvedValue(null);
      await wishlistController.removeFromWishlist(req, res);
      expect(Wishlist.findOne).toHaveBeenCalledWith({
        userId: new mongoose.Types.ObjectId(validUserId),
      });
    });

    it('returns 404 when wishlist not found', async () => {
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockResolvedValue(null);
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Wishlist not found' });
    });

    it('returns 404 when listing not in wishlist', async () => {
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockResolvedValue({
        listingId: { some: () => false },
      });
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Listing not in wishlist' });
    });

    it('removes listing and returns 200', async () => {
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

    it('removes only the matching listing from the stored array', async () => {
      const otherId = new mongoose.Types.ObjectId();
      req.params = { listingId: validListingId };
      const mockWishlist = {
        listingId: [new mongoose.Types.ObjectId(validListingId), otherId],
        save: jest.fn().mockResolvedValue(),
      };
      Wishlist.findOne.mockResolvedValue(mockWishlist);

      await wishlistController.removeFromWishlist(req, res);
      expect(mockWishlist.listingId).toEqual([otherId]);
    });

    it('returns 500 on unexpected error', async () => {
      req.params = { listingId: validListingId };
      Wishlist.findOne.mockRejectedValue(new Error('DB error'));
      await wishlistController.removeFromWishlist(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error removing from wishlist' });
    });
  });
});
