const mongoose = require('mongoose');
const Wishlist = require('../../models/lbdashboard/wishlists');
const Listing = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');
const logger = require('../../startup/logger');

const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;

const toObjectId = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const getRequestorObjectId = (req) => toObjectId(req.body.requestor?.requestorId);

const wishlistController = {
  getWishlist: async (req, res) => {
    try {
      const userObjectId = getRequestorObjectId(req);
      if (!userObjectId)
        return res.status(HTTP_UNAUTHORIZED).json({ message: 'Invalid requestor' });
      const wishlist = await Wishlist.findOne({ userId: userObjectId }).populate(
        'listingId',
        'title images description price amenities village',
      );

      if (!wishlist) return res.status(200).json({ listingId: [] });

      const listingsWithVillageAmenities = await Promise.all(
        wishlist.listingId.map(async (listing) => {
          let villageAmenities = [];
          if (listing.village) {
            const village = await Village.findOne({ name: String(listing.village) }).select(
              'amenities',
            );
            if (village) villageAmenities = village.amenities;
          }

          return {
            ...listing.toObject(),
            villageAmenities,
          };
        }),
      );

      res.status(200).json({
        ...wishlist.toObject(),
        listingId: listingsWithVillageAmenities,
      });
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ message: 'Error fetching wishlist' });
    }
  },

  addToWishlist: async (req, res) => {
    try {
      const userObjectId = getRequestorObjectId(req);
      if (!userObjectId)
        return res.status(HTTP_UNAUTHORIZED).json({ message: 'Invalid requestor' });
      const { listingId } = req.body;
      if (!listingId) return res.status(400).json({ message: 'listingId required' });
      const listingObjectId = toObjectId(listingId);
      if (!listingObjectId) return res.status(400).json({ message: 'Invalid listingId' });
      const listingHex = listingObjectId.toHexString();

      const listingExists = await Listing.findById(listingObjectId);
      if (!listingExists) return res.status(404).json({ message: 'Listing not found' });

      // The pre-update document shows whether this request or an earlier one added the listing
      const previous = await Wishlist.findOneAndUpdate(
        { userId: userObjectId },
        { $addToSet: { listingId: listingObjectId } },
        { upsert: true, new: false },
      );
      if (previous?.listingId.some((id) => String(id) === listingHex))
        return res.status(HTTP_CONFLICT).json({ message: 'Listing already in wishlist' });

      const wishlist = await Wishlist.findOne({ userId: userObjectId });
      res.status(200).json(wishlist);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ message: 'Error adding to wishlist' });
    }
  },

  removeFromWishlist: async (req, res) => {
    try {
      const userObjectId = getRequestorObjectId(req);
      if (!userObjectId)
        return res.status(HTTP_UNAUTHORIZED).json({ message: 'Invalid requestor' });
      const { listingId } = req.params;
      if (!listingId) return res.status(400).json({ message: 'listingId required' });
      const listingObjectId = toObjectId(listingId);
      if (!listingObjectId) return res.status(400).json({ message: 'Invalid listingId' });
      const listingHex = listingObjectId.toHexString();

      const wishlist = await Wishlist.findOne({ userId: userObjectId });
      if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

      if (!wishlist.listingId.some((id) => String(id) === listingHex))
        return res.status(404).json({ message: 'Listing not in wishlist' });

      wishlist.listingId = wishlist.listingId.filter((id) => String(id) !== listingHex);
      await wishlist.save();

      res.status(200).json({ message: 'Listing removed from wishlist' });
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ message: 'Error removing from wishlist' });
    }
  },
};

module.exports = wishlistController;
