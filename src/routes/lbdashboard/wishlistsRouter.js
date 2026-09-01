const express = require('express');
const wishlistController = require('../../controllers/lbdashboard/wishlistsController');

const wishlistRouter = express.Router();

wishlistRouter.get('/wishlist', wishlistController.getWishlist);
wishlistRouter.post('/wishlist/add', wishlistController.addToWishlist);
wishlistRouter.delete('/wishlist/remove/:listingId', wishlistController.removeFromWishlist);

module.exports = wishlistRouter;
