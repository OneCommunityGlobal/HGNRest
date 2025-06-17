const mongoose = require('mongoose');
const Listing = require('../../models/lbdashboard/listings');

const listingAvailablityController = (Availability) => {
  const getListingAvailablity = async (req, res) => {
    try {
      const listingId = req.body.listingId;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header or body' });
      }
      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const createListingAvailability = async (req, res) => {
    try {
      const data = req.body;
      const listingId = data.listingId;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header or body' });
      }
      let availability = await Availability.findOne({ listingId });
      if (availability) {
        return res.status(409).json({ error: 'Availability already exists for this listing' });
      }
      availability = new Availability({ ...data, listingId });
      await availability.save();
      res.status(201).json({ status: 201, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const updateListingBooking = async (req, res) => {
    try {
      const { from, to, userId, listingId } = req.body;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header or body' });
      }
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Valid userId is required in body' });
      }
      if (!from || !to) {
        return res.status(400).json({ error: 'from and to dates are required' });
      }
      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      availability.bookedDates.push({
        from: new Date(from),
        to: new Date(to),
        bookingUserId: userId,
      });
      availability.lastUpdated = new Date();
      await availability.save();
      res.json({ status: 200, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const updateBookedDate = async (req, res) => {
    try {
      const { listingId, bookingId, bookingUserId, from, to } = req.body;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required' });
      }
      if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ error: 'Valid bookingId is required' });
      }
      if (!bookingUserId || !mongoose.Types.ObjectId.isValid(bookingUserId)) {
        return res.status(400).json({ error: 'Valid bookingUserId is required' });
      }
      if (!from || !to) {
        return res.status(400).json({ error: 'from and to dates are required' });
      }

      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }

      const bookedDate = availability.bookedDates.id(bookingId);
      if (!bookedDate) {
        return res.status(404).json({ error: 'Booked date not found' });
      }
      if (String(bookedDate.bookingUserId) !== String(bookingUserId)) {
        return res.status(403).json({ error: 'Not authorized to update this booking' });
      }

      bookedDate.from = new Date(from);
      bookedDate.to = new Date(to);
      availability.lastUpdated = new Date();
      await availability.save();

      res.json({ status: 200, message: 'Booked date updated', data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const deleteBookedDate = async (req, res) => {
    try {
      const { listingId, bookingId, bookingUserId } = req.body;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required' });
      }
      if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ error: 'Valid bookingId is required' });
      }
      if (!bookingUserId || !mongoose.Types.ObjectId.isValid(bookingUserId)) {
        return res.status(400).json({ error: 'Valid bookingUserId is required' });
      }

      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }

      const bookedDate = availability.bookedDates.id(bookingId);
      if (!bookedDate) {
        return res.status(404).json({ error: 'Booked date not found' });
      }
      if (String(bookedDate.bookingUserId) !== String(bookingUserId)) {
        return res.status(403).json({ error: 'Not authorized to delete this booking' });
      }

      bookedDate.remove();
      availability.lastUpdated = new Date();
      await availability.save();

      res.json({ status: 200, message: 'Booked date deleted', data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const updateListingBlockedDates = async (req, res) => {
    try {
      const { from, to, reason, userId, listingId } = req.body;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header or body' });
      }
      if (!from || !to) {
        return res.status(400).json({ error: 'from and to dates are required' });
      }
      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      const allowedUser = userId || req.headers['userid'];
      if (
        !allowedUser ||
        (
          allowedUser !== String(listing.createdBy) &&
          allowedUser !== String(listing.updatedBy)
        )
      ) {
        return res.status(403).json({ error: 'Not authorized to block dates for this listing' });
      }
      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      availability.blockedOutDates.push({
        from: new Date(from),
        to: new Date(to),
        reason: reason || '',
        blockedBy: allowedUser,
      });
      availability.lastUpdated = new Date();
      await availability.save();
      res.json({ status: 200, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const deleteListingAvailability = async (req, res) => {
    try {
      const {userId, listingId} = req.body;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header or body' });
      }
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Valid userId is required in header or body' });
      }
      const listing = await Listing.findById(listingId);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      if (
        userId !== String(listing.createdBy) &&
        userId !== String(listing.updatedBy)
      ) {
        return res.status(403).json({ error: 'Not authorized to delete availability for this listing' });
      }
      const deleted = await Availability.findOneAndDelete({ listingId });
      if (!deleted) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, message: 'Availability deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  return {
    getListingAvailablity,
    createListingAvailability,
    updateListingBooking,
    updateBookedDate,
    deleteBookedDate,
    updateListingBlockedDates,
    deleteListingAvailability,
  };
};

module.exports = listingAvailablityController;