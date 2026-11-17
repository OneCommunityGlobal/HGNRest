const mongoose = require('mongoose');
const Wishlist = require('../../models/lbdashboard/wishlists');
const Listing = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');
const logger = require('../../startup/logger');

const HTTP_CONFLICT = 409;

const toObjectId = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const wishlistController = {
  getWishlist: async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ message: 'userId is required' });
      const userObjectId = toObjectId(userId);
      if (!userObjectId) return res.status(400).json({ message: 'Invalid userId' });
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
      const { userId, listingId } = req.body;
      if (!userId || !listingId)
        return res.status(400).json({ message: 'userId and listingId required' });
      const userObjectId = toObjectId(userId);
      const listingObjectId = toObjectId(listingId);
      const listingHex = listingObjectId ? listingObjectId.toHexString() : null;
      if (!userObjectId || !listingObjectId)
        return res.status(400).json({ message: 'Invalid userId or listingId' });

      const listingExists = await Listing.findById(listingObjectId);
      if (!listingExists) return res.status(404).json({ message: 'Listing not found' });

      let wishlist = await Wishlist.findOne({ userId: userObjectId });
      if (!wishlist)
        wishlist = new Wishlist({ userId: userObjectId, listingId: [listingObjectId] });
      else if (wishlist.listingId.some((id) => String(id) === listingHex))
        return res.status(HTTP_CONFLICT).json({ message: 'Listing already in wishlist' });
      else wishlist.listingId.push(listingObjectId);

      await wishlist.save();
      res.status(200).json(wishlist);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ message: 'Error adding to wishlist' });
    }
  },

  removeFromWishlist: async (req, res) => {
    try {
      const { userId } = req.body;
      const { listingId } = req.params;
      if (!userId || !listingId)
        return res.status(400).json({ message: 'userId and listingId required' });
      const userObjectId = toObjectId(userId);
      const listingObjectId = toObjectId(listingId);
      const listingHex = listingObjectId ? listingObjectId.toHexString() : null;
      if (!userObjectId || !listingObjectId)
        return res.status(400).json({ message: 'Invalid userId or listingId' });

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
