const wishlistsController = function (wishlist) {
  const getWishlistById = async (req, res) => {
    try {
      const wishlistItem = await wishlist.findById(req.params.id).populate('wishlistVillageListing addedBy');
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      res.status(200).json(wishlistItem);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving wishlist', error });
    }
  };

  const createWishlist = async (req, res) => {
    try {
      const { wishlistVillageListing, addedBy } = req.body;
      const newWishlist = new wishlist({
        wishlistVillageListing,
        addedBy,
      });
      const savedWishlist = await newWishlist.save();
      res.status(201).json(savedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error creating wishlist', error });
    }
  };

  const updateWishlist = async (req, res) => {
    try {
      const { wishlistVillageListing, addedBy } = req.body;
      const updatedWishlist = await wishlist.findByIdAndUpdate(
        req.params.id,
        { wishlistVillageListing, addedBy },
        { new: true, runValidators: true }
      );
      if (!updatedWishlist) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error updating wishlist', error });
    }
  };

  const deleteWishlist = async (req, res) => {
    try {
      const deletedWishlist = await wishlist.findByIdAndDelete(req.params.id);
      if (!deletedWishlist) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      res.status(200).json({ message: 'Wishlist deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting wishlist', error });
    }
  };

  const addListingToWishlist = async (req, res) => {
    try {
      const { wishlistId, wishlistVillageListing } = req.body;
      const wishlistItem = await wishlist.findById(wishlistId);
      if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist not found' });
      }
      wishlistItem.wishlistVillageListing = wishlistVillageListing;
      const updatedWishlist = await wishlistItem.save();
      res.status(200).json(updatedWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error adding listing to wishlist', error });
    }
  };

  const getUserWishlist = async (req, res) => {
    try {
      const userWishlist = await wishlist.find({ addedBy: req.params.userId }).populate('wishlistVillageListing');
      if (!userWishlist || userWishlist.length === 0) {
        return res.status(404).json({ message: 'No wishlist found for this user' });
      }
      res.status(200).json(userWishlist);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving user wishlist', error });
    }
  };

  return {
    getWishlistById,
    createWishlist,
    updateWishlist,
    deleteWishlist,
    addListingToWishlist,
    getUserWishlist,
  };
};

module.exports = wishlistsController;