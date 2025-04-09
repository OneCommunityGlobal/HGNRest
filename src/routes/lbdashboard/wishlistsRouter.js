const express = require('express');

const routes = function (wishlist) {
  const wishlistRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/wishlistsController')(wishlist);

  // Test route
  wishlistRouter.route('/wishlist/test').get((req, res) => {
    res.status(200).send('Test route is working again!');
  });


  // Route to create a new wishlist
  wishlistRouter.route('/wishlist').post(controller.createWishlist);

  // Route to get a single wishlist by ID
  wishlistRouter.route('/wishlist').get(controller.getWishlistById);

  // Route to add a listing to a user's wishlist
  wishlistRouter.route('/wishlist/add').post(controller.addListingToWishlist);

  // Route to remove a listing to a user's wishlist
  wishlistRouter.route('/wishlist/remove').post(controller.removeListingFromWishlist);

  // Route to retrieve a user's wishlist
  wishlistRouter.route('/wishlist/user').get(controller.getUserWishlist);

  return wishlistRouter;
};

module.exports = routes;