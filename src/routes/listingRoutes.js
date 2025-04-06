const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listingController");
const { uploadMultiple } = require("../helpers/imageHelper"); // Import helper

router.get("/lbdashboard/biddinghome", listingController.getListings);
router.get("/lbdashboard/biddinghome/:id", listingController.getListingById);
router.post("/lbdashboard/biddinghome/", uploadMultiple("images", 5), listingController.createListing);
router.put("/lbdashboard/biddinghome/:id", uploadMultiple("images", 5), listingController.updateListing);
router.delete("/lbdashboard/biddinghome/:id", listingController.deleteListing);

module.exports = router;
