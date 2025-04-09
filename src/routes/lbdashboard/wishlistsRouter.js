const express = require('express');

const routes = function (wishlist) {
  const wishlistRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/wishlistsController')(wishlist);

  // Test route
  wishlistRouter.route('/wishlist/test').get((req, res) => {
    res.status(200).send('Test route is working!');
  });

  // Route to get a single wishlist by ID
  wishlistRouter.route('/wishlist/:id').get(controller.getWishlistById);

  // Route to create a new wishlist
  wishlistRouter.route('/wishlist').post(controller.createWishlist);

  // Route to update a wishlist by ID
  wishlistRouter.route('/wishlist/:id').put(controller.updateWishlist);

  // Route to delete a wishlist by ID
  wishlistRouter.route('/wishlist/:id').delete(controller.deleteWishlist);

  // Route to add a listing to a user's wishlist
  wishlistRouter.route('/wishlist/add').post(controller.addListingToWishlist);

  // Route to retrieve a user's wishlist
  wishlistRouter.route('/wishlist/user/:userId').get(controller.getUserWishlist);

  return wishlistRouter;
};

module.exports = routes;