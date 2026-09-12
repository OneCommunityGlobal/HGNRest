const mongoose = require('mongoose');
const Listings = require('../../models/lbdashboard/listings');
const village = require('../../models/lbdashboard/villages');
const Bookings = require('../../models/lbdashboard/listingAvailability');

const listOverviewController = function () {
  const getListOverview = async (req, res) => {
    try {
      const listingId = req.params.id;
      // validate listingId
      if (!listingId) {
        return res
          .status(400)
          .json({ message: ' Listing Id is missing , please provide the listingId' });
      }
      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ message: 'Invalid listingId format' });
      }
      const safeListingId = new mongoose.Types.ObjectId(listingId);
      // check if listing exists
      const listing = await Listings.findById(safeListingId);
      if (!listing) {
        return res.status(400).json({ message: "Couldn't find listing for the given listingId" });
      }
      // fetch village level amenities
      const villageName = listing.village;
      const villageAmenities = await village
        .findOne({ name: villageName })
        .select('-_id -__v -name');
      if (!villageAmenities) {
        return res
          .status(400)
          .json({ message: "Couldn't find village amenities for the given listingId" });
      }
      // prepare response
      const response = {
        listingId: listing._id,
        title: listing.title,
        images: listing.images,
        unitAmenities: listing.amenities,
        villageAmenities: villageAmenities.amenities,
        price: listing.price,
      };
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  };

  const submitBooking = async (req, res) => {
    try {
      const { listingId, rentingFrom, rentingTill } = req.body;
      // validate input
      if (!listingId || !rentingFrom || !rentingTill) {
        return res
          .status(400)
          .json({ message: 'Missing required fields: listingId, rentingFrom, rentingTill' });
      }
      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ message: 'Invalid listingId format' });
      }
      const safeListingId = new mongoose.Types.ObjectId(listingId);
      // check if listing exists
      const listing = await Listings.findById(safeListingId);
      if (!listing) {
        return res.status(400).json({ message: "Couldn't find listing for the given listingId" });
      }
      // validate date range
      const fromDate = new Date(rentingFrom);
      const tillDate = new Date(rentingTill);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date value for rentingFrom' });
      }
      if (Number.isNaN(tillDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date value for rentingTill' });
      }
      if (fromDate >= tillDate) {
        return res
          .status(400)
          .json({ message: 'Invalid date range: rentingFrom should be before rentingTill' });
      }
      // check for booking conflicts
      const conflictingBooking = await Bookings.findOne({
        listingId: safeListingId,
        rentingFrom: { $lt: tillDate },
        rentingTill: { $gt: fromDate },
      });

      if (conflictingBooking) {
        return res.status(409).json({
          message: 'Booking conflict: The listing is already booked for the selected dates',
        });
      }
      // create booking
      const newBooking = new Bookings({
        listingId: safeListingId,
        rentingFrom: new Date(rentingFrom),
        rentingTill: new Date(rentingTill),
      });
      await newBooking.save();
      return res
        .status(201)
        .json({ message: 'Booking submitted successfully', bookingId: newBooking._id });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  };

  return {
    getListOverview,
    submitBooking,
  };
};
module.exports = listOverviewController();
