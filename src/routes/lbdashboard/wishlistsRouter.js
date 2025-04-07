const express = require('express');
const router = express.Router();
const wishlistsController = require('../../controllers/lbdashboard/wishlistsController');
const authenticate = require('../../middleware/authenticate'); // Middleware for user authentication

// Route to get all wishlists (Admin or general use)
router.get('/', authenticate, wishlistsController.getAllWishlists);

// Route to get a single wishlist by ID
router.get('/:id', authenticate, wishlistsController.getWishlistById);

// Route to create a new wishlist
router.post('/', authenticate, wishlistsController.createWishlist);

// Route to update a wishlist by ID
router.put('/:id', authenticate, wishlistsController.updateWishlist);

// Route to delete a wishlist by ID
router.delete('/:id', authenticate, wishlistsController.deleteWishlist);

// Route to add a listing to a user's wishlist
router.post('/add', authenticate, wishlistsController.addListingToWishlist);

// Route to remove a listing from a user's wishlist
router.post('/remove', authenticate, wishlistsController.removeListingFromWishlist);

// Route to retrieve a user's wishlist
router.get('/user/:userId', authenticate, wishlistsController.getUserWishlist);

module.exports = router;