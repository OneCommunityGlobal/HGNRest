const express = require('express');
const router = express.Router();
const wishlistsController = require('../../controllers/lbdashboard/wishlistsController');

// Route to get all wishlists
router.get('/', wishlistsController.getAllWishlists);

// Route to get a single wishlist by ID
router.get('/:id', wishlistsController.getWishlistById);

// Route to create a new wishlist
router.post('/', wishlistsController.createWishlist);

// Route to update a wishlist by ID
router.put('/:id', wishlistsController.updateWishlist);

// Route to delete a wishlist by ID
router.delete('/:id', wishlistsController.deleteWishlist);

module.exports = router;