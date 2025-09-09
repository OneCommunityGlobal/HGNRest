const WishlistsController = function (Wishlist) {
  const getWishlistById = async (req, res) => {
    try {
      const WishlistId = req.headers.id;
      if (!WishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const WishlistItem = await Wishlist.findById(WishlistId);
      if (!WishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      res.status(200).json(WishlistItem);
    } catch (error) {
      console.error('Error retrieving Wishlist:', error);
      res.status(500).json({ message: 'Error retrieving Wishlist', error: error.message });
    }
  };

  const createWishlist = async (req, res) => {
    try {
      const { WishlistListings, addedBy } = req.body;
      const newWishlist = new Wishlist({
        WishlistListings,
        addedBy,
      });
      const savedWishlist = await newWishlist.save();
      res.status(201).json(savedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error creating Wishlist', error });
    }
  };

  const addListingToWishlist = async (req, res) => {
    try {
      const WishlistId = req.headers.id;
      if (!WishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const { listingId } = req.body;
      if (!listingId) {
        return res.status(400).json({ message: 'Listing ID is required' });
      }
      const WishlistItem = await Wishlist.findById(WishlistId);
      if (!WishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }

      const existingListing = WishlistItem.WishlistListings.find(
        (id) => id.toString() === listingId.toString(),
      );
      if (existingListing) {
        return res.status(400).json({ message: 'Listing already in Wishlist' });
      }

      WishlistItem.WishlistListings.push(listingId);
      const updatedWishlist = await WishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error adding listing to Wishlist', error });
    }
  };

  const removeListingFromWishlist = async (req, res) => {
    try {
      const WishlistId = req.headers.id;
      if (!WishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const { listingId } = req.body;
      if (!listingId) {
        return res.status(400).json({ message: 'Listing ID is required' });
      }
      const WishlistItem = await Wishlist.findById(WishlistId);
      if (!WishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }

      const listingExists = WishlistItem.WishlistListings.find(
        (id) => id.toString() === listingId.toString(),
      );
      if (!listingExists) {
        return res.status(404).json({ message: 'Listing not found in Wishlist' });
      }

      WishlistItem.WishlistListings = WishlistItem.WishlistListings.filter(
        (id) => id.toString() !== listingId.toString(),
      );
      const updatedWishlist = await WishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error removing listing from Wishlist', error });
    }
  };

  const getUserWishlist = async (req, res) => {
    try {
      const userId = req.headers.userid; // Extract userId from headers
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required in headers' });
      }
      const userWishlist = await Wishlist.find({ addedBy: userId }); // No populate()
      if (!userWishlist || userWishlist.length === 0) {
        return res.status(404).json({ message: 'No Wishlist found for this user' });
      }
      res.status(200).json(userWishlist);
    } catch (error) {
      console.error('Error retrieving user Wishlist:', error); // Log the error for debugging
      res.status(500).json({ message: 'Error retrieving user Wishlist', error: error.message });
    }
  };

  return {
    getWishlistById,
    createWishlist,
    addListingToWishlist,
    removeListingFromWishlist,
    getUserWishlist,
  };
};

module.exports = WishlistsController;
