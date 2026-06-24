const Wishlist = require('../../models/lbdashboard/wishlists');
const Listing = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');

const wishlistController = {
  getWishlist: async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ message: 'userId is required' });
      const wishlist = await Wishlist.findOne({ userId }).populate(
        'listingId',
        'title images description price amenities village',
      );

      if (!wishlist) return res.status(200).json({ listingId: [] });

      const listingsWithVillageAmenities = await Promise.all(
        wishlist.listingId.map(async (listing) => {
          let villageAmenities = [];
          if (listing.village) {
            const village = await Village.findOne({ name: listing.village }).select('amenities');
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
      console.error(error);
      res.status(500).json({ message: 'Error fetching wishlist' });
    }
  },

  addToWishlist: async (req, res) => {
    try {
      const { userId } = req.body;
      const { listingId } = req.body;
      if (!userId || !listingId)
        return res.status(400).json({ message: 'userId and listingId required' });

      const listingExists = await Listing.findById(listingId);
      if (!listingExists) return res.status(404).json({ message: 'Listing not found' });

      let wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) wishlist = new Wishlist({ userId, listingId: [listingId] });
      else if (wishlist.listingId.some((id) => id.toString() === listingId))
        return res.status(409).json({ message: 'Listing already in wishlist' });
      else wishlist.listingId.push(listingId);

      await wishlist.save();
      res.status(200).json(wishlist);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error adding to wishlist' });
    }
  },

  removeFromWishlist: async (req, res) => {
    try {
      const { userId } = req.body;
      const { listingId } = req.params;
      if (!userId || !listingId)
        return res.status(400).json({ message: 'userId and listingId required' });

      const wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

      if (!wishlist.listingId.some((id) => id.toString() === listingId))
        return res.status(404).json({ message: 'Listing not in wishlist' });

      wishlist.listingId = wishlist.listingId.filter((id) => id.toString() !== listingId);
      await wishlist.save();

      res.status(200).json({ message: 'Listing removed from wishlist' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error removing from wishlist' });
    }
  },
};

module.exports = wishlistController;
