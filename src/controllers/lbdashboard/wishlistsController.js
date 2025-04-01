const Wishlist = require('../../models/lbdashboard/wishlists');

// Get all wishlists
exports.getAllWishlists = async (req, res) => {
  try {
    const wishlists = await Wishlist.find().populate('createdBy', 'name email');
    res.status(200).json(wishlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wishlists' });
  }
};

// Get a single wishlist by ID
exports.getWishlistById = async (req, res) => {
  try {
    const wishlist = await Wishlist.findById(req.params.id).populate('createdBy', 'name email');
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }
    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
};

// Create a new wishlist
exports.createWishlist = async (req, res) => {
  try {
    const { name, description, items, createdBy } = req.body;
    const newWishlist = new Wishlist({ name, description, items, createdBy });
    const savedWishlist = await newWishlist.save();
    res.status(201).json(savedWishlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create wishlist' });
  }
};

// Update a wishlist by ID
exports.updateWishlist = async (req, res) => {
  try {
    const updatedWishlist = await Wishlist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedWishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }
    res.status(200).json(updatedWishlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
};

// Delete a wishlist by ID
exports.deleteWishlist = async (req, res) => {
  try {
    const deletedWishlist = await Wishlist.findByIdAndDelete(req.params.id);
    if (!deletedWishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }
    res.status(200).json({ message: 'Wishlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete wishlist' });
  }
};