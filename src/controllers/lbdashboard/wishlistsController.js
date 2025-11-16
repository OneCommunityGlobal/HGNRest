const wishlistsController = function (Wishlist) {
  //  Helper: check ownership
  const checkOwnership = (wishlistItem, requestor, res) => {
    // Allow admins to bypass ownership check
    if (requestor.role === 'admin') return true;

    // Check both addedBy and createdBy
    const ownsWishlist =
      wishlistItem.addedBy.toString() === requestor.requestorId.toString() ||
      wishlistItem.createdBy.toString() === requestor.requestorId.toString();

    if (!ownsWishlist) {
      res.status(403).json({ message: 'Forbidden: You do not own this wishlist' });
      return false;
    }
    return true;
  };

  //  Get wishlist by ID
  const getWishlistById = async (req, res) => {
    try {
      const wishlistId = req.headers.id;
      if (!wishlistId)
        return res.status(400).json({ message: 'Wishlist ID or createdBy is required in headers' });

      // Try to find by _id first
      let wishlistItem = await Wishlist.findById(wishlistId);

      // If not found, try by createdBy
      if (!wishlistItem) {
        wishlistItem = await Wishlist.findOne({ createdBy: wishlistId });
      }

      if (!wishlistItem) return res.status(404).json({ message: 'Wishlist not found' });

      //  Authorization check
      if (!checkOwnership(wishlistItem, req.body.requestor, res)) return;

      res.status(200).json(wishlistItem);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving wishlist', error: error.message });
    }
  };

  //  Create wishlist
  const createWishlist = async (req, res) => {
    try {
      const { wishlistListings, createdBy } = req.body;
      const { requestorId } = req.body.requestor;

      if (!createdBy) {
        return res.status(400).json({ message: 'createdBy is required' });
      }

      //  Check if this user already created a wishlist for this same createdBy
      const wishlistItem = await Wishlist.findOne({
        createdBy,
        addedBy: requestorId,
      });

      if (wishlistItem) {
        return res.status(409).json({ message: 'Wishlist already exists for this user' });
      }

      //  Otherwise, create a new wishlist
      const newWishlist = new Wishlist({
        wishlistListings,
        createdBy,
        addedBy: requestorId, // Ownership from JWT
      });

      const savedWishlist = await newWishlist.save();
      res.status(201).json(savedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error creating wishlist', error: error.message });
    }
  };

  //  Add listing
  const addListingToWishlist = async (req, res) => {
    try {
      const wishlistId = req.headers.id;
      const { listingId } = req.body;

      if (!wishlistId || !listingId)
        return res.status(400).json({ message: 'Wishlist ID and listing ID are required' });

      const wishlistItem = await Wishlist.findById(wishlistId);
      if (!wishlistItem) return res.status(404).json({ message: 'Wishlist not found' });

      if (!checkOwnership(wishlistItem, req.body.requestor, res)) return;

      if (wishlistItem.wishlistListings.includes(listingId))
        return res.status(400).json({ message: 'Listing already exists in wishlist' });

      wishlistItem.wishlistListings.push(listingId);
      const updatedWishlist = await wishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error adding listing', error: error.message });
    }
  };

  //  Remove listing
  const removeListingFromWishlist = async (req, res) => {
    try {
      const wishlistId = req.headers.id;
      const { listingId } = req.body;

      if (!wishlistId || !listingId)
        return res.status(400).json({ message: 'Wishlist ID and listing ID are required' });

      const wishlistItem = await Wishlist.findById(wishlistId);
      if (!wishlistItem) return res.status(404).json({ message: 'Wishlist not found' });

      if (!checkOwnership(wishlistItem, req.body.requestor, res)) return;

      const listingIndex = wishlistItem.wishlistListings.indexOf(listingId);
      if (listingIndex === -1)
        return res.status(404).json({ message: 'Listing not found in wishlist' });

      wishlistItem.wishlistListings.splice(listingIndex, 1);
      const updatedWishlist = await wishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error removing listing from wishlist', error: error.message });
    }
  };

  //  Get wishlist(s) by createdBy or logged-in user
  const getUserWishlist = async (req, res) => {
    try {
      const { requestorId } = req.body.requestor;

      const userWishlist = await Wishlist.find({
        $or: [{ addedBy: requestorId }, { createdBy: requestorId }],
      });

      if (!userWishlist.length)
        return res.status(404).json({ message: 'No wishlist found for this user' });

      res.status(200).json(userWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving user wishlist', error: error.message });
    }
  };

  //  Delete entire wishlist by ID
  const deleteWishlist = async (req, res) => {
    try {
      const wishlistId = req.headers.id;
      if (!wishlistId) {
        return res.status(400).json({ message: 'Wishlist ID is required in headers' });
      }

      // Find the wishlist
      const wishlistItem = await Wishlist.findById(wishlistId);
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }

      //  Authorization: only allow owner or admin to delete
      if (!checkOwnership(wishlistItem, req.body.requestor, res)) return;

      // Delete the wishlist
      await Wishlist.findByIdAndDelete(wishlistId);

      res.status(200).json({ message: 'Wishlist deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting wishlist', error: error.message });
    }
  };

  return {
    getWishlistById,
    createWishlist,
    addListingToWishlist,
    removeListingFromWishlist,
    getUserWishlist,
    deleteWishlist,
  };
};

module.exports = wishlistsController;
