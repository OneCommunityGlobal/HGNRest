const mongoose = require('mongoose');
const {fetchImagesFromAzureBlobStorage, saveImagestoAzureBlobStorage} = require('../../utilities/AzureBlobImages');
const userProfile = require('../../models/userProfile');
const Availability = require('../../models/lbdashboard/availability');

const listingsController = (ListingHome) => {
  const getListings = async (req, res) => {
    try {
      const { page = 1, size = 10 } = req.query;
      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;
      const total = await ListingHome.countDocuments();
      const totalPages = Math.ceil(total / sizeNum);

      if (pageNum > totalPages && totalPages > 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const listings = await ListingHome.find()
        .populate([
          {
            path: 'createdBy', select: '_id firstName lastName'
          },
          {
            path: 'updatedBy', select: '_id firstName lastName'
          }
        ]) 
        .sort({ updatedOn: -1 })
        .skip(skip)
        .limit(sizeNum)
        .lean()
        .exec();

      if (!listings.length) {
        return res.status(404).json({ error: 'No listings found' });
      }

      const processedListings = await Promise.all (listings.map( async listing => {
        const processed = { 
          ...listing,
          images: listing.images.length > 0 ? await fetchImagesFromAzureBlobStorage(listing.images) : [],
          createdOn: listing.createdOn ? listing.createdOn.toISOString().split('T')[0] : null,
          updatedOn: listing.updatedOn ? listing.updatedOn.toISOString().split('T')[0] : null,
        };
        return processed;
      }));

      const response = {
        status: 200,
        message: 'Listings retrieved successfully',
        data: {
          items: processedListings,
          pagination: {
            total,
            totalPages,
            currentPage: pageNum,
            pageSize: sizeNum
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };
  
  const createListing = async (req, res) => {
    try {
      const { 
        title, 
        description, 
        price, 
        perUnit, 
        createdBy,
        updatedBy, 
        availability, 
        amenities, 
        status 
      } = req.body;
      const images = req.files;

      const isComplete = status === 'complete';
      
      if (!(status === 'complete' || status === 'draft')) {
        return res.status(400).json({error: 'Invalid status'});
      }

      if (isComplete) {
        if (!title || !description || !price || !perUnit || !createdBy || !images || !availability || !amenities || !updatedBy) {
          return res.status(400).json({
            error: 'Missing required fields for complete listing',
            details: {
              title: !title ? 'Required' : null,
              description: !description ? 'Required' : null,
              price: !price ? 'Required' : null,
              perUnit: !perUnit ? 'Required' : null,
              createdBy: !createdBy ? 'Required' : null,
              images: !images ? 'Required' : null,
              availability: !availability ? 'Required' : null,
              anmenities: !amenities ? 'Required' : null
            }
          });
        }
      }
      else if (!isComplete) {
        if (!title || !price || !perUnit || !createdBy || !updatedBy) {
          return res.status(400).json({
            error: "Missing required fields to create a draft",
            details: {
              title: !title ? 'Required' : null,
              price: !price ? 'Required' : null,
              perUnit: !perUnit ? 'Required' : null,
              createdBy: !createdBy ? 'Required' : null,
              updatedBy: !updatedBy ? 'Required' : null
            }
          })
        }
      } 
  
      if (!mongoose.Types.ObjectId.isValid(createdBy) || !mongoose.Types.ObjectId.isValid(updatedBy)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      if (price) {
        const numPrice = parseFloat(price);
        if (Number.isNaN(numPrice) || numPrice < 0) {
          return res.status(400).json({ error: 'Price must be a valid positive number' });
        }
      }

      const listingData = {
        title,
        description,
        price: price ? parseFloat(price) : undefined,
        perUnit,
        createdBy,
        availability,
        status,
        updatedBy
      };
  
      if (images) {
        listingData.images = await saveImagestoAzureBlobStorage(images, title);
      };
      if (availability) listingData.availability = new Date(availability); // in MM/DD/YYYY format
      console.log('availability', availability);
      if (amenities) listingData.amenities = amenities;

      let savedListing;
      const {draftId} = req.body;

      let existingDraft;
      if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {

        if (await userProfile.findOne({ _id: updatedBy, role: { $in: ['Owner', 'Administrator', 'Manager'] }})) {
          existingDraft = await ListingHome.findOne({ 
            _id: draftId 
          });
        } else {
        existingDraft = await ListingHome.findOne({ 
          _id: draftId, 
          updatedBy
        });
      }
        if (!existingDraft) {
          return res.status(403).json({ error: 'Unauthorized: Draft not found or does not belong to user' });
        }
        console.log(listingData);
        // Update the existing draft
        savedListing = await ListingHome.findByIdAndUpdate(
          draftId,
          { $set: listingData },
          { new: true }
        );
      } else {
        const newListing = new ListingHome(listingData);
        savedListing = await newListing.save();
      }
  
      res.status(201).json({
        status: 201,
        message: `Listing ${status === 'draft' ? 'draft' : ''} created successfully`,
        data: {
          id: savedListing._id,
          title: savedListing.title,
          description: savedListing.description,
          price: savedListing.price,
          perUnit: savedListing.perUnit,
          createdBy: savedListing.createdBy,
          status: savedListing.status,
          images: savedListing.images,
          availability: savedListing.availability,
          amenities: savedListing.amenities
        }
      });
  
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  };

  const getAvailabilityForListing = async (req, res) => {
    try {
      const { listingId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Invalid listing ID' });
      }

      const availabilityForListing = await Availability.findOne({ listingId });

      if (!availabilityForListing) {
        return res.status(204).json({ error: 'Availability not found for this listing' });
      }

      res.status(200).json({
        status: 200,
        message: 'Availability retrieved successfully',
        data: availabilityForListing
      });

    } catch (error) {
      console.error('Error fetching availability:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };

  const updateListingAvailability = async (req, res) => {
    try {
      const { listingId } = req.params;
      const { updateType, from, to, reason, bookingId, reservationId } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Invalid listing ID' });
      }
      
      if (!updateType || !from || !to) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const fromDate = new Date(from);
      const toDate = new Date(to);
      
      if (Number.isNaN(fromDate) || Number.isNaN(toDate)) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      
      if (toDate < fromDate) {
        return res.status(400).json({ error: 'End date cannot be before start date' });
      }
      
      let availabilityRecord = await Availability.findOne({ listingId });
      
      if (!availabilityRecord) {
        // Create new availability record if one doesn't exist
        availabilityRecord = new Availability({
          listingId,
          bookedDates: [],
          pendingReservations: [],
          blockedOutDates: []
        });
      }
      
      switch(updateType) {
        case 'book':
          if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ error: 'Valid bookingId required for booking' });
          }
          availabilityRecord.bookedDates.push({
            from: fromDate,
            to: toDate,
            bookingId
          });
          break;
          
        case 'reserve':
          if (!reservationId || !mongoose.Types.ObjectId.isValid(reservationId)) {
            return res.status(400).json({ error: 'Valid reservationId required for reservation' });
          }
          availabilityRecord.pendingReservations.push({
            from: fromDate,
            to: toDate,
            reservationId
          });
          break;
          
        case 'block':
          availabilityRecord.blockedOutDates.push({
            from: fromDate,
            to: toDate,
            reason: reason || 'Blocked by owner'
          });
          break;
          
        default:
          return res.status(400).json({ error: 'Invalid update type' });
      }
      
      availabilityRecord.lastUpdated = new Date();
      const saved = await availabilityRecord.save();
      
      res.status(200).json({
        status: 200,
        message: 'Availability updated successfully',
        data: saved
      });
      
    } catch (error) {
      console.error('Error updating availability:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };

  const getBookingHistory = async (req, res) => {
    try {
      const { listingId } = req.params;
      const { type = 'all' } = req.query; // 'all', 'upcoming', or 'past'
      
      if (!mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Invalid listing ID' });
      }
      
      const availabilityRecord = await Availability.findOne({ listingId });
      
      if (!availabilityRecord) {
        return res.status(204).json({ message: 'No booking history found for this listing' });
      }
      
      const now = new Date();
      let bookedDates = [...availabilityRecord.bookedDates];
      
      if (type === 'upcoming') {
        bookedDates = bookedDates.filter(booking => new Date(booking.to) >= now);
      } else if (type === 'past') {
        bookedDates = bookedDates.filter(booking => new Date(booking.to) < now);
      }
      
      // Sort by date (upcoming first)
      bookedDates.sort((a, b) => new Date(a.from) - new Date(b.from));
      
      res.status(200).json({
        status: 200,
        message: 'Booking history retrieved successfully',
        data: {
          listingId,
          bookings: bookedDates
        }
      });
      
    } catch (error) {
      console.error('Error fetching booking history:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };

  const cancelReservation = async (req, res) => {
    try {
      const { listingId } = req.params;
      const { reservationId } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(listingId) || !mongoose.Types.ObjectId.isValid(reservationId)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const result = await Availability.updateOne(
        { listingId },
        { $pull: { pendingReservations: { reservationId } } }
      );
      
      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      
      res.status(200).json({
        status: 200,
        message: 'Reservation cancelled successfully'
      });
      
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };

  const confirmReservation = async (req, res) => {
    try {
      const { listingId } = req.params;
      const { reservationId, bookingId } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(listingId) || 
          !mongoose.Types.ObjectId.isValid(reservationId) || 
          !mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const availabilityRecord = await Availability.findOne({ 
        listingId,
        pendingReservations: { $elemMatch: { reservationId } }
      });
      
      if (!availabilityRecord) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      
      const reservation = availabilityRecord.pendingReservations.find(
        r => r.reservationId.toString() === reservationId
      );
      
      // Add to booked dates
      availabilityRecord.bookedDates.push({
        from: reservation.from,
        to: reservation.to,
        bookingId
      });
      
      // Remove from pending reservations
      availabilityRecord.pendingReservations = availabilityRecord.pendingReservations.filter(
        r => r.reservationId.toString() !== reservationId
      );
      
      availabilityRecord.lastUpdated = new Date();
      await availabilityRecord.save();
      
      res.status(200).json({
        status: 200,
        message: 'Reservation confirmed successfully',
        data: {
          booking: availabilityRecord.bookedDates[availabilityRecord.bookedDates.length - 1]
        }
      });
      
    } catch (error) {
      console.error('Error confirming reservation:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };

  return { 
    getListings, 
    createListing, 
    getAvailabilityForListing, 
    updateListingAvailability, 
    getBookingHistory,
    cancelReservation,
    confirmReservation
  };
};

module.exports = listingsController;