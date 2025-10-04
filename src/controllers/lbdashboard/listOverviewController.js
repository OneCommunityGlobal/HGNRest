const Listings = require('../../models/lbdashboard/listings');
const village = require('../../models/lbdashboard/villages');
const Bookings = require('../../models/lbdashboard/bookings');

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
      // check if listing exists
      const listing = await Listings.findById(listingId);
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
      // check if listing exists
      const listing = await Listings.findById(listingId);
      if (!listing) {
        return res.status(400).json({ message: "Couldn't find listing for the given listingId" });
      }
      // validate date range
      const fromDate = new Date(rentingFrom);
      const tillDate = new Date(rentingTill);
      if (fromDate >= tillDate) {
        return res
          .status(400)
          .json({ message: 'Invalid date range: rentingFrom should be before rentingTill' });
      }
      // check for booking conflicts
      const conflictingBooking = await Bookings.findOne({
        listingId,
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
        listingId,
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
