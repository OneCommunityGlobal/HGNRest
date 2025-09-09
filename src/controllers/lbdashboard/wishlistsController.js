const wishlistsController = function (wishlist) {
  const getWishlistById = async (req, res) => {
    try {
      const wishlistId = req.headers.id;
      if (!wishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const wishlistItem = await wishlist.findById(wishlistId); 
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      res.status(200).json(wishlistItem);
    } catch (error) {
      console.error('Error retrieving wishlist:', error); 
      res.status(500).json({ message: 'Error retrieving wishlist', error: error.message });
    }
  };

  const createWishlist = async (req, res) => {
    try {
      const { wishlistListings, addedBy } = req.body;
      const newWishlist = new wishlist({
        wishlistListings,
        addedBy,
      });
      const savedWishlist = await newWishlist.save();
      res.status(201).json(savedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error creating wishlist', error });
    }
  };

  const addListingToWishlist = async (req, res) => {
    try {
      const wishlistId = req.headers.id; 
      if (!wishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const { listingId } = req.body;
      if (!listingId) {
        return res.status(400).json({ message: 'Listing ID is required' });
      }
      const wishlistItem = await wishlist.findById(wishlistId);
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      
      const existingListing = wishlistItem.wishlistListings.find(
        (id) => id.toString() === listingId.toString()
      );
      if (existingListing) {
        return res.status(400).json({ message: 'Listing already in wishlist' });
      }
      
      wishlistItem.wishlistListings.push(listingId);
      const updatedWishlist = await wishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error adding listing to wishlist', error });
    }
  };

  const removeListingFromWishlist = async (req, res) => {
    try {
      const wishlistId = req.headers.id; 
      if (!wishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }
      const { listingId } = req.body;
      if (!listingId) {
        return res.status(400).json({ message: 'Listing ID is required' });
      }
      const wishlistItem = await wishlist.findById(wishlistId);
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      
      const listingExists = wishlistItem.wishlistListings.find(
        (id) => id.toString() === listingId.toString()
      );
      if (!listingExists) {
        return res.status(404).json({ message: 'Listing not found in wishlist' });
      }
      
      wishlistItem.wishlistListings = wishlistItem.wishlistListings.filter(
        (id) => id.toString() !== listingId.toString()
      );
      const updatedWishlist = await wishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error removing listing from wishlist', error });
    }
  };

  const getUserWishlist = async (req, res) => {
    try {
      const userId = req.headers.userid; // Extract userId from headers
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required in headers' });
      }
      const userWishlist = await wishlist.find({ addedBy: userId }); // No populate()
      if (!userWishlist || userWishlist.length === 0) {
        return res.status(404).json({ message: 'No wishlist found for this user' });
      }
      res.status(200).json(userWishlist);
    } catch (error) {
      console.error('Error retrieving user wishlist:', error); // Log the error for debugging
      res.status(500).json({ message: 'Error retrieving user wishlist', error: error.message });
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

module.exports = wishlistsController;